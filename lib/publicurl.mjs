// The address other people can actually reach this instance on.
//
// The launcher opens a tunnel *after* the server is already running, so this
// cannot be an environment variable. It is written to a file in the data
// directory instead: no endpoint to authenticate, and only something with local
// filesystem access can set it.

import { promises as fs, readFileSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const FILE = path.join(DATA_DIR, "public-url");

/**
 * Best address to hand someone else, or "" if we only know local ones.
 * PUBLIC_URL wins: an operator behind their own domain or Tailscale has said
 * explicitly what the address is.
 */
export function getPublicUrl() {
  const configured = process.env.PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  try {
    // Read every time rather than caching: the tunnel can come up, go away, or
    // change while the server keeps running.
    return existsSync(FILE) ? readFileSync(FILE, "utf8").trim() : "";
  } catch {
    return "";
  }
}

export async function setPublicUrl(url) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, String(url ?? "").trim());
}

export async function clearPublicUrl() {
  await fs.unlink(FILE).catch(() => {});
}
