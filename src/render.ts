import { inbound } from "./parse";
import type { Block, Graph, GraphNode } from "./types";

export type View =
  | { kind: "map" }
  | { kind: "routing" }
  | { kind: "node"; id: string };

export function parseHash(hash: string): View {
  const raw = hash.replace(/^#/, "");
  if (raw === "" || raw === "/" || raw === "/map") return { kind: "map" };
  if (raw === "/routing") return { kind: "routing" };
  const node = raw.match(/^\/node\/(.+)$/);
  if (node?.[1]) return { kind: "node", id: decodeURIComponent(node[1]) };
  const playbook = raw.match(/^\/playbook\/([a-z0-9-]+)$/);
  if (playbook?.[1]) return { kind: "node", id: `playbook:${playbook[1]}` };
  const skill = raw.match(/^\/skill\/([a-z0-9-]+)$/);
  if (skill?.[1]) return { kind: "node", id: `skill:${skill[1]}` };
  return { kind: "map" };
}

export function hrefFor(view: View): string {
  if (view.kind === "map") return "#/";
  if (view.kind === "routing") return "#/routing";
  return `#/node/${encodeURIComponent(view.id)}`;
}

export function renderApp(graph: Graph, view: View, query: string): string {
  return `
    <div class="app">
      ${renderTop(graph, query)}
      <div class="frame">
        ${renderNav(graph, view, query)}
        <main id="content">${renderMain(graph, view)}</main>
      </div>
    </div>
  `;
}

function renderTop(graph: Graph, query: string): string {
  return `
    <header class="top">
      <a class="brand" href="#/">odd-stack paths</a>
      <p class="tag">Read-only map of <code>/odd-mode</code>. Parsed from the skill, playbook, and agent files.</p>
      <form class="search" role="search">
        <label for="q">Find</label>
        <input id="q" name="q" type="search" value="${esc(query)}" placeholder="Playbook, skill, or command" autocomplete="off" />
      </form>
      <p class="keyword" data-keyword-required="${graph.keyword.required}">
        Prompts do not need specific keywords.
      </p>
    </header>
  `;
}

function renderNav(graph: Graph, view: View, query: string): string {
  const q = query.trim().toLowerCase();
  const match = (node: GraphNode | undefined, extra = "") => {
    if (!q) return true;
    const hay = `${node?.name ?? ""} ${node?.summary ?? ""} ${extra}`.toLowerCase();
    return hay.includes(q);
  };
  const routeLinks = graph.routes
    .filter((route) => match(graph.nodes[route.targetId], route.condition))
    .map((route) => navLink(route.targetId, route.title, route.condition, view))
    .join("");
  const skillLinks = reachableSkills(graph)
    .filter((node) => match(node))
    .map((node) => navLink(node.id, node.name, node.summary, view))
    .join("");
  const outsideLinks = graph.outside
    .map((id) => graph.nodes[id])
    .filter((node): node is GraphNode => !!node && match(node))
    .map((node) => navLink(node.id, node.name, node.summary, view))
    .join("");
  return `
    <details class="nav-drawer" open>
      <summary>Browse paths</summary>
      <nav class="nav" aria-label="Paths">
      <section>
        <h2>Entry</h2>
        ${navLink("skill:odd-mode", "/odd-mode", "Slash command and custom mode", view)}
        <a class="nav-link ${view.kind === "routing" ? "is-current" : ""}" href="#/routing">
          <span>Routing layer</span>
          <small>Triggers, principles, subagents</small>
        </a>
      </section>
      <section>
        <h2>Routes <span>${graph.routes.length}</span></h2>
        ${routeLinks || `<p class="empty">No routes match.</p>`}
      </section>
      <section>
        <h2>Skills on these paths</h2>
        ${skillLinks || `<p class="empty">No skills match.</p>`}
      </section>
      ${
        outsideLinks
          ? `<section><h2>Not routed from odd-mode</h2>${outsideLinks}</section>`
          : ""
      }
    </nav>
    </details>
  `;
}

function navLink(id: string, title: string, detail: string, view: View): string {
  const current = view.kind === "node" && view.id === id;
  return `
    <a class="nav-link ${current ? "is-current" : ""}" href="${hrefFor({ kind: "node", id })}" data-nav="${esc(id)}">
      <span>${esc(title)}</span>
      <small>${esc(clip(detail, 110))}</small>
    </a>
  `;
}

function renderMain(graph: Graph, view: View): string {
  if (view.kind === "map") return renderMap(graph);
  if (view.kind === "routing") return renderRouting(graph);
  const node = graph.nodes[view.id];
  if (!node) {
    return `<article class="sheet"><h1>Missing node</h1><p>No source file produced <code>${esc(view.id)}</code>.</p></article>`;
  }
  if (node.kind === "playbook" || node.id === "skill:figure-it-out") {
    return renderPath(graph, node);
  }
  return renderNodePage(graph, node, 0);
}

function renderMap(graph: Graph): string {
  const routes = graph.routes
    .map((route, index) => {
      const node = graph.nodes[route.targetId];
      return `
        <li>
          <a href="${hrefFor({ kind: "node", id: route.targetId })}" data-route="${esc(route.playbookId ?? "figure-it-out")}">
            <span class="idx">${index + 1}</span>
            <span>
              <strong>${esc(route.title)}</strong>
              <em>${esc(route.condition)}</em>
              <small>${esc(node?.source ?? route.targetId)}</small>
            </span>
          </a>
        </li>
      `;
    })
    .join("");
  const triggers = graph.triggers
    .map((id) => graph.nodes[id])
    .filter((node): node is GraphNode => !!node)
    .map(
      (node) =>
        `<li><a href="#/routing">${esc(node.name)}</a></li>`,
    )
    .join("");
  return `
    <article class="sheet" data-view="map">
      <p class="kicker">Entry</p>
      <h1><code>/odd-mode</code> reads the task and opens one path.</h1>
      <p class="lede">${esc(graph.keyword.summary)}</p>
      <ul class="facts">
        <li>Slash command. The words after <code>/odd-mode</code> are the task.</li>
        <li>Custom mode is ${graph.entry.mode ? "on" : "off"} in the skill frontmatter (<code>mode: true</code>). Pinning it keeps the skill in context. The reminder says: ${esc(graph.entry.reminder)}</li>
        <li>Model auto-invoke is ${graph.entry.disableModelInvocation ? "off" : "on"} (<code>disable-model-invocation: true</code>). The user attaches the skill. The description alone does not start it.</li>
        <li>${esc(graph.hooksNote)}</li>
      </ul>
      <h2>Before and during routing</h2>
      <p>These triggers live in the Non-negotiables section. They can run before a playbook is chosen, or while it runs. Principles ground every trigger. <a href="#/routing">Open the routing layer</a> to read each one in full.</p>
      <ul class="trigger-index">${triggers}</ul>
      <h2>Every route</h2>
      <p>Order follows the Playbooks section in <code>skills/odd-mode/SKILL.md</code>. The last row is the skill the same section uses when no bundled playbook fits, or when the work is large enough to need its own playbook.</p>
      <ol class="route-list">${routes}</ol>
      ${renderAutomations(graph)}
    </article>
  `;
}

function renderRouting(graph: Graph): string {
  const triggers = graph.triggers
    .map((id) => graph.nodes[id])
    .filter((node): node is GraphNode => !!node)
    .map((node) => renderNodePage(graph, node, 1))
    .join("");
  const principles = graph.principles
    .map((id) => graph.nodes[id])
    .filter((node): node is GraphNode => !!node);
  let lastGroup = "";
  const principleHtml = principles
    .map((node) => {
      const head =
        node.group !== lastGroup
          ? `<h3 class="group">${esc(node.group)}</h3>`
          : "";
      lastGroup = node.group;
      return `
        ${head}
        <li>
          <a href="${hrefFor({ kind: "node", id: node.id })}">${esc(node.name)}</a>
          <span>${esc(node.when || node.summary)}</span>
        </li>
      `;
    })
    .join("");
  const sections = ["section:autonomy", "section:subagents", "section:writing-the-reply", "section:comments"]
    .map((id) => graph.nodes[id])
    .filter((node): node is GraphNode => !!node)
    .map((node) => renderNodePage(graph, node, 1))
    .join("");
  const quotes = graph.keyword.evidence
    .map(
      (item) =>
        `<blockquote><p>${esc(item.quote)}</p><cite>${esc(item.source)}</cite></blockquote>`,
    )
    .join("");
  return `
    <article class="sheet" data-view="routing">
      <p class="kicker">Routing</p>
      <h1>What happens before a playbook owns the task</h1>
      <p class="lede">${esc(graph.keyword.summary)}</p>
      <div class="quotes">${quotes}</div>
      <p>Cues the sources name, none of them required: ${graph.keyword.cues.map((cue) => `<code>${esc(cue)}</code>`).join(" ")}</p>
      <h2>Non-negotiable triggers</h2>
      <p>${esc(graph.nodes["section:triggers-intro"]?.summary ?? "")}</p>
      <div class="stack">${triggers}</div>
      <h2>Principles</h2>
      <p>The Principles section says it grounds every trigger. Each line below is the index entry. Open a principle to read the leaf skill.</p>
      <ol class="principles">${principleHtml}</ol>
      <h2>Rules that sit on the path</h2>
      ${renderNodePage(graph, required(graph, "rule:odd-stack-models"), 1)}
      ${renderNodePage(graph, required(graph, "skill:setup-odd-stack"), 1)}
      <p>${esc(graph.hooksNote)}</p>
      <h2>Cross-cutting sections</h2>
      <div class="stack">${sections}</div>
    </article>
  `;
}

function renderPath(graph: Graph, node: GraphNode): string {
  const route = graph.routes.find((item) => item.targetId === node.id);
  const outline = node.blocks
    .map((block, index) => {
      const chips = block.links
        .map((id) => graph.nodes[id]?.name ?? id)
        .slice(0, 8);
      return `<li><a href="#step-${index}">${esc(block.label)}</a>${
        chips.length ? `<small>${esc(chips.join(" · "))}</small>` : ""
      }</li>`;
    })
    .join("");
  const steps = node.blocks.map((block, index) => renderStep(graph, block, index)).join("");
  return `
    <article class="sheet path" data-view="path" data-path="${esc(node.id)}">
      <p class="kicker">Full path</p>
      <ol class="spine">
        <li>
          <h2>1. Entry</h2>
          <p><a href="#/node/skill%3Aodd-mode"><code>/odd-mode</code></a> is the slash command. ${esc(graph.nodes["skill:odd-mode"]?.summary ?? "")}</p>
          <p data-keyword-required="false">${esc(graph.keyword.summary)}</p>
        </li>
        <li>
          <h2>2. Route</h2>
          <p>${route ? esc(route.condition) : "Opened directly."}</p>
          <p>Subagents spawned inside a playbook step for code use <a href="${hrefFor({ kind: "node", id: "agent:odd-agent" })}">odd-agent</a>, which reads this same skill before it works. <code>how</code>, <code>why</code>, <code>interrogate</code>, <code>reflect</code>, and <code>swarm</code> keep the subagent type they name.</p>
        </li>
        <li>
          <h2>3. ${esc(node.name)}</h2>
          <p class="source">${esc(node.source ?? "")}</p>
          ${
            node.lead
              ? `<div class="prose">${formatText(node.lead)}</div>`
              : `<p>${esc(node.summary)}</p>`
          }
        </li>
      </ol>
      <h2>On this branch</h2>
      <ol class="outline">${outline}</ol>
      <div class="steps">${steps}</div>
      ${
        node.reply
          ? `<section class="reply"><h2>Reply</h2><div class="prose">${formatText(node.reply)}</div></section>`
          : ""
      }
      <p class="footnote"><a href="#/routing">Routing layer</a> lists the triggers and principles that can already be in play on this path.</p>
    </article>
  `;
}

function renderStep(graph: Graph, block: Block, index: number): string {
  const children = block.links
    .map((id) => graph.nodes[id])
    .filter((node): node is GraphNode => !!node)
    .map((node) => renderChild(graph, node))
    .join("");
  return `
    <section class="step" id="step-${index}" data-step="${esc(block.label)}" ${block.template ? 'data-template="true"' : ""}>
      <h2>${esc(block.label)}</h2>
      <div class="prose ${block.template ? "template" : ""}">${formatText(block.text)}</div>
      ${
        children
          ? `<div class="children"><p class="connect">Connects to</p>${children}</div>`
          : ""
      }
    </section>
  `;
}

function renderChild(graph: Graph, node: GraphNode): string {
  const inner = node.blocks
    .map(
      (block) => `
        <section class="substep">
          <h4>${esc(block.label)}</h4>
          <div class="prose ${block.template ? "template" : ""}">${formatText(block.text)}</div>
          ${chipRow(graph, block.links)}
        </section>
      `,
    )
    .join("");
  return `
    <article class="child" data-node="${esc(node.id)}" data-kind="${esc(node.kind)}">
      <header>
        <span class="kind">${esc(node.kind)}</span>
        <h3><a href="${hrefFor({ kind: "node", id: node.id })}">${esc(node.name)}</a></h3>
        <p>${esc(node.summary)}</p>
        ${node.source ? `<p class="source">${esc(node.source)}</p>` : `<p class="source">Not a file in this repo.</p>`}
      </header>
      ${node.lead ? `<div class="prose">${formatText(node.lead)}</div>` : ""}
      ${inner}
      ${node.reply ? `<p class="reply-line"><strong>Reply.</strong> ${esc(node.reply)}</p>` : ""}
    </article>
  `;
}

function renderNodePage(graph: Graph, node: GraphNode, depth: number): string {
  const from = inbound(graph, node.id);
  const seen = new Set<string>();
  const inboundHtml = from
    .filter((edge) => {
      const key = `${edge.from}:${edge.where}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24)
    .map((edge) => {
      const source = graph.nodes[edge.from];
      const name = source?.name ?? edge.from;
      return `<li><a href="${hrefFor({ kind: "node", id: edge.from })}">${esc(name)}</a> <span>${esc(edge.where)}</span></li>`;
    })
    .join("");
  const body =
    depth > 0
      ? node.blocks
          .map(
            (block) => `
              <section class="substep">
                <h3>${esc(block.label)}</h3>
                <div class="prose ${block.template ? "template" : ""}">${formatText(block.text)}</div>
                ${chipRow(graph, block.links)}
              </section>
            `,
          )
          .join("")
      : node.blocks.map((block, index) => renderStep(graph, block, index)).join("");
  return `
    <article class="sheet node-page" data-view="node" data-node="${esc(node.id)}" data-kind="${esc(node.kind)}">
      <p class="kicker">${esc(node.kind)}${node.outside ? " · not on the odd-mode route" : ""}</p>
      <h1>${esc(node.name)}</h1>
      <p class="lede">${esc(node.when || node.summary)}</p>
      ${node.summary && node.when ? `<p>${esc(node.summary)}</p>` : ""}
      <p class="source">${node.source ? esc(node.source) : "Not a file in this repo."}</p>
      ${
        inboundHtml
          ? `<h2>How it connects</h2><ul class="inbound">${inboundHtml}</ul>`
          : ""
      }
      ${depth === 0 && node.lead ? `<div class="prose">${formatText(node.lead)}</div>` : ""}
      ${body}
      ${node.reply ? `<section class="reply"><h2>Reply</h2><div class="prose">${formatText(node.reply)}</div></section>` : ""}
    </article>
  `;
}

function chipRow(graph: Graph, ids: string[]): string {
  if (!ids.length) return "";
  const chips = ids
    .map((id) => {
      const node = graph.nodes[id];
      return `<a class="chip" href="${hrefFor({ kind: "node", id })}" data-kind="${esc(node?.kind ?? "skill")}">${esc(node?.name ?? id)}</a>`;
    })
    .join("");
  return `<p class="chips">${chips}</p>`;
}

function renderAutomations(graph: Graph): string {
  if (!graph.automations.length) return "";
  const items = graph.automations
    .map((id) => graph.nodes[id])
    .filter((node): node is GraphNode => !!node)
    .map(
      (node) =>
        `<li><a href="${hrefFor({ kind: "node", id: node.id })}">${esc(node.name)}</a> <span>${esc(node.summary)}</span></li>`,
    )
    .join("");
  return `
    <h2>Separate from this route</h2>
    <p><code>automations/benny</code> is a different pack in this repo. odd-mode does not route to it.</p>
    <ul class="outside">${items}</ul>
  `;
}

function reachableSkills(graph: Graph): GraphNode[] {
  return Object.values(graph.nodes)
    .filter(
      (node) =>
        !node.outside &&
        node.kind === "skill" &&
        node.id !== "skill:odd-mode" &&
        node.id !== "skill:figure-it-out",
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function required(graph: Graph, id: string): GraphNode {
  const node = graph.nodes[id];
  if (!node) {
    throw new Error(`missing ${id}`);
  }
  return node;
}

function formatText(text: string): string {
  const escaped = esc(text.trim())
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
