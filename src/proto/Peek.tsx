import { useProto } from "./ctx";
import { KIND_LABEL, gistOf, nameOf, usersOf } from "./data";
import { plain } from "./Md";

/** A hover preview for a mention: what it is and how widely it is used, without leaving the sentence. */
export function Peek() {
  const { peek, stack } = useProto();
  if (!peek) return null;
  const e = stack.entities.get(peek.key);
  if (!e) return null;
  const flow = stack.flows.get(peek.key);
  const users = usersOf(stack, peek.key).length;
  const left = Math.min(peek.x, window.innerWidth - 340);
  return (
    <div className={`peek k-${e.kind}`} style={{ left, top: peek.y + 8 }} role="tooltip">
      <span className="peek-kind">
        <span className="kind-dot" /> {KIND_LABEL[e.kind]}
      </span>
      <strong>{nameOf(stack, peek.key)}</strong>
      <p>{plain(gistOf(stack, peek.key) || e.summary)}</p>
      <span className="peek-meta">
        {flow && flow.stations.length > 0 ? `${flow.stations.length} steps · ` : ""}
        used by {users} {users === 1 ? "path" : "paths"} · click to open
      </span>
    </div>
  );
}
