import { Router } from "express";
import { templates } from "../lib/templates.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(templates);
});

router.get("/:sector", (req, res) => {
  const { sector } = req.params;
  const template = templates.find((t) => t.sector === sector);
  if (!template) {
    res.status(404).json({ error: `Template for sector '${sector}' not found.` });
    return;
  }
  res.json(template);
});

export default router;
