// Locating a JavaScript runtime for yt-dlp.
//
// YouTube's player requires solving a JS challenge. Without a runtime yt-dlp
// warns "extraction without a JS runtime has been deprecated", silently falls
// back to limited clients, and those get bot-checked — so tracks fail with a
// misleading "Sign in to confirm you're not a bot" even on a home connection.
// Deno is the only runtime yt-dlp enables by default.

import { existsSync } from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function systemDeno() {
  try {
    execFileSync("deno", ["--version"], { stdio: "ignore" });
    return "deno";
  } catch {
    return null;
  }
}

function bundledDeno() {
  try {
    // Optional dependency: absent in the Docker image, which installs deno
    // system-wide instead.
    const pkgDir = path.dirname(require.resolve("deno/package.json"));
    const bin = path.join(pkgDir, process.platform === "win32" ? "deno.exe" : "deno");
    return existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}

let cached;

/** Absolute path to a deno binary, "deno" if it's on PATH, or null. */
export function denoPath() {
  if (cached !== undefined) return cached;
  cached = systemDeno() ?? bundledDeno();
  return cached;
}

/**
 * Directory to prepend to PATH so yt-dlp's own auto-detection finds deno.
 * Null when deno is already on PATH (or missing entirely).
 */
export function denoPathDir() {
  const p = denoPath();
  return p && p !== "deno" ? path.dirname(p) : null;
}

export function jsRuntimeMissing() {
  return denoPath() === null;
}
