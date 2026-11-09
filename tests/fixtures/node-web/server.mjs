// App Service sets PORT; locally it defaults to 3000.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const build = JSON.parse(readFileSync(new URL("./dist/build.json", import.meta.url), "utf8"));
const port = process.env.PORT ?? 3000;

createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", ...build }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("Web App fixture\n");
}).listen(port, () => console.log(`Listening on ${port}`));
