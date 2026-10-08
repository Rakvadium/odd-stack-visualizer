import { useEffect, useState, type RefObject } from "react";

export type Shape = "h" | "v" | "line" | "uturn-r" | "uturn-l";

export interface Edge {
  from: string;
  to: string;
  shape: Shape;
  cls?: string;
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
  cx: number;
  cy: number;
}

/**
 * Draws connectors between elements tagged with `data-node` inside `container`.
 * Positions come from real layout, so nodes stay plain HTML and text wraps naturally.
 */
export function Curves({ container, edges, deps }: { container: RefObject<HTMLElement | null>; edges: Edge[]; deps: unknown[] }) {
  const [state, setState] = useState<{ w: number; h: number; paths: { d: string; cls: string }[] }>({ w: 0, h: 0, paths: [] });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const root = el.getBoundingClientRect();
      const boxOf = (id: string): Box | null => {
        const n = el.querySelector(`[data-node="${CSS.escape(id)}"]`);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        const l = r.left - root.left;
        const t = r.top - root.top;
        return { l, t, r: l + r.width, b: t + r.height, cx: l + r.width / 2, cy: t + r.height / 2 };
      };
      const paths = edges.flatMap((e) => {
        const a = boxOf(e.from);
        const b = boxOf(e.to);
        if (!a || !b) return [];
        return [{ d: pathFor(e.shape, a, b), cls: e.cls ?? "" }];
      });
      setState({ w: el.scrollWidth, h: el.scrollHeight, paths });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <svg className="curves" width={state.w} height={state.h} aria-hidden>
      {state.paths.map((p, i) => (
        <path key={i} d={p.d} className={p.cls} />
      ))}
    </svg>
  );
}

function pathFor(shape: Shape, a: Box, b: Box): string {
  switch (shape) {
    case "h": {
      const dx = Math.max(28, (b.l - a.r) / 2);
      return `M${a.r},${a.cy} C${a.r + dx},${a.cy} ${b.l - dx},${b.cy} ${b.l},${b.cy}`;
    }
    case "v": {
      const dy = Math.max(16, (b.t - a.b) / 2);
      return `M${a.cx},${a.b} C${a.cx},${a.b + dy} ${b.cx},${b.t - dy} ${b.cx},${b.t}`;
    }
    case "line":
      return a.cx <= b.cx ? `M${a.r},${a.cy} L${b.l},${b.cy}` : `M${a.l},${a.cy} L${b.r},${b.cy}`;
    case "uturn-r": {
      const x = Math.max(a.r, b.r);
      const reach = Math.min(60, (b.cy - a.cy) / 2 + 12);
      return `M${a.r},${a.cy} C${x + reach},${a.cy} ${x + reach},${b.cy} ${b.r},${b.cy}`;
    }
    case "uturn-l": {
      const x = Math.min(a.l, b.l);
      const reach = Math.min(60, (b.cy - a.cy) / 2 + 12);
      return `M${a.l},${a.cy} C${x - reach},${a.cy} ${x - reach},${b.cy} ${b.l},${b.cy}`;
    }
  }
}
