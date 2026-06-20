"use client";

import { memo } from "react";
import type { Cell } from "@/lib/nonogram";

export function cellLabel(r: number, c: number, value: Cell): string {
  const state = value === 1 ? "filled" : value === 2 ? "marked" : "empty";
  return `Row ${r + 1}, column ${c + 1}, ${state}`;
}

const FILLED: React.CSSProperties = {
  background: "var(--shroom-accent)",
  boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.20)",
};
const REVEALED: React.CSSProperties = {
  background: "var(--tile-revealed)",
  boxShadow: "inset 0 0 0 1px var(--tile-revealed-edge)",
};

interface CellButtonProps {
  r: number;
  c: number;
  value: Cell;
  px: number;
  tabbable: boolean;
  onPointerDown: (e: React.PointerEvent, r: number, c: number) => void;
  onPointerEnter: (r: number, c: number) => void;
  registerRef: (r: number, c: number, el: HTMLButtonElement | null) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export const CellButton = memo(function CellButton(props: CellButtonProps) {
  const { r, c, value, px, tabbable, onPointerDown, onPointerEnter, registerRef, onKeyDown } = props;
  const skin = value === 1 ? FILLED : REVEALED;
  return (
    <button
      type="button"
      role="gridcell"
      aria-label={cellLabel(r, c, value)}
      tabIndex={tabbable ? 0 : -1}
      ref={(el) => registerRef(r, c, el)}
      onPointerDown={(e) => onPointerDown(e, r, c)}
      onPointerEnter={() => onPointerEnter(r, c)}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className="rounded-[9px] flex items-center justify-center select-none font-mono font-semibold text-on-accent transition-transform duration-75 ease-out active:scale-[0.86]"
      style={{
        width: px,
        height: px,
        fontSize: Math.round(px * 0.5),
        color: value === 2 ? "var(--shroom-text-soft)" : "transparent",
        ...skin,
      }}
    >
      {value === 2 ? "×" : ""}
    </button>
  );
});
