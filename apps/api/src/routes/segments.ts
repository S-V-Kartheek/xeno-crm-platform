import { Router } from "express";
import { z } from "zod";
import {
  paginationQuerySchema,
  segmentCreateSchema,
  segmentRulesSchema,
  segmentUpdateSchema,
  type SegmentSummary
} from "@smartcrm/shared";
import { asyncRoute, parseBody, parseQuery } from "../http.js";
import { getPrisma } from "../prisma.js";
import { evaluateSegment } from "../rule-engine.js";
import { generateSegmentRules } from "../ai-client.js";
import { getSegmentStats } from "../insight-stats.js";
import type { Segment } from "@prisma/client";

export const segmentsRouter = Router();

function serializeSegment(segment: Segment, customerCount = 0): SegmentSummary {
  return {
    id: segment.id,
    name: segment.name,
    description: segment.description,
    // Prisma returns Json already parsed — cast is safe because we always
    // validate with segmentRulesSchema before writing to the DB.
    rules: segment.rules as unknown as SegmentSummary["rules"],
    createdVia: segment.createdVia as SegmentSummary["createdVia"],
    createdAt: segment.createdAt.toISOString(),
    updatedAt: segment.updatedAt.toISOString(),
    customerCount
  };
}

// ─────────────────────────────────────────────────────────────
// GET /segments — list all segments with live customer counts
// ─────────────────────────────────────────────────────────────
segmentsRouter.get(
  "/",
  asyncRoute(async (request, response) => {
    const { page, pageSize } = parseQuery(paginationQuerySchema, request);
    const prisma = getPrisma();

    const [segments, total] = await Promise.all([
      prisma.segment.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.segment.count()
    ]);

    const segmentsWithCounts = await Promise.all(
      segments.map(async (segment) => {
        try {
          const rules = segmentRulesSchema.parse(segment.rules);
          const preview = await evaluateSegment(prisma, rules);
          return serializeSegment(segment, preview.count);
        } catch {
          // If rules are somehow malformed, return 0 rather than crashing the list
          return serializeSegment(segment, 0);
        }
      })
    );

    response.json({
      data: segmentsWithCounts,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  })
);

// ─────────────────────────────────────────────────────────────
// GET /segments/:id/stats — segment-level campaign performance
// ─────────────────────────────────────────────────────────────
segmentsRouter.get(
  "/:id/stats",
  asyncRoute(async (request, response) => {
    const prisma = getPrisma();
    const stats = await getSegmentStats(prisma, String(request.params.id ?? ""));
    if (!stats) {
      response.status(404).json({ error: "Segment not found" });
      return;
    }
    response.json({ data: stats });
  })
);

// ─────────────────────────────────────────────────────────────
// GET /segments/:id — single segment with live count
// ─────────────────────────────────────────────────────────────
segmentsRouter.get(
  "/:id",
  asyncRoute(async (request, response) => {
    const prisma = getPrisma();
    const segment = await prisma.segment.findUnique({
      where: { id: String(request.params.id ?? "") }
    });

    if (!segment) {
      response.status(404).json({ error: "Segment not found" });
      return;
    }

    const rules = segmentRulesSchema.parse(segment.rules);
    const preview = await evaluateSegment(prisma, rules);

    response.json({ data: serializeSegment(segment, preview.count) });
  })
);

// ─────────────────────────────────────────────────────────────
// POST /segments — create a segment
// ─────────────────────────────────────────────────────────────
segmentsRouter.post(
  "/",
  asyncRoute(async (request, response) => {
    const input = parseBody(segmentCreateSchema, request);
    const prisma = getPrisma();

    // Duplicate name guard
    const existing = await prisma.segment.findUnique({ where: { name: input.name } });
    if (existing) {
      response.status(409).json({ error: `A segment named "${input.name}" already exists` });
      return;
    }

    const segment = await prisma.segment.create({
      data: {
        name: input.name,
        description: input.description,
        rules: input.rules,
        createdVia: input.createdVia
      }
    });

    const preview = await evaluateSegment(prisma, input.rules);
    response.status(201).json({ data: serializeSegment(segment, preview.count) });
  })
);

// ─────────────────────────────────────────────────────────────
// PATCH /segments/:id — update a segment
// ─────────────────────────────────────────────────────────────
segmentsRouter.patch(
  "/:id",
  asyncRoute(async (request, response) => {
    const input = parseBody(segmentUpdateSchema, request);
    const prisma = getPrisma();
    const id = String(request.params.id ?? "");

    // Duplicate name guard (excluding self)
    if (input.name) {
      const conflict = await prisma.segment.findFirst({
        where: { name: input.name, NOT: { id } }
      });
      if (conflict) {
        response.status(409).json({ error: `A segment named "${input.name}" already exists` });
        return;
      }
    }

    const segment = await prisma.segment.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.rules !== undefined && { rules: input.rules }),
        ...(input.createdVia !== undefined && { createdVia: input.createdVia })
      }
    });

    const rules = segmentRulesSchema.parse(segment.rules);
    const preview = await evaluateSegment(prisma, rules);
    response.json({ data: serializeSegment(segment, preview.count) });
  })
);

// ─────────────────────────────────────────────────────────────
// DELETE /segments/:id
// ─────────────────────────────────────────────────────────────
segmentsRouter.delete(
  "/:id",
  asyncRoute(async (request, response) => {
    const prisma = getPrisma();
    const id = String(request.params.id ?? "");

    const existing = await prisma.segment.findUnique({ where: { id } });
    if (!existing) {
      response.status(404).json({ error: "Segment not found" });
      return;
    }

    await prisma.segment.delete({ where: { id } });
    response.json({ data: { deleted: true } });
  })
);

// ─────────────────────────────────────────────────────────────
// POST /segments/preview — evaluate rules, return count + sample
// Does NOT save anything — safe to call as often as needed.
// ─────────────────────────────────────────────────────────────
const previewBodySchema = z.object({ rules: segmentRulesSchema });

segmentsRouter.post(
  "/preview",
  asyncRoute(async (request, response) => {
    const { rules } = parseBody(previewBodySchema, request);
    const prisma = getPrisma();
    const result = await evaluateSegment(prisma, rules);
    response.json({ data: result });
  })
);

// ─────────────────────────────────────────────────────────────
// POST /segments/ai-generate — NL prompt → validated rules + preview
// Does NOT save anything — caller decides whether to save.
// ─────────────────────────────────────────────────────────────
const aiGenerateBodySchema = z.object({
  prompt: z.string().trim().min(3, "Prompt must be at least 3 characters").max(500)
});

segmentsRouter.post(
  "/ai-generate",
  asyncRoute(async (request, response) => {
    const { prompt } = parseBody(aiGenerateBodySchema, request);

    const result = await generateSegmentRules(prompt);

    if (!result.ok) {
      // 422 Unprocessable — AI understood the request but couldn't produce valid rules
      response.status(422).json({ error: result.error });
      return;
    }

    // Run a preview so the UI can show a live count right away
    const prisma = getPrisma();
    const preview = await evaluateSegment(prisma, result.rules);

    response.json({
      data: {
        rules: result.rules,
        preview
      }
    });
  })
);
