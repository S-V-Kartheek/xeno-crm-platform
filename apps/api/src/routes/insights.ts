import { Router } from "express";
import { asyncRoute } from "../http.js";
import { getPrisma } from "../prisma.js";
import { getInsightsDashboard } from "../insight-stats.js";

export const insightsRouter = Router();

insightsRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    const prisma = getPrisma();
    res.json({ data: await getInsightsDashboard(prisma) });
  })
);
