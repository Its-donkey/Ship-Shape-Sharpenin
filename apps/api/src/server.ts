// apps/api/src/server.ts
import "dotenv/config";
import { createServer } from "node:http";
import app from "./app";
import { startTldCron } from "./jobs/tldCron";

const PORT = Number(process.env.API_PORT || process.env.PORT || 5001);
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  // Start background jobs only when server is running
  startTldCron();
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[api] Received ${signal}, shutting down...`);
  server.close(() => {
    console.log("[api] Server closed cleanly");
    process.exit(0);
  });

  // Force exit if it takes too long
  setTimeout(() => {
    console.error("[api] Forcefully shutting down");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
