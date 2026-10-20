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

interface ThreadMainPaneFrameProps {
  children: ReactNode;
  onContentElement: (element: HTMLElement | null) => void;
  onStripElement: (element: HTMLElement | null) => void;
}

export function ThreadMainPaneFrame({
  children,
  onContentElement,
  onStripElement,
}: ThreadMainPaneFrameProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={onStripElement}
        data-thread-main-pane-strip=""
        className="flex shrink-0 flex-col empty:hidden"
      />
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
