import { Router } from "express";
import { solveSimplex } from "../lib/simplex.js";

const router = Router();

router.post("/solve", (req, res) => {
  const input = req.body;

  if (!input || !input.objectiveType || !Array.isArray(input.variables) || !Array.isArray(input.constraints)) {
    res.status(400).json({ error: "Invalid input. Required: objectiveType, variables[], constraints[]." });
    return;
  }

  if (!["maximize", "minimize"].includes(input.objectiveType)) {
    res.status(400).json({ error: "objectiveType must be 'maximize' or 'minimize'." });
    return;
  }

  try {
    const result = solveSimplex(input);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Simplex solver error");
    res.status(500).json({ error: "Internal solver error." });
  }
});

export default router;
