"use client";

import { useCallback, useRef, useState } from "react";

export type ReorderState = {
  /** Key of the row being dragged, or null. */
  activeKey: string | null;
  /** Pixels the dragged row has moved. */
  offsetY: number;
  /** Index it would land on if released now. */
  targetIndex: number;
  fromIndex: number;
};

const IDLE: ReorderState = { activeKey: null, offsetY: 0, targetIndex: -1, fromIndex: -1 };

/**
 * Drag-to-reorder for a uniform vertical list.
 *
 * Pointer events rather than HTML5 drag-and-drop, because HTML5 drag does not
 * exist on touch — and rather than a gesture library, because this is the only
 * gesture in the app and it is forty lines. The row height is measured from
 * the element being dragged, so it stays correct if the row design changes.
 *
 * The list is never mutated locally: the drag reports a target index and the
 * server's next queue broadcast is what actually moves anything. That keeps
 * one ordering authority, so two people dragging at once converge instead of
 * fighting.
 */
export function useReorder(onDrop: (key: string, toIndex: number) => void) {
  const [state, setState] = useState<ReorderState>(IDLE);
  const drag = useRef({ startY: 0, rowH: 56, count: 0, from: 0, key: "", moved: false });

  const start = useCallback(
    (e: React.PointerEvent, key: string, index: number, count: number) => {
      // Left button / touch / pen only — a right-click shouldn't start a drag.
      if (e.button !== 0) return;
      const row = (e.currentTarget as HTMLElement).closest("li");
      const rowH = row?.getBoundingClientRect().height || 56;
      drag.current = { startY: e.clientY, rowH, count, from: index, key, moved: false };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setState({ activeKey: key, offsetY: 0, targetIndex: index, fromIndex: index });
      e.preventDefault();
    },
    []
  );

  const move = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.key) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 3) d.moved = true;
    const shift = Math.round(dy / d.rowH);
    const target = Math.max(0, Math.min(d.count - 1, d.from + shift));
    setState({ activeKey: d.key, offsetY: dy, targetIndex: target, fromIndex: d.from });
  }, []);

  const end = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d.key) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone — nothing to release */
      }
      setState((s) => {
        if (d.moved && s.targetIndex >= 0 && s.targetIndex !== d.from) {
          onDrop(d.key, s.targetIndex);
        }
        return IDLE;
      });
      drag.current = { ...d, key: "" };
    },
    [onDrop]
  );

  /**
   * How far a row at `index` should shift to make room for the drag. The
   * dragged row follows the pointer; everything between its origin and its
   * target slides one place the other way.
   */
  const shiftFor = useCallback(
    (index: number, rowHeight = drag.current.rowH) => {
      const { activeKey, fromIndex, targetIndex } = state;
      if (!activeKey || index === fromIndex) return 0;
      if (fromIndex < targetIndex && index > fromIndex && index <= targetIndex) return -rowHeight;
      if (fromIndex > targetIndex && index < fromIndex && index >= targetIndex) return rowHeight;
      return 0;
    },
    [state]
  );

  return { state, start, move, end, shiftFor };
}
