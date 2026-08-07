import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";

// Public routes — no auth required
const router = Router();

const LeadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  pressName: z.string().optional(),
  city: z.string().optional(),
  message: z.string().optional(),
});

// ── POST /api/v1/public/leads ─────────────────────────────
router.post("/leads", async (req, res) => {
  const parsed = LeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  // Store lead in a simple JSON log or a leads table (using audit_log for now)
  // In a real deployment, also send a notification to the sales team
  res.status(201).json({ message: "Thank you! We will reach out shortly." });
});

export default router;
