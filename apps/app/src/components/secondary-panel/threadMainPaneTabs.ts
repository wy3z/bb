import { useCallback } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { atomFamily } from "jotai-family";
import { z } from "zod";
import { arrayMove } from "@bb/client-core";
import { createLocalStorageSyncStorage } from "@/lib/browser-storage";
import { hasThreadId } from "@/lib/thread-id";

const THREAD_MAIN_PANE_TABS_STORAGE_PREFIX = "bb.thread.mainPaneTabs";
const THREAD_MAIN_PANE_TABS_STORAGE_VERSION = 1;

export type PanelTabPlacement = "main" | "panel";

export const MAIN_PANE_NEW_AGENT_TAB_ID = "main-pane:new-agent";

const MAIN_PANE_AGENT_TAB_PREFIX = "main-pane:agent:";

export function getMainPaneAgentTabId(threadId: string): string {
  return `${MAIN_PANE_AGENT_TAB_PREFIX}${threadId}`;
}

export function isMainPaneAgentTabId(tabId: string): boolean {
  return tabId.startsWith(MAIN_PANE_AGENT_TAB_PREFIX);
}

export function getMainPaneAgentThreadId(
  tabId: string | null | undefined,
): string | null {
  if (tabId === null || tabId === undefined) return null;
  if (!isMainPaneAgentTabId(tabId)) return null;
  const threadId = tabId.slice(MAIN_PANE_AGENT_TAB_PREFIX.length);
  return threadId.length === 0 ? null : threadId;
}

export interface ThreadMainPaneTabsState {
  tabIds: readonly string[];
  activeTabId: string | null;
}

export const EMPTY_THREAD_MAIN_PANE_TABS: ThreadMainPaneTabsState = {
  tabIds: [],
  activeTabId: null,
};

const mainPaneTabsSchema = z
  .object({
    tabIds: z.array(z.string().min(1)),
    activeTabId: z.string().min(1).nullable(),
  })
  .strict();

function normalizeMainPaneTabs(
  state: ThreadMainPaneTabsState,
): ThreadMainPaneTabsState {
  const tabIds = [...new Set(state.tabIds)];
  const activeTabId =
    state.activeTabId !== null &&
    (tabIds.includes(state.activeTabId) ||
      isMainPaneAgentTabId(state.activeTabId))
      ? state.activeTabId
      : null;
  return tabIds.length === 0 && activeTabId === null
    ? EMPTY_THREAD_MAIN_PANE_TABS
    : { tabIds, activeTabId };
}

function areMainPaneTabsEqual(
  first: ThreadMainPaneTabsState,
  second: ThreadMainPaneTabsState,
): boolean {
  return (
    first.activeTabId === second.activeTabId &&
    first.tabIds.length === second.tabIds.length &&
    first.tabIds.every((tabId, index) => tabId === second.tabIds[index])
  );
}

function preserveIdentity(
  current: ThreadMainPaneTabsState,
  next: ThreadMainPaneTabsState,
): ThreadMainPaneTabsState {
  return areMainPaneTabsEqual(current, next) ? current : next;
}

export function moveTabToMainPane(
  state: ThreadMainPaneTabsState,
  tabId: string,
): ThreadMainPaneTabsState {
  const tabIds = state.tabIds.includes(tabId)
    ? state.tabIds
    : [...state.tabIds, tabId];
  return preserveIdentity(state, { tabIds, activeTabId: tabId });
}

export function adoptTabsIntoMainPane(
  state: ThreadMainPaneTabsState,
  tabIds: readonly string[],
): ThreadMainPaneTabsState {
  const missing = tabIds.filter((tabId) => !state.tabIds.includes(tabId));
  if (missing.length === 0) return state;
  return { ...state, tabIds: [...state.tabIds, ...missing] };
}

export function moveTabToRightPanel(
  state: ThreadMainPaneTabsState,
  tabId: string,
): ThreadMainPaneTabsState {
  const index = state.tabIds.indexOf(tabId);
  if (index < 0) return state;
  const tabIds = state.tabIds.filter((candidate) => candidate !== tabId);
  const activeTabId =
    state.activeTabId === tabId
      ? (tabIds[index - 1] ?? tabIds[index] ?? null)
      : state.activeTabId;
  return normalizeMainPaneTabs({ tabIds, activeTabId });
}

export function replaceMainPaneTab(
  state: ThreadMainPaneTabsState,
  previousTabId: string,
  nextTabId: string,
): ThreadMainPaneTabsState {
  if (previousTabId === nextTabId || !state.tabIds.includes(previousTabId)) {
    return state;
  }
  const tabIds = state.tabIds
    .filter((tabId) => tabId !== nextTabId)
    .map((tabId) => (tabId === previousTabId ? nextTabId : tabId));
  const activeTabId =
    state.activeTabId === previousTabId ? nextTabId : state.activeTabId;
  return normalizeMainPaneTabs({ tabIds, activeTabId });
}

export function selectMainPaneTab(
  state: ThreadMainPaneTabsState,
  tabId: string | null,
): ThreadMainPaneTabsState {
  if (
    tabId !== null &&
    !state.tabIds.includes(tabId) &&
    !isMainPaneAgentTabId(tabId)
  ) {
    return state;
  }
  return state.activeTabId === tabId ? state : { ...state, activeTabId: tabId };
}

export function selectMainPaneAgentTab(
  state: ThreadMainPaneTabsState,
  threadId: string | null,
): ThreadMainPaneTabsState {
  return selectMainPaneTab(
    state,
    threadId === null ? null : getMainPaneAgentTabId(threadId),
  );
}

export function reorderMainPaneTab(
  state: ThreadMainPaneTabsState,
  activeTabId: string,
  overTabId: string,
): ThreadMainPaneTabsState {
  const from = state.tabIds.indexOf(activeTabId);
  const to = state.tabIds.indexOf(overTabId);
  if (from < 0 || to < 0 || from === to) return state;
  return { ...state, tabIds: arrayMove([...state.tabIds], from, to) };
}

export function reconcileMainPaneTabs(
  state: ThreadMainPaneTabsState,
  availableTabIds: readonly string[],
): ThreadMainPaneTabsState {
  const available = new Set([...availableTabIds, MAIN_PANE_NEW_AGENT_TAB_ID]);
  const isAvailable = (tabId: string) =>
    available.has(tabId) || isMainPaneAgentTabId(tabId);
  const tabIds = state.tabIds.filter(isAvailable);
  if (tabIds.length === state.tabIds.length) return state;
  const removedIndex = state.tabIds.findIndex((tabId) => !isAvailable(tabId));
  const activeTabId =
    state.activeTabId !== null && !isAvailable(state.activeTabId)
      ? (tabIds[Math.max(0, removedIndex - 1)] ?? null)
      : state.activeTabId;
  return normalizeMainPaneTabs({ tabIds, activeTabId });
}

const mainPaneTabsStorage =
  createLocalStorageSyncStorage<ThreadMainPaneTabsState>({
    parse: (storedValue, initialValue) => {
      if (storedValue === null) return initialValue;
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(storedValue);
      } catch {
        return initialValue;
      }
      const result = mainPaneTabsSchema.safeParse(parsedValue);
      return result.success ? normalizeMainPaneTabs(result.data) : initialValue;
    },
    serialize: (value) => JSON.stringify(value),
  });

export function getThreadMainPaneTabsStorageKey(threadId: string): string {
  return `${THREAD_MAIN_PANE_TABS_STORAGE_PREFIX}-${encodeURIComponent(
    threadId,
  )}-${THREAD_MAIN_PANE_TABS_STORAGE_VERSION}`;
}

const threadMainPaneTabsAtomFamily = atomFamily((threadId: string) =>
  atomWithStorage<ThreadMainPaneTabsState>(
    getThreadMainPaneTabsStorageKey(threadId),
    EMPTY_THREAD_MAIN_PANE_TABS,
    mainPaneTabsStorage,
    { getOnInit: true },
  ),
);

const disabledThreadMainPaneTabsAtom = atom<ThreadMainPaneTabsState>(
  EMPTY_THREAD_MAIN_PANE_TABS,
);

export function getThreadMainPaneTabsAtom(threadId: string | null | undefined) {
  return hasThreadId(threadId)
    ? threadMainPaneTabsAtomFamily(threadId)
    : disabledThreadMainPaneTabsAtom;
}

export function useThreadMainPaneTabs(
  threadId: string | null | undefined,
): ThreadMainPaneTabsState {
  return useAtomValue(getThreadMainPaneTabsAtom(threadId));
}

export function useUpdateThreadMainPaneTabs(
  threadId: string | null | undefined,
): (
  update: (state: ThreadMainPaneTabsState) => ThreadMainPaneTabsState,
) => void {
  const setState = useSetAtom(getThreadMainPaneTabsAtom(threadId));
  return useCallback(
    (update) => {
      if (!hasThreadId(threadId)) return;
      setState((current) => preserveIdentity(current, update(current)));
    },
    [setState, threadId],
  );
}
