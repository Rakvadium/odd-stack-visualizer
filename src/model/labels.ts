const CUTS = [" (", ", ", ": ", " via ", " so ", " before ", " even ", " — ", " until ", " when ", " with ", " per ", " and only "];
const MAX_WORDS = 6;

/** A diagram-sized label for a step: its bold lead when it has one, else the head of its first sentence. */
export function shortLabel(title: string): string {
  let text = title.replace(/\*\*|`/g, "").replace(/[.:]$/, "").trim();
  for (const cut of CUTS) {
    const at = text.indexOf(cut);
    if (at > 8) text = text.slice(0, at);
  }
  const words = text.split(/\s+/);
  if (words.length > MAX_WORDS) text = words.slice(0, MAX_WORDS).join(" ") + "…";
  return text.replace(/[,;]$/, "");
}
