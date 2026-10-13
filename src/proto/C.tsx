import { useEffect, useRef, useState, type RefObject } from "react";
import { EXAMPLES, GROUPS } from "../model/curated";
import type { EntityKey } from "../model/types";
import { useProto } from "./ctx";
import { callsOf, dirOf, groupOf, handoffsOf, isOverride, kindOf, nameOf, whenOf } from "./data";
import { Icon } from "./Icon";
import { Inline, Md, plain } from "./Md";

export function C() {
  const { path } = useProto();
  return (
    <div className="c">
      <CNav />
      <main className="c-main scroll-top" id="c-main">
        {path ? <CPath key={path} flowKey={path} /> : <COverview />}
      </main>
    </div>
  );
}

function CNav() {
  const { stack, path, setPath } = useProto();
  return (
    <nav className="c-nav" aria-label="Paths">
      <button className={`c-home${path ? "" : " is-on"}`} onClick={() => setPath(null)}>
        <Icon name="crown" size={15} /> How routing works
      </button>
      {GROUPS.map((g) => (
        <div key={g.title} className="c-nav-group">
          <h4>{g.title}</h4>
          {g.members.map((k) => (
            <button key={k} className={path === k ? "is-on" : ""} onClick={() => setPath(k)}>
              {nameOf(stack, k)}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

function COverview() {
  const { stack, setPath, open } = useProto();
  return (
    <article className="c-doc">
      <p className="eyebrow">odd-mode</p>
      <h1>How a request finds its path</h1>
      <p className="c-lede">
        You type <code>/odd-mode</code> and a request. odd-mode reads it, picks the one playbook that fits, copies that playbook's steps
        into a todo list, and works through them. Each step can call other skills, which have steps of their own.
      </p>

      <ol className="c-flow">
        <li>
          <b>You type a request.</b> Plain words. No keywords needed.
        </li>
        <li>
          <b>Shortcuts are checked first.</b> A PR-status question goes to Babysit, "land the stack" goes to Shipping, and big or unattended work
          goes to figure-it-out.
        </li>
        <li>
          <b>Otherwise, the best fit wins.</b> The model compares your request with each path's "pick when" line below.
        </li>
        <li>
          <b>The steps run in order.</b> {stack.triggers.length} triggers and {stack.principles.length} principles stay on the whole time.{" "}
          <button className="c-inline-link" onClick={() => open({ t: "always" })}>
            See them
          </button>
        </li>
      </ol>

      {GROUPS.map((g) => (
        <section key={g.title} className="c-group">
          <h2>{g.title}</h2>
          <div className="c-rows">
            {g.members.map((k) => (
              <button key={k} className="c-row" onClick={() => setPath(k)}>
                <span className="c-row-name">
                  {nameOf(stack, k)}
                  {isOverride(k) && (
                    <span className="c-bolt" title="Checked first">
                      <Icon name="bolt" size={11} />
                    </span>
                  )}
                </span>
                <span className="c-row-when">{plain(whenOf(stack, k))}</span>
                <Icon name="chevron" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

function CPath({ flowKey }: { flowKey: EntityKey }) {
  const { stack } = useProto();
  const flow = stack.flows.get(flowKey)!;
  const base = dirOf(flow.path);
  const group = groupOf(flowKey);
  const example = EXAMPLES[flowKey];
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const root = document.getElementById("c-main");
    if (!root) return;
    const onScroll = () => {
      const mid = root.getBoundingClientRect().top + 160;
      let current = 0;
      refs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= mid) current = i;
      });
      setActive(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [flowKey]);

  const jump = (i: number) => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="c-pathwrap">
      <article className="c-doc">
        <p className="eyebrow">{group?.title ?? "Skill"}</p>
        <h1>{nameOf(stack, flowKey)}</h1>
        <div className="c-when">
          <span>Picked when</span>
          <p>{plain(whenOf(stack, flowKey) || stack.entities.get(flowKey)!.summary)}</p>
          {example && <code>{example.prompt}</code>}
        </div>
        {flow.owns && (
          <p className="c-lede">
            {flow.owns}. {flow.ownsDetail && <Inline text={flow.ownsDetail} base={base} />}
          </p>
        )}

        <Steps flowKey={flowKey} refs={refs} />
      </article>

      <aside className="c-mini" aria-label="Steps on this path">
        <p className="c-mini-title">{flow.stations.length} steps</p>
        <ol>
          {flow.stations.map((s, i) => {
            const calls = callsOf(flow, i).filter((k) => kindOf(k) !== "principle");
            return (
              <li key={i} className={i === active ? "is-on" : i < active ? "is-past" : ""}>
                <button onClick={() => jump(i)}>
                  <span className="c-mini-dot">{s.label || i + 1}</span>
                  <span className="c-mini-label">
                    {s.short}
                    {calls.length > 0 && <small>{calls.map((k) => nameOf(stack, k)).join(" · ")}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

/** Every step of a flow as readable sections, then the reply and any handoffs. */
export function Steps({ flowKey, refs }: { flowKey: EntityKey; refs: RefObject<(HTMLElement | null)[]> }) {
  const { stack, open, setPath } = useProto();
  const flow = stack.flows.get(flowKey)!;
  const base = dirOf(flow.path);
  const handoffs = handoffsOf(flow);
  return (
    <>
        {flow.stations.map((s, i) => {
        const calls = callsOf(flow, i).filter((k) => kindOf(k) !== "principle");
        const titleIsShort = plain(s.title).replace(/\.$/, "") === s.short;
        return (
          <section key={i} className="c-step" ref={(el) => {
              refs.current[i] = el;
            }}>
            <h2>
              <span className="c-step-n">{s.label || i + 1}</span>
              {s.short}
            </h2>
            {!titleIsShort && (
              <p className="c-step-lede">
                <Inline text={s.title} base={base} />
              </p>
            )}
            {s.body && <Md text={s.body} base={base} className="c-body" />}
            {calls.length > 0 && (
              <div className="c-calls">
                {calls.map((k) => (
                  <button key={k} className={`c-call k-${kindOf(k)}`} onClick={() => (kindOf(k) === "playbook" ? setPath(k) : open({ t: "entity", key: k }))}>
                    <span className="kind-dot" />
                    {nameOf(stack, k)}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {flow.reply && (
        <section className="c-step is-end">
          <h2>
            <span className="c-step-n">
              <Icon name="reply" size={14} />
            </span>
            What you get back
          </h2>
          <Md text={flow.reply} base={base} className="c-body" />
        </section>
      )}
      {handoffs.length > 0 && (
        <p className="c-handoff">
          May hand off to{" "}
          {handoffs.map((k, i) => (
            <span key={k}>
              <button className="c-inline-link" onClick={() => setPath(k)}>
                {nameOf(stack, k)}
              </button>
              {i < handoffs.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      )}
    </>
  );
}
