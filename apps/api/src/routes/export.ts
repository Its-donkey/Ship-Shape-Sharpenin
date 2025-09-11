// apps/api/src/routes/export.ts
import { Router, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import archiver, { ArchiverError } from "archiver";

const router = Router();

/** Walk up from a starting directory to locate the repo root (top-most package.json or .git). */
function findRepoRoot(startDir: string = __dirname): string {
  let dir: string = path.resolve(startDir);

  while (dir !== path.dirname(dir)) {
    const pkg = path.join(dir, "package.json");
    const git = path.join(dir, ".git");

    // Prefer the highest package.json; if parent also has one, keep walking
    if (fs.existsSync(pkg)) {
      const parent = path.dirname(dir);
      const parentPkg = path.join(parent, "package.json");
      if (parent !== dir && fs.existsSync(parentPkg)) {
        dir = parent;
        continue;
      }
      return dir;
    }
    if (fs.existsSync(git)) return dir;

    dir = path.dirname(dir);
  }

  return startDir;
}

function sydneyStamp(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
}

/**
 * GET /api/export/zip
 * Streams a zip containing only the useful files for review (source, configs, env scaffolding).
 */
router.get("/zip", async (_req: Request, res: Response): Promise<void> => {
  try {
    const repoRoot: string = findRepoRoot(path.resolve(__dirname, "..", "..", "..", "..")); // apps/api/src -> apps/api
    const filename: string = `Ship-Shape-Review-${sydneyStamp()}.zip`;

    // Response headers
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err: ArchiverError) => {
      console.error("[export.zip] archiver error:", err);
      if (!res.headersSent) {
        res.status(500).end("Archive error");
      } else {
        // Response may already be streaming; ensure we end it
        try {
          res.end();
        } catch {}
      }
    });

    archive.on("warning", (warn: ArchiverError) => {
      // Non-fatal fs conditions commonly surface here
      console.warn("[export.zip] archiver warning:", warn);
    });

    // Pipe the archive stream to the HTTP response
    archive.pipe(res);

    // ========= INCLUDES (allow-list) =========
    const includeTop: string[] = [
      "package.json",
      "pnpm-workspace.yaml",
      "turbo.json",
      "tsconfig.json",
      ".editorconfig",
      ".prettierrc",
      ".prettierrc.*",
      ".eslint*",
      ".github/**",
      "Dockerfile",
      "docker-compose.yml",
      ".env.example",
      "README.md",
      "vite.config.*",
      "tailwind.config.*",
      "postcss.config.*",
    ];
    for (const pattern of includeTop) {
      archive.glob(pattern, { cwd: repoRoot, dot: true });
    }

    const includeApi: string[] = [
      "apps/api/src/**",
      "apps/api/package.json",
      "apps/api/tsconfig*.json",
      "apps/api/nodemon.json",
      "apps/api/.env.example",
      "apps/api/prisma/schema.prisma", // safe if missing
    ];
    for (const pattern of includeApi) {
      archive.glob(pattern, { cwd: repoRoot, dot: true });
    }

    const includeWeb: string[] = [
      "apps/web/src/**",
      "apps/web/index.html",
      "apps/web/package.json",
      "apps/web/tsconfig*.json",
      "apps/web/vite.config.*",
      "apps/web/postcss.config.*",
      "apps/web/tailwind.config.*",
      "apps/web/.env.example",
      "apps/web/public/**",
    ];
    for (const pattern of includeWeb) {
      archive.glob(pattern, { cwd: repoRoot, dot: true });
    }

    // ========= EXCLUDES (belt-and-suspenders) =========
    // We already allow-list specific globs above, but add a broad "everything" with ignores
    // to defensively filter out junk that slips through.
    archive.glob("**/*", {
      cwd: repoRoot,
      dot: true,
      ignore: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/coverage/**",
        "**/.next/**",
        "**/out/**",
        "**/.turbo/**",
        "**/.cache/**",
        "**/.parcel-cache/**",
        "**/.vite/**",
        "**/.vscode/**",
        "**/.idea/**",
        "**/*.log",
        "**/*.lock",
        "**/.DS_Store",
        "**/Thumbs.db",
        // runtime/data
        "apps/api/data/**",
        "uploads/**",
        "tmp/**",
      ],
    });

    await archive.finalize();
  } catch (e) {
    const err = e as Error;
    console.error("[export.zip] failed:", err);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ ok: false, error: err?.message ?? "Failed to build zip" });
    } else {
      try {
        res.end();
      } catch {}
    }
  }
});

export default router;
