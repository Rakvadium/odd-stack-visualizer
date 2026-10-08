import type { EntityKey } from "./types";

export type InlineToken =
  | { t: "text"; s: string }
  | { t: "code"; s: string }
  | { t: "bold"; children: InlineToken[] }
  | { t: "em"; children: InlineToken[] }
  | { t: "link"; s: string; href: string }
  | { t: "ref"; s: string; key: EntityKey; code: boolean };

interface PlainPattern {
  source: string;
  key: EntityKey;
}

/**
 * Resolves the ways the pstack sources name a skill, principle, playbook, tool, agent, or doc.
 * Markup (bold, code, slash commands) is matched exactly. Plain prose only matches names that
 * cannot be ordinary English, so "how" in a sentence stays a word while `how` is the skill.
 */
export class Lexicon {
  private exact = new Map<string, EntityKey>();
  private plain: PlainPattern[] = [];
  private compiled: RegExp | null = null;
  private keysByGroup: EntityKey[] = [];
  private docPaths = new Set<string>();

  addExact(name: string, key: EntityKey): void {
    const normal = normalize(name);
    if (!this.exact.has(normal)) this.exact.set(normal, key);
  }

  /** A name safe to spot in running prose. Matched case-sensitively on word boundaries. */
  addPlain(name: string, key: EntityKey, opts: { notSentenceStart?: boolean } = {}): void {
    const word = escape(name);
    const guard = opts.notSentenceStart ? "(?<!(?:^|[.!?:→]\\s+|\\n|- ))" : "";
    this.plain.push({ source: `${guard}(?<![\\w/-])${word}(?![\\w-]|\\.md)`, key });
    this.compiled = null;
  }

  /** A short name that only counts as a reference inside a fixed phrase, e.g. "the how skill". */
  addPhrase(source: string, key: EntityKey): void {
    this.plain.push({ source, key });
    this.compiled = null;
  }

  addDoc(path: string): void {
    this.docPaths.add(path);
  }

  resolve(raw: string, base: string): EntityKey | null {
    const text = raw.trim();
    const doc = this.resolveDoc(text, base);
    if (doc) return doc;
    const playbookPath = /^(?:\.\.\/)?(?:pstack\/skills\/poteto-mode\/)?playbooks\/([\w-]+)\.md$/.exec(text);
    if (playbookPath) return `playbook:${playbookPath[1]}`;
    return this.exact.get(normalize(text)) ?? null;
  }

  tokenize(text: string, base: string): InlineToken[] {
    const out: InlineToken[] = [];
    const re = /(`+)([\s\S]*?)\1|\*\*([\s\S]+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])/g;
    let last = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (m.index > last) out.push(...this.scanPlain(text.slice(last, m.index)));
      if (m[1]) {
        const code = m[2].trim();
        const key = this.resolve(code, base);
        out.push(key ? { t: "ref", s: code, key, code: true } : { t: "code", s: code });
      } else if (m[3] !== undefined) {
        const key = this.resolve(m[3], base);
        out.push(key ? { t: "ref", s: m[3], key, code: false } : { t: "bold", children: this.tokenize(m[3], base) });
      } else if (m[4] !== undefined) {
        const key = this.resolve(m[5], base);
        out.push(key ? { t: "ref", s: m[4], key, code: false } : { t: "link", s: m[4], href: m[5] });
      } else if (m[6] !== undefined) {
        out.push({ t: "em", children: this.tokenize(m[6], base) });
      }
      last = re.lastIndex;
    }
    if (last < text.length) out.push(...this.scanPlain(text.slice(last)));
    return out;
  }

  /** Every entity a markdown string mentions, in order of first mention. */
  refs(markdown: string, base: string): EntityKey[] {
    const seen = new Set<EntityKey>();
    const walk = (tokens: InlineToken[]) => {
      for (const token of tokens) {
        if (token.t === "ref") seen.add(token.key);
        else if (token.t === "bold" || token.t === "em") walk(token.children);
        else if (token.t === "code") for (const t of this.scanPlain(token.s)) if (t.t === "ref") seen.add(t.key);
      }
    };
    walk(this.tokenize(markdown.replace(/^\s*(?:[-*]|\d+\.)\s+/gm, ""), base));
    return [...seen];
  }

  private resolveDoc(text: string, base: string): EntityKey | null {
    if (!/^(?:\.\.\/)*references\/[\w./-]+\.(md|tsv)$/.test(text)) return null;
    const parts = base.split("/");
    let rel = text;
    while (rel.startsWith("../")) {
      parts.pop();
      rel = rel.slice(3);
    }
    const candidates = [[...parts, rel].join("/")];
    if (parts.at(-1) === "playbooks") candidates.push([...parts.slice(0, -1), rel].join("/"));
    const hit = candidates.find((p) => this.docPaths.has(p));
    return hit ? `doc:${hit}` : null;
  }

  private scanPlain(text: string): InlineToken[] {
    if (!this.plain.length) return [{ t: "text", s: text }];
    if (!this.compiled) {
      const sorted = [...this.plain].sort((a, b) => b.source.length - a.source.length);
      this.keysByGroup = sorted.map((p) => p.key);
      this.compiled = new RegExp(sorted.map((p) => `(${p.source})`).join("|"), "g");
    }
    const re = new RegExp(this.compiled.source, "g");
    const out: InlineToken[] = [];
    let last = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const group = m.slice(1).findIndex((g) => g !== undefined);
      if (m.index > last) out.push({ t: "text", s: text.slice(last, m.index) });
      out.push({ t: "ref", s: m[0], key: this.keysByGroup[group], code: false });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ t: "text", s: text.slice(last) });
    return out;
  }
}

function normalize(name: string): string {
  return name
    .trim()
    .replace(/^\//, "")
    .replace(/['’]s$/, "")
    .replace(/[.:]$/, "")
    .toLowerCase();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
