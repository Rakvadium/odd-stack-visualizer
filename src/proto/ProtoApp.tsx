import { useEffect } from "react";
import { A } from "./A";
import { B } from "./B";
import { D } from "./D";
import { E } from "./E/E";
import { useProto, type Variant } from "./ctx";
import { Peek } from "./Peek";
import { Reader } from "./Reader";

const VARIANTS: { v: Variant; name: string }[] = [
  { v: "a", name: "Map" },
  { v: "b", name: "Guided" },
  { v: "d", name: "Map + read" },
  { v: "e", name: "Canvas" },
];

export function ProtoApp() {
  const { variant, setVariant, reader } = useProto();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", variant === "e");
  }, [variant]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reader.length || document.activeElement?.tagName === "INPUT") return;
      const hit = VARIANTS[Number(e.key) - 1];
      if (hit) setVariant(hit.v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reader.length, setVariant]);

  return (
    <>
      {variant === "a" && <A />}
      {variant === "b" && <B />}
      {variant === "d" && <D />}
      {variant === "e" && <E />}
      <Peek />
      <Reader />
      <div className="switcher" role="tablist" aria-label="Prototype">
        <span className="switcher-label">Prototype</span>
        {VARIANTS.map((x, i) => (
          <button key={x.v} role="tab" aria-selected={variant === x.v} className={variant === x.v ? "is-on" : ""} onClick={() => setVariant(x.v)}>
            <kbd>{i + 1}</kbd> {x.name}
          </button>
        ))}
      </div>
    </>
  );
}
