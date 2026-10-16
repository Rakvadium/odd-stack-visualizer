import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLES, GROUPS, OVERRIDES } from "./curated";
import { buildStack, type SourceFile } from "./stack";

const repo = resolve(__dirname, "../../odd-stack");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files: SourceFile[] = ["skills", "agents"].flatMap((top) =>
  walk(join(repo, top))
    .filter((p) => /\.(md|tsv)$/.test(p))
    .map((p) => ({ path: relative(repo, p).replace(/\\/g, "/"), text: readFileSync(p, "utf8") })),
);

const stack = buildStack(files);
const flow = (key: string) => {
  const found = stack.flows.get(key as never);
  if (!found) throw new Error(`no flow ${key}`);
  return found;
};
const stepRefs = (key: string, step: number) => flow(key).stations[step - 1].refs;

describe("routing", () => {
  it("reads every playbook route from odd-mode", () => {
    expect(stack.routes).toHaveLength(23);
    for (const route of stack.routes) expect(flow(route.key).stations.length).toBeGreaterThan(0);
  });

  it("places every route in exactly one group", () => {
    const grouped = GROUPS.flatMap((g) => g.members);
    for (const route of stack.routes) expect(grouped.filter((k) => k === route.key)).toHaveLength(1);
    for (const key of grouped) expect(stack.flows.has(key)).toBe(true);
  });

  it("points curated examples and overrides at real flows", () => {
    for (const key of Object.keys(EXAMPLES)) expect(stack.flows.has(key as never)).toBe(true);
    for (const o of OVERRIDES) expect(stack.flows.has(o.target)).toBe(true);
  });

  it("keeps quoted example phrases from the route text", () => {
    const babysit = stack.routes.find((r) => r.key === "playbook:babysit")!;
    expect(babysit.when).toBe("Driving a PR or a stack to merge-ready: conflicts, review threads, CI.");
    const prototype = stack.routes.find((r) => r.key === "playbook:prototype")!;
    expect(prototype.phrases).toEqual(["prototype", "mock it up", "try this layout", "sketch it to decide"]);
  });
});

describe("playbook steps", () => {
  it("splits Bug fix into its six steps with the skills each one calls", () => {
    const bugFix = flow("playbook:bug-fix");
    expect(bugFix.owns).toBe("You own this task. Plan, review, verify");
    expect(bugFix.stations.map((s) => s.label)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(stepRefs("playbook:bug-fix", 2)).toEqual(["skill:how", "skill:why", "tool:loop"]);
    expect(stepRefs("playbook:bug-fix", 3)).toEqual(["skill:tdd", "principle:principle-sequence-verifiable-units"]);
    expect(stepRefs("playbook:bug-fix", 6)).toEqual(["playbook:opening-a-pr"]);
    expect(bugFix.reply).toMatch(/^what was broken, root cause/);
  });

  it("finds Feature's step 1 call to the how skill", () => {
    expect(stepRefs("playbook:feature", 1)).toEqual(["skill:how"]);
    expect(stepRefs("playbook:feature", 2)).toEqual(["skill:architect"]);
  });

  it("finds handoffs written in plain prose", () => {
    const notes = flow("playbook:investigation").notes.flatMap((n) => n.refs);
    expect(notes).toEqual(expect.arrayContaining(["playbook:bug-fix", "playbook:feature"]));
    expect(stepRefs("playbook:prototype", 1)).toContain("playbook:feature");
  });

  it("reads bold-lead paragraphs as stations when a playbook has no numbered list", () => {
    expect(flow("playbook:opening-a-pr").stations.map((s) => s.title)).toEqual([
      "Worktree",
      "Commits",
      "Branches",
      "PRs",
      "Titles",
      "Descriptions",
      "Forge",
      "Remotes",
      "Built-in PR tool",
      "Size and stacks",
      "Readiness",
      "Deploys",
      "Done",
      "No checks configured",
      "Babysit",
    ]);
  });

  it("takes Orchestrate's steps from its Steps heading", () => {
    expect(flow("playbook:orchestrate").stations.map((s) => s.title)).toEqual([
      "Frame",
      "Install the runtime",
      "Pilot",
      "Scale",
      "Drain",
      "Land",
      "Close",
    ]);
  });

  it("keeps Eval's blinding rules out of its steps", () => {
    const evalFlow = flow("playbook:eval");
    expect(evalFlow.stations).toHaveLength(7);
    expect(evalFlow.intro.map((s) => s.title)).toContain("Non-negotiables for blinding");
  });
});

describe("skills", () => {
  it("reads skill phases as stations", () => {
    expect(flow("skill:architect").stations.map((s) => `${s.label} ${s.title}`)).toEqual([
      "A Ground the problem",
      "B Sketch",
      "C Agree (opt-in)",
      "D Implement against the sketch",
      "E Scrap when the architecture is wrong",
    ]);
    expect(flow("skill:architect").stations[0].refs).toEqual(["skill:how", "skill:why"]);
  });

  it("does not read plain-English 'how' as the how skill", () => {
    expect(stack.lexicon.refs("how does X work, why was Y built", "skills/odd-mode")).toEqual([]);
    expect(stack.lexicon.refs("Route through the **how** skill.", "skills/odd-mode")).toEqual(["skill:how"]);
  });
});

describe("always-on layer", () => {
  it("reads the non-negotiable triggers and their targets", () => {
    expect(stack.triggers.length).toBeGreaterThanOrEqual(15);
    const babysit = stack.triggers.find((t) => t.when.startsWith("Any PR-status request"))!;
    expect(babysit.refs).toContain("playbook:babysit");
  });

  it("reads all 24 principles with their groups", () => {
    expect(stack.principles).toHaveLength(24);
    expect(new Set(stack.principles.map((p) => p.group))).toEqual(
      new Set(["Core", "Architecture", "Verification", "Delegation", "Meta"]),
    );
  });

  it("indexes which flows use a skill", () => {
    const users = new Set(stack.usage.get("skill:how")!.map((u) => u.flow));
    for (const key of ["playbook:feature", "playbook:bug-fix", "playbook:investigation", "skill:architect"]) {
      expect(users.has(key as never)).toBe(true);
    }
  });
});
