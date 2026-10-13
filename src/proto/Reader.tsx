import { useEffect, useRef, useState } from "react";
import { splitFrontmatter } from "../model/markdown";
import type { EntityKey } from "../model/types";
import { useProto, type Target } from "./ctx";
import { KIND_LABEL, ROUTES, callsOf, dirOf, gistOf, kindOf, nameOf, usersOf } from "./data";
import { Icon } from "./Icon";
import { Inline, Md, plain } from "./Md";

/** A centered reading sheet. Opening something never replaces what you were looking at underneath. */
export function Reader() {
  const { reader, back, close, stack } = useProto();
  const scroll = useRef<HTMLDivElement>(null);
  const top = reader.at(-1);

  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Backspace" && reader.length > 1) back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, reader.length, back, close]);

  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
  }, [top]);

  if (!top) return null;
  const prev = reader.at(-2);

  return (
    <div className="sheet-backdrop" onMouseDown={close}>
      <article className="sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="sheet-bar">
          {prev ? (
            <button className="sheet-back" onClick={back}>
              <Icon name="back" /> {targetName(stack, prev)}
            </button>
          ) : (
            <span />
          )}
          <button className="sheet-x" onClick={close} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="sheet-scroll" ref={scroll}>
          {top.t === "step" && <StepDoc flowKey={top.flow} index={top.index} />}
          {top.t === "entity" && <EntityDoc entityKey={top.key} />}
          {top.t === "always" && <AlwaysDoc />}
        </div>
      </article>
    </div>
  );
}

function targetName(stack: ReturnType<typeof useProto>["stack"], t: Target): string {
  if (t.t === "always") return "Always on";
  if (t.t === "entity") return nameOf(stack, t.key);
  const s = stack.flows.get(t.flow)!.stations[t.index];
  return `${nameOf(stack, t.flow)} · ${s.short}`;
}

function StepDoc({ flowKey, index }: { flowKey: EntityKey; index: number }) {
  const { stack, open, back, reader } = useProto();
  const flow = stack.flows.get(flowKey)!;
  const station = flow.stations[index];
  const base = dirOf(flow.path);
  const calls = callsOf(flow, index);
  const unit = kindOf(flowKey) === "playbook" ? "Step" : /^[A-Z]$/.test(station.label) ? "Phase" : "Section";
  const go = (i: number) => {
    back();
    open({ t: "step", flow: flowKey, index: i });
  };
  const titleIsShort = plain(station.title).replace(/\.$/, "") === station.short;

  return (
    <div className="doc">
      <p className="doc-kicker">
        {nameOf(stack, flowKey)} <span>·</span> {unit} {station.label || index + 1} of {flow.stations.length}
      </p>
      <h2 className="doc-title">{station.short}</h2>
      {!titleIsShort && (
        <p className="doc-lede">
          <Inline text={station.title} base={base} />
        </p>
      )}
      {station.body && <Md text={station.body} base={base} className="doc-body" />}

      {calls.length > 0 && (
        <section className="doc-calls">
          <h3>This step calls</h3>
          <div className="cards">
            {calls.map((k) => (
              <button key={k} className={`card k-${kindOf(k)}`} onClick={() => open({ t: "entity", key: k })}>
                <span className="card-kind">{KIND_LABEL[kindOf(k)]}</span>
                <span className="card-name">{nameOf(stack, k)}</span>
                <span className="card-gist">{plain(gistOf(stack, k))}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <nav className="doc-steps">
        {index > 0 ? (
          <button onClick={() => go(index - 1)}>
            <Icon name="back" />
            <span>
              <small>Previous</small>
              {flow.stations[index - 1].short}
            </span>
          </button>
        ) : (
          <span />
        )}
        {index < flow.stations.length - 1 ? (
          <button className="next" onClick={() => go(index + 1)}>
            <span>
              <small>Next</small>
              {flow.stations[index + 1].short}
            </span>
            <Icon name="arrow" />
          </button>
        ) : (
          <span className="doc-end">{reader.length > 0 && flow.reply ? "Last step. Then the reply." : "Last step."}</span>
        )}
      </nav>
    </div>
  );
}

function EntityDoc({ entityKey }: { entityKey: EntityKey }) {
  const { stack, open, setPath } = useProto();
  const entity = stack.entities.get(entityKey)!;
  const flow = stack.flows.get(entityKey);
  const principle = stack.principles.find((p) => p.key === entityKey);
  const hasSteps = !!flow && flow.stations.length > 0;
  const [full, setFull] = useState(!hasSteps);
  const users = usersOf(stack, entityKey);
  const base = entity.path ? dirOf(entity.path) : "skills/odd-mode";
  const lede = flow?.intro.find((s) => !s.title)?.body;

  return (
    <div className="doc">
      <p className={`doc-kicker k-${entity.kind}`}>
        <span className="kind-dot" /> {KIND_LABEL[entity.kind]}
        {entity.origin && <span className="doc-origin"> · from {entity.origin}</span>}
      </p>
      <h2 className="doc-title">{nameOf(stack, entityKey)}</h2>
      {principle && (
        <p className="doc-when">
          <b>Use when</b> <Inline text={principle.when} base="skills/odd-mode" />
        </p>
      )}
      <p className="doc-lede">{principle ? entity.summary : gistOf(stack, entityKey) || entity.summary}</p>
      {lede && hasSteps && <Md text={lede} base={base} className="doc-body" />}

      {hasSteps && (
        <section className="doc-phases">
          <div className="doc-phases-head">
            <h3>{kindOf(entityKey) === "playbook" ? "Steps" : "How it runs"}</h3>
            <button className="text-btn" onClick={() => setPath(entityKey)}>
              See it as a map <Icon name="arrow" />
            </button>
          </div>
          <ol className="phase-list">
            {flow!.stations.map((s, i) => (
              <li key={i}>
                <button onClick={() => open({ t: "step", flow: entityKey, index: i })}>
                  <span className="phase-n">{s.label || "•"}</span>
                  <span className="phase-name">{s.short}</span>
                  <span className="phase-calls">
                    {callsOf(flow!, i)
                      .filter((k) => kindOf(k) !== "principle")
                      .slice(0, 3)
                      .map((k) => nameOf(stack, k))
                      .join(", ")}
                  </span>
                  <Icon name="chevron" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {entity.source && entity.path?.endsWith(".md") && (
        <section className="doc-source">
          {hasSteps && (
            <button className="disclose" onClick={() => setFull(!full)} aria-expanded={full}>
              <Icon name={full ? "down" : "chevron"} /> {full ? "Hide" : "Read"} the full {entity.path.split("/").at(-1)}
            </button>
          )}
          {full && <Md text={splitFrontmatter(entity.source).body.replace(/^#\s.*\n/, "")} base={base} className="doc-body" />}
        </section>
      )}
      {!entity.source && !hasSteps && <p className="doc-muted">oddstack calls this but does not define it in this repo.</p>}

      {users.length > 0 && (
        <footer className="doc-used">
          <span>Used by</span>
          {users.map((k) => (
            <button key={k} onClick={() => (ROUTES.includes(k) ? setPath(k) : open({ t: "entity", key: k }))}>
              {nameOf(stack, k)}
            </button>
          ))}
        </footer>
      )}
    </div>
  );
}

function AlwaysDoc() {
  const { stack, open } = useProto();
  const groups = [...new Set(stack.principles.map((p) => p.group))];
  return (
    <div className="doc">
      <p className="doc-kicker">odd-mode</p>
      <h2 className="doc-title">Always on</h2>
      <p className="doc-lede">
        These hold on every path. A trigger fires the moment its situation comes up, whatever step the agent is on. A principle applies whenever
        its situation holds.
      </p>
      <section>
        <h3 className="doc-h3">{stack.triggers.length} triggers</h3>
        <ul className="trigger-list">
          {stack.triggers.map((t, i) => (
            <li key={i}>
              <span className="trig-if">
                <Inline text={t.when || "Always"} base="skills/odd-mode" />
              </span>
              <span className="trig-then">
                <Inline text={t.then.split(/(?<=\.)\s/)[0]} base="skills/odd-mode" />
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="doc-h3">{stack.principles.length} principles</h3>
        {groups.map((g) => (
          <div key={g} className="principle-group">
            <h4>{g}</h4>
            <div className="chips">
              {stack.principles
                .filter((p) => p.group === g)
                .map((p) => (
                  <button key={p.key} className="chip k-principle" onClick={() => open({ t: "entity", key: p.key })}>
                    {p.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
