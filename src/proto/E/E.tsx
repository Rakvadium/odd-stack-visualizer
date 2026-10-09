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
import { nav } from "./nav";
import { CanvasCtx, edgeTypes, nodeTypes } from "./nodes";
import "./e.css";


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
  const { stack, setPath, reader } = useProto();
  const rf = useReactFlow<GNode>();
  const [leaving, setLeaving] = useState<"in" | "out" | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const steps = flowKey ? stack.flows.get(flowKey)!.stations.length : 0;

  /** Zoom into a node, then swap the scene to `key`. */
  const enter = useCallback(
    (nodeId: string, key: EntityKey) => {
      if (leaving) return;
      const node = rf.getNode(nodeId);
      if (flowKey) {
        const step = node?.data.t === "callee" ? node.data.step : -1;
        nav.trail = [...nav.trail, flowKey];
        nav.callers = [...nav.callers, { flow: flowKey, label: stack.flows.get(flowKey)!.stations[step]?.label || (step >= 0 ? String(step + 1) : undefined) }];
      } else {
        nav.trail = [];
        nav.callers = [];
      }
      nav.from = null;
      nav.dir = "in";
      setLeaving("in");
      setTarget(nodeId);
      rf.fitView({ nodes: [{ id: nodeId }], duration: 620, maxZoom: 2.6, padding: 0.18 });
      window.setTimeout(() => setPath(key), 600);
    },
    [leaving, flowKey, rf, setPath, stack],
  );

  /** Pull back out to the overview or an earlier path in the trail. */
  const leave = useCallback(
    (to: EntityKey | null) => {
      if (leaving) return;
      const at = to ? nav.trail.indexOf(to) : -1;
      nav.trail = at >= 0 ? nav.trail.slice(0, at) : [];
      nav.callers = at >= 0 ? nav.callers.slice(0, at) : [];
      nav.from = flowKey;
      nav.dir = "out";
      setLeaving("out");
      rf.zoomTo(rf.getZoom() * 0.7, { duration: 380 });
      window.setTimeout(() => setPath(to), 300);
    },
    [leaving, flowKey, rf, setPath],
  );

  // Esc closes an open step before it leaves the path. Arrows walk the path one step at a time.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reader.length || !flowKey || document.activeElement?.tagName === "INPUT") return;
      const at = expanded ? Number(expanded.slice(1)) : -1;
      if (e.key === "Escape") expanded ? setExpanded(null) : leave(nav.trail.at(-1) ?? null);
      else if (e.key === "ArrowRight") setExpanded(`s${Math.min(steps - 1, at + 1)}`);
      else if (e.key === "ArrowLeft" && at > 0) setExpanded(`s${at - 1}`);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flowKey, leave, reader.length, expanded, steps]);

  return (
    <div className={`scene${leaving ? ` is-leaving-${leaving}` : ""}`}>
      <Canvas
        flowKey={flowKey}
        enter={enter}
        back={() => leave(nav.trail.at(-1) ?? null)}
        target={target}
        expanded={expanded}
        setExpanded={setExpanded}
      />
      <Header flowKey={flowKey} leave={leave} walk={() => setExpanded("s0")} walking={expanded !== null} />
    </div>
  );
}

function Header({ flowKey, leave, walk, walking }: { flowKey: EntityKey | null; leave: (to: EntityKey | null) => void; walk: () => void; walking: boolean }) {
  const { stack } = useProto();
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
        {!walking && (
          <button className="e-read" onClick={walk}>
            Walk through it <Icon name="arrow" size={12} />
          </button>
        )}
        <span className="e-hint">
          {walking ? (
            <>
              <kbd>←</kbd>
              <kbd>→</kbd> previous / next step <kbd>esc</kbd> close
            </>
          ) : (
            <>
              <kbd>esc</kbd> back
            </>
          )}
        </span>
      </div>
    </header>
  );
}

interface CanvasProps {
  flowKey: EntityKey | null;
  enter: (nodeId: string, key: EntityKey) => void;
  back: () => void;
  target: string | null;
  expanded: string | null;
  setExpanded: (id: string | null | ((cur: string | null) => string | null)) => void;
}

function Canvas({ flowKey, enter, back, target, expanded, setExpanded }: CanvasProps) {
  const { stack, open } = useProto();
  const rf = useReactFlow();
  const graph = useMemo(() => (flowKey ? flowGraph(stack, flowKey) : overviewGraph()), [stack, flowKey]);
  const [nodes, setNodes, onNodesChange] = useNodesState<GNode>(graph.nodes);
  const [hover, setHover] = useState<string | null>(null);
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
  const followed = useRef<string | null>(null);
  useEffect(() => {
    if (!flowKey) return;
    const opened = expanded ? graph.nodes.find((n) => n.id === expanded) : undefined;
    if (!opened) followed.current = null;
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
    // The camera follows the open step: centered across, its top just below the header.
    if (opened && followed.current !== opened.id) {
      followed.current = opened.id;
      const at = target.get(opened.id)!;
      const zoom = Math.min(1, Math.max(0.8, rf.getZoom()));
      const h = document.querySelector(".e")?.clientHeight ?? window.innerHeight;
      rf.setCenter(at.x + OPEN_W / 2, at.y + (h / 2 - 270) / zoom, { zoom, duration: 560 });
    }
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

  const toggle = useCallback((id: string) => setExpanded((cur) => (cur === id ? null : id)), [setExpanded]);
  const ctx = useMemo(() => ({ lit, expanded, toggle, dive: enter, back }), [lit, expanded, toggle, enter, back]);

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
          else if (d.t === "entry" && nav.callers.length) back();
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

