// Desktop launcher. `start.bat` / `start.sh` delegate here so the real logic
// lives in one place instead of being written twice in two shell dialects.
//
// Installs dependencies and builds on first run, rebuilds when sources have
// changed since the last build, prints the LAN URL to share, starts the server,
// and opens a browser.

import { spawn, spawnSync } from "child_process";
import { existsSync, statSync, readdirSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_ID = path.join(ROOT, ".next", "BUILD_ID");
const PORT = process.env.PORT || "3000";

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};
const say = (m) => console.log(m);
const step = (m) => say(`\n${C.cyan}${C.bold}==>${C.reset} ${C.bold}${m}${C.reset}`);
const warn = (m) => say(`${C.yellow}  ! ${m}${C.reset}`);
const die = (m) => {
  say(`\n${C.red}${C.bold}Error:${C.reset} ${m}\n`);
  process.exit(1);
};

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

function run(cmd, args, extraEnv = {}) {
  // On Windows npm is a .cmd shim, which Node refuses to spawn without a shell.
  // Passing an args array alongside shell:true is deprecated (DEP0190), so build
  // one command string instead — safe here because every argument is a literal
  // defined in this file, never user input.
  const opts = {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  };
  const r = isWin
    ? spawnSync([cmd, ...args].join(" "), { ...opts, shell: true })
    : spawnSync(cmd, args, opts);
  return r.status === 0;
}

// ---------------------------------------------------------------- node version
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  die(
    `Syncwave needs Node 20 or newer — this is Node ${process.versions.node}.\n` +
      `Download the current LTS from https://nodejs.org and run this again.`
  );
}

say(`${C.bold}${C.cyan}🌊 Syncwave${C.reset} ${C.dim}· starting up${C.reset}`);

// ------------------------------------------------------------------- freshness
/** Newest mtime across the files a build depends on. */
function newestSourceMtime() {
  const roots = ["app", "components", "lib", "hooks", "public"].map((d) => path.join(ROOT, d));
  const files = ["package.json", "package-lock.json", "server.mjs", "next.config.ts", "next.config.mjs"]
    .map((f) => path.join(ROOT, f))
    .filter(existsSync);

  let newest = 0;
  for (const f of files) newest = Math.max(newest, statSync(f).mtimeMs);

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  for (const r of roots) if (existsSync(r)) walk(r);
  return newest;
}

const force = process.argv.includes("--rebuild");
const needsInstall = !existsSync(path.join(ROOT, "node_modules", "next"));
const built = existsSync(BUILD_ID);
const needsBuild = force || !built || newestSourceMtime() > statSync(BUILD_ID).mtimeMs;

// --------------------------------------------------------------------- install
if (needsInstall) {
  step("Installing dependencies (first run — this takes a few minutes)");
  // youtube-dl-exec looks for a `python` binary at install time; the runtime
  // only needs python3, which the yt-dlp build finds itself.
  if (!run(npm, ["install"], { YOUTUBE_DL_SKIP_PYTHON_CHECK: "1" })) {
    die("Dependency installation failed. Scroll up for the reason.");
  }
} else {
  say(`${C.dim}  dependencies already installed${C.reset}`);
}

// ----------------------------------------------------------------------- build
if (needsBuild) {
  step(built ? "Sources changed — rebuilding" : "Building the app (first run)");
  if (!run(npm, ["run", "build"])) {
    die("Build failed. Scroll up for the reason.");
  }
} else {
  say(`${C.dim}  build is up to date${C.reset}`);
}

// ------------------------------------------------------------- runtime checks
const { ffmpegMissing } = await import("../lib/ffmpeg.mjs");
const { jsRuntimeMissing } = await import("../lib/jsruntime.mjs");

if (ffmpegMissing()) {
  warn("ffmpeg was not found, so tracks will fail to convert.");
  warn(
    process.platform === "win32"
      ? "Install it with:  winget install Gyan.FFmpeg"
      : process.platform === "darwin"
        ? "Install it with:  brew install ffmpeg"
        : "Install it with:  sudo apt install ffmpeg"
  );
}
if (jsRuntimeMissing()) {
  // Without this YouTube bot-checks every request and the failure looks like a
  // blocked IP rather than a missing dependency.
  warn("No JavaScript runtime found — YouTube will refuse downloads.");
  warn("Fix it with:  npm install deno");
}

// -------------------------------------------------------------------- lan urls
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

const lan = lanAddresses();
step("Syncwave is starting");
say(`\n  ${C.bold}On this computer${C.reset}   ${C.cyan}http://localhost:${PORT}${C.reset}`);
if (lan.length) {
  say(`  ${C.bold}On your network${C.reset}    ${C.cyan}http://${lan[0]}:${PORT}${C.reset}`);
  for (const a of lan.slice(1)) say(`                     ${C.dim}http://${a}:${PORT}${C.reset}`);
  say(
    `\n  ${C.dim}Share the network address with friends on the same Wi-Fi.${C.reset}\n` +
      `  ${C.dim}To reach it from anywhere, see DEPLOY.md (Tailscale).${C.reset}`
  );
} else {
  say(`  ${C.dim}No network address found — only this computer can reach it.${C.reset}`);
}
say(`\n  ${C.dim}Press Ctrl+C to stop.${C.reset}\n`);

// ---------------------------------------------------------------------- server
const server = spawn(process.execPath, ["server.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production", PORT },
});

// Give the server a moment to bind before the browser races it.
const url = `http://localhost:${PORT}`;
const openTimer = setTimeout(() => {
  try {
    if (isWin) {
      spawn(`start "" "${url}"`, { stdio: "ignore", detached: true, shell: true }).unref();
    } else {
      const cmd = process.platform === "darwin" ? "open" : "xdg-open";
      spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    /* headless box, or no opener installed — the URLs are printed above */
  }
}, 2500);

const stop = () => {
  clearTimeout(openTimer);
  server.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  clearTimeout(openTimer);
  process.exit(code ?? 0);
});
