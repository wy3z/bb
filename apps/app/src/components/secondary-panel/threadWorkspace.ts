import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { z } from "zod";
import type { ThreadListEntry } from "@bb/domain";
import { createLocalStorageSyncStorage } from "@/lib/browser-storage";
import { useSidebarNavigationThreadSelection } from "@/hooks/queries/sidebar-navigation-query";

const WORKSPACE_LINKS_STORAGE_KEY = "bb.thread.workspaceLinks-1";

export interface WorkspaceThreadCandidate {
  id: string;
  createdAt: number;
  environmentId: string | null;
  environmentIsWorktree: boolean;
  parentThreadId: string | null;
}

export type WorkspaceLinks = Readonly<Record<string, string>>;

const EMPTY_LINKS: WorkspaceLinks = {};

export function workspaceAnchorThreadId(
  threadId: string,
  links: WorkspaceLinks,
): string {
  return links[threadId] ?? threadId;
}

export function resolveWorkspaceThreadIds(
  threadId: string,
  threads: readonly WorkspaceThreadCandidate[],
  links: WorkspaceLinks,
): string[] {
  const current = threads.find((thread) => thread.id === threadId);
  if (current === undefined) return [threadId];
  const isMember = (thread: WorkspaceThreadCandidate): boolean => {
    if (thread.id === threadId) return true;
    if (thread.parentThreadId !== null) return false;
    if (
      current.environmentIsWorktree &&
      current.environmentId !== null &&
      thread.environmentId === current.environmentId
    ) {
      return true;
    }
    const anchor = workspaceAnchorThreadId(threadId, links);
    return (
      thread.id === anchor ||
      workspaceAnchorThreadId(thread.id, links) === anchor
    );
  };
  return threads
    .filter(isMember)
    .sort((first, second) => first.createdAt - second.createdAt)
    .map((thread) => thread.id);
}

export function linkThreadToWorkspace(
  links: WorkspaceLinks,
  threadId: string,
  workspaceThreadId: string,
): WorkspaceLinks {
  const anchor = workspaceAnchorThreadId(workspaceThreadId, links);
  if (anchor === threadId || links[threadId] === anchor) return links;
  return { ...links, [threadId]: anchor };
}

const workspaceLinksSchema = z.record(z.string().min(1), z.string().min(1));

const workspaceLinksAtom = atomWithStorage<WorkspaceLinks>(
  WORKSPACE_LINKS_STORAGE_KEY,
  EMPTY_LINKS,
  createLocalStorageSyncStorage<WorkspaceLinks>({
    parse: (storedValue, initialValue) => {
      if (storedValue === null) return initialValue;
      try {
        const result = workspaceLinksSchema.safeParse(JSON.parse(storedValue));
        return result.success ? result.data : initialValue;
      } catch {
        return initialValue;
      }
    },
    serialize: (value) => JSON.stringify(value),
  }),
  { getOnInit: true },
);

export function useLinkThreadToWorkspace(): (
  threadId: string,
  workspaceThreadId: string,
) => void {
  const setLinks = useSetAtom(workspaceLinksAtom);
  return useCallback(
    (threadId, workspaceThreadId) =>
      setLinks((links) =>
        linkThreadToWorkspace(links, threadId, workspaceThreadId),
      ),
    [setLinks],
  );
}

function toCandidate(entry: ThreadListEntry): WorkspaceThreadCandidate {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    environmentId: entry.environmentId,
    environmentIsWorktree: entry.environmentIsWorktree === true,
    parentThreadId: entry.parentThreadId,
  };
}

function selectActiveThreads(threads: ThreadListEntry[]): ThreadListEntry[] {
  return threads.filter((thread) => thread.archivedAt === null);
}

export function useThreadWorkspaceThreads(
  threadId: string | null | undefined,
): readonly ThreadListEntry[] {
  const links = useAtomValue(workspaceLinksAtom);
  const { data: threads } =
    useSidebarNavigationThreadSelection(selectActiveThreads);
  if (threadId === null || threadId === undefined || threads === undefined) {
    return [];
  }
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  return resolveWorkspaceThreadIds(threadId, threads.map(toCandidate), links)
    .map((id) => byId.get(id))
    .filter((thread): thread is ThreadListEntry => thread !== undefined);
}
