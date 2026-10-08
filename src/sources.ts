import { buildStack, type SourceFile } from "./model/stack";

const raw = import.meta.glob(["../../skills/**/*.md", "../../skills/**/*.tsv", "../../agents/*.md"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const files: SourceFile[] = Object.entries(raw).map(([path, text]) => ({
  path: path.replace(/^(\.\.\/)+/, ""),
  text,
}));

export const stack = buildStack(files);
