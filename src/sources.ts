import { buildStack, type SourceFile } from "./model/stack";

const raw = import.meta.glob(["../odd-stack/skills/**/*.md", "../odd-stack/skills/**/*.tsv", "../odd-stack/agents/*.md"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const files: SourceFile[] = Object.entries(raw).map(([path, text]) => ({
  path: path.replace(/^\.\.\/odd-stack\//, ""),
  text,
}));

export const stack = buildStack(files);
