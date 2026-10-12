import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGraph, type SourceFile } from "./parse";

const repo = join(import.meta.dirname, "../..");

function load(dir: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!name.endsWith(".md")) continue;
      out.push({
        path: relative(repo, path).split("\\").join("/"),
        text: readFileSync(path, "utf8"),
      });
    }
  };
  walk(join(repo, dir));
  return out;
}

const graph = buildGraph([
  ...load("skills"),
  ...load("agents"),
  ...load("automations"),
  {
    path: "docs/guide/02-odd-mode.md",
    text: readFileSync(join(repo, "docs/guide/02-odd-mode.md"), "utf8"),
  },
]);

function links(id: string): string[] {
  const node = graph.nodes[id];
  if (!node) return [];
  return [...new Set(node.blocks.flatMap((block) => block.links))];
}

describe("odd-mode graph", () => {
  it("does not require keywords and records the cue phrases", () => {
    expect(graph.keyword.required).toBe(false);
    expect(graph.keyword.evidence.map((item) => item.quote)).toEqual(
      expect.arrayContaining(["/odd-mode do it", "You don't write a spec. You say what's wrong or what you want"]),
    );
    expect(graph.keyword.cues).toEqual(expect.arrayContaining(["new task", "check on PR", "going to bed"]));
    expect(graph.entry.mode).toBe(true);
    expect(graph.entry.disableModelInvocation).toBe(true);
  });

  it("routes to every playbook plus figure-it-out", () => {
    const playbooks = Object.values(graph.nodes).filter((node) => node.kind === "playbook");
    expect(playbooks).toHaveLength(23);
    const routed = graph.routes.map((route) => route.targetId);
    for (const playbook of playbooks) {
      expect(routed).toContain(playbook.id);
    }
    expect(routed).toContain("skill:figure-it-out");
  });

  it("connects bug fix through the skills the playbook names", () => {
    const ids = links("playbook:bug-fix");
    expect(ids).toEqual(
      expect.arrayContaining([
        "skill:how",
        "skill:why",
        "skill:architect",
        "skill:tdd",
        "skill:principle-sequence-verifiable-units",
        "playbook:opening-a-pr",
        "external:loop",
        "external:control-ui",
        "external:control-cli",
      ]),
    );
  });

  it("keeps investigation read-only and still names how, why, and unslop", () => {
    const ids = links("playbook:investigation");
    expect(ids).toEqual(expect.arrayContaining(["skill:how", "skill:why", "skill:unslop"]));
    expect(ids).not.toContain("playbook:opening-a-pr");
    expect(ids).not.toContain("skill:architect");
  });

  it("follows feature into design skills and the PR playbook", () => {
    const ids = links("playbook:feature");
    expect(ids).toEqual(
      expect.arrayContaining([
        "skill:how",
        "skill:architect",
        "skill:arena",
        "skill:interrogate",
        "skill:principle-model-the-domain",
        "playbook:opening-a-pr",
      ]),
    );
  });

  it("expands opening a PR into commands and skills", () => {
    const ids = links("playbook:opening-a-pr");
    expect(ids).toEqual(
      expect.arrayContaining([
        "external:deslop",
        "skill:no-comments",
        "skill:technical-writing",
        "skill:unslop",
        "skill:interrogate",
        "playbook:babysit",
      ]),
    );
  });

  it("gives how and no-comments their own trees", () => {
    expect(links("skill:how")).toEqual(
      expect.arrayContaining([
        "rule:odd-stack-models",
        "ref:how/explorer-prompt",
        "ref:how/explainer-prompt",
      ]),
    );
    expect(links("skill:no-comments")).toEqual(
      expect.arrayContaining(["agent:comment-sicko", "skill:how", "skill:why", "skill:architect"]),
    );
    const howLabels = graph.nodes["skill:how"]?.blocks.map((block) => block.label) ?? [];
    expect(howLabels.some((label) => /simple|Assess/i.test(label))).toBe(true);
    expect(howLabels.some((label) => /Explore/i.test(label))).toBe(true);
  });

  it("leaves direct-only skills off the route and keeps benny separate", () => {
    expect(graph.outside).toContain("skill:odd-help");
    expect(graph.outside).toContain("skill:bro");
    expect(graph.automations.length).toBeGreaterThan(0);
    expect(graph.hooksNote.toLowerCase()).toContain("no hooks");
  });
});
