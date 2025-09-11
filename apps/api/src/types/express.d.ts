// apps/api/src/types/express.d.ts

import "express";
import "multer";

// 1) Global Express namespace augmentation (common case)
declare global {
  namespace Express {
    interface Request {
      /** set by your auth middleware (requireSession) */
      customerId?: number;
      /** multer single-file */
      file?: Express.Multer.File;
      /** multer .array() or .fields() */
      files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
    }
  }
}

// 2) Also augment express-serve-static-core (covers some import patterns)
declare module "express-serve-static-core" {
  interface Request {
    customerId?: number;
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
  }
}

export {};
