import { spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const TARBALL = "https://codeload.github.com/Rakvadium/odd-stack/tar.gz/refs/heads/main";
const DEST = "odd-stack";
const STAGING = `${DEST}.partial`;

if (existsSync(DEST) && !process.argv.includes("--refresh")) process.exit(0);

const res = await fetch(TARBALL);
if (!res.ok || !res.body) throw new Error(`GET ${TARBALL} returned ${res.status}`);

rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING);
const tar = spawn(
  "tar",
  ["-xzf", "-", "-C", STAGING, "--strip-components=1", "odd-stack-main/skills", "odd-stack-main/agents"],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const exited = new Promise((resolve, reject) =>
  tar.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`tar exited with ${code}`)))),
);
await pipeline(Readable.fromWeb(res.body), tar.stdin);
await exited;

// Swap in only a complete copy, so an interrupted fetch never passes the existsSync check above.
rmSync(DEST, { recursive: true, force: true });
renameSync(STAGING, DEST);
console.log(`Fetched skills/ and agents/ from odd-stack main into ${DEST}/`);
