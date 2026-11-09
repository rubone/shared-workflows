// Minimal "build": writes the build info the server reports, like a compile step would.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });
writeFileSync("dist/build.json", JSON.stringify({ builtAt: new Date().toISOString() }));
console.log("Built dist/build.json");
