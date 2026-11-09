// Minimal "build": writes src/index.html to dist/ with the build time, like a bundler would.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
const html = readFileSync("src/index.html", "utf8").replace("{{BUILT_AT}}", new Date().toISOString());
writeFileSync("dist/index.html", html);
console.log("Built dist/index.html");
