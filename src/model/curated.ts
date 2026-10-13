import type { EntityKey } from "./types";

/**
 * Presentation facts the markdown sources do not carry. Everything else in the app is
 * parsed from the skill, playbook, and agent files at build time.
 */

export interface RouteGroup {
  title: string;
  blurb: string;
  members: EntityKey[];
}

export const GROUPS: RouteGroup[] = [
  {
    title: "Understand",
    blurb: "Answer a question or pick up prior work. No code changes.",
    members: ["playbook:investigation", "playbook:session-pickup"],
  },
  {
    title: "Diagnose",
    blurb: "Find the cause from live or captured evidence.",
    members: ["playbook:runtime-forensics", "playbook:trace-forensics"],
  },
  {
    title: "Fix and speed up",
    blurb: "Correct a defect or improve a measured number.",
    members: ["playbook:bug-fix", "playbook:perf-issue", "playbook:hillclimb"],
  },
  {
    title: "Build and reshape",
    blurb: "New behavior, new structure, or a throwaway sketch.",
    members: ["playbook:feature", "playbook:refactoring", "playbook:prototype", "playbook:visual-parity"],
  },
  {
    title: "Skills and evals",
    blurb: "Change the agent's own instructions and test them.",
    members: ["playbook:authoring-a-skill", "playbook:eval"],
  },
  {
    title: "Plan and run long",
    blurb: "Multi-PR plans, unattended runs, and programs.",
    members: [
      "playbook:multi-phase-plan",
      "skill:figure-it-out",
      "playbook:autonomous-run",
      "playbook:autopilot-full",
      "playbook:autopilot-stack",
      "playbook:orchestrate",
    ],
  },
  {
    title: "Pull requests",
    blurb: "Open, babysit, and land PRs.",
    members: ["playbook:opening-a-pr", "playbook:babysit", "playbook:shipping"],
  },
  {
    title: "Housekeeping",
    blurb: "Stop cleanly or reclaim disk.",
    members: ["playbook:pause-safely", "playbook:worktree-cleanup"],
  },
];

export interface Example {
  prompt: string;
  source: string;
}

export const EXAMPLES: Partial<Record<EntityKey, Example>> = {
  "playbook:investigation": {
    prompt:
      "/odd-mode investigate why background jobs time out every few hours. give me what we know, what data you used, and your best hypotheses. don't change any code yet.",
    source: "docs/guide/03-understand.md",
  },
  "playbook:session-pickup": {
    prompt:
      "/odd-mode take over this branch. read the decision log, figure out what's done, and continue from there. don't redo finished work.",
    source: "docs/guide/03-understand.md",
  },
  "playbook:trace-forensics": {
    prompt:
      "/odd-mode here's a cpuprofile from the slow startup. tell me where the time goes and which source lines own it. no fix yet.",
    source: "docs/guide/05-build-and-clean.md",
  },
  "playbook:bug-fix": {
    prompt: "/odd-mode users get two notifications after a retry. repro first, then fix and verify.",
    source: "docs/guide/02-odd-mode.md",
  },
  "playbook:perf-issue": {
    prompt: "/odd-mode startup takes 1.8s on this fixture. trace it, fix the measured cause, show me before and after.",
    source: "docs/guide/05-build-and-clean.md",
  },
  "playbook:feature": {
    prompt: "/odd-mode add a --json flag to this command. text output stays byte-identical. verify both.",
    source: "docs/guide/01-setup.md",
  },
  "playbook:refactoring": {
    prompt:
      "/odd-mode move parsing into one module, zero behavior change. record the current output first and prove it's unchanged after.",
    source: "docs/guide/05-build-and-clean.md",
  },
  "playbook:prototype": {
    prompt: "/odd-mode prototype a few options for the new dropdown menu. take screenshots or videos for me to compare.",
    source: "docs/guide/04-design.md",
  },
  "playbook:authoring-a-skill": {
    prompt: "/odd-mode write a skill for verifying database migrations in this repo",
    source: "docs/guide/09-make-it-yours.md",
  },
  "playbook:eval": {
    prompt: "/odd-mode run the eval playbook on this skill change. same task for both variants, candidates stay blind.",
    source: "docs/guide/09-make-it-yours.md",
  },
  "playbook:multi-phase-plan": {
    prompt: "/odd-mode turn this design into a plan. small verifiable PRs, each with its own verification steps.",
    source: "docs/guide/04-design.md",
  },
  "skill:figure-it-out": {
    prompt: "/odd-mode im stepping away. keep going until the migration check reports zero old callers. log your decisions.",
    source: "docs/guide/02-odd-mode.md",
  },
  "playbook:autopilot-full": {
    prompt: "/odd-mode full autopilot on this queue. each item is independent. i want them merged by morning.",
    source: "docs/guide/07-overnight.md",
  },
  "playbook:autopilot-stack": {
    prompt: "/odd-mode autopilot these five changes but stack them, don't ship. i'll land the stack in the morning.",
    source: "docs/guide/07-overnight.md",
  },
  "playbook:orchestrate": {
    prompt:
      "/odd-mode orchestrate the store migration. own it until every package is converted and merged. i'll check in twice a day.",
    source: "docs/guide/07-overnight.md",
  },
  "playbook:opening-a-pr": {
    prompt: "/odd-mode open the pr. small ordered commits, evidence in the description.",
    source: "docs/guide/06-verify-and-ship.md",
  },
  "playbook:babysit": {
    prompt: "/odd-mode babysit this pr. get it green.",
    source: "docs/guide/06-verify-and-ship.md",
  },
  "playbook:shipping": {
    prompt: "/odd-mode land the stack.",
    source: "docs/guide/06-verify-and-ship.md",
  },
  "playbook:worktree-cleanup": {
    prompt: "/odd-mode what's eating my disk? prune the worktrees that are safe to prune.",
    source: "docs/guide/02-odd-mode.md",
  },
};

/** Routes odd-mode checks before ordinary intent matching, each traced to its sentence in SKILL.md. */
export interface Override {
  when: string;
  target: EntityKey;
  quote: string;
}

export const OVERRIDES: Override[] = [
  {
    when: "Large or cross-cutting work, or work you step away from",
    target: "skill:figure-it-out",
    quote: "routes to the **figure-it-out** skill even when a narrower playbook like Feature fits",
  },
  {
    when: "A standing, multi-day program with many stacked PRs",
    target: "playbook:orchestrate",
    quote: "A standing project-scale program (multi-day, many stacked PRs, a fleet of subagents under one coordinator) routes to **Orchestrate** instead.",
  },
  {
    when: "Any PR-status request, like \"check on PR X\"",
    target: "playbook:babysit",
    quote: "Any PR-status request → the **Babysit** playbook",
  },
  {
    when: "Asked to land or ship a green stack",
    target: "playbook:shipping",
    quote: "Asked to land or ship a green stack → the **Shipping** playbook",
  },
  {
    when: "A \"which approach\" fork an experiment could settle",
    target: "playbook:prototype",
    quote: "Sketch it via the Prototype playbook (`playbooks/prototype.md`) and let the result decide.",
  },
];

/** Phrases the guide says change routing or behavior. */
export const STEERING: { phrase: string; effect: string }[] = [
  { phrase: "new task", effect: "Re-match from scratch instead of continuing the last playbook." },
  { phrase: "don't change any code yet", effect: "Pins the request to Investigation." },
  { phrase: "going to bed / keep going", effect: "Autonomy override. Keeps going and logs a decision trail." },
  { phrase: "repro first", effect: "A real constraint. Bug fix honors it." },
];

export interface Tool {
  id: string;
  name: string;
  origin: string;
  summary: string;
  path: string | null;
  aliases: string[];
  /** Regex sources that find this tool in running prose or code spans. */
  plain: string[];
}

export const TOOLS: Tool[] = [
  {
    id: "deslop",
    name: "/deslop",
    origin: "cursor-team-kit plugin",
    summary: "Strips AI slop from a diff before commit. Not part of this repo.",
    path: null,
    aliases: ["deslop", "/deslop"],
    plain: ["(?<![\\w/])/deslop(?![\\w-])"],
  },
  {
    id: "control-ui",
    name: "control-ui",
    origin: "cursor-team-kit plugin",
    summary: "Drives browser, Electron, and web UIs to reproduce bugs and verify changes on the real surface.",
    path: null,
    aliases: ["control-ui"],
    plain: ["(?<![\\w/-])control-ui(?![\\w-])"],
  },
  {
    id: "control-cli",
    name: "control-cli",
    origin: "cursor-team-kit plugin",
    summary: "Drives CLIs and TUIs to reproduce bugs and verify changes on the real surface.",
    path: null,
    aliases: ["control-cli"],
    plain: ["(?<![\\w/-])control-cli(?![\\w-])"],
  },
  {
    id: "create-skill",
    name: "create-skill",
    origin: "Cursor built-in",
    summary: "Cursor's built-in skill for authoring SKILL.md files.",
    path: null,
    aliases: ["create-skill"],
    plain: ["(?<![\\w/-])create-skill(?![\\w-])"],
  },
  {
    id: "loop",
    name: "/loop",
    origin: "Cursor built-in",
    summary: "Re-runs a prompt on an interval or until a condition holds. Wakes long or unattended work.",
    path: null,
    aliases: ["/loop", "loop"],
    plain: ["(?<![\\w/])/loop(?![\\w-])", "(?<=\\bthe )loop(?= skill)"],
  },
  {
    id: "watch-pr",
    name: "watch-pr",
    origin: "odd-mode script",
    summary: "Polls a GitHub PR or stack and emits a merge verdict (READY, WAITING, ADVANCE, COMPLETE).",
    path: "skills/odd-mode/scripts/watch-pr/cli.ts",
    aliases: ["watch-pr", "scripts/watch-pr/watch-pr"],
    plain: ["(?<![\\w/-])scripts/watch-pr/watch-pr"],
  },
  {
    id: "check-plan",
    name: "check-plan.mjs",
    origin: "odd-mode script",
    summary: "Lints a multi-phase plan file against the required skeleton.",
    path: "skills/odd-mode/scripts/check-plan.mjs",
    aliases: ["check-plan.mjs"],
    plain: ["check-plan\\.mjs"],
  },
  {
    id: "worktree-audit",
    name: "worktree-audit.sh",
    origin: "odd-mode script",
    summary: "Classifies every git worktree by size, age, merge state, uncommitted work, and recent chats.",
    path: "skills/odd-mode/scripts/worktree-audit.sh",
    aliases: ["scripts/worktree-audit.sh", "worktree-audit.sh"],
    plain: ["worktree-audit\\.sh"],
  },
  {
    id: "orch",
    name: "orch",
    origin: "odd-mode script",
    summary: "Bookkeeping CLI for Orchestrate's store: units, ledger, inbox, frontier.",
    path: "skills/odd-mode/scripts/orch/orch.ts",
    aliases: ["orch", "scripts/orch/orch.ts"],
    plain: ["scripts/orch/orch\\.ts"],
  },
];

/** Diagram labels for steps whose source sentence does not shorten cleanly. Keyed `<flow key>#<step label>`. */
export const SHORT_LABELS: Record<string, string> = {
  "playbook:investigation#1": "Route through how",
  "playbook:investigation#2": "One-line checkpoint",
  "playbook:investigation#3": "Write the how-shaped answer",
  "playbook:investigation#4": "Unslop the reply",
  "playbook:session-pickup#4": "Route the rest to a playbook",
  "playbook:session-pickup#5": "Verify inherited claims",
  "playbook:runtime-forensics#1": "Capture the live signal",
  "playbook:runtime-forensics#2": "Reduce to the smoking gun",
  "playbook:runtime-forensics#5": "One-line checkpoint",
  "playbook:trace-forensics#2": "Make it queryable",
  "playbook:bug-fix#1": "Reproduce it yourself",
  "playbook:bug-fix#5": "Failing repro, then fix",
  "playbook:bug-fix#6": "Open a PR",
  "playbook:perf-issue#2": "Ground hypotheses with how",
  "playbook:perf-issue#6": "Open a PR",
  "playbook:hillclimb#4": "Ground each hypothesis",
  "playbook:hillclimb#5": "Loop, one hypothesis each",
  "playbook:hillclimb#8": "Open a PR",
  "playbook:feature#1": "Understand with how",
  "playbook:feature#2": "Design with architect",
  "playbook:feature#3": "Throughput checkpoint",
  "playbook:feature#4": "Delegate the code",
  "playbook:feature#6": "Rebase into small commits",
  "playbook:feature#7": "Interrogate if contested",
  "playbook:feature#8": "Open a PR",
  "playbook:refactoring#2": "Name the missing structure",
  "playbook:refactoring#5": "Move in small steps",
  "playbook:refactoring#6": "Prove behavior unchanged",
  "playbook:prototype#1": "Scope the decision",
  "playbook:prototype#3": "Build it throwaway",
  "playbook:prototype#4": "Compare behind a switcher",
  "playbook:visual-parity#2": "Hold the anti-shortcut rules",
  "playbook:visual-parity#4": "Image-diff each component",
  "playbook:visual-parity#5": "Open a PR",
  "playbook:authoring-a-skill#1": "Draft with create-skill",
  "playbook:authoring-a-skill#4": "Open a PR",
  "playbook:multi-phase-plan#1": "Skip if it's trivial",
  "playbook:multi-phase-plan#4": "Fill the plan skeleton",
  "playbook:multi-phase-plan#5": "Write it, then unslop",
  "playbook:multi-phase-plan#6": "Lint with check-plan",
  "playbook:autonomous-run#1": "State the exit condition",
  "playbook:autonomous-run#2": "Pick the wake mechanism",
  "playbook:autonomous-run#3": "Smallest change per loop",
  "playbook:autonomous-run#5": "Log every iteration",
  "playbook:autopilot-full#1": "Mark the operator's items",
  "playbook:autopilot-full#2": "One owner per PR",
  "playbook:autopilot-full#3": "Run owners in parallel",
  "playbook:autopilot-full#5": "Owner merges on a clean verdict",
  "playbook:autopilot-full#7": "Stand down on stop",
  "playbook:autopilot-stack#5": "Append, never ship",
  "playbook:autopilot-stack#6": "One topology writer",
  "playbook:babysit#1": "Declare the mode",
  "playbook:babysit#2": "Work the merge frontier",
  "playbook:babysit#3": "One babysitter per stack",
  "playbook:babysit#5": "Conflicts, threads, then CI",
  "playbook:babysit#6": "Trust the forge's verdict",
  "playbook:babysit#7": "Classify CI failures",
  "playbook:babysit#8": "Triage Bugbot skeptically",
  "playbook:shipping#1": "Verify every PR independently",
  "playbook:shipping#2": "Land only the verified run",
  "playbook:shipping#3": "Re-check each verdict",
  "playbook:shipping#6": "Ignore autoMergeRequest",
  "playbook:shipping#8": "Watch the frontier",
  "playbook:worktree-cleanup#2": "Treat buckets as advice",
};
