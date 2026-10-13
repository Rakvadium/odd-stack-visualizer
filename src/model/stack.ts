import { SHORT_LABELS, TOOLS } from "./curated";
import { shortLabel } from "./labels";
import { Lexicon } from "./lexicon";
import {
  blocksToMarkdown,
  firstSentence,
  parseBlocks,
  splitFrontmatter,
  splitLead,
  type Block,
} from "./markdown";
import type {
  Entity,
  EntityKey,
  Flow,
  ModeDoc,
  Principle,
  Route,
  Section,
  Station,
  Trigger,
  Usage,
} from "./types";

export interface SourceFile {
  path: string;
  text: string;
}

export interface Stack {
  entities: Map<EntityKey, Entity>;
  flows: Map<EntityKey, Flow>;
  routes: Route[];
  triggers: Trigger[];
  principles: Principle[];
  usage: Map<EntityKey, Usage[]>;
  mode: ModeDoc;
  lexicon: Lexicon;
}

const MODE_PATH = "skills/odd-mode/SKILL.md";
const PLAYBOOK_DIR = "skills/odd-mode/playbooks";

export function buildStack(files: SourceFile[]): Stack {
  const byPath = new Map(files.map((f) => [f.path, f.text]));
  const entities = new Map<EntityKey, Entity>();
  const lexicon = new Lexicon();
  const add = (entity: Entity) => entities.set(entity.key, entity);

  const modeSource = byPath.get(MODE_PATH);
  if (!modeSource) throw new Error(`missing ${MODE_PATH}`);
  const modeFront = splitFrontmatter(modeSource);
  const modeSections = sectionsByHeading(parseBlocks(modeFront.body), 2);

  for (const file of files) {
    const skill = /^skills\/([\w-]+)\/SKILL\.md$/.exec(file.path);
    if (skill) {
      const { data } = splitFrontmatter(file.text);
      const id = skill[1];
      const principle = id.startsWith("principle-");
      add({
        key: principle ? `principle:${id}` : `skill:${id}`,
        kind: principle ? "principle" : "skill",
        id,
        name: principle ? titleCase(id.slice("principle-".length)) : id,
        summary: data.description ?? "",
        path: file.path,
        origin: null,
        source: file.text,
      });
      continue;
    }
    const playbook = new RegExp(`^${PLAYBOOK_DIR}/([\\w-]+)\\.md$`).exec(file.path);
    if (playbook) {
      const title = /^###\s+(.+)$/m.exec(file.text)?.[1].trim() ?? playbook[1];
      add({
        key: `playbook:${playbook[1]}`,
        kind: "playbook",
        id: playbook[1],
        name: title,
        summary: "",
        path: file.path,
        origin: null,
        source: file.text,
      });
      continue;
    }
    const agent = /^agents\/([\w-]+)\.md$/.exec(file.path);
    if (agent) {
      const { data } = splitFrontmatter(file.text);
      add({
        key: `agent:${agent[1]}`,
        kind: "agent",
        id: agent[1],
        name: data.name ?? agent[1],
        summary: data.description ?? "",
        path: file.path,
        origin: null,
        source: file.text,
      });
      continue;
    }
    if (/\/references\/.+\.(md|tsv)$/.test(file.path)) {
      lexicon.addDoc(file.path);
      add({
        key: `doc:${file.path}`,
        kind: "doc",
        id: file.path,
        name: file.path.split("/").at(-1)!.replace(/\.(md|tsv)$/, ""),
        summary: "",
        path: file.path,
        origin: null,
        source: file.text,
      });
    }
  }

  for (const tool of TOOLS) {
    const source = tool.path ? byPath.get(tool.path) ?? null : null;
    add({
      key: `tool:${tool.id}`,
      kind: "tool",
      id: tool.id,
      name: tool.name,
      summary: tool.summary,
      path: tool.path,
      origin: tool.origin,
      source,
    });
  }

  const routes = parseRoutes(modeSections.get("Playbooks") ?? []);
  for (const route of routes) {
    const entity = entities.get(route.key);
    if (entity) entity.summary = route.when;
  }

  registerNames(lexicon, entities, routes);

  const principles = parsePrinciples(modeSections.get("Principles") ?? [], lexicon);
  for (const p of principles) {
    const entity = entities.get(p.key);
    if (entity) entity.name = p.name;
    lexicon.addExact(p.name, p.key);
    lexicon.addPlain(p.name, p.key);
  }

  const triggers = parseTriggers(modeSections.get("Non-negotiables") ?? [], lexicon);

  const flows = new Map<EntityKey, Flow>();
  for (const entity of entities.values()) {
    if (!entity.source || !entity.path) continue;
    if (entity.kind === "playbook") flows.set(entity.key, playbookFlow(entity, lexicon));
    else if (entity.kind === "skill" || entity.kind === "principle") flows.set(entity.key, skillFlow(entity, lexicon));
  }

  for (const flow of flows.values()) {
    for (const station of flow.stations) station.short = SHORT_LABELS[`${flow.key}#${station.label}`] ?? shortLabel(station.title);
  }

  const usage = new Map<EntityKey, Usage[]>();
  const note = (key: EntityKey, use: Usage) => {
    if (key === use.flow) return;
    const list = usage.get(key) ?? [];
    if (!list.some((u) => u.flow === use.flow && u.station === use.station)) list.push(use);
    usage.set(key, list);
  };
  for (const flow of flows.values()) {
    flow.stations.forEach((station, index) => station.refs.forEach((key) => note(key, { flow: flow.key, station: index })));
    for (const section of [...flow.intro, ...flow.notes]) section.refs.forEach((key) => note(key, { flow: flow.key, station: null }));
  }

  const modeText = (name: string) => blocksToMarkdown(modeSections.get(name) ?? []);
  const playbookBlocks = modeSections.get("Playbooks") ?? [];
  const mode: ModeDoc = {
    reminder: modeFront.data.reminder ?? "",
    routingIntro: blocksToMarkdown(playbookBlocks.filter((b) => b.type === "paragraph")),
    autonomy: modeText("Autonomy"),
    subagents: modeText("Subagents"),
    reply: modeText("Writing the reply"),
    comments: modeText("Comments"),
  };

  return { entities, flows, routes, triggers, principles, usage, mode, lexicon };
}

function registerNames(lexicon: Lexicon, entities: Map<EntityKey, Entity>, routes: Route[]): void {
  for (const entity of entities.values()) {
    switch (entity.kind) {
      case "playbook":
        addPlaybookName(lexicon, entity.name, entity.key);
        break;
      case "skill": {
        lexicon.addExact(entity.id, entity.key);
        const name = splitFrontmatter(entity.source ?? "").data.name;
        if (name) lexicon.addExact(name, entity.key);
        lexicon.addPhrase(`(?<![\\w/])/${escape(entity.id)}(?![\\w-])`, entity.key);
        if (entity.id.includes("-")) lexicon.addPlain(entity.id, entity.key);
        else lexicon.addPhrase(`(?<=\\b[Tt]he )${escape(entity.id)}(?= skill)`, entity.key);
        break;
      }
      case "principle": {
        const short = entity.id.slice("principle-".length);
        lexicon.addExact(entity.id, entity.key);
        lexicon.addExact(short, entity.key);
        lexicon.addPlain(entity.id, entity.key);
        lexicon.addPlain(short, entity.key);
        break;
      }
      case "agent":
        lexicon.addExact(entity.id, entity.key);
        lexicon.addExact(entity.name, entity.key);
        lexicon.addPlain(entity.name, entity.key);
        if (entity.id !== entity.name) lexicon.addPlain(entity.id, entity.key);
        break;
      case "tool": {
        const tool = TOOLS.find((t) => `tool:${t.id}` === entity.key)!;
        for (const alias of tool.aliases) lexicon.addExact(alias, entity.key);
        for (const plain of tool.plain) lexicon.addPhrase(plain, entity.key);
        break;
      }
      case "doc":
        break;
    }
  }
  for (const route of routes) {
    if (route.key.startsWith("playbook:")) addPlaybookName(lexicon, route.name, route.key);
  }
  lexicon.addPlain("Perf", "playbook:perf-issue", { notSentenceStart: true });
}

function addPlaybookName(lexicon: Lexicon, name: string, key: EntityKey): void {
  lexicon.addExact(name, key);
  const single = !/[\s-]/.test(name);
  lexicon.addPlain(name, key, { notSentenceStart: single });
}

function parseRoutes(blocks: Block[]): Route[] {
  const list = blocks.find((b): b is Extract<Block, { type: "list" }> => b.type === "list");
  if (!list) return [];
  return list.items.flatMap((item) => {
    const { lead, rest } = splitLead(item.text);
    const file = /`playbooks\/([\w-]+)\.md`/.exec(rest);
    if (!lead || !file) return [];
    const when = rest
      .replace(/\s*(?:Full steps:\s*)?`playbooks\/[\w-]+\.md`\.?\s*$/, "")
      .trim();
    return [{ key: `playbook:${file[1]}` as EntityKey, name: lead, when, phrases: quoted(when) }];
  });
}

function parsePrinciples(blocks: Block[], lexicon: Lexicon): Principle[] {
  const out: Principle[] = [];
  let group = "";
  for (const block of blocks) {
    if (block.type === "paragraph") {
      const g = /^\*\*(\w+)\*\*$/.exec(block.text);
      if (g) group = g[1];
      continue;
    }
    if (block.type !== "list") continue;
    for (const item of block.items) {
      const m = /^\*\*(.+?)\*\*\s*\(\*\*(principle-[\w-]+)\*\*\)\.\s*([\s\S]*)$/.exec(item.text);
      if (!m) continue;
      const key = lexicon.resolve(m[2], "skills/odd-mode") ?? (`principle:${m[2]}` as EntityKey);
      out.push({ key, name: m[1], group, when: m[3].trim() });
    }
  }
  return out;
}

function parseTriggers(blocks: Block[], lexicon: Lexicon): Trigger[] {
  const out: Trigger[] = [];
  for (const block of blocks) {
    if (block.type !== "list") continue;
    for (const item of block.items) {
      const [when, ...then] = item.text.split(/\s*→\s*/);
      const action = then.join(" → ");
      out.push({
        when: action ? when : "",
        then: action || when,
        refs: lexicon.refs(item.text, "skills/odd-mode"),
      });
    }
  }
  return out;
}

function playbookFlow(entity: Entity, lexicon: Lexicon): Flow {
  const base = PLAYBOOK_DIR;
  const blocks = parseBlocks(entity.source!).filter((b) => !(b.type === "heading" && b.level === 3));
  const flow = emptyFlow(entity);
  const section = (title: string, body: Block[]): Section => {
    const md = blocksToMarkdown(body);
    return { title, body: md, refs: withoutSelf(lexicon.refs(`${title}\n\n${md}`, base), entity.key) };
  };

  const ownIndex = blocks.findIndex((b) => b.type === "paragraph" && b.text.startsWith("**You own"));
  if (ownIndex >= 0) {
    const own = splitLead((blocks[ownIndex] as { text: string }).text);
    flow.owns = own.lead;
    flow.ownsDetail = own.rest;
    blocks.splice(ownIndex, 1);
  }

  const replyIndex = blocks.findIndex((b) => b.type === "paragraph" && b.text.startsWith("**Reply:**"));
  if (replyIndex >= 0) {
    flow.reply = (blocks[replyIndex] as { text: string }).text.replace(/^\*\*Reply:\*\*\s*/, "");
    blocks.splice(replyIndex, 1);
  }

  const stepsIndex = findStepList(blocks);
  if (stepsIndex >= 0) {
    const list = blocks[stepsIndex] as Extract<Block, { type: "list" }>;
    let before = blocks.slice(0, stepsIndex);
    const marker = before.at(-1);
    if (marker && ((marker.type === "heading" && /^steps$/i.test(marker.text)) || (marker.type === "paragraph" && /^\*\*Steps:?\*\*:?$/.test(marker.text)))) {
      before = before.slice(0, -1);
    }
    flow.intro = groupSections(before).map(([t, b]) => section(t, b));
    flow.stations = list.items.map((item, index) => station(String(index + 1), item.text, lexicon, base, entity.key));
    flow.notes = groupSections(blocks.slice(stepsIndex + 1)).map(([t, b]) => section(t, b));
  } else {
    const intro: Block[] = [];
    for (const block of blocks) {
      const lead = block.type === "paragraph" ? splitLead(block.text) : null;
      if (lead?.lead) {
        flow.stations.push(station(String(flow.stations.length + 1), block.type === "paragraph" ? block.text : "", lexicon, base, entity.key));
      } else if (flow.stations.length === 0) {
        intro.push(block);
      } else {
        const last = flow.stations.at(-1)!;
        last.body = [last.body, blocksToMarkdown([block])].filter(Boolean).join("\n\n");
        last.refs = withoutSelf(lexicon.refs(`${last.title}\n\n${last.body}`, base), entity.key);
      }
    }
    flow.intro = groupSections(intro).map(([t, b]) => section(t, b));
  }
  return flow;
}

function skillFlow(entity: Entity, lexicon: Lexicon): Flow {
  const base = entity.path!.replace(/\/SKILL\.md$/, "");
  const { body } = splitFrontmatter(entity.source!);
  const blocks = parseBlocks(body).filter((b) => !(b.type === "heading" && b.level === 1));
  const flow = emptyFlow(entity);
  const refsOf = (text: string) => withoutSelf(lexicon.refs(text, base), entity.key);

  const first = blocks.findIndex((b) => b.type === "heading" && b.level === 2);
  const lead = first < 0 ? blocks : blocks.slice(0, first);
  const leadMd = blocksToMarkdown(lead);
  if (leadMd) flow.intro.push({ title: "", body: leadMd, refs: refsOf(leadMd) });

  for (const [title, sectionBlocks] of sectionsByHeading(blocks, 2)) {
    const md = blocksToMarkdown(sectionBlocks);
    if (/^start$/i.test(title)) {
      flow.intro.push({ title: "Start", body: md, refs: refsOf(md) });
    } else if (/^(outputs?|output format)$/i.test(title)) {
      flow.reply = md;
    } else {
      const m = /^(?:(?:Phase|Step)\s+([\w]+)[.:,]?\s*)?(.*)$/.exec(title)!;
      flow.stations.push({
        label: m[1] ?? "",
        short: "",
        title: m[2] || title,
        body: md,
        refs: refsOf(`${title}\n\n${md}`),
      });
    }
  }
  return flow;
}

function station(label: string, text: string, lexicon: Lexicon, base: string, self: EntityKey): Station {
  const { lead, rest } = splitLead(text);
  let title = lead;
  let body = rest;
  if (!title) {
    const firstLine = text.split("\n")[0];
    title = firstSentence(firstLine).replace(/:$/, "");
    body = text.slice(text.indexOf(title) + title.length).replace(/^:/, "").trim();
  }
  return { label, short: "", title, body, refs: withoutSelf(lexicon.refs(text, base), self) };
}

function findStepList(blocks: Block[]): number {
  const marker = blocks.findIndex(
    (b) => (b.type === "heading" && /^steps$/i.test(b.text)) || (b.type === "paragraph" && /^\*\*Steps:?\*\*:?$/.test(b.text)),
  );
  const from = marker >= 0 ? marker : 0;
  return blocks.findIndex((b, i) => i >= from && b.type === "list" && b.ordered);
}

/** Group blocks into titled sections. A heading or a bold-only paragraph opens a section. */
function groupSections(blocks: Block[]): [string, Block[]][] {
  const out: [string, Block[]][] = [];
  for (const block of blocks) {
    if (block.type === "heading") {
      out.push([block.text, []]);
      continue;
    }
    if (block.type === "paragraph") {
      const bare = /^\*\*(.+?)[:.]?\*\*:?$/.exec(block.text);
      if (bare) {
        out.push([bare[1], []]);
        continue;
      }
    }
    if (!out.length) out.push(["", []]);
    out.at(-1)![1].push(block);
  }
  return out.filter(([title, body]) => title || body.length);
}

function sectionsByHeading(blocks: Block[], level: number): Map<string, Block[]> {
  const out = new Map<string, Block[]>();
  let current: Block[] | null = null;
  for (const block of blocks) {
    if (block.type === "heading" && block.level === level) {
      current = [];
      out.set(block.text, current);
    } else if (block.type === "heading" && block.level < level) {
      current = null;
    } else if (current) {
      current.push(block);
    }
  }
  return out;
}

function emptyFlow(entity: Entity): Flow {
  return {
    key: entity.key,
    title: entity.name,
    path: entity.path!,
    owns: null,
    ownsDetail: "",
    intro: [],
    stations: [],
    notes: [],
    reply: null,
  };
}

function withoutSelf(keys: EntityKey[], self: EntityKey): EntityKey[] {
  return keys.filter((k) => k !== self);
}

function quoted(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w, i) => (i === 0 || w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
