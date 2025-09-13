// apps/api/src/routes/customers.ts
import { Router } from "express";
import { requireSession, requireAdmin } from "./auth";
import { register, login, me, updateProfile, listCustomers, resetPassword, setAdminFlag, setBusinessLink } from "../controllers/customers";

const router = Router();

/** POST /api/customers/register */
router.post("/customers/register", register);

/** POST /api/customers/login — validates password, sets sid cookie */
/** POST /api/customers/login — validates password, sets sid cookie */
router.post("/customers/login", login);

/** GET /api/customers/me — requires valid session */
router.get("/customers/me", requireSession, me);

/** PUT /api/customers/profile — update FULL profile */
router.put("/customers/profile", requireSession, updateProfile);

// Admin utilities
router.get("/customers/admin/list", requireAdmin, listCustomers);
router.post("/customers/:id/password", requireAdmin, resetPassword);
router.post("/customers/:id/admin", requireAdmin, setAdminFlag);
router.post("/customers/:id/business", requireAdmin, setBusinessLink);

export default router;
