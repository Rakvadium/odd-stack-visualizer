import { Handle, Position, getBezierPath, type EdgeProps, type NodeProps } from "@xyflow/react";
import { createContext, useContext, type CSSProperties } from "react";
import { GROUPS } from "../../model/curated";
import { firstSentence } from "../../model/markdown";
import type { EntityKey } from "../../model/types";
import { useProto } from "../ctx";
import { KIND_LABEL, callsOf, dirOf, gistOf, isOverride, kindOf, nameOf, whenOf } from "../data";
import { Icon } from "../Icon";
import { Inline, Md, plain } from "../Md";
import { GROUP_COLORS, KIND_COLORS, type GEdge, type GNode } from "./layout";

interface CanvasState {
  /** Node ids and edge ids that stay lit while something is hovered. Null when nothing is. */
  lit: Set<string> | null;
  expanded: string | null;
  toggle: (id: string) => void;
  /** Zoom into a node, then show `key` as the path. */
  dive: (nodeId: string, key: EntityKey) => void;
}

export const CanvasCtx = createContext<CanvasState>({ lit: null, expanded: null, toggle: () => {}, dive: () => {} });

const vars = (v: Record<string, string>) => v as CSSProperties;

function Port({ type, position, id, color, style }: { type: "source" | "target"; position: Position; id?: string; color?: string; style?: CSSProperties }) {
  return (
    <Handle
      type={type}
      position={position}
      id={id}
      className="port"
      style={{ ...(color ? vars({ "--pc": color }) : {}), ...style }}
      isConnectable={false}
    />
  );
}

function PromptNode() {
  return (
    <div className="n n-prompt">
      <header className="n-head">
        <Icon name="chat" size={14} /> You type
      </header>
      <div className="n-field">
        /poteto-mode users get two notifications after a retry. repro first, then fix.
        <span className="n-caret" />
      </div>
      <Port type="source" position={Position.Bottom} />
    </div>
  );
}

function RouterNode() {
  const { stack } = useProto();
  const half = Math.ceil(GROUPS.length / 2);
  const left = GROUPS.slice(0, half);
  const right = GROUPS.slice(half);
  return (
    <div className="n n-router">
      <Port type="target" position={Position.Top} />
      <header className="n-head is-center">
        <span className="n-crown">
          <Icon name="crown" size={14} />
        </span>
        poteto-mode
      </header>
      <p className="n-sub is-center">Reads the request and wires it to the one path that fits.</p>
      <div className="n-ports">
        {left.map((g, i) => {
          const r = right[i];
          const ri = half + i;
          return (
            <div key={g.title} className="n-portrow">
              <div className="n-row is-in">
                <Port type="source" position={Position.Left} id={`g${i}`} color={GROUP_COLORS[i]} />
                <span>{g.title}</span>
                <span className="n-count">{g.members.length}</span>
              </div>
              {r && (
                <div className="n-row is-out">
                  <span className="n-count">{r.members.length}</span>
                  <span>{r.title}</span>
                  <Port type="source" position={Position.Right} id={`g${ri}`} color={GROUP_COLORS[ri]} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="n-status is-center">
        <span className="n-pulse" /> Matches by intent, not keywords · {stack.routes.length + 1} paths
      </p>
    </div>
  );
}

function AlwaysNode() {
  const { stack } = useProto();
  return (
    <div className="n n-always">
      <Icon name="layers" size={14} />
      <span>
        <b>Always on</b>
        {stack.triggers.length} triggers · {stack.principles.length} principles
      </span>
      <Icon name="chevron" size={12} />
    </div>
  );
}

function GroupNode({ data }: NodeProps<GNode>) {
  if (data.t !== "group") return null;
  return (
    <div className="n-group" style={vars({ "--c": data.color })}>
      <Port type="target" position={data.side === "left" ? Position.Right : Position.Left} color={data.color} />
      <header>
        <span className="n-swatch" />
        <b>{data.title}</b>
        <span>{data.blurb}</span>
      </header>
    </div>
  );
}

function RouteNode({ data }: NodeProps<GNode>) {
  const { stack } = useProto();
  if (data.t !== "route") return null;
  const flow = stack.flows.get(data.key)!;
  return (
    <div className="n n-route" style={vars({ "--c": data.color })}>
      <header className="n-head">
        {nameOf(stack, data.key)}
        {isOverride(data.key) && (
          <span className="n-bolt" title="Shortcut. Checked before the rest.">
            <Icon name="bolt" size={11} />
          </span>
        )}
      </header>
      <p className="n-when">{plain(whenOf(stack, data.key))}</p>
      <footer className="n-foot">
        <span className="n-dots" aria-label={`${flow.stations.length} steps`}>
          {flow.stations.map((_, i) => (
            <i key={i} />
          ))}
          <span>{flow.stations.length} steps</span>
        </span>
        <span className="n-open">
          Step inside <Icon name="arrow" size={12} />
        </span>
      </footer>
    </div>
  );
}

function EntryNode({ data }: NodeProps<GNode>) {
  if (data.t !== "entry") return null;
  const routed = kindOf(data.flow) === "playbook" || data.flow === "skill:figure-it-out";
  return (
    <div className="n n-entry">
      <Icon name={routed ? "crown" : "arrow"} size={13} /> {routed ? "poteto-mode routes here" : "A step calls this"}
      <Port type="source" position={Position.Right} id="next" />
    </div>
  );
}

function StepNode({ id, data }: NodeProps<GNode>) {
  const { stack, open } = useProto();
  const { expanded } = useContext(CanvasCtx);
  if (data.t !== "step") return null;
  const flow = stack.flows.get(data.flow)!;
  const s = flow.stations[data.index];
  const base = dirOf(flow.path);
  const isOpen = expanded === id;
  const all = callsOf(flow, data.index);
  const principles = all.filter((k) => kindOf(k) === "principle");
  const callCount = all.length - principles.length;
  const titleIsShort = plain(s.title).replace(/\.$/, "") === s.short;
  const gist = !titleIsShort ? s.title : s.body ? firstSentence(s.body) : "";

  return (
    <div className={`n n-step${isOpen ? " is-open" : ""}`}>
      <Port type="target" position={Position.Left} id="prev" />
      <header className="n-head">
        <span className="n-num">{s.label || data.index + 1}</span>
        <span className="n-title">{s.short}</span>
      </header>
      {isOpen ? (
        <div className="n-read nowheel nodrag">
          {!titleIsShort && (
            <p className="n-lede">
              <Inline text={s.title} base={base} />
            </p>
          )}
          {s.body && <Md text={s.body} base={base} />}
        </div>
      ) : (
        gist && <p className="n-gist">{plain(gist)}</p>
      )}
      <footer className="n-foot">
        <span className="n-meta">
          {callCount > 0 && <span>{callCount} below</span>}
          {principles.length > 0 && (
            <button className="n-principles nodrag" onClick={(e) => (e.stopPropagation(), open({ t: "entity", key: principles[0] }))}>
              +{principles.length} principle{principles.length > 1 ? "s" : ""}
            </button>
          )}
        </span>
        <span className="n-open">
          {isOpen ? "Close" : "Read"} <Icon name={isOpen ? "x" : "chevron"} size={11} />
        </span>
      </footer>
      <Port type="source" position={Position.Right} id="next" />
      {callCount > 0 && <Port type="source" position={Position.Bottom} id="calls" style={{ left: 20 }} />}
    </div>
  );
}

function CalleeNode({ id, data }: NodeProps<GNode>) {
  const { stack } = useProto();
  const { dive } = useContext(CanvasCtx);
  if (data.t !== "callee") return null;
  const e = stack.entities.get(data.key);
  if (!e) return null;
  const steps = stack.flows.get(data.key)?.stations.length ?? 0;
  const color = KIND_COLORS[e.kind];
  return (
    <div className={`n n-callee${data.handoff ? " is-handoff" : ""}`} style={vars({ "--c": color })}>
      <Port type="target" position={Position.Left} id="in" color={color} />
      <div className="n-callee-top">
        <span className="n-kind">{data.handoff ? "Hands off to" : KIND_LABEL[e.kind]}</span>
        {data.also.length > 0 && <span className="n-also">also step {data.also.join(", ")}</span>}
        {e.origin && <span className="n-also">{e.origin}</span>}
      </div>
      <div className="n-callee-main">
        <span>
          <strong className="n-name">{nameOf(stack, data.key)}</strong>
          <span className="n-gist">{plain(gistOf(stack, data.key))}</span>
        </span>
        {steps > 0 && (
          <button
            className="n-enter nodrag"
            title={`Step inside ${nameOf(stack, data.key)} · ${steps} steps`}
            onClick={(ev) => (ev.stopPropagation(), dive(id, data.key))}
          >
            <span>{steps}</span>
            <Icon name="arrow" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function ReplyNode({ data }: NodeProps<GNode>) {
  const { stack } = useProto();
  if (data.t !== "reply") return null;
  const flow = stack.flows.get(data.flow)!;
  return (
    <div className="n n-reply">
      <Port type="target" position={Position.Left} id="prev" />
      <header className="n-head">
        <Icon name="reply" size={14} /> {kindOf(data.flow) === "playbook" ? "Reply to you" : "Returns"}
      </header>
      {flow.reply ? <p className="n-gist is-long">{plain(flow.reply)}</p> : <p className="n-gist">Back to the step that called it.</p>}
      <Port type="source" position={Position.Bottom} id="out" style={{ left: 20 }} />
    </div>
  );
}

export const nodeTypes = {
  prompt: PromptNode,
  router: RouterNode,
  always: AlwaysNode,
  group: GroupNode,
  route: RouteNode,
  entry: EntryNode,
  step: StepNode,
  callee: CalleeNode,
  reply: ReplyNode,
};

function WireShape({ id, path, data }: { id: string; path: string; data?: GEdge["data"] }) {
  const { lit } = useContext(CanvasCtx);
  const on = lit === null || lit.has(id);
  const cls = ["wire", data?.strong && "is-strong", data?.dashed && "is-dashed", !on && "is-dim", lit && on && "is-lit"].filter(Boolean).join(" ");
  return (
    <g className={cls} style={vars({ "--w": data?.color ?? "#fff", "--wd": `${data?.delay ?? 0}ms` })}>
      <path d={path} className="wire-glow" />
      <path d={path} className="wire-core" pathLength={data?.dashed ? undefined : 1} />
    </g>
  );
}

function Wire({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<GEdge>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  return <WireShape id={id} path={path} data={data} />;
}

/** A tree-style elbow: straight down from the step, then a rounded turn into the item. */
function Branch({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<GEdge>) {
  const r = Math.min(12, Math.abs(targetX - sourceX) / 2, Math.abs(targetY - sourceY) / 2);
  const path = `M${sourceX},${sourceY} L${sourceX},${targetY - r} Q${sourceX},${targetY} ${sourceX + r},${targetY} L${targetX},${targetY}`;
  return <WireShape id={id} path={path} data={data} />;
}

export const edgeTypes = { wire: Wire, branch: Branch };
