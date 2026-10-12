import { buildGraph, type SourceFile } from "./parse";
import { parseHash, renderApp, type View } from "./render";

const skillFiles = import.meta.glob(
  ["../../skills/**/*.md", "../../agents/**/*.md", "../../automations/**/*.md", "../../docs/guide/02-odd-mode.md"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const files: SourceFile[] = Object.entries(skillFiles).map(([path, text]) => ({
  path: path.replace(/^(\.\.\/)+/, ""),
  text,
}));

const graph = buildGraph(files);
const root = document.querySelector("#app");
if (!root) throw new Error("missing #app");

let query = "";

function draw(): void {
  const view: View = parseHash(location.hash);
  const input = document.querySelector<HTMLInputElement>("#q");
  const caret = input && document.activeElement === input ? input.selectionStart : null;
  root!.innerHTML = renderApp(graph, view, query);
  const next = document.querySelector<HTMLInputElement>("#q");
  const form = document.querySelector<HTMLFormElement>(".search");
  next?.addEventListener("input", () => {
    query = next.value;
    draw();
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const hit = document.querySelector<HTMLAnchorElement>(".nav a.nav-link");
    if (hit) location.hash = hit.getAttribute("href") ?? "#/";
  });
  if (caret !== null && next) {
    next.focus();
    next.setSelectionRange(caret, caret);
  }
  const drawer = document.querySelector<HTMLDetailsElement>(".nav-drawer");
  if (
    drawer &&
    window.matchMedia("(max-width: 860px)").matches &&
    query.trim() === ""
  ) {
    drawer.open = false;
  }
}

window.addEventListener("hashchange", draw);
draw();
