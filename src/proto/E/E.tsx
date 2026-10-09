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


const OPEN_W = 560;
/** Where the open step's top-left corner sits on screen while walking. */
const READ_X = 500;
const READ_Y = 72;
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
      {flowKey && expanded ? (
        <WalkPanel flowKey={flowKey} at={Number(expanded.slice(1))} go={(i) => setExpanded(i < 0 ? null : `s${i}`)} />
      ) : (
        <Header flowKey={flowKey} leave={leave} walk={() => setExpanded("s0")} />
      )}
    </div>
  );
}

/**
 * Walk mode takes over the header. The controls row sits above the title, so Previous and Next
 * never move however long a step's name is. The open card always lands just right of this panel.
 */
function WalkPanel({ flowKey, at, go }: { flowKey: EntityKey; at: number; go: (index: number) => void }) {
  const { stack } = useProto();
  const stations = stack.flows.get(flowKey)!.stations;
  const current = stations[at];
  const last = at === stations.length - 1;
  return (
    <header className="e-head wk" aria-label="Walking the path">
      <button className="wk-exit" onClick={() => go(-1)} title="Stop walking (esc)">
        <Icon name="back" size={13} /> {nameOf(stack, flowKey)}
      </button>
      <div className="wk-controls" role="toolbar" aria-label="Step through the path">
        <button className="wk-btn" disabled={at === 0} onClick={() => go(at - 1)} aria-label="Previous step" title="Previous step (←)">
          <Icon name="back" size={15} />
        </button>
        <span className="wk-count" aria-live="polite">
          Step <b>{current.label || at + 1}</b> of {stations.length}
        </span>
        <button className="wk-btn is-next" onClick={() => go(last ? -1 : at + 1)} title={last ? "Finish (esc)" : "Next step (→)"}>
          {last ? "Finish" : "Next"} <Icon name={last ? "x" : "arrow"} size={14} />
        </button>
      </div>
      <ol className="wk-outline">
        {stations.map((s, i) => (
          <li key={i} className={i === at ? "is-on" : i < at ? "is-past" : ""}>
            <button onClick={() => go(i)} aria-current={i === at ? "step" : undefined}>
              <span className="wk-n">{i < at ? <Icon name="check" size={11} /> : s.label || i + 1}</span>
              <span className="wk-name">{s.short}</span>
            </button>
          </li>
        ))}
        <li className="is-end">
          <span className="wk-n">
            <Icon name="reply" size={11} />
          </span>
          <span className="wk-name">{kindOf(flowKey) === "playbook" ? "Reply to you" : "Returns"}</span>
        </li>
      </ol>
      <p className="wk-keys">
        <kbd>←</kbd> <kbd>→</kbd> step <span>·</span> <kbd>esc</kbd> stop
      </p>
    </header>
  );
}


function Header({ flowKey, leave, walk }: { flowKey: EntityKey | null; leave: (to: EntityKey | null) => void; walk: () => void }) {
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
        <button className="e-read" onClick={walk}>
          Walk through it <Icon name="arrow" size={12} />
        </button>
        <span className="e-hint">
          <kbd>esc</kbd> back
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
    // Ending a walk glides back to the path's normal framing, clear of the header.
    if (!opened && followed.current) {
      followed.current = null;
      rf.fitView({ ...fit, duration: 600 });
    }
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
    // The camera puts the open step in one fixed reading spot, just right of the walk panel.
    if (opened && followed.current !== opened.id) {
      followed.current = opened.id;
      const at = target.get(opened.id)!;
      const box = document.querySelector(".e")?.getBoundingClientRect();
      const w = box?.width ?? window.innerWidth;
      const h = box?.height ?? window.innerHeight;
      const sx = Math.min(READ_X, w * 0.36);
      rf.setCenter(at.x + (w / 2 - sx), at.y + (h / 2 - READ_Y), { zoom: 1, duration: 600 });
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
  }, [expanded, openH, graph, flowKey, rf, setNodes, fit]);

  const walkLit = useMemo(() => {
    if (!expanded) return null;
    const idx = Number(expanded.slice(1));
    const ids = new Set<string>([expanded]);
    graph.nodes.forEach((n) => n.data.t === "callee" && n.data.step === idx && !n.data.handoff && ids.add(n.id));
    graph.edges.forEach((e) => e.source === expanded && e.type === "branch" && ids.add(e.id));
    return ids;
  }, [expanded, graph]);

  // Hovering lights what the node touches. A copy of a skill lights every copy and its step.
  const hoverLit = useMemo(() => {
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
  const lit = hoverLit ?? walkLit;

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
        className={[far && "is-far", ready && "is-ready", expanded && "is-walking", !flowKey && nav.dir === "out" && "no-enter"].filter(Boolean).join(" ")}
        nodes={shown}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        panOnScroll
        zoomOnScroll={false}
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

