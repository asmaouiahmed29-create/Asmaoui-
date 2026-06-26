import { Router } from "express";
import { db, savedProblemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const { sector, limit } = req.query;
  const lim = Math.min(parseInt(limit as string) || 20, 100);

  try {
    let query = db.select().from(savedProblemsTable).orderBy(desc(savedProblemsTable.createdAt)).limit(lim);
    const rows = await query;

    const filtered = sector
      ? rows.filter((r) => r.sector === sector)
      : rows;

    res.json(
      filtered.map((r) => ({
        ...r,
        optimalValue: r.optimalValue != null ? parseFloat(r.optimalValue as string) : null,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "List problems error");
    res.status(500).json({ error: "Failed to list problems." });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const rows = await db.select().from(savedProblemsTable).orderBy(desc(savedProblemsTable.createdAt)).limit(100);

    const bySector: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const r of rows) {
      bySector[r.sector] = (bySector[r.sector] || 0) + 1;
      const st = r.status ?? "unknown";
      byStatus[st] = (byStatus[st] || 0) + 1;
    }

    res.json({
      total: rows.length,
      bySector,
      byStatus,
      recentProblems: rows.slice(0, 5).map((r) => ({
        ...r,
        optimalValue: r.optimalValue != null ? parseFloat(r.optimalValue as string) : null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Stats error");
    res.status(500).json({ error: "Failed to get stats." });
  }
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  try {
    const rows = await db.select().from(savedProblemsTable).where(eq(savedProblemsTable.id, id)).limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    const r = rows[0];
    res.json({
      ...r,
      optimalValue: r.optimalValue != null ? parseFloat(r.optimalValue as string) : null,
      createdAt: r.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Get problem error");
    res.status(500).json({ error: "Failed to get problem." });
  }
});

router.post("/", async (req, res) => {
  const { name, sector, problemData, result } = req.body;

  if (!name || !sector || !problemData) {
    res.status(400).json({ error: "Required: name, sector, problemData." });
    return;
  }

  const objectiveType = problemData.objectiveType ?? "maximize";
  const status = result?.status ?? null;
  const optimalValue = result?.optimalValue != null ? String(result.optimalValue) : null;

  try {
    const rows = await db
      .insert(savedProblemsTable)
      .values({ name, sector, objectiveType, status, optimalValue, problemData, result: result ?? null })
      .returning();

    const r = rows[0];
    res.status(201).json({
      ...r,
      optimalValue: r.optimalValue != null ? parseFloat(r.optimalValue as string) : null,
      createdAt: r.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Save problem error");
    res.status(500).json({ error: "Failed to save problem." });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  try {
    await db.delete(savedProblemsTable).where(eq(savedProblemsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete problem error");
    res.status(500).json({ error: "Failed to delete problem." });
  }
});

export default router;
