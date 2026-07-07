"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  onDelete: () => void;
  /** Action text revealed behind the row, e.g. "Delete" or "Remove". */
  label?: string;
  children: React.ReactNode;
}

const THRESHOLD = 90; // px of rightward travel to trigger

/**
 * Swipe-right-to-delete wrapper. Works with touch and mouse via pointer
 * events; vertical drags are handed back to the scroller (touch-action:
 * pan-y + an axis check before capturing).
 */
export default function SwipeToDelete({ onDelete, label = "Remove", children }: Props) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const dxRef = useRef(0);
  const gesture = useRef<{ x: number; y: number; active: boolean; captured: boolean } | null>(
    null
  );
  const suppressClick = useRef(false);

  function move(value: number) {
    dxRef.current = value;
    setDx(value);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (leaving) return;
    gesture.current = { x: e.clientX, y: e.clientY, active: true, captured: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g?.active) return;
    const dxNow = e.clientX - g.x;
    const dyNow = e.clientY - g.y;
    if (!g.captured) {
      if (Math.abs(dxNow) < 8) return;
      // more vertical than horizontal — it's a scroll, let it go
      if (Math.abs(dxNow) < Math.abs(dyNow)) {
        g.active = false;
        return;
      }
      g.captured = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    move(Math.max(0, dxNow)); // right-swipe only
  }

  function onPointerEnd() {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.captured) return;
    suppressClick.current = true; // a swipe is not a tap
    if (dxRef.current >= THRESHOLD) {
      setLeaving(true);
      setTimeout(onDelete, 220);
    } else {
      move(0);
    }
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl transition-[max-height,opacity] duration-300 ${
        leaving ? "max-h-0 opacity-0" : "max-h-40"
      }`}
    >
      {/* revealed behind the row while swiping */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center gap-2 rounded-2xl bg-danger/15 pl-5 text-danger transition-opacity"
        style={{ opacity: dx > 8 || leaving ? 1 : 0 }}
      >
        <Trash2 className="size-4" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        style={{
          transform: leaving ? "translateX(110%)" : `translateX(${dx}px)`,
          transition: dx === 0 || leaving ? "transform 0.25s ease" : "none",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
