import { useEffect, useRef, useState } from "react";
import { EXAMPLES } from "../model/curated";
import type { EntityKey } from "../model/types";
import { AOverview, Track } from "./A";
import { Steps } from "./C";
import { useProto } from "./ctx";
import { groupOf, nameOf, whenOf } from "./data";
import { Icon } from "./Icon";
import { plain } from "./Md";

/** Recommended hybrid: see the shape on a map, then read the whole thing on the same page. */
export function D() {
  const { path } = useProto();
  return (
    <div className="a scroll-top" id="d-main">
      {path ? <DPath key={path} flowKey={path} /> : <AOverview />}
    </div>
  );
}

function DPath({ flowKey }: { flowKey: EntityKey }) {
  const { stack, setPath } = useProto();
  const flow = stack.flows.get(flowKey)!;
  const group = groupOf(flowKey);
  const example = EXAMPLES[flowKey];
  const refs = useRef<(HTMLElement | null)[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const root = document.getElementById("d-main");
    if (!root) return;
    const onScroll = () => {
      const top = root.getBoundingClientRect().top;
      setPinned((mapRef.current?.getBoundingClientRect().bottom ?? 1) < top + 40);
      let current = -1;
      refs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= top + 180) current = i;
      });
      setActive(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [flowKey]);

  const jump = (i: number) => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  const toMap = () => document.getElementById("d-main")?.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      <div className={`d-bar${pinned ? " is-on" : ""}`} aria-hidden={!pinned}>
        <button className="d-bar-title" onClick={toMap}>
          <Icon name="back" size={13} /> {nameOf(stack, flowKey)}
        </button>
        <ol className="d-bar-steps">
          {flow.stations.map((s, i) => (
            <li key={i} className={i === active ? "is-on" : i < active ? "is-past" : ""}>
              <button onClick={() => jump(i)} title={s.short}>
                {s.label || i + 1}
              </button>
            </li>
          ))}
        </ol>
        <span className="d-bar-now">{active >= 0 ? flow.stations[active].short : ""}</span>
      </div>

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
        </header>

        <div ref={mapRef}>
          <Track flowKey={flowKey} onStep={jump} active={active} />
        </div>
        <button className="d-scroll-cue" onClick={() => jump(0)}>
          Read the steps <Icon name="down" size={13} />
        </button>

        <article className="c-doc d-doc">
          {flow.owns && (
            <p className="c-lede">
              <b>{flow.owns}.</b> {flow.ownsDetail && plain(flow.ownsDetail)}
            </p>
          )}
          <Steps flowKey={flowKey} refs={refs} />
        </article>
      </div>
    </>
  );
}
