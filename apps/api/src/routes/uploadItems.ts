//apps/api/src/routes/uploadItems.ts

// file name — /server/routes/uploadItems.ts
import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { parseItemsTextRawAndNormalised } from "../utils/parseItems";

const router = Router();

// Temp upload dir
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

// Sydney timestamp formatter: priceless-YYYY-MM-DD-hhmm
function sydneyTimestamp(): string {
  const d = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
}

// ✅ POST /upload-items — parse and save JSON only (no .txt)
router.post("/upload-items", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const storageDir = path.join(process.cwd(), "server", "data");
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    // Read temp file, then delete it
    const rawText = fs.readFileSync(req.file.path, "utf8");
    fs.unlinkSync(req.file.path);

    // Parse to raw + normalised
    const { raw, normalised } = parseItemsTextRawAndNormalised(rawText);

    // Versioned JSON and rolling latest
    const stamp = sydneyTimestamp();
    const jsonName = `priceless-${stamp}.json`;
    const jsonTarget = path.join(storageDir, jsonName);
    const payload = { items: raw, normalisedItems: normalised };

    fs.writeFileSync(jsonTarget, JSON.stringify(payload, null, 2), "utf8");
    fs.writeFileSync(path.join(storageDir, "items.latest.json"), JSON.stringify(payload, null, 2), "utf8");

    return res.json({
      ok: true,
      savedJson: jsonName,
      counts: { items: raw.length, normalisedItems: normalised.length },
      latestJsonPath: "/api/items.json",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save/parse file" });
  }
});

export default router;
