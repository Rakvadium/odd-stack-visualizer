import { useState, type ReactNode } from "react";
import { EXAMPLES, GROUPS } from "../model/curated";
import { firstSentence } from "../model/markdown";
import type { EntityKey } from "../model/types";
import { useProto } from "./ctx";
import { callsOf, dirOf, groupOf, handoffsOf, isOverride, kindOf, nameOf, whenOf } from "./data";
import { Icon } from "./Icon";
import { Inline, Md, plain } from "./Md";

const GLYPHS: Record<string, ReactNode> = {
  Understand: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="M14.5 14.5L20 20" />
    </>
  ),
  Diagnose: <path d="M2 12h4l3-7 4 14 3-7h6" />,
  "Fix and speed up": <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  "Build and reshape": (
    <>
      <rect x="3" y="12" width="8" height="8" rx="1.5" />
      <rect x="13" y="12" width="8" height="8" rx="1.5" />
      <rect x="8" y="3" width="8" height="8" rx="1.5" />
    </>
  ),
  "Skills and evals": (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h5" />
    </>
  ),
  "Plan and run long": (
    <>
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="6" r="2" />
      <path d="M7 18h7a3.5 3.5 0 000-7h-4a3.5 3.5 0 010-7h7" />
    </>
  ),
  "Pull requests": (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="M6 7v10M18 17V10a3 3 0 00-3-3h-4" />
      <path d="M13 4.5L10.5 7 13 9.5" />
    </>
  ),
  Housekeeping: (
    <>
      <path d="M4 8h16l-1.5 12h-13z" />
      <path d="M9 8V5h6v3M10 12v5M14 12v5" />
    </>
  ),
};

function Glyph({ name }: { name: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {GLYPHS[name]}
    </svg>
  );
}

export function B() {
  const { intent, path } = useProto();
  return (
    <div className="b scroll-top">
      <div className="b-inner">
        <Progress />
        {path ? <BPath key={path} flowKey={path} /> : intent ? <BPick intent={intent} /> : <BStart />}
      </div>
    </div>
  );
}

function Progress() {
  const { stack, intent, path, setIntent, setPath } = useProto();
  const group = path ? groupOf(path) : GROUPS.find((g) => g.title === intent);
  const stage = path ? 3 : intent ? 2 : 1;
  if (stage === 1) return null;
  return (
    <nav className="b-progress">
      <button onClick={() => setIntent(null)}>
        <span className="b-n">1</span>
        <span>
          <small>Kind of request</small>
          {group?.title}
        </span>
      </button>
      <Icon name="chevron" />
      <button className={stage === 2 ? "is-on" : ""} onClick={() => group && setIntent(group.title)}>
        <span className="b-n">2</span>
        <span>
          <small>Path</small>
          {path ? nameOf(stack, path) : "Pick one"}
        </span>
      </button>
      <Icon name="chevron" />
      <button className={stage === 3 ? "is-on" : ""} disabled={!path} onClick={() => path && setPath(path)}>
        <span className="b-n">3</span>
        <span>
          <small>Steps</small>
          {path ? `${stack.flows.get(path)!.stations.length} steps` : "Follow it"}
        </span>
      </button>
    </nav>
  );
}

function BStart() {
  const { setIntent, open, stack } = useProto();
  return (
    <div className="b-start">
      <p className="eyebrow">poteto-mode, one question at a time</p>
      <h1>What do you want the agent to do?</h1>
      <p className="b-sub">
        When you type <code>/poteto-mode</code> and a request, it works out which kind of request it is, then runs the one path that fits. Start
        the same way.
      </p>
      <div className="b-tiles">
        {GROUPS.map((g) => (
          <button key={g.title} className="b-tile" onClick={() => setIntent(g.title)}>
            <span className="b-glyph">
              <Glyph name={g.title} />
            </span>
            <span className="b-tile-title">{g.title}</span>
            <span className="b-tile-blurb">{g.blurb}</span>
            <span className="b-tile-n">
              {g.members.length} path{g.members.length > 1 ? "s" : ""}
            </span>
          </button>
        ))}
      </div>
      <button className="b-always" onClick={() => open({ t: "always" })}>
        <Icon name="layers" size={14} /> Along every path, {stack.triggers.length} triggers and {stack.principles.length} principles stay on.
        <span>See them</span>
      </button>
    </div>
  );
}

function BPick({ intent }: { intent: string }) {
  const { stack, setPath } = useProto();
  const group = GROUPS.find((g) => g.title === intent);
  if (!group) return null;
  return (
    <div className="b-pick">
      <h1>
        <span className="b-glyph is-inline">
          <Glyph name={group.title} />
        </span>
        {group.title}
      </h1>
      <p className="b-sub">{group.members.length > 1 ? `poteto-mode picks one of these ${group.members.length} by what you describe.` : group.blurb}</p>
      <div className="b-cards">
        {group.members.map((k) => {
          const flow = stack.flows.get(k)!;
          const ex = EXAMPLES[k];
          return (
            <button key={k} className="b-card" onClick={() => setPath(k)}>
              <span className="b-card-head">
                <span className="b-card-name">{nameOf(stack, k)}</span>
                {isOverride(k) && (
                  <span className="b-short">
                    <Icon name="bolt" size={11} /> checked first
                  </span>
                )}
                <span className="b-card-go">
                  {flow.stations.length} steps <Icon name="arrow" size={13} />
                </span>
              </span>
              <span className="b-card-when">
                <b>Pick this when</b> {plain(whenOf(stack, k))}
              </span>
              {ex && <span className="b-card-ex">“{ex.prompt.replace(/^\/poteto-mode\s*/, "")}”</span>}
              <span className="b-card-steps">
                {flow.stations.map((s, i) => (
                  <span key={i}>{s.short}</span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BPath({ flowKey }: { flowKey: EntityKey }) {
  const { stack, open, setPath } = useProto();
  const flow = stack.flows.get(flowKey)!;
  const [openStep, setOpenStep] = useState<number | null>(null);
  const base = dirOf(flow.path);
  const handoffs = handoffsOf(flow);

  return (
    <div className="b-path">
      <h1>{nameOf(stack, flowKey)}</h1>
      <p className="b-sub">{flow.owns ? `${flow.owns}.` : plain(whenOf(stack, flowKey))}</p>
      <ol className="b-story">
        {flow.stations.map((s, i) => {
          const calls = callsOf(flow, i).filter((k) => kindOf(k) !== "principle");
          const isOpen = openStep === i;
          const gist = plain(s.title).replace(/\.$/, "") !== s.short ? s.title : s.body ? firstSentence(s.body) : "";
          return (
            <li key={i} className={`b-step${isOpen ? " is-open" : ""}`}>
              <span className="b-step-n">{s.label || i + 1}</span>
              <div className="b-step-card">
                <button className="b-step-head" onClick={() => setOpenStep(isOpen ? null : i)} aria-expanded={isOpen}>
                  <span className="b-step-title">{s.short}</span>
                  {!isOpen && gist && (
                    <span className="b-step-gist">{plain(gist)}</span>
                  )}
                  <span className="b-step-toggle">
                    <Icon name={isOpen ? "down" : "chevron"} />
                  </span>
                </button>
                {isOpen && (
                  <div className="b-step-full">
                    {plain(s.title).replace(/\.$/, "") !== s.short && (
                      <p className="b-step-lede">
                        <Inline text={s.title} base={base} />
                      </p>
                    )}
                    {s.body && <Md text={s.body} base={base} />}
                  </div>
                )}
                {calls.length > 0 && (
                  <div className="b-uses">
                    {calls.map((k) => (
                      <button
                        key={k}
                        className={`b-use k-${kindOf(k)}`}
                        onClick={() => (kindOf(k) === "playbook" ? setPath(k) : open({ t: "entity", key: k }))}
                      >
                        <span className="kind-dot" /> {nameOf(stack, k)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        <li className="b-step is-end">
          <span className="b-step-n">
            <Icon name="reply" size={14} />
          </span>
          <div className="b-step-card is-plain">
            <span className="b-step-title">Then it replies</span>
            {flow.reply && <p className="b-step-gist">{plain(flow.reply)}</p>}
            {handoffs.length > 0 && (
              <div className="b-uses">
                <small>Can hand off to</small>
                {handoffs.map((k) => (
                  <button key={k} className="b-use k-playbook" onClick={() => setPath(k)}>
                    {nameOf(stack, k)} <Icon name="arrow" size={11} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}
