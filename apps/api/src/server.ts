// apps/api/src/server.ts
import { createServer } from "node:http";
import app from "./app";

const PORT = Number(process.env.API_PORT || process.env.PORT || 5001);
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
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
