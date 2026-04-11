/**
 * Vercel: if the project expects an output folder named "build", materialize it
 * from static files in this directory (no bundler).
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = path.join(root, "build");

try {
  fs.rmSync(out, { recursive: true, force: true });
} catch (_) {}
fs.mkdirSync(out, { recursive: true });

const skip = new Set(["build", "node_modules", "vercel-build.cjs", ".DS_Store"]);

for (const name of fs.readdirSync(root)) {
  if (skip.has(name)) continue;
  const from = path.join(root, name);
  const to = path.join(out, name);
  fs.cpSync(from, to, { recursive: true });
}
