import type { EntityKey } from "../../model/types";

/** Where a path was entered from: the flow, and the label of the step that called it (absent for a reply handoff). */
export interface Caller {
  flow: EntityKey;
  label?: string;
}

/**
 * Navigation memory that outlives a scene. Each path mounts a fresh canvas, so the trail of paths
 * you stepped through, who called each one, and the node you left from live here.
 * `callers[i]` is how you got from `trail[i]` into the next path.
 */
export const nav: { trail: EntityKey[]; callers: Caller[]; from: string | null; dir: "in" | "out" } = {
  trail: [],
  callers: [],
  from: null,
  dir: "in",
};

export function currentCaller(): Caller | undefined {
  return nav.callers.at(-1);
}
