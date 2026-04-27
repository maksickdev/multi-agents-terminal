// @ts-check
import http from "http";
import { handleHook } from "./routes/hooks.js";

const PORT = 27123;
const HOST = "127.0.0.1";

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/hook") {
    handleHook(req, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.on("error", (/** @type {NodeJS.ErrnoException} */ err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[server] port ${PORT} already in use — is the server already running?`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
