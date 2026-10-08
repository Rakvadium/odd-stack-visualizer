import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useStore,
  type FitViewOptions,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLES } from "../../model/curated";
import type { EntityKey } from "../../model/types";
import { useProto } from "../ctx";
import { groupOf, kindOf, nameOf, whenOf } from "../data";
import { Icon } from "../Icon";
import { plain } from "../Md";
import { COLUMN_Y, STEP_W, columnOf, flowGraph, overviewGraph, type GNode } from "./layout";
import { CanvasCtx, edgeTypes, nodeTypes } from "./nodes";
import "./e.css";

/**
 * Navigation memory that outlives a scene. Each path mounts a fresh canvas, so the trail of
 * paths you dove through, and the node you left from, live here.
 */
const nav: { trail: EntityKey[]; from: string | null; dir: "in" | "out" } = { trail: [], from: null, dir: "in" };

const OPEN_W = 460;
const EASE = (t: number) => 1 - Math.pow(1 - t, 3);

export function E() {
  const { path } = useProto();
  return (
    <div className="e">
      <ReactFlowProvider key={path ?? "overview"}>
        <Scene flowKey={path} />
      </ReactFlowProvider>
    </div>
  );
}

function Scene({ flowKey }: { flowKey: EntityKey | null }) {
  const { setPath, reader } = useProto();
  const rf = useReactFlow();
  const [leaving, setLeaving] = useState<"in" | "out" | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  /** Zoom into a node, then swap the scene to `key`. */
  const enter = useCallback(
    (nodeId: string, key: EntityKey) => {
      if (leaving) return;
      nav.trail = flowKey ? [...nav.trail, flowKey] : [];
      nav.from = null;
      nav.dir = "in";
      setLeaving("in");
      setTarget(nodeId);
      rf.fitView({ nodes: [{ id: nodeId }], duration: 620, maxZoom: 2.6, padding: 0.18 });
      window.setTimeout(() => setPath(key), 600);
    },
    [leaving, flowKey, rf, setPath],
  );

  /** Pull back out to the overview or an earlier path in the trail. */
  const leave = useCallback(
    (to: EntityKey | null) => {
      if (leaving) return;
      const at = to ? nav.trail.indexOf(to) : -1;
      nav.trail = at >= 0 ? nav.trail.slice(0, at) : [];
      nav.from = flowKey;
      nav.dir = "out";
      setLeaving("out");
      rf.zoomTo(rf.getZoom() * 0.7, { duration: 380 });
      window.setTimeout(() => setPath(to), 300);
    },
    [leaving, flowKey, rf, setPath],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || reader.length || !flowKey) return;
      leave(nav.trail.at(-1) ?? null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flowKey, leave, reader.length]);

  return (
    <div className={`scene${leaving ? ` is-leaving-${leaving}` : ""}`}>
      <Canvas flowKey={flowKey} enter={enter} target={target} />
      <Header flowKey={flowKey} leave={leave} />
    </div>
  );
}

function Header({ flowKey, leave }: { flowKey: EntityKey | null; leave: (to: EntityKey | null) => void }) {
  const { stack, open } = useProto();
  if (!flowKey)
    return (
      <header className="e-head">
        <h1>Where does a request go?</h1>
        <p>Your prompt goes into poteto-mode, which wires it to one path. Click a path to step inside it.</p>
      </header>
    );
  const group = groupOf(flowKey);
  const example = EXAMPLES[flowKey];
  return (
    <header className="e-head">
      <nav className="e-crumbs" aria-label="Where you are">
        <button onClick={() => leave(null)}>
          <Icon name="back" size={13} /> All paths
        </button>
        {nav.trail.map((k) => (
          <button key={k} className="is-trail" onClick={() => leave(k)}>
            {nameOf(stack, k)}
          </button>
        ))}
        {!nav.trail.length && group && <span>{group.title}</span>}
      </nav>
      <h1>{nameOf(stack, flowKey)}</h1>
      <p>{plain(whenOf(stack, flowKey) || stack.entities.get(flowKey)!.summary)}</p>
      {example && <p className="e-example">“{example.prompt.replace(/^\/poteto-mode\s*/, "")}”</p>}
      <div className="e-actions">
        <button className="e-read" onClick={() => open({ t: "step", flow: flowKey, index: 0 })}>
          Read start to finish <Icon name="arrow" size={12} />
        </button>
        <span className="e-hint">
          <kbd>esc</kbd> back
        </span>
      </div>
    </header>
  );
}

function Canvas({ flowKey, enter, target }: { flowKey: EntityKey | null; enter: (nodeId: string, key: EntityKey) => void; target: string | null }) {
  const { stack, open } = useProto();
  const rf = useReactFlow();
  const graph = useMemo(() => (flowKey ? flowGraph(stack, flowKey) : overviewGraph()), [stack, flowKey]);
  const [nodes, setNodes, onNodesChange] = useNodesState<GNode>(graph.nodes);
  const [hover, setHover] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const initialized = useNodesInitialized();
  const far = useStore((s) => s.transform[2] < 0.72);
  const openH = useStore((s) => (expanded ? (s.nodeLookup.get(expanded)?.measured?.height ?? 0) : 0));

  const fit: FitViewOptions = useMemo(() => {
    const focusNodes = flowKey
      ? graph.nodes.filter((n) => n.id === "entry" || (columnOf(n) >= 0 && columnOf(n) <= 3))
      : graph.nodes.filter((n) => !n.parentId);
    return {
      nodes: focusNodes.map((n) => ({ id: n.id })),
      padding: { top: flowKey ? "250px" : "150px", left: "48px", right: "48px", bottom: "100px" },
      maxZoom: flowKey ? 0.95 : 1,
    };
  }, [graph, flowKey]);

  // First frame: place the camera before anything is visible. Coming back out, start zoomed on
  // the card you left from and pull back, so the overview reads as the room you stepped out of.
  const placed = useRef(false);
  useEffect(() => {
    if (!initialized || placed.current) return;
    placed.current = true;
    const from = !flowKey && nav.dir === "out" && nav.from ? rf.getNode(nav.from) : undefined;
    if (from) {
      rf.fitView({ nodes: [{ id: from.id }], duration: 0, maxZoom: 2.4, padding: 0.12 });
      requestAnimationFrame(() => rf.fitView({ ...fit, duration: 720 }));
    } else {
      rf.fitView({ ...fit, duration: 0 });
    }
    requestAnimationFrame(() => setReady(true));
  }, [initialized, rf, fit, flowKey]);

  // Opening a step makes room: later columns slide right, and the step's own column slides down.
  const frame = useRef(0);
  useEffect(() => {
    if (!flowKey) return;
    const opened = expanded ? graph.nodes.find((n) => n.id === expanded) : undefined;
    const col = opened ? columnOf(opened) : -2;
    const dx = opened ? OPEN_W - STEP_W : 0;
    const dy = opened ? Math.max(0, openH + 40 - COLUMN_Y) : 0;
    const target = new Map(
      graph.nodes.map((b) => {
        const c = columnOf(b);
        const x = b.position.x + (opened && c > col ? dx : 0);
        const y = b.position.y + (opened && c === col && b.data.t === "callee" ? dy : 0);
        return [b.id, { x, y }];
      }),
    );
    const start = new Map(rf.getNodes().map((n) => [n.id, n.position]));
    const t0 = performance.now();
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => {
      const t = EASE(Math.min(1, (now - t0) / 320));
      setNodes((ns) =>
        ns.map((n) => {
          const a = start.get(n.id) ?? n.position;
          const b = target.get(n.id) ?? n.position;
          return { ...n, zIndex: n.id === expanded ? 1000 : 0, position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } };
        }),
      );
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [expanded, openH, graph, flowKey, rf, setNodes]);

  // Hovering lights what the node touches. A copy of a skill lights every copy and its step.
  const lit = useMemo(() => {
    if (!hover) return null;
    const node = graph.nodes.find((n) => n.id === hover);
    const ids = new Set<string>([hover]);
    if (node?.data.t === "callee") {
      const key = node.data.key;
      graph.nodes.forEach((n) => n.data.t === "callee" && n.data.key === key && ids.add(n.id));
    }
    if (node?.data.t === "route") ids.add(node.parentId!), ids.add("router");
    for (const e of graph.edges) {
      if (ids.has(e.source) || ids.has(e.target)) {
        ids.add(e.id);
        if (node?.data.t !== "step" || e.type === "branch") ids.add(e.source), ids.add(e.target);
      }
    }
    return ids;
  }, [hover, graph]);

  // Inside a path, hovering dims what it does not touch. On the overview only its wire lights up.
  const shown = useMemo(
    () =>
      nodes.map((n) => {
        const dim = flowKey && lit && !lit.has(n.id);
        const cls = [dim && "is-dim", n.id === target && "is-target"].filter(Boolean).join(" ");
        return cls || n.className ? { ...n, className: cls } : n;
      }),
    [nodes, lit, target, flowKey],
  );

  const toggle = useCallback((id: string) => setExpanded((cur) => (cur === id ? null : id)), []);
  const ctx = useMemo(() => ({ lit, expanded, toggle, dive: enter }), [lit, expanded, toggle, enter]);

  return (
    <CanvasCtx.Provider value={ctx}>
      <ReactFlow
        className={[far && "is-far", ready && "is-ready", !flowKey && nav.dir === "out" && "no-enter"].filter(Boolean).join(" ")}
        nodes={shown}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        minZoom={0.2}
        maxZoom={2.4}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        onNodeMouseEnter={(_, n) => setHover(n.type === "group" ? null : n.id)}
        onNodeMouseLeave={() => setHover(null)}
        onNodeClick={(_, n) => {
          const d = n.data;
          if (d.t === "route") enter(n.id, d.key);
          else if (d.t === "always") open({ t: "always" });
          else if (d.t === "step") toggle(n.id);
          else if (d.t === "callee") d.handoff || kindOf(d.key) === "playbook" ? enter(n.id, d.key) : open({ t: "entity", key: d.key });
        }}
        onPaneClick={() => setExpanded(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#2b2d33" />
        <Controls showInteractive={false} position="bottom-left" fitViewOptions={{ ...fit, nodes: undefined, duration: 500 }} />
      </ReactFlow>
    </CanvasCtx.Provider>
  );
}

