import type { PointerEvent as ReactPointerEvent } from "react";

const PANE_TAB_MOVE_DISTANCE_PX = 6;

export function isPointInElement(
  element: HTMLElement | null,
  clientX: number,
  clientY: number,
): boolean {
  if (element === null) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export interface PaneTabMoveDragArgs {
  event: ReactPointerEvent<HTMLElement>;
  isOverTarget: (clientX: number, clientY: number) => boolean;
  onDrop: () => void;
}

export function beginPaneTabMoveDrag({
  event,
  isOverTarget,
  onDrop,
}: PaneTabMoveDragArgs): void {
  if (event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  let engaged = false;

  const hasMoved = (clientX: number, clientY: number): boolean =>
    Math.hypot(clientX - startX, clientY - startY) > PANE_TAB_MOVE_DISTANCE_PX;

  function teardown(): void {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleCancel);
    window.removeEventListener("keydown", handleKeyDown, true);
  }

  function handleMove(moveEvent: PointerEvent): void {
    if (engaged) return;
    engaged = hasMoved(moveEvent.clientX, moveEvent.clientY);
  }

  function handleUp(upEvent: PointerEvent): void {
    teardown();
    if (!engaged && !hasMoved(upEvent.clientX, upEvent.clientY)) return;
    if (!isOverTarget(upEvent.clientX, upEvent.clientY)) return;
    onDrop();
  }

  function handleCancel(): void {
    teardown();
  }

  function handleKeyDown(keyEvent: KeyboardEvent): void {
    if (keyEvent.key === "Escape") teardown();
  }

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleCancel);
  window.addEventListener("keydown", handleKeyDown, true);
}
