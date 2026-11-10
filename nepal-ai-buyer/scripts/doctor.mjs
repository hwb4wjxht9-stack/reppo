// `npm run doctor` — checks everything the app needs and says how to fix it.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { checkEnv, printChecks, ROOT } from "./env-check.mjs";

const PORT = 3000;

function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => srv.close(() => resolve(true)))
      .listen(port);
  });
}

console.log("\nNepal AI Buyer — checkup\n");

const checks = [];
const [major, minor] = process.versions.node.split(".").map(Number);
checks.push(
  major > 18 || (major === 18 && minor >= 18)
    ? { ok: true, label: `Node.js ${process.versions.node}` }
    : { ok: false, label: `Node.js ${process.versions.node} is too old`, fix: "Install the LTS version from https://nodejs.org" },
);
checks.push(
  existsSync(join(ROOT, "node_modules", "next"))
    ? { ok: true, label: "Packages installed" }
    : { ok: false, label: "Packages not installed", fix: "Run:  npm install" },
);

if (await portFree(PORT)) checks.push({ ok: true, label: `Port ${PORT} is free` });
else {
  let who = "";
  try {
    who = execSync(`lsof -nP -iTCP:${PORT} -sTCP:LISTEN`, { encoding: "utf8" }).split("\n")[1] ?? "";
  } catch {}
  checks.push({
    ok: false,
    label: `Port ${PORT} is already in use${who ? ` by: ${who.trim().split(/\s+/).slice(0, 2).join(" ")}` : ""}`,
    fix: "That's fine if the app is already running in another window. Otherwise `npm run dev` stops the old copy for you.",
  });
}

checks.push(...(await checkEnv()));
printChecks(checks);

const bad = checks.filter((c) => !c.ok).length;
console.log(bad ? `\n${bad} thing(s) to fix above.\n` : "\nAll good! Start the app with:  npm run dev\n");
process.exit(bad ? 1 : 0);
