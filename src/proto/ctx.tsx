import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Stack } from "../model/stack";
import type { EntityKey } from "../model/types";

export type Variant = "a" | "b" | "d" | "e";

export type Target = { t: "step"; flow: EntityKey; index: number } | { t: "entity"; key: EntityKey } | { t: "always" };

interface Proto {
  stack: Stack;
  variant: Variant;
  setVariant: (v: Variant) => void;
  path: EntityKey | null;
  setPath: (key: EntityKey | null) => void;
  intent: string | null;
  setIntent: (title: string | null) => void;
  reader: Target[];
  open: (target: Target) => void;
  back: () => void;
  close: () => void;
  hover: EntityKey | null;
  setHover: (key: EntityKey | null) => void;
  peek: Peek | null;
  setPeek: (peek: Peek | null) => void;
}

export interface Peek {
  key: EntityKey;
  x: number;
  y: number;
}

const Ctx = createContext<Proto | null>(null);

interface UrlState {
  variant: Variant;
  path: EntityKey | null;
  intent: string | null;
}

function readUrl(stack: Stack): UrlState {
  const p = new URLSearchParams(location.hash.slice(1));
  const v = p.get("v");
  const path = p.get("path") as EntityKey | null;
  return {
    variant: v === "b" || v === "d" || v === "e" ? v : "a",
    path: path && stack.flows.has(path) ? path : null,
    intent: p.get("intent"),
  };
}

function writeUrl(s: UrlState): void {
  const p = new URLSearchParams();
  p.set("v", s.variant);
  if (s.intent) p.set("intent", s.intent);
  if (s.path) p.set("path", s.path);
  const hash = "#" + p.toString().replace(/%3A/g, ":");
  if (hash !== location.hash) history.pushState(null, "", hash);
}

export function ProtoProvider({ stack, children }: { stack: Stack; children: ReactNode }) {
  const [url, setUrl] = useState<UrlState>(() => readUrl(stack));
  const [reader, setReader] = useState<Target[]>([]);
  const [hover, setHover] = useState<EntityKey | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);

  useEffect(() => {
    const onPop = () => {
      setUrl(readUrl(stack));
      setReader([]);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [stack]);

  const update = useCallback((next: UrlState) => {
    writeUrl(next);
    setUrl(next);
    setReader([]);
    window.scrollTo({ top: 0 });
    document.querySelectorAll(".scroll-top").forEach((el) => el.scrollTo({ top: 0 }));
  }, []);

  const value = useMemo<Proto>(
    () => ({
      stack,
      ...url,
      setVariant: (variant) => update({ ...url, variant }),
      setPath: (path) => update({ ...url, path }),
      setIntent: (intent) => update({ ...url, intent, path: null }),
      reader,
      open: (target) => {
        setPeek(null);
        setReader((r) => [...r, target]);
      },
      back: () => setReader((r) => r.slice(0, -1)),
      close: () => setReader([]),
      hover,
      setHover,
      peek,
      setPeek,
    }),
    [stack, url, update, reader, hover, peek],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProto(): Proto {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProto outside ProtoProvider");
  return v;
}
