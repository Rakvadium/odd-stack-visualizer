import { GROUPS, OVERRIDES } from "../model/curated";
import { firstSentence } from "../model/markdown";
import type { Stack } from "../model/stack";
import type { EntityKey, Flow, Kind } from "../model/types";

export const ROOT: EntityKey = "skill:poteto-mode";
export const ROUTES: EntityKey[] = GROUPS.flatMap((g) => g.members);

export const KIND_LABEL: Record<Kind, string> = {
  playbook: "Playbook",
  skill: "Skill",
  principle: "Principle",
  tool: "Tool",
  agent: "Agent",
  doc: "Reference",
};

export function kindOf(key: EntityKey): Kind {
  return key.slice(0, key.indexOf(":")) as Kind;
}

export function nameOf(stack: Stack, key: EntityKey): string {
  return stack.routes.find((r) => r.key === key)?.name ?? stack.entities.get(key)?.name ?? key;
}

export function whenOf(stack: Stack, key: EntityKey): string {
  if (key === "skill:figure-it-out") return "No playbook fits, or the work is large, cross-cutting, or reviewed after you step away.";
  return stack.routes.find((r) => r.key === key)?.when ?? "";
}

export function gistOf(stack: Stack, key: EntityKey): string {
  const e = stack.entities.get(key);
  const p = stack.principles.find((x) => x.key === key);
  if (p) return p.when;
  if (!e) return "";
  if (e.kind === "playbook") return whenOf(stack, key);
  return e.summary ? firstSentence(e.summary) : "";
}

export function groupOf(key: EntityKey) {
  return GROUPS.find((g) => g.members.includes(key)) ?? null;
}

export function isOverride(key: EntityKey): boolean {
  return OVERRIDES.some((o) => o.target === key);
}

export function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/** What a step calls, minus the root skill (always on) and minus refs that just point back at this flow. */
export function callsOf(flow: Flow, index: number): EntityKey[] {
  return flow.stations[index].refs.filter((k) => k !== ROOT);
}

/** Other playbooks a flow hands work to, anywhere in its text, excluding ones its steps already call. */
export function handoffsOf(flow: Flow): EntityKey[] {
  const called = new Set(flow.stations.flatMap((s) => s.refs));
  const out: EntityKey[] = [];
  for (const s of [...flow.intro, ...flow.notes]) {
    for (const k of s.refs) if (kindOf(k) === "playbook" && !called.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Flows that mention `key`, routes first. */
export function usersOf(stack: Stack, key: EntityKey): EntityKey[] {
  const flows = [...new Set((stack.usage.get(key) ?? []).map((u) => u.flow))].filter((k) => k !== ROOT);
  return flows.sort((a, b) => Number(ROUTES.includes(b)) - Number(ROUTES.includes(a)));
}
