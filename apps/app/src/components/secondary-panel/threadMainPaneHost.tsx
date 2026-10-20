import { createContext, useContext, type ReactNode } from "react";

export interface ThreadMainPaneHost {
  contentElement: HTMLElement | null;
  isVisible: boolean;
  stripElement: HTMLElement | null;
}

export const ThreadMainPaneHostContext =
  createContext<ThreadMainPaneHost | null>(null);

export function useThreadMainPaneHost(): ThreadMainPaneHost | null {
  return useContext(ThreadMainPaneHostContext);
}

export const ThreadMainPaneStripSlotContext = createContext<
  ((element: HTMLElement | null) => void) | null
>(null);

export function ThreadMainPaneStripSlot() {
  const onStripElement = useContext(ThreadMainPaneStripSlotContext);
  if (onStripElement === null) return null;
  return (
    <div
      ref={onStripElement}
      data-thread-main-pane-strip=""
      className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden"
    />
  );
}

interface ThreadMainPaneFrameProps {
  children: ReactNode;
  onContentElement: (element: HTMLElement | null) => void;
}

export function ThreadMainPaneFrame({
  children,
  onContentElement,
}: ThreadMainPaneFrameProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
        <div
          ref={onContentElement}
          data-thread-main-pane-content=""
          className="pointer-events-none absolute inset-0 z-40 flex flex-col empty:hidden"
        />
      </div>
    </div>
  );
}
