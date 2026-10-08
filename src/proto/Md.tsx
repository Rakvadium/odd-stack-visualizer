import { Fragment, useMemo } from "react";
import type { InlineToken } from "../model/lexicon";
import { parseBlocks, type Block } from "../model/markdown";
import { useProto } from "./ctx";

export function Md({ text, base, className }: { text: string; base: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className={["md", className].filter(Boolean).join(" ")}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} base={base} />
      ))}
    </div>
  );
}

function BlockView({ block, base }: { block: Block; base: string }) {
  switch (block.type) {
    case "heading":
      return (
        <h4 className="md-h">
          <Inline text={block.text} base={base} />
        </h4>
      );
    case "paragraph":
      return (
        <p>
          <Inline text={block.text} base={base} />
        </p>
      );
    case "code":
      return <pre className="md-pre">{block.text}</pre>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag>
          {block.items.map((item, i) => {
            const box = /^\[( |x)\]\s+/.exec(item.text);
            const text = box ? item.text.slice(box[0].length) : item.text;
            const nested = parseBlocks(text);
            return (
              <li key={i} className={box ? "md-task" : undefined}>
                {nested.length === 1 && nested[0].type === "paragraph" ? (
                  <Inline text={nested[0].text} base={base} />
                ) : (
                  nested.map((b, j) => <BlockView key={j} block={b} base={base} />)
                )}
              </li>
            );
          })}
        </Tag>
      );
    }
  }
}

export function Inline({ text, base }: { text: string; base: string }) {
  const { stack } = useProto();
  const tokens = useMemo(() => stack.lexicon.tokenize(text, base), [stack, text, base]);
  return <Tokens tokens={tokens} />;
}

/** Plain text with markdown markers stripped, for compact labels. */
export function plain(text: string): string {
  return text.replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function Tokens({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((t, i) => (
        <Fragment key={i}>
          <Token token={t} />
        </Fragment>
      ))}
    </>
  );
}

function Token({ token }: { token: InlineToken }) {
  const { stack, open, setPeek } = useProto();
  switch (token.t) {
    case "text":
      return <>{token.s}</>;
    case "code":
      return <code>{token.s}</code>;
    case "bold":
      return (
        <strong>
          <Tokens tokens={token.children} />
        </strong>
      );
    case "em":
      return (
        <em>
          <Tokens tokens={token.children} />
        </em>
      );
    case "link":
      return <span className="md-link">{token.s}</span>;
    case "ref": {
      const e = stack.entities.get(token.key);
      return (
        <button
          type="button"
          className={`ref k-${e?.kind ?? "skill"}${token.code ? " is-code" : ""}`}
          onClick={(ev) => {
            ev.stopPropagation();
            open({ t: "entity", key: token.key });
          }}
          onMouseEnter={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            setPeek({ key: token.key, x: r.left, y: r.bottom });
          }}
          onMouseLeave={() => setPeek(null)}
        >
          {token.s}
        </button>
      );
    }
  }
}
