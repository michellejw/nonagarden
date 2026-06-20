"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cell, Clue, LineState } from "@/lib/nonogram";
import { CellButton } from "./Cell";
import { ClueLine } from "./ClueLine";

interface BoardProps {
  size: number;
  cells: Cell[][];
  rowClues: Clue[];
  colClues: Clue[];
  rowState: LineState[];
  colState: LineState[];
  primaryValueAt: (r: number, c: number) => Cell;
  markValueAt: (r: number, c: number) => Cell;
  paint: (r: number, c: number, value: Cell) => void;
}

const GAP = 5;

export function Board(props: BoardProps) {
  const {
    size,
    cells,
    rowClues,
    colClues,
    rowState,
    colState,
    primaryValueAt,
    markValueAt,
    paint,
  } = props;

  const px = size <= 5 ? 46 : 34;
  const maxRow = Math.max(1, ...rowClues.map((c) => c.length));
  const maxCol = Math.max(1, ...colClues.map((c) => c.length));
  const gutterW = Math.max(62, maxRow * 18 + 16);
  const bandH = Math.max(62, maxCol * 19 + 12);

  const dragValue = useRef<Cell | null>(null);
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const refs = useRef<(HTMLButtonElement | null)[][]>([]);

  const registerRef = useCallback((r: number, c: number, el: HTMLButtonElement | null) => {
    if (!refs.current[r]) refs.current[r] = [];
    refs.current[r][c] = el;
  }, []);

  useEffect(() => {
    const up = () => (dragValue.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, r: number, c: number) => {
      e.preventDefault();
      const value = e.button === 2 ? markValueAt(r, c) : primaryValueAt(r, c);
      dragValue.current = value;
      paint(r, c, value);
    },
    [markValueAt, primaryValueAt, paint],
  );

  const onPointerEnter = useCallback(
    (r: number, c: number) => {
      if (dragValue.current != null) paint(r, c, dragValue.current);
    },
    [paint],
  );

  const moveFocus = useCallback(
    (r: number, c: number) => {
      const nr = Math.max(0, Math.min(size - 1, r));
      const nc = Math.max(0, Math.min(size - 1, c));
      setFocus({ r: nr, c: nc });
      refs.current[nr]?.[nc]?.focus();
    },
    [size],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, r: number, c: number) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          moveFocus(r, c + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveFocus(r, c - 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocus(r - 1, c);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveFocus(r + 1, c);
          break;
        case "Home":
          e.preventDefault();
          moveFocus(r, 0);
          break;
        case "End":
          e.preventDefault();
          moveFocus(r, size - 1);
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          paint(r, c, primaryValueAt(r, c));
          break;
        case "x":
        case "X":
          e.preventDefault();
          paint(r, c, markValueAt(r, c));
          break;
      }
    },
    [moveFocus, paint, primaryValueAt, markValueAt, size],
  );

  const cluesLabel = (kind: "Row" | "Column", i: number, clue: Clue) =>
    `${kind} ${i + 1} clues: ${clue[0] === 0 && clue.length === 1 ? "none" : clue.join(", ")}`;

  return (
    <div className="flex flex-col items-start">
      {/* top clue band */}
      <div className="flex">
        <div style={{ width: gutterW, flex: "none" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${size}, ${px}px)`,
            gap: GAP,
            paddingLeft: 9,
            height: bandH,
            alignItems: "end",
          }}
        >
          {colClues.map((clue, c) => (
            <ClueLine
              key={c}
              items={clue}
              state={colState[c]}
              orientation="column"
              label={cluesLabel("Column", c, clue)}
            />
          ))}
        </div>
      </div>

      {/* left gutter + cell grid */}
      <div className="flex">
        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${size}, ${px}px)`,
            gap: GAP,
            width: gutterW,
            paddingTop: 9,
          }}
        >
          {rowClues.map((clue, r) => (
            <ClueLine
              key={r}
              items={clue}
              state={rowState[r]}
              orientation="row"
              label={cluesLabel("Row", r, clue)}
            />
          ))}
        </div>

        <div
          role="grid"
          aria-label={`Nonogram puzzle, ${size} by ${size}`}
          className="rounded-2xl bg-board"
          style={{ padding: 9 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {cells.map((row, r) => (
            <div
              role="row"
              key={r}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${size}, ${px}px)`,
                gap: GAP,
                marginBottom: r < size - 1 ? GAP : 0,
              }}
            >
              {row.map((value, c) => (
                <CellButton
                  key={c}
                  r={r}
                  c={c}
                  value={value}
                  px={px}
                  tabbable={focus.r === r && focus.c === c}
                  onPointerDown={onPointerDown}
                  onPointerEnter={onPointerEnter}
                  registerRef={registerRef}
                  onKeyDown={(e) => onKeyDown(e, r, c)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
