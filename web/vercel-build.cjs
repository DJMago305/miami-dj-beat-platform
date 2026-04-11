/**
 * Vercel: materialize ./build so "Output Directory: build" in the dashboard has content.
 * Copies static files only (no bundler). Safe on Node 16+ (fs.cpSync).
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = path.join(root, "build");

function main() {
  console.log("[vercel-build] cwd=", root);
  try {
    fs.rmSync(out, { recursive: true, force: true });
  } catch (_) {}
  fs.mkdirSync(out, { recursive: true });

  const skip = new Set(["build", "node_modules", "vercel-build.cjs", ".DS_Store"]);

  for (const name of fs.readdirSync(root)) {
    if (skip.has(name)) continue;
    const from = path.join(root, name);
    const to = path.join(out, name);
    try {
      fs.cpSync(from, to, { recursive: true });
    } catch (err) {
      console.error("[vercel-build] copy failed:", from, err);
      process.exit(1);
    }
  }

  const idx = path.join(out, "index.html");
  if (!fs.existsSync(idx)) {
    console.error("[vercel-build] missing build/index.html after copy");
    process.exit(1);
  }
  console.log("[vercel-build] ok, wrote", idx);
}

main();
