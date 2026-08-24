// Zero-dependency static file server for previewing ./dist locally.
// Usage: node serve.js [port]
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname, resolve, sep } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(__dirname, "dist"));
const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    let filePath = resolve(join(ROOT, urlPath));

    // Reject any request whose path (after resolving "..", etc.) would
    // escape the dist/ root - path.join() alone does not prevent this.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end("<h1>403 — Forbidden</h1>");
      return;
    }

    let st;
    try {
      st = await stat(filePath);
    } catch {
      st = null;
    }
    if (st && st.isDirectory()) {
      filePath = join(filePath, "index.html");
    } else if (!st && !extname(filePath)) {
      filePath = filePath + ".html";
    }

    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<h1>404 â€” Not found</h1><p><a href='/index.html'>Back to home</a></p>");
  }
});

server.listen(PORT, () => {
  console.log(`InfoBridgeIndia preview running at http://localhost:${PORT}`);
});
