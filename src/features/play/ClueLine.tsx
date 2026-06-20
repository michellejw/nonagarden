"use client";

import type { Clue } from "@/lib/nonogram";
import type { LineState } from "@/lib/nonogram";

interface ClueLineProps {
  items: Clue;
  state: LineState;
  orientation: "row" | "column";
  label: string;
}

const COLOR: Record<LineState, string> = {
  normal: "var(--text-strong, var(--shroom-text))",
  satisfied: "var(--shroom-text-soft)",
  impossible: "var(--mushroom-cap)",
};

export function ClueLine({ items, state, orientation, label }: ClueLineProps) {
  const isEmpty = items.length === 1 && items[0] === 0;
  return (
    <div
      aria-label={label}
      data-state={state}
      className={
        orientation === "row"
          ? "clue-line flex w-full items-center justify-end gap-[7px] pr-[9px]"
          : "clue-line flex h-full flex-col items-center justify-end gap-[2px]"
      }
    >
      {isEmpty
        ? null
        : items.map((n, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="font-mono text-[14px] font-semibold leading-none"
              style={{
                color: COLOR[state],
                opacity: state === "satisfied" ? 0.4 : 1,
                // non-color cue for the impossible state
                textDecoration: state === "impossible" ? "underline" : "none",
                textUnderlineOffset: "3px",
              }}
            >
              {n}
            </span>
          ))}
    </div>
  );
}
