// studio/preview.ts
import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildGalleryHtml, gradeCandidates } from "../src/lib/studio/gallery";
import type { Puzzle } from "../src/lib/nonogram";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: studio:preview <candidates-file>");
  const mod = (await import(pathToFileURL(resolve(file)).href)) as {
    candidates: Puzzle[];
  };
  const items = gradeCandidates(mod.candidates);
  const html = buildGalleryHtml(items);
  await mkdir("studio/preview", { recursive: true });
  const out = `studio/preview/${basename(file).replace(/\.ts$/, "")}.html`;
  await writeFile(out, html, "utf8");
  console.log(
    `Wrote ${items.filter((i) => i.valid).length}/${items.length} valid → ${out}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
