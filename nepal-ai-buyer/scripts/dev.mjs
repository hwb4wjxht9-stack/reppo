// `npm run dev` — starts the app the same way every time:
//   1. stops any old copy still holding port 3000 (even a frozen one)
//   2. deletes the temporary .next build folder, which gets corrupted when
//      two copies run at once or the app is stopped mid-build
//   3. checks .env.local and warns about mistakes
//   4. starts Next.js on http://localhost:3000

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { checkEnv, printChecks, ROOT } from "./env-check.mjs";

const PORT = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

// Finds the process(es) listening on a port. Uses lsof (Mac), then ss or
// fuser (Linux). Returns [] if nothing is listening.
function pidsOnPort(port) {
  let out = run(`lsof -ti tcp:${port} -sTCP:LISTEN`);
  if (!out) out = [...run(`ss -ltnpH "sport = :${port}"`).matchAll(/pid=(\d+)/g)].map((m) => m[1]).join("\n");
  if (!out) out = run(`fuser ${port}/tcp`);
  return [...new Set(out.split(/\s+/).map(Number).filter(Boolean))];
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => srv.close(() => resolve(true)))
      .listen(port);
  });
}

function commandOf(pid) {
  return run(`ps -o command= -p ${pid}`).trim();
}

function parentOf(pid) {
  return Number(run(`ps -o ppid= -p ${pid}`).trim()) || 0;
}

/** The server process plus the `next dev` / npm processes that started it. */
function appFamily(pid) {
  const family = [pid];
  let p = parentOf(pid);
  while (p > 1 && /next|npm|dev\.mjs/i.test(commandOf(p)) && p !== process.pid) {
    family.push(p);
    p = parentOf(p);
  }
  return family;
}

function stop(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch {}
}

async function freePort() {
  if (await portFree(PORT)) return true;
  const pids = pidsOnPort(PORT);
  if (pids.length === 0) {
    console.log(`❌ Port ${PORT} is busy, but I couldn't tell which program is using it.`);
    console.log("   → Close other Terminal windows running the app (or restart the computer), then run npm run dev again.");
    return false;
  }
  const family = [];
  for (const pid of pids) {
    const cmd = commandOf(pid);
    if (!/node|next/i.test(cmd)) {
      console.log(`❌ Port ${PORT} is used by another program: ${cmd || pid}`);
      console.log("   → Close that program, then run npm run dev again.");
      return false;
    }
    console.log(`• Stopping an old copy of the app (process ${pid})`);
    for (const p of appFamily(pid)) {
      stop(p, "SIGCONT"); // wake it if it was frozen with Ctrl+Z
      stop(p, "SIGTERM");
      family.push(p);
    }
  }
  await sleep(1500);
  for (const p of [...family, ...pidsOnPort(PORT)]) stop(p, "SIGKILL");
  for (let i = 0; i < 20 && !(await portFree(PORT)); i++) await sleep(150);
  if (await portFree(PORT)) return true;
  console.log(`❌ Couldn't stop the old copy on port ${PORT}. Restart the computer, then run npm run dev.`);
  return false;
}

console.log("\nStarting Nepal AI Buyer…\n");

if (!(await freePort())) process.exit(1);

rmSync(join(ROOT, ".next"), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
console.log("• Cleared the temporary build folder (.next)");

const checks = await checkEnv();
if (checks.some((c) => !c.ok)) {
  console.log("\n⚠️  The customer screens will work, but the admin page needs these fixed:");
  printChecks(checks.filter((c) => !c.ok));
} else {
  console.log("• Settings OK and database reachable");
}

console.log(`\nOpen http://localhost:${PORT}  (admin: http://localhost:${PORT}/admin)`);
console.log("Stop the app with Ctrl + C  (not Ctrl + Z, which only freezes it).\n");

const next = spawn(process.execPath, [join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", "--port", String(PORT)], {
  cwd: ROOT,
  stdio: "inherit",
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => next.kill(sig));
next.on("exit", (code) => process.exit(code ?? 0));
