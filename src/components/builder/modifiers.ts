import type { Modifier } from "@dnd-kit/core";

/** Keep drags vertical and inside the list (avoids pulling in @dnd-kit/modifiers). */
export const restrictToVerticalAxisAndParent: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  const next = { ...transform, x: 0 };
  if (!draggingNodeRect || !containerNodeRect) return next;
  const minY = containerNodeRect.top - draggingNodeRect.top;
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom;
  return { ...next, y: Math.min(Math.max(next.y, minY), maxY) };
};
