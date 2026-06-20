import { tokens } from "@shroomgames/tokens";
import { ThemeToggle } from "@/components/ThemeToggle";

/* Design-system smoke test. Not the game — this exists to prove @shroomgames/tokens
   flows through three ways: Tailwind utilities (bg-app, text-ink…), raw CSS vars
   (--num-*), and the typed JS token object (imported above). Delete once the real
   screens land. */

const surfaces: { label: string; cls: string }[] = [
  { label: "app", cls: "bg-app" },
  { label: "board", cls: "bg-board" },
  { label: "card", cls: "bg-card" },
  { label: "pill", cls: "bg-pill" },
  { label: "accent", cls: "bg-accent" },
];

const radii: { label: string; cls: string }[] = [
  { label: "sm 10", cls: "rounded-sm" },
  { label: "md 12", cls: "rounded-md" },
  { label: "lg 14", cls: "rounded-lg" },
  { label: "xl 16", cls: "rounded-xl" },
  { label: "2xl 18", cls: "rounded-2xl" },
  { label: "pill 22", cls: "rounded-pill" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-10 px-6 py-16">
      <header className="flex w-full max-w-2xl items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
            Shroom Games
          </span>
          <h1 className="text-4xl font-semibold leading-none text-ink">Nonagarden</h1>
          <p className="mt-1 text-sm text-ink-soft">Design-system smoke test</p>
        </div>
        <ThemeToggle />
      </header>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-soft">Surfaces</h2>
        <div className="flex flex-wrap gap-3">
          {surfaces.map((s) => (
            <div
              key={s.label}
              className={`${s.cls} flex h-20 w-28 items-end rounded-xl border border-border p-2`}
            >
              <span className="rounded-md bg-card/70 px-1.5 py-0.5 text-xs font-medium text-ink">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-soft">Radii</h2>
        <div className="flex flex-wrap gap-3">
          {radii.map((r) => (
            <div
              key={r.label}
              className={`${r.cls} flex h-16 w-16 items-center justify-center bg-accent text-center text-[10px] font-semibold text-on-accent`}
            >
              {r.label}
            </div>
          ))}
        </div>
      </section>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-soft">
          Clue palette <span className="font-normal">(raw --num-* vars)</span>
        </h2>
        <div className="flex flex-wrap gap-2 font-mono text-lg font-semibold">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-card"
              style={{ color: `var(--num-${i + 1})` }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </section>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-soft">
          Sample tiles <span className="font-normal">(accent fill + inset lip)</span>
        </h2>
        <div className="grid grid-cols-5 gap-[5px] rounded-2xl bg-board p-[9px] w-fit">
          {[1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1].map(
            (filled, i) => (
              <div
                key={i}
                className="h-9 w-9 rounded-[9px]"
                style={
                  filled
                    ? {
                        background: "var(--shroom-accent)",
                        boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.20)",
                      }
                    : {
                        background: "var(--tile-revealed)",
                        boxShadow: "inset 0 0 0 1px var(--tile-revealed-edge)",
                      }
                }
              />
            ),
          )}
        </div>
      </section>

      <footer className="max-w-2xl text-center text-xs text-ink-soft">
        JS tokens reachable too — accent (forest) ={" "}
        <code className="font-mono">{tokens.color.forest.accent}</code>, radius.md ={" "}
        <code className="font-mono">{tokens.radius.md}px</code>.
      </footer>
    </main>
  );
}
