import { useLayoutEffect, useRef, useState } from "react";
import { EXAMPLES, GROUPS } from "../model/curated";
import type { EntityKey } from "../model/types";
import { useProto } from "./ctx";
import { Curves, type Edge } from "./Curves";
import { callsOf, groupOf, handoffsOf, isOverride, kindOf, nameOf, whenOf } from "./data";
import { Icon } from "./Icon";
import { plain } from "./Md";

export function A() {
  const { path } = useProto();
  return <div className="a scroll-top">{path ? <APath key={path} flowKey={path} /> : <AOverview />}</div>;
}

export function AOverview() {
  const { stack, setPath, open } = useProto();
  const map = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<number | null>(null);
  const edges: Edge[] = [
    { from: "prompt", to: "hub", shape: "v", cls: "c-strong" },
    ...GROUPS.map((_, i) => ({ from: "hub", to: `g${i}`, shape: "h" as const, cls: hot === i ? "c-hot" : "" })),
  ];

  return (
    <div className="a-overview">
      <header className="a-intro">
        <h1>Where does a request go?</h1>
        <p>
          You type <code>/odd-mode</code> and a request. It picks <b>one</b> of these {GROUPS.flatMap((g) => g.members).length} paths by
          what you are asking for. No keywords needed. Click a path to follow it.
        </p>
      </header>
      <div className="a-map" ref={map}>
        <Curves container={map} edges={edges} deps={[hot]} />
        <div className="a-left">
          <div className="a-prompt" data-node="prompt">
            <span className="eyebrow">
              <Icon name="chat" size={12} /> You type
            </span>
            <span className="a-prompt-text">/odd-mode users get two notifications after a retry. repro first, then fix.</span>
          </div>
          <div className="a-hub" data-node="hub">
            <span className="a-hub-icon">
              <Icon name="crown" size={18} />
            </span>
            <span>
              <b>odd-mode</b>
              <small>reads it and picks one path</small>
            </span>
          </div>
          <button className="a-always" onClick={() => open({ t: "always" })}>
            <Icon name="layers" size={13} />
            <span>
              {stack.triggers.length} triggers and {stack.principles.length} principles stay on along every path
            </span>
          </button>
        </div>
        <div className="a-groups">
          {GROUPS.map((g, i) => (
            <section key={g.title} className={`a-group${hot === i ? " is-hot" : ""}`} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
              <div className="a-group-head" data-node={`g${i}`}>
                <h3>{g.title}</h3>
                <p>{g.blurb}</p>
              </div>
              <div className="a-pills">
                {g.members.map((k) => (
                  <button key={k} className="a-pill" onClick={() => setPath(k)}>
                    {isOverride(k) && (
                      <span className="a-bolt" title="Checked before the rest">
                        <Icon name="bolt" size={11} />
                      </span>
                    )}
                    {nameOf(stack, k)}
                    <span className="tip">{plain(whenOf(stack, k))}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <p className="a-legend">
        <span className="a-bolt">
          <Icon name="bolt" size={11} />
        </span>
        Shortcut. odd-mode checks these first, like "check on PR 12" going straight to Babysit.
      </p>
    </div>
  );
}

const STATION_W = 184;

type Item = { kind: "start" } | { kind: "step"; index: number } | { kind: "end" };

function APath({ flowKey }: { flowKey: EntityKey }) {
  const { stack, setPath, open } = useProto();
  const group = groupOf(flowKey);
  const example = EXAMPLES[flowKey];

  return (
    <div className="a-pathview">
      <nav className="a-crumbs">
        <button onClick={() => setPath(null)}>
          <Icon name="back" size={13} /> All paths
        </button>
        {group && <span>{group.title}</span>}
      </nav>
      <header className="a-path-head">
        <h1>{nameOf(stack, flowKey)}</h1>
        <p className="a-when">
          <span>Picked when</span> {plain(whenOf(stack, flowKey) || stack.entities.get(flowKey)!.summary)}
        </p>
        {example && <p className="a-example">“{example.prompt.replace(/^\/odd-mode\s*/, "")}”</p>}
        <button className="a-read" onClick={() => open({ t: "step", flow: flowKey, index: 0 })}>
          Read it start to finish <Icon name="arrow" size={13} />
        </button>
      </header>
      <Track flowKey={flowKey} onStep={(index) => open({ t: "step", flow: flowKey, index })} />
      <p className="a-hint">Click a step to read it. Click a skill to see what it does.</p>
    </div>
  );
}

/** A path drawn as a winding line of numbered steps, with what each step calls hanging below it. */
export function Track({ flowKey, onStep, active }: { flowKey: EntityKey; onStep: (index: number) => void; active?: number }) {
  const { stack, setPath, open, hover, setHover } = useProto();
  const flow = stack.flows.get(flowKey)!;
  const track = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(5);
  const handoffs = handoffsOf(flow);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const fit = () => setPerRow(Math.max(2, Math.floor((el.clientWidth + 8) / STATION_W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items: Item[] = [{ kind: "start" }, ...flow.stations.map((_, index) => ({ kind: "step" as const, index })), { kind: "end" }];
  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  const id = (it: Item) => (it.kind === "step" ? `s${it.index}` : it.kind);
  const edges: Edge[] = [];
  rows.forEach((row, r) => {
    row.forEach((it, c) => {
      const next = row[c + 1] ?? rows[r + 1]?.[0];
      if (!next) return;
      edges.push({ from: id(it), to: id(next), shape: row[c + 1] ? "line" : r % 2 === 0 ? "uturn-r" : "uturn-l", cls: "c-track" });
    });
  });

  return (
    <div className="a-track" ref={track}>
      <Curves container={track} edges={edges} deps={[perRow, flowKey]} />
      {rows.map((row, r) => (
        <div key={r} className={`a-row${r % 2 ? " is-rev" : ""}`}>
          {row.map((it) => {
            if (it.kind === "start")
              return (
                <div key="start" className="a-st is-cap">
                  <span className="a-dot is-cap" data-node="start">
                    <Icon name="crown" size={14} />
                  </span>
                  <span className="a-st-label">odd-mode routes here</span>
                </div>
              );
            if (it.kind === "end")
              return (
                <div key="end" className="a-st is-cap">
                  <span className="a-dot is-cap" data-node="end">
                    <Icon name="reply" size={14} />
                  </span>
                  <span className="a-st-label">Reply to you</span>
                  {handoffs.length > 0 && (
                    <div className="a-handoffs">
                      <small>May hand off to</small>
                      {handoffs.map((k) => (
                        <button key={k} className="a-call k-playbook" onClick={() => setPath(k)}>
                          {nameOf(stack, k)} <Icon name="arrow" size={11} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            const s = flow.stations[it.index];
            const all = callsOf(flow, it.index);
            const calls = all.filter((k) => kindOf(k) !== "principle");
            const principles = all.length - calls.length;
            return (
              <div key={it.index} className={`a-st${active === it.index ? " is-active" : ""}`}>
                <button className="a-dot" data-node={`s${it.index}`} onClick={() => onStep(it.index)}>
                  {s.label || it.index + 1}
                </button>
                <button className="a-st-label is-link" onClick={() => onStep(it.index)}>
                  {s.short}
                </button>
                {(calls.length > 0 || principles > 0) && (
                  <div className="a-calls">
                    {calls.map((k) => (
                      <button
                        key={k}
                        className={`a-call k-${kindOf(k)}${hover === k ? " is-hot" : ""}`}
                        onMouseEnter={() => setHover(k)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => (kindOf(k) === "playbook" ? setPath(k) : open({ t: "entity", key: k }))}
                      >
                        {nameOf(stack, k)}
                        {kindOf(k) === "playbook" && <Icon name="arrow" size={11} />}
                      </button>
                    ))}
                    {principles > 0 && (
                      <button className="a-principles" onClick={() => onStep(it.index)}>
                        +{principles} principle{principles > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
