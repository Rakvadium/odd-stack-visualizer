import type { Edge, Node } from "@xyflow/react";
import { GROUPS } from "../../model/curated";
import type { Stack } from "../../model/stack";
import type { EntityKey, Kind } from "../../model/types";
import { callsOf, handoffsOf, kindOf } from "../data";

export const GROUP_COLORS = ["#60a5fa", "#2dd4bf", "#f87171", "#facc15", "#a78bfa", "#fb923c", "#4ade80", "#94a3b8"];

export const KIND_COLORS: Record<Kind, string> = {
  playbook: "#4ade80",
  skill: "#a78bfa",
  principle: "#fbbf24",
  tool: "#94a3b8",
  agent: "#f472b6",
  doc: "#38bdf8",
};

export const STEP_COLOR = "#e4e4e7";

export type NodeData =
  | { t: "prompt" }
  | { t: "router" }
  | { t: "always" }
  | { t: "route"; key: EntityKey; color: string; group: number }
  | { t: "group"; title: string; blurb: string; color: string; group: number; side: "left" | "right" }
  | { t: "entry"; flow: EntityKey }
  | { t: "step"; flow: EntityKey; index: number }
  | { t: "callee"; key: EntityKey; step: number; also: string[]; handoff?: boolean }
  | { t: "reply"; flow: EntityKey };

export type GNode = Node<NodeData & Record<string, unknown>>;

export interface WireData extends Record<string, unknown> {
  color: string;
  strong?: boolean;
  dashed?: boolean;
  /** Entrance delay in ms, so wires draw in after the node they leave. */
  delay?: number;
}

export type GEdge = Edge<WireData>;

const wire = (
  id: string,
  source: string,
  target: string,
  color: string,
  extra: Omit<Partial<GEdge>, "data"> & { data?: Partial<WireData> } = {},
): GEdge => ({
  id,
  source,
  target,
  type: "wire",
  ...extra,
  data: { color, ...extra.data },
});

/** Entrance delay for a node, read by the CSS as `--d`. */
const delay = (ms: number) => ({ "--d": `${Math.round(ms)}ms` }) as React.CSSProperties;

const CARD_W = 250;
const CARD_H = 132;
const GAP = 14;
const PAD = 16;
const HEAD = 44;
const PER_ROW = 3;
const ROW_GAP = 28;
const GROUP_W = PAD * 2 + PER_ROW * CARD_W + (PER_ROW - 1) * GAP;
const ROUTER_W = 440;
const HUB_GAP = 150;

/** odd-mode as a hub: your prompt flows in from above, intent groups branch out to both sides. */
export function overviewGraph(): { nodes: GNode[]; edges: GEdge[] } {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const half = Math.ceil(GROUPS.length / 2);
  const sides = [GROUPS.slice(0, half), GROUPS.slice(half)];
  const heights = sides.map((side) =>
    side.reduce((sum, g) => {
      const rows = Math.ceil(g.members.length / PER_ROW);
      return sum + HEAD + rows * CARD_H + (rows - 1) * GAP + PAD + ROW_GAP;
    }, -ROW_GAP),
  );
  const tallest = Math.max(...heights);
  const routerX = GROUP_W + HUB_GAP;
  const rightX = routerX + ROUTER_W + HUB_GAP;

  sides.forEach((side, si) => {
    let y = (tallest - heights[si]) / 2;
    side.forEach((g, row) => {
      const gi = GROUPS.indexOf(g);
      const rows = Math.ceil(g.members.length / PER_ROW);
      const h = HEAD + rows * CARD_H + (rows - 1) * GAP + PAD;
      const id = `group-${gi}`;
      const d = 260 + row * 70;
      nodes.push({
        id,
        type: "group",
        position: { x: si === 0 ? 0 : rightX, y },
        style: { width: GROUP_W, height: h, ...delay(d) },
        data: { t: "group", title: g.title, blurb: g.blurb, color: GROUP_COLORS[gi], group: gi, side: si === 0 ? "left" : "right" },
        selectable: false,
      });
      g.members.forEach((key, j) => {
        nodes.push({
          id: key,
          type: "route",
          parentId: id,
          extent: "parent",
          style: delay(d + 80 + j * 40),
          position: { x: PAD + (j % PER_ROW) * (CARD_W + GAP), y: HEAD + Math.floor(j / PER_ROW) * (CARD_H + GAP) },
          data: { t: "route", key, color: GROUP_COLORS[gi], group: gi },
        });
      });
      edges.push(wire(`r-${gi}`, "router", id, GROUP_COLORS[gi], { sourceHandle: `g${gi}`, data: { strong: true, delay: d - 60 } }));
      y += h + ROW_GAP;
    });
  });

  const routerH = 110 + half * 44;
  const routerY = tallest / 2 - routerH / 2 + 60;
  nodes.unshift(
    { id: "prompt", type: "prompt", position: { x: routerX + 70, y: routerY - 250 }, style: delay(0), data: { t: "prompt" } },
    { id: "router", type: "router", position: { x: routerX, y: routerY }, style: delay(120), data: { t: "router" } },
    { id: "always", type: "always", position: { x: routerX + 90, y: routerY + routerH + 50 }, style: delay(200), data: { t: "always" } },
  );
  edges.push(wire("p-r", "prompt", "router", STEP_COLOR, { data: { strong: true, delay: 60 } }));
  return { nodes, edges };
}

export const STEP_W = 300;
export const STEP_X0 = 280;
export const STEP_DX = 370;
/** Top of each step's column of calls. Leaves room for the tallest collapsed step card. */
export const COLUMN_Y = 200;
const CALLEE_INDENT = 34;
const CALLEE_H = 92;
const CALLEE_GAP = 12;

/**
 * One playbook or skill: steps chained left to right, and under each step a column of what it calls.
 * A skill several steps call appears under each of them, so every step reads on its own.
 */
export function flowGraph(stack: Stack, flowKey: EntityKey): { nodes: GNode[]; edges: GEdge[] } {
  const flow = stack.flows.get(flowKey)!;
  const nodes: GNode[] = [{ id: "entry", type: "entry", position: { x: 0, y: 42 }, style: delay(0), data: { t: "entry", flow: flowKey } }];
  const edges: GEdge[] = [];
  const callsByStep = flow.stations.map((_, i) => callsOf(flow, i).filter((k) => kindOf(k) !== "principle"));
  const STEP_DELAY = 110;

  flow.stations.forEach((_, i) => {
    const x = STEP_X0 + i * STEP_DX;
    const d = 60 + i * STEP_DELAY;
    nodes.push({ id: `s${i}`, type: "step", position: { x, y: 0 }, style: delay(d), data: { t: "step", flow: flowKey, index: i } });
    edges.push(
      wire(`chain-${i}`, i === 0 ? "entry" : `s${i - 1}`, `s${i}`, STEP_COLOR, {
        sourceHandle: "next",
        targetHandle: "prev",
        data: { strong: true, delay: d - 70 },
      }),
    );
    callsByStep[i].forEach((key, k) => {
      const id = `c${i}-${key}`;
      const also = callsByStep.flatMap((keys, j) => (j !== i && keys.includes(key) ? [flow.stations[j].label || String(j + 1)] : []));
      const cd = d + 180 + k * 70;
      nodes.push({
        id,
        type: "callee",
        position: { x: x + CALLEE_INDENT, y: COLUMN_Y + k * (CALLEE_H + CALLEE_GAP) },
        style: delay(cd),
        data: { t: "callee", key, step: i, also },
      });
      edges.push(wire(`call-${i}-${key}`, `s${i}`, id, KIND_COLORS[kindOf(key)], { type: "branch", sourceHandle: "calls", targetHandle: "in", data: { delay: cd - 90 } }));
    });
  });

  const n = flow.stations.length;
  const endX = STEP_X0 + n * STEP_DX;
  const endD = 60 + n * STEP_DELAY;
  nodes.push({ id: "reply", type: "reply", position: { x: endX, y: 0 }, style: delay(endD), data: { t: "reply", flow: flowKey } });
  edges.push(wire("chain-end", `s${n - 1}`, "reply", STEP_COLOR, { sourceHandle: "next", targetHandle: "prev", data: { strong: true, delay: endD - 70 } }));

  handoffsOf(flow).forEach((key, k) => {
    const cd = endD + 220 + k * 70;
    nodes.push({
      id: `h-${key}`,
      type: "callee",
      position: { x: endX + CALLEE_INDENT, y: COLUMN_Y + k * (CALLEE_H + CALLEE_GAP) },
      style: delay(cd),
      data: { t: "callee", key, step: n, also: [], handoff: true },
    });
    edges.push(wire(`hand-${key}`, "reply", `h-${key}`, KIND_COLORS.playbook, { type: "branch", sourceHandle: "out", targetHandle: "in", data: { dashed: true, delay: cd - 90 } }));
  });

  return { nodes, edges };
}

/** Which step column a node belongs to, for shifting columns when a step opens. Entry is -1, the reply is past the end. */
export function columnOf(node: GNode): number {
  const d = node.data;
  if (d.t === "step") return d.index;
  if (d.t === "callee") return d.step;
  if (d.t === "reply") return Infinity;
  return -1;
}
