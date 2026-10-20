import { useCallback, useState } from "react";
import { useStore } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import {
  closeSecondaryPanelTabInState,
  createNewTabFixedPanelTab,
  createTerminalFixedPanelTab,
  setSecondaryPanelTabsInState,
} from "@bb/client-core";
import type {
  TerminalCreateTarget,
  TerminalSession,
} from "@bb/server-contract";
import { useAppCommandHandler } from "@/components/commands/AppCommandProvider";
import {
  DEFAULT_TERMINAL_COLS,
  DEFAULT_TERMINAL_ROWS,
} from "@/components/thread/terminal/useThreadTerminalController";
import { applyTerminalSessionUpsert } from "@/hooks/cache-owners/terminal-cache-owner";
import {
  useCloseTerminal,
  useCreateTerminal,
} from "@/hooks/queries/thread-terminal-queries";
import {
  upsertTerminalTab,
  useRemoveFixedRightTerminalTab,
  useSetFixedRightTerminalActiveTerminal,
  useUpdateFixedPanelTabsState,
} from "@/lib/fixed-panel-tabs";
import {
  getThreadMainPaneTabsAtom,
  moveTabToMainPane,
  type PanelTabPlacement,
} from "./threadMainPaneTabs";
import { isVisibleTerminalSession } from "@/lib/terminal-session-visibility";

interface UsePanelTerminalsArgs {
  panelStateId: string | null | undefined;
  syncThreadId: string | null | undefined;
  createTarget: TerminalCreateTarget | null;
  isFocused: boolean;
  acceptsSession: (session: TerminalSession) => boolean;
  tabsCarryTarget: boolean;
  reveal: () => void;
  onCloseLastTab?: () => void;
}

export interface PanelTerminals {
  autoFocusTerminalId: string | null;
  canStart: boolean;
  close: (terminalId: string) => void;
  handleAutoFocusHandled: () => void;
  isStarting: boolean;
  open: (session: TerminalSession) => boolean;
  select: (terminalId: string, target?: TerminalCreateTarget) => void;
  start: (options?: { placement?: PanelTabPlacement }) => void;
}

export function terminalTargetForSession(
  session: TerminalSession,
): TerminalCreateTarget {
  if (session.threadId !== null) {
    return { kind: "thread", threadId: session.threadId };
  }
  if (session.environmentId !== null) {
    return { kind: "environment", environmentId: session.environmentId };
  }
  return { kind: "host_path", hostId: session.hostId, cwd: session.initialCwd };
}

export function usePanelTerminals({
  panelStateId,
  syncThreadId,
  createTarget,
  isFocused,
  acceptsSession,
  tabsCarryTarget,
  reveal,
  onCloseLastTab,
}: UsePanelTerminalsArgs): PanelTerminals {
  const [autoFocusTerminalId, setAutoFocusTerminalId] = useState<string | null>(
    null,
  );
  const queryClient = useQueryClient();
  const store = useStore();
  const createTerminal = useCreateTerminal();
  const { mutateAsync: closeTerminal } = useCloseTerminal();
  const updatePanelState = useUpdateFixedPanelTabsState(
    panelStateId,
    syncThreadId,
  );
  const setActiveTerminal = useSetFixedRightTerminalActiveTerminal(
    panelStateId,
    syncThreadId,
  );
  const removeTerminalTab = useRemoveFixedRightTerminalTab(
    panelStateId,
    syncThreadId,
    onCloseLastTab,
  );

  const select = useCallback(
    (terminalId: string, target?: TerminalCreateTarget) => {
      setAutoFocusTerminalId(terminalId);
      setActiveTerminal(terminalId, target);
      reveal();
    },
    [reveal, setActiveTerminal],
  );

  const open = useCallback(
    (session: TerminalSession) => {
      if (!isVisibleTerminalSession(session) || !acceptsSession(session)) {
        return false;
      }
      applyTerminalSessionUpsert({ queryClient, session });
      select(
        session.id,
        tabsCarryTarget ? terminalTargetForSession(session) : undefined,
      );
      return true;
    },
    [acceptsSession, queryClient, select, tabsCarryTarget],
  );

  const isStarting = createTerminal.isPending;
  const canStart = createTarget !== null && !isStarting;
  const start = useCallback(
    (options?: { placement?: PanelTabPlacement }) => {
      if (createTarget === null || createTerminal.isPending) return;
      void createTerminal
        .mutateAsync({
          cols: DEFAULT_TERMINAL_COLS,
          rows: DEFAULT_TERMINAL_ROWS,
          target: createTarget,
        })
        .then((session) => {
          const target = tabsCarryTarget ? createTarget : undefined;
          updatePanelState((state) =>
            closeSecondaryPanelTabInState(
              state,
              createNewTabFixedPanelTab().id,
            ),
          );
          if (options?.placement !== "main") {
            select(session.id, target);
            return;
          }
          setAutoFocusTerminalId(session.id);
          updatePanelState((state) =>
            setSecondaryPanelTabsInState({
              state,
              tabs: upsertTerminalTab(state.secondary.tabs, session.id, target),
              activeTabId: state.secondary.activeTabId,
              isOpen: state.secondary.isOpen,
            }),
          );
          store.set(getThreadMainPaneTabsAtom(panelStateId), (current) =>
            moveTabToMainPane(
              current,
              createTerminalFixedPanelTab({ terminalId: session.id, target })
                .id,
            ),
          );
        })
        .catch(() => undefined);
    },
    [
      createTarget,
      createTerminal,
      panelStateId,
      select,
      store,
      tabsCarryTarget,
      updatePanelState,
    ],
  );

  useAppCommandHandler("terminal.open", () => {
    if (!isFocused || !canStart) return false;
    start();
    return true;
  });

  const close = useCallback(
    (terminalId: string) => {
      void closeTerminal({ mode: "force", terminalId })
        .then(() => removeTerminalTab(terminalId))
        .catch(() => undefined);
    },
    [closeTerminal, removeTerminalTab],
  );

  const handleAutoFocusHandled = useCallback(
    () => setAutoFocusTerminalId(null),
    [],
  );

  return {
    autoFocusTerminalId,
    canStart,
    close,
    handleAutoFocusHandled,
    isStarting,
    open,
    select,
    start,
  };
}
