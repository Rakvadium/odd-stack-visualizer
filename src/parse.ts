import type {
  Block,
  Edge,
  EvidenceQuote,
  Graph,
  GraphNode,
  NodeKind,
  Route,
} from "./types";

export interface SourceFile {
  path: string;
  text: string;
}

const STRICT_WORDS = [
  "unslop",
  "deslop",
  "swarm",
  "arena",
  "architect",
  "interrogate",
  "tdd",
  "reflect",
] as const;

export function buildGraph(files: SourceFile[]): Graph {
  const byPath = new Map(files.map((file) => [file.path, file.text]));
  const nodes: Record<string, GraphNode> = {};

  for (const file of files) {
    const skillId = file.path.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1];
    if (skillId) {
      const meta = parseFrontmatter(file.text);
      const kind: NodeKind = skillId.startsWith("principle-")
        ? "principle"
        : "skill";
      const body = stripFrontmatter(file.text);
      const parsed =
        skillId === "odd-mode"
          ? { lead: "", reply: "", blocks: [] as Block[] }
          : parseBlocks(body, "skill");
      nodes[`skill:${skillId}`] = {
        id: `skill:${skillId}`,
        kind,
        name: meta.name || skillId,
        summary: clean(meta.description || firstSentence(parsed.lead)),
        source: file.path,
        lead: parsed.lead,
        reply: parsed.reply,
        blocks: parsed.blocks,
        when: "",
        group: "",
        outside: false,
      };
      continue;
    }

    const playbookId = file.path.match(
      /^skills\/odd-mode\/playbooks\/([^/]+)\.md$/,
    )?.[1];
    if (playbookId) {
      const parsed = parseBlocks(file.text, "playbook");
      const title =
        file.text.match(/^###\s+(.+)$/m)?.[1]?.trim() || playbookId;
      nodes[`playbook:${playbookId}`] = {
        id: `playbook:${playbookId}`,
        kind: "playbook",
        name: title,
        summary: clean(firstParagraph(parsed.lead) || title),
        source: file.path,
        lead: parsed.lead,
        reply: parsed.reply,
        blocks: parsed.blocks,
        when: "",
        group: "",
        outside: false,
      };
      continue;
    }

    const agentId = file.path.match(/^agents\/([^/]+)\.md$/)?.[1];
    if (agentId) {
      const meta = parseFrontmatter(file.text);
      const body = stripFrontmatter(file.text);
      const parsed = parseBlocks(body, "skill");
      nodes[`agent:${agentId}`] = {
        id: `agent:${agentId}`,
        kind: "agent",
        name: meta.name || agentId,
        summary: clean(meta.description || firstSentence(parsed.lead)),
        source: file.path,
        lead: parsed.lead,
        reply: parsed.reply,
        blocks: parsed.blocks,
        when: "",
        group: "",
        outside: false,
      };
      continue;
    }

    const autoId = file.path.match(
      /^automations\/benny\/skills\/([^/]+)\/SKILL\.md$/,
    )?.[1];
    if (autoId) {
      const meta = parseFrontmatter(file.text);
      nodes[`automation:${autoId}`] = {
        id: `automation:${autoId}`,
        kind: "skill",
        name: meta.name || autoId,
        summary: clean(meta.description || ""),
        source: file.path,
        lead: "",
        reply: "",
        blocks: [],
        when: "",
        group: "benny",
        outside: true,
      };
    }
  }

  indexReferences(files, nodes);
  addFixedNodes(nodes);

  const modeText = byPath.get("skills/odd-mode/SKILL.md") ?? "";
  const modeBody = stripFrontmatter(modeText);
  const principles = attachPrinciples(modeBody, nodes);
  const triggers = attachTriggers(modeBody, nodes);
  const sections = attachModeSections(modeBody, nodes);
  const routes = attachRoutes(modeBody, nodes);
  const keyword = keywordNotes(byPath);

  const alias = buildAliasMap(nodes);
  const refPaths = referencePathIndex(nodes);

  for (const node of Object.values(nodes)) {
    if (node.outside) continue;
    linkBlocks(node, alias, refPaths);
  }

  const edges = collectEdges(nodes, triggers, sections);
  for (const route of routes) {
    edges.push({
      from: "skill:odd-mode",
      to: route.targetId,
      where: "Playbook match",
    });
  }
  for (const id of principles) {
    edges.push({
      from: "section:triggers-intro",
      to: id,
      where: "Principles index",
    });
  }
  markOutside(nodes, edges, principles);

  return {
    nodes,
    routes,
    triggers,
    principles,
    outside: Object.values(nodes)
      .filter((node) => node.outside && !node.id.startsWith("automation:"))
      .map((node) => node.id),
    automations: Object.values(nodes)
      .filter((node) => node.id.startsWith("automation:"))
      .map((node) => node.id),
    edges,
    keyword,
    hooksNote:
      "This plugin ships no hooks. plugin.json declares skills and agents only, and the repo has no hooks directory. A playbook line about pushing with git hooks on is git's own pre-push hooks, not a Cursor hook on this path.",
    entryId: "skill:odd-mode",
    entry: entryMeta(byPath.get("skills/odd-mode/SKILL.md") ?? ""),
  };
}

function entryMeta(text: string): Graph["entry"] {
  const meta = parseFrontmatter(text);
  return {
    mode: meta.mode === "true",
    disableModelInvocation: meta["disable-model-invocation"] === "true",
    reminder: meta.reminder ?? "",
  };
}

function addFixedNodes(nodes: Record<string, GraphNode>): void {
  const fixed: GraphNode[] = [
    {
      id: "external:deslop",
      kind: "external",
      name: "/deslop",
      summary:
        "Skill from the cursor-team-kit plugin. Run it over the diff before commit.",
      source: null,
      lead: "Named from odd-mode and from Opening a PR. It is not a file in this repo.",
      reply: "",
      blocks: [],
      when: "Before commit.",
      group: "",
      outside: false,
    },
    {
      id: "external:control-ui",
      kind: "external",
      name: "control-ui",
      summary:
        "cursor-team-kit skill for browser, Electron, and web UI control.",
      source: null,
      lead: "Named in odd-mode's non-negotiables. It is not a file in this repo.",
      reply: "",
      blocks: [],
      when: "Shipping or reproducing a browser, Electron, or web UI.",
      group: "",
      outside: false,
    },
    {
      id: "external:control-cli",
      kind: "external",
      name: "control-cli",
      summary: "cursor-team-kit skill for CLI and TUI control.",
      source: null,
      lead: "Named in odd-mode's non-negotiables. It is not a file in this repo.",
      reply: "",
      blocks: [],
      when: "Shipping or reproducing a CLI or TUI.",
      group: "",
      outside: false,
    },
    {
      id: "external:create-skill",
      kind: "external",
      name: "create-skill",
      summary: "Cursor's built-in skill for authoring SKILL.md files.",
      source: null,
      lead: "Named by odd-mode and by the Authoring a skill playbook. It is not a file in this repo.",
      reply: "",
      blocks: [],
      when: "Writing or editing a SKILL.md.",
      group: "",
      outside: false,
    },
    {
      id: "external:loop",
      kind: "external",
      name: "/loop",
      summary:
        "Cursor's built-in command for a wake loop. Not an odd-stack skill.",
      source: null,
      lead: "The Autonomous run playbook calls it a built-in, not an odd-stack skill.",
      reply: "",
      blocks: [],
      when: "A long hunt, a babysit drive, an audit tick, or an autonomous run needs a wake-up.",
      group: "",
      outside: false,
    },
    {
      id: "rule:odd-stack-models",
      kind: "rule",
      name: "odd-stack-models.mdc",
      summary:
        "Always-applied rule that sets the model per role. setup-odd-stack writes it to ~/.cursor/rules/. It is not in this repo.",
      source: null,
      lead: "Routed skills read a role line from this rule and fall back to the default named in the skill when the line is missing.",
      reply: "",
      blocks: [],
      when: "Any subagent spawn that names a model role.",
      group: "",
      outside: false,
    },
    {
      id: "script:watch-pr",
      kind: "script",
      name: "watch-pr",
      summary:
        "GitHub PR watcher the Babysit playbook runs directly. JSON by default. The bare command polls until a terminal verdict.",
      source: "skills/odd-mode/scripts/watch-pr/watch-pr",
      lead: "",
      reply: "",
      blocks: [],
      when: "Babysit on GitHub.",
      group: "",
      outside: false,
    },
    {
      id: "script:worktree-audit",
      kind: "script",
      name: "worktree-audit.sh",
      summary:
        "Read-only worktree prune audit. Classifies every git worktree and never deletes anything.",
      source: "skills/odd-mode/scripts/worktree-audit.sh",
      lead: "",
      reply: "",
      blocks: [],
      when: "Worktree cleanup, step 1.",
      group: "",
      outside: false,
    },
    {
      id: "script:check-plan",
      kind: "script",
      name: "check-plan.mjs",
      summary:
        "Checks a multi-phase plan file and prints every line that fails. The playbook says to fix every line it prints.",
      source: "skills/odd-mode/scripts/check-plan.mjs",
      lead: "",
      reply: "",
      blocks: [],
      when: "Multi-phase plan, step 6.",
      group: "",
      outside: false,
    },
    {
      id: "script:orch",
      kind: "script",
      name: "orch",
      summary:
        "Plain-file bookkeeping for the Orchestrate playbook. One command in and one line out. It never spawns or wakes agents.",
      source: "skills/odd-mode/scripts/orch/orch.ts",
      lead: "",
      reply: "",
      blocks: [],
      when: "Orchestrate store reads and writes at drain points.",
      group: "",
      outside: false,
    },
  ];
  for (const node of fixed) nodes[node.id] = node;
}

function indexReferences(
  files: SourceFile[],
  nodes: Record<string, GraphNode>,
): void {
  for (const file of files) {
    const match = file.path.match(
      /^skills\/([^/]+)\/references\/(.+\.md)$/,
    );
    if (!match) continue;
    const skillFolder = match[1] ?? "";
    const rel = match[2] ?? "";
    const id = `ref:${skillFolder}/${rel.replace(/\.md$/, "")}`;
    const title =
      file.text.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
      rel.replace(/\.md$/, "");
    const summary = clean(firstParagraph(stripHeading(file.text)) || title);
    nodes[id] = {
      id,
      kind: "reference",
      name: title,
      summary,
      source: file.path,
      lead: stripHeading(file.text).trim(),
      reply: "",
      blocks: [],
      when: "",
      group: skillFolder,
      outside: false,
    };
  }
}

function attachPrinciples(
  modeBody: string,
  nodes: Record<string, GraphNode>,
): string[] {
  const section = sliceSection(modeBody, "## Principles", "## Autonomy");
  const ids: string[] = [];
  let group = "";
  for (const bullet of bullets(section)) {
    const groupLine = bullet.match(/^\*\*([^*]+)\*\*$/);
    if (groupLine?.[1]) {
      group = groupLine[1];
      continue;
    }
    const match = bullet.match(
      /^\*\*(.+?)\*\*\s+\(\*\*([^*]+)\*\*\)\.\s*([\s\S]*)$/,
    );
    if (!match) continue;
    const display = match[1]?.trim() ?? "";
    const skillFolder = match[2]?.trim() ?? "";
    const when = clean(match[3] ?? "");
    const id = `skill:${skillFolder}`;
    const node = nodes[id];
    if (node) {
      node.when = when;
      node.group = group;
      node.name = display;
      if (!node.summary) node.summary = when;
    }
    ids.push(id);
  }
  return ids;
}

function attachTriggers(
  modeBody: string,
  nodes: Record<string, GraphNode>,
): string[] {
  const section = sliceSection(
    modeBody,
    "## Non-negotiables",
    "## Principles",
  );
  const intro = section.split(/\n- /)[0]?.trim() ?? "";
  nodes["section:triggers-intro"] = {
    id: "section:triggers-intro",
    kind: "section",
    name: "Non-negotiables",
    summary: clean(intro),
    source: "skills/odd-mode/SKILL.md",
    lead: intro,
    reply: "",
    blocks: [],
    when: "Before and during playbook routing.",
    group: "",
    outside: false,
  };
  const ids: string[] = [];
  bullets(section).forEach((bullet, index) => {
    const id = `trigger:${index + 1}`;
    const arrow = bullet.split("→");
    const title = clean(arrow[0] ?? bullet).replace(/\.$/, "");
    nodes[id] = {
      id,
      kind: "trigger",
      name: title.length > 96 ? `${title.slice(0, 93)}...` : title,
      summary: clean(bullet),
      source: "skills/odd-mode/SKILL.md",
      lead: bullet,
      reply: "",
      blocks: [],
      when: "Non-negotiable trigger. It can fire before a playbook is chosen or while that playbook runs.",
      group: "Non-negotiables",
      outside: false,
    };
    ids.push(id);
  });
  return ids;
}

function attachModeSections(
  modeBody: string,
  nodes: Record<string, GraphNode>,
): string[] {
  const specs = [
    ["## Autonomy", "## Subagents", "Autonomy"],
    ["## Subagents", "## Writing the reply", "Subagents"],
    ["## Writing the reply", "## Comments", "Writing the reply"],
    ["## Comments", "## Playbooks", "Comments"],
  ] as const;
  const ids: string[] = [];
  for (const [start, end, name] of specs) {
    const text = sliceSection(modeBody, start, end).trim();
    const id = `section:${name.toLowerCase().replace(/\s+/g, "-")}`;
    const parsed = parseBlocks(`# ${name}\n\n${text}`, "skill");
    nodes[id] = {
      id,
      kind: "section",
      name,
      summary: clean(firstSentence(text)),
      source: "skills/odd-mode/SKILL.md",
      lead: parsed.lead,
      reply: "",
      blocks: parsed.blocks.length ? parsed.blocks : [{ label: name, text, links: [], template: false }],
      when: "Applies across playbooks.",
      group: "",
      outside: false,
    };
    ids.push(id);
  }
  return ids;
}

function attachRoutes(modeBody: string, nodes: Record<string, GraphNode>): Route[] {
  const section = sliceSection(modeBody, "## Playbooks", "");
  const routes: Route[] = [];
  const preamble = section.split(/\n- \*\*/)[0] ?? "";
  const figure = preamble
    .split(/(?<=\.)\s+/)
    .filter((sentence) => /figure-it-out/i.test(sentence))
    .slice(0, 2)
    .join(" ");
  for (const bullet of bullets(section)) {
    const title = bullet.match(/^\*\*(.+?)\.\*\*/)?.[1]?.trim() ?? "Playbook";
    const path = bullet.match(/playbooks\/([a-z0-9-]+)\.md/)?.[1];
    if (!path) continue;
    const targetId = `playbook:${path}`;
    const condition = clean(
      bullet
        .replace(/^\*\*.+?\.\*\*\s*/, "")
        .replace(/`playbooks\/[^`]+`\.?/, "")
        .trim(),
    );
    routes.push({
      title: nodes[targetId]?.name || title,
      condition,
      targetId,
      playbookId: path,
    });
  }
  if (figure.trim()) {
    routes.push({
      title: "figure-it-out",
      condition: clean(figure),
      targetId: "skill:figure-it-out",
      playbookId: null,
    });
  }
  return routes;
}

function keywordNotes(byPath: Map<string, string>): Graph["keyword"] {
  const guide = byPath.get("docs/guide/02-odd-mode.md") ?? "";
  const skill = byPath.get("skills/odd-mode/SKILL.md") ?? "";
  const evidence: EvidenceQuote[] = [];
  const want = [
    {
      source: "skills/odd-mode/SKILL.md",
      text: skill,
      quote:
        "Use for odd, /odd-mode, or requests to work in this style.",
    },
    {
      source: "docs/guide/02-odd-mode.md",
      text: guide,
      quote: "You don't write a spec. You say what's wrong or what you want",
    },
    {
      source: "docs/guide/02-odd-mode.md",
      text: guide,
      quote: "/odd-mode do it",
    },
    {
      source: "docs/guide/02-odd-mode.md",
      text: guide,
      quote:
        '"new task" tells `/odd-mode` to re-match rather than continue the prior playbook.',
    },
  ];
  for (const item of want) {
    if (item.text.includes(item.quote)) {
      evidence.push({ source: item.source, quote: item.quote });
    }
  }
  const cues = [
    "new task",
    "check on PR",
    "anything outstanding",
    "going to bed",
    "/loop until",
    "Don't stop",
    "run until done",
    "be fully autonomous",
  ].filter((cue) => skill.includes(cue) || guide.includes(cue));
  return {
    required: false,
    summary:
      "The slash command passes the rest of the message through as the task. Nothing in the skill or the guide requires that prompt to contain a keyword list. odd-mode matches the task against playbook conditions. A few phrases are cues that steer a match or a re-match. They are optional. With the conversation already in context, the guide treats `/odd-mode do it` as enough.",
    cues,
    evidence,
  };
}

function linkBlocks(
  node: GraphNode,
  alias: AliasMap,
  refPaths: Map<string, string>,
): void {
  node.blocks = node.blocks.map((block) => ({
    ...block,
    links: linksIn(block.text, node, alias, refPaths),
  }));
  const leadLinks = linksIn(`${node.lead}\n${node.reply}`, node, alias, refPaths);
  if (node.blocks.length === 0 && node.lead) {
    node.blocks = [
      {
        label: node.kind === "trigger" ? "Trigger" : "Full text",
        text: node.lead,
        links: leadLinks,
        template: false,
      },
    ];
    if (node.kind !== "playbook") node.lead = "";
    return;
  }
  const known = new Set(node.blocks.flatMap((block) => block.links));
  const extra = leadLinks.filter((id) => !known.has(id));
  if (!extra.length) return;
  if (node.kind === "playbook" && node.blocks[0]) {
    node.blocks[0] = {
      ...node.blocks[0],
      links: unique([...extra, ...node.blocks[0].links]),
    };
    return;
  }
  node.blocks.unshift({
    label: "Before the steps",
    text: node.lead,
    links: extra,
    template: false,
  });
  node.lead = "";
}

interface AliasMap {
  strict: Map<string, string>;
  hyphen: Map<string, string>;
}

function buildAliasMap(nodes: Record<string, GraphNode>): AliasMap {
  const strict = new Map<string, string>();
  const hyphen = new Map<string, string>();
  const add = (alias: string, id: string, forceHyphen = false) => {
    const key = alias.trim().toLowerCase();
    if (!key || key.length < 2) return;
    if (forceHyphen || key.includes("-")) hyphen.set(key, id);
    else strict.set(key, id);
  };

  for (const node of Object.values(nodes)) {
    if (node.outside && node.id.startsWith("automation:")) continue;
    add(node.name, node.id);
    if (node.id.startsWith("skill:")) {
      const folder = node.id.slice("skill:".length);
      add(folder, node.id);
      if (folder.startsWith("principle-")) add(folder.slice("principle-".length), node.id);
    }
    if (node.id.startsWith("playbook:")) add(node.id.slice("playbook:".length), node.id);
    if (node.id.startsWith("agent:")) add(node.id.slice("agent:".length), node.id);
  }
  add("opening a pr", "playbook:opening-a-pr");
  add("bug fix", "playbook:bug-fix");
  add("perf issue", "playbook:perf-issue");
  add("comment sicko", "agent:comment-sicko");
  add("odd-agent", "agent:odd-agent", true);
  add("deslop", "external:deslop");
  add("control-ui", "external:control-ui", true);
  add("control-cli", "external:control-cli", true);
  add("create-skill", "external:create-skill", true);
  add("loop", "external:loop");
  add("odd-stack-models", "rule:odd-stack-models", true);
  add("odd-stack-models.mdc", "rule:odd-stack-models", true);
  add("watch-pr", "script:watch-pr", true);
  add("worktree-audit.sh", "script:worktree-audit", true);
  add("check-plan.mjs", "script:check-plan", true);
  return { strict, hyphen };
}

function referencePathIndex(nodes: Record<string, GraphNode>): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of Object.values(nodes)) {
    if (node.source) index.set(node.source, node.id);
  }
  return index;
}

function linksIn(
  text: string,
  self: GraphNode,
  alias: AliasMap,
  refPaths: Map<string, string>,
): string[] {
  const found: string[] = [];
  const push = (id: string | undefined) => {
    if (!id || id === self.id) return;
    if (!found.includes(id)) found.push(id);
  };

  for (const match of text.matchAll(/playbooks\/([a-z0-9-]+)\.md/g)) {
    push(`playbook:${match[1]}`);
  }
  for (const match of text.matchAll(/(?:\.\.\/)?references\/\S+?\.md/g)) {
    const rel = match[0] ?? "";
    if (rel.includes("*")) {
      const folder = self.id.startsWith("skill:")
        ? self.id.slice("skill:".length)
        : self.group;
      const star = rel.slice(rel.indexOf("references/") + "references/".length);
      const prefix = `skills/${folder}/references/${star.slice(0, star.indexOf("*"))}`;
      for (const [path, id] of refPaths) {
        if (path.startsWith(prefix)) push(id);
      }
      continue;
    }
    push(resolveRef(self, rel, refPaths));
  }
  if (/scripts\/watch-pr\/watch-pr/.test(text)) push("script:watch-pr");
  if (/scripts\/worktree-audit\.sh/.test(text)) push("script:worktree-audit");
  if (/check-plan\.mjs/.test(text)) push("script:check-plan");
  if (/scripts\/orch\/orch\.ts|\borch init\b|\b`orch`\b/.test(text)) {
    push("script:orch");
  }
  if (/\bcontrol skill\b/i.test(text)) {
    push("external:control-ui");
    push("external:control-cli");
  }
  if (/\/loop\b/.test(text)) push("external:loop");
  if (/\bComment Sicko\b/.test(text)) push("agent:comment-sicko");

  const token =
    /`([^`]+)`|\*\*([^*]+)\*\*|\/([a-z][a-z0-9-]*)|\b(principle-[a-z0-9-]+)\b|\b([a-z0-9]+(?:-[a-z0-9]+){1,})\b/g;
  for (const match of text.matchAll(token)) {
    const raw = match[1] || match[2] || match[3] || match[4] || match[5] || "";
    const key = raw
      .trim()
      .toLowerCase()
      .replace(/^\//, "")
      .replace(/[.,:;]+$/, "");
    if (!key || negated(text, match.index ?? 0)) continue;
    if (match[5] && !match[1] && !match[2] && !match[3] && !match[4]) {
      push(alias.hyphen.get(key));
      continue;
    }
    push(alias.strict.get(key) || alias.hyphen.get(key));
  }

  for (const word of STRICT_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    for (const match of text.matchAll(re)) {
      if (negated(text, match.index ?? 0)) continue;
      push(alias.strict.get(word) || alias.hyphen.get(word));
    }
  }
  if (positiveMention(text, "how")) push("skill:how");
  if (positiveMention(text, "why")) push("skill:why");
  return found;
}

function negated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 32), index).toLowerCase();
  return /\bno\s+[`*_]*$/.test(before) || /\bnot\s+[`*_]*$/.test(before);
}

function positiveMention(text: string, name: string): boolean {
  const patterns = [
    new RegExp(`\\b${name}\\b(?=\\s+skill)`, "gi"),
    new RegExp("`" + name + "`", "gi"),
    new RegExp(`\\*\\*${name}\\*\\*`, "gi"),
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      if (!negated(text, match.index ?? 0)) return true;
    }
  }
  return false;
}

function shortLabel(text: string): string {
  const clean = text.replace(/\.$/, "").trim();
  if (clean.length <= 52) return clean;
  const cut = clean.slice(0, 52);
  const space = cut.lastIndexOf(" ");
  return `${(space > 24 ? cut.slice(0, space) : cut).trim()}...`;
}

function resolveRef(
  self: GraphNode,
  rel: string,
  refPaths: Map<string, string>,
): string | undefined {
  if (!self.source) return undefined;
  const base = self.source.split("/").slice(0, -1);
  const parts = rel.split("/");
  const stack = [...base];
  for (const part of parts) {
    if (part === "..") stack.pop();
    else if (part !== ".") stack.push(part);
  }
  return refPaths.get(stack.join("/"));
}

function collectEdges(
  nodes: Record<string, GraphNode>,
  triggers: string[],
  sections: string[],
): Edge[] {
  const edges: Edge[] = [];
  const push = (from: string, to: string, where: string) => {
    edges.push({ from, to, where });
  };
  for (const id of triggers) {
    const node = nodes[id];
    if (!node) continue;
    for (const block of node.blocks) {
      for (const to of block.links) push(id, to, "Trigger");
    }
  }
  for (const id of sections) {
    const node = nodes[id];
    if (!node) continue;
    for (const block of node.blocks) {
      for (const to of block.links) push(id, to, block.label);
    }
  }
  for (const node of Object.values(nodes)) {
    if (node.kind === "trigger" || node.kind === "section") continue;
    for (const block of node.blocks) {
      for (const to of block.links) push(node.id, to, block.label);
    }
  }
  return edges;
}

function markOutside(
  nodes: Record<string, GraphNode>,
  edges: Edge[],
  principles: string[],
): void {
  const reachable = new Set<string>(["skill:odd-mode", ...principles]);
  const queue = ["skill:odd-mode", ...principles];
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
  }
  for (const node of Object.values(nodes)) {
    if (node.kind === "playbook" || node.kind === "trigger" || node.kind === "section") {
      queue.push(node.id);
      reachable.add(node.id);
    }
  }
  while (queue.length) {
    const id = queue.pop();
    if (!id) break;
    for (const next of outgoing.get(id) ?? []) {
      if (reachable.has(next)) continue;
      reachable.add(next);
      queue.push(next);
    }
  }
  for (const node of Object.values(nodes)) {
    if (node.id.startsWith("automation:")) {
      node.outside = true;
      continue;
    }
    if (node.kind === "reference") continue;
    if (!reachable.has(node.id) && (node.kind === "skill" || node.kind === "principle")) {
      node.outside = true;
    }
  }
}

export function inbound(graph: Graph, id: string): Edge[] {
  return graph.edges.filter((edge) => edge.to === id);
}

function parseFrontmatter(text: string): Record<string, string> {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) return {};
  const lines = text.slice(4, end).split("\n");
  const meta: Record<string, string> = {};
  let key = "";
  let buf: string[] = [];
  let fold = false;
  const flush = () => {
    if (!key) return;
    meta[key] = (fold ? buf.join(" ") : buf.join("\n")).trim();
    key = "";
    buf = [];
    fold = false;
  };
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match && !line.startsWith(" ") && !line.startsWith("\t")) {
      flush();
      key = match[1] ?? "";
      const rest = (match[2] ?? "").trim();
      if (rest === ">-" || rest === ">" || rest === "|" || rest === "|-") {
        fold = true;
      } else {
        buf = [unquote(rest)];
      }
    } else if (key) {
      buf.push(line.trim());
    }
  }
  flush();
  return meta;
}

function stripFrontmatter(text: string): string {
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) return text;
  return text.slice(end + 5).replace(/^\n/, "");
}

function parseBlocks(
  body: string,
  mode: "playbook" | "skill",
): { lead: string; reply: string; blocks: Block[] } {
  const lines = body.split("\n");
  let lead = "";
  let reply = "";
  const blocks: Block[] = [];
  const cursor: {
    block: { label: string; lines: string[]; template: boolean } | null;
  } = { block: null };
  let inFence = false;
  let fenceLang = "";
  let fenceLines: string[] = [];
  let started = false;
  let sawTitle = false;
  let replyMode = false;

  const flush = () => {
    const block = cursor.block;
    if (!block) return;
    const text = block.lines.join("\n").trim();
    if (text) {
      blocks.push({
        label: block.label,
        text,
        links: [],
        template: block.template,
      });
    }
    cursor.block = null;
  };

  const start = (label: string, first: string, template = false) => {
    flush();
    started = true;
    cursor.block = { label, lines: first ? [first] : [], template };
  };

  for (const line of lines) {
    if (replyMode) {
      reply += `${line}\n`;
      continue;
    }
    if (line.startsWith("```")) {
      if (!inFence) {
        inFence = true;
        fenceLang = line.slice(3).trim();
        fenceLines = [];
      } else {
        inFence = false;
        const fenced = fenceLines.join("\n");
        if (fenceLang === "markdown" || fenceLines.length > 40) {
          start("Template", fenced, true);
          flush();
        } else if (cursor.block) {
          cursor.block.lines.push("```" + fenceLang, fenced, "```");
        } else {
          lead += `\n\`\`\`${fenceLang}\n${fenced}\n\`\`\`\n`;
        }
        fenceLang = "";
        fenceLines = [];
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }
    if (/^\*\*Reply:\*\*/.test(line)) {
      flush();
      replyMode = true;
      reply = line.replace(/^\*\*Reply:\*\*\s*/, "");
      continue;
    }
    const titleLine =
      mode === "playbook" ? /^###\s+/.test(line) : /^#\s+/.test(line);
    if (!sawTitle && titleLine) {
      sawTitle = true;
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    const bold =
      mode === "playbook"
        ? line.match(/^\*\*([^*]{2,48})\.\*\*(?:\s*(.*))?$/)
        : null;
    const boldLabel = bold?.[1] ?? "";
    const boldOk =
      !!bold &&
      boldLabel.split(".").length === 1 &&
      !/^you own/i.test(boldLabel) &&
      !/^reply$/i.test(boldLabel);

    if (heading && (mode === "skill" || heading[1] === "####")) {
      start(heading[2] ?? "Section", "");
      continue;
    }
    if (numbered) {
      const rest = numbered[2] ?? "";
      const named = rest.match(/^\*\*([^*]+?)\*\*/);
      const label = named?.[1]
        ? `${numbered[1]}. ${shortLabel(named[1])}`
        : `Step ${numbered[1]}`;
      start(label, line);
      continue;
    }
    if (boldOk && bold) {
      start(bold[1] ?? "Section", line);
      continue;
    }
    if (!started) lead += `${line}\n`;
    else if (cursor.block) cursor.block.lines.push(line);
    else lead += `${line}\n`;
  }
  flush();
  return { lead: lead.trim(), reply: reply.trim(), blocks };
}

function bullets(section: string): string[] {
  const chunks = section.split(/\n(?=- )/);
  const items: string[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith("- ")) continue;
    items.push(
      trimmed
        .replace(/^- /, "")
        .replace(/\n[ \t]+/g, " ")
        .trim(),
    );
  }
  return items;
}

function sliceSection(body: string, start: string, end: string): string {
  const from = body.indexOf(start);
  if (from < 0) return "";
  const after = from + start.length;
  const to = end ? body.indexOf(end, after) : -1;
  return body.slice(after, to < 0 ? undefined : to);
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function stripHeading(text: string): string {
  return text.replace(/^#\s+.+\n+/, "");
}

function firstParagraph(text: string): string {
  const parts = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] ?? "";
}

function firstSentence(text: string): string {
  const plain = clean(text);
  const match = plain.match(/^.{20,220}?\./);
  return match?.[0] ?? plain.slice(0, 220);
}

function clean(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
