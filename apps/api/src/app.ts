// apps/api/src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import itemsRoutes from "./routes/items";
import exportRouter from "./routes/export";

import "./db/client"; // side-effect: init DB/migrations

const app = express();

// CORS & parsers
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Debug/health
import type { Request, Response } from "express";
app.get("/api/_debug", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    routes: [
      { path: "POST /api/customers/register" },
      { path: "POST /api/customers/login" },
      { path: "POST /api/customers/logout" },
      { path: "GET  /api/customers/me" },
      { path: "POST /api/items/upload" },
      { path: "GET  /api/items" },
      { path: "GET  /api/items/compact" },
      { path: "GET  /api/items/_count" },
      { path: "GET  /api/items/_sample" },
      { path: "POST /api/auth/logout" },
      { path: "POST /api/auth/devlogin" },
    ],
  });
});

// Mount API routes
app.use("/api", authRoutes);
app.use("/api", customerRoutes);
app.use("/api/export", exportRouter);
app.use("/api/items", itemsRoutes);

export default app;
