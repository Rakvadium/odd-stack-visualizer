export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "code"; lang: string; text: string };

export interface ListItem {
  marker: string;
  /** Item source with the marker removed and continuation lines dedented. */
  text: string;
}

export interface Frontmatter {
  data: Record<string, string>;
  body: string;
}

export function splitFrontmatter(source: string): Frontmatter {
  const text = source.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  const data: Record<string, string> = {};
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value === ">-" || value === "|" || value === ">") {
      const folded: string[] = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) folded.push(lines[++i].trim());
      value = folded.join(" ");
    }
    data[kv[1]] = value.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
  }
  return { data, body: text.slice(match[0].length) };
}

const LIST_ITEM = /^( {0,3})([-*]|\d+\.)\s+(.*)$/;
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i++]);
      }
      i++;
      blocks.push({ type: "code", lang: fence[2].trim(), text: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = /\d/.test(item[2]);
      const items: ListItem[] = [];
      while (i < lines.length) {
        const head = LIST_ITEM.exec(lines[i]);
        if (!head || /\d/.test(head[2]) !== ordered) break;
        const indent = head[1].length + head[2].length + 1;
        const body = [head[3]];
        i++;
        while (i < lines.length) {
          const next = lines[i];
          if (next.trim() === "") {
            const after = lines.slice(i + 1).find((l) => l.trim() !== "");
            if (after !== undefined && /^\s{2,}\S/.test(after)) {
              body.push("");
              i++;
              continue;
            }
            break;
          }
          const sub = LIST_ITEM.exec(next);
          if (sub && sub[1].length <= head[1].length) break;
          if (/^\s+/.test(next)) {
            body.push(next.replace(new RegExp(`^ {0,${Math.max(indent, 2)}}`), ""));
            i++;
            continue;
          }
          if (/^(#{1,6}\s|`{3,}|~{3,})/.test(next)) break;
          body.push(next);
          i++;
        }
        items.push({ marker: head[2], text: body.join("\n").trim() });
        while (i < lines.length && lines[i].trim() === "") {
          const after = lines.slice(i).find((l) => l.trim() !== "");
          const nextItem = after ? LIST_ITEM.exec(after) : null;
          if (nextItem && /\d/.test(nextItem[2]) === ordered) i++;
          else break;
        }
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !FENCE.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !LIST_ITEM.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

/** Serialize blocks back to markdown so a slice of a document can be rendered on its own. */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${"#".repeat(block.level)} ${block.text}`;
        case "paragraph":
          return block.text;
        case "code":
          return "````" + block.lang + "\n" + block.text + "\n````";
        case "list":
          return block.items
            .map((item, index) => {
              const marker = block.ordered ? `${index + 1}.` : "-";
              const [first, ...rest] = item.text.split("\n");
              return [`${marker} ${first}`, ...rest.map((l) => (l ? `   ${l}` : l))].join("\n");
            })
            .join("\n");
      }
    })
    .join("\n\n");
}

/** Split "**Lead.** rest" into its bold lead and the rest of the text. */
export function splitLead(text: string): { lead: string | null; rest: string } {
  const match = /^\*\*(.+?)\*\*[:.]?\s*([\s\S]*)$/.exec(text);
  if (!match) return { lead: null, rest: text };
  return { lead: match[1].replace(/[.:]$/, ""), rest: match[2] };
}

/** First sentence of a markdown string, for compact summaries. */
export function firstSentence(text: string): string {
  const flat = text.replace(/\n+/g, " ").trim();
  const match = /^(.+?[.!?])(\s|$)/.exec(flat);
  return (match ? match[1] : flat).trim();
}
