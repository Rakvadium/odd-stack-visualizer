# odd-mode paths

A read-only visualizer for every path `/odd-mode` can take. It reads the skill, playbook, and agent markdown in this repo at build time, so editing a playbook updates the app.

This is a prototype stage. A switcher at the bottom compares four directions:

- **Map.** A branching overview, then each path as a winding line of steps.
- **Guided.** One question per screen: kind of request, then path, then steps.
- **Map + read.** The map on top, the full playbook text below.
- **Canvas.** A node graph. odd-mode is a hub wired to every path, and each path is a chain of steps with what each step calls branching below it.

## Run

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5173. Keys `1` to `4` switch prototypes. On the canvas, `esc` goes back a level.

## Where things live

- `src/model/` parses the markdown into paths and is covered by tests. `curated.ts` holds the few facts the markdown lacks: intent groups, example prompts, short step labels, and outside tools.
- `src/proto/` holds the prototypes. `E/` is the canvas.

## Deploy

`vercel.json` at the repo root builds this folder. Deploy from the repo root, since the build reads `skills/` and `agents/`.
