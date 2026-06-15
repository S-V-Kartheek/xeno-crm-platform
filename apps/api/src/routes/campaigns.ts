/**
 * Campaigns router — CRUD + send + AI draft
 *
 * Routes:
 *   GET    /campaigns              — list with live stats
 *   GET    /campaigns/:id          — single campaign with full stats
 *   POST   /campaigns              — create a draft
 *   PATCH  /campaigns/:id          — update a draft
 *   DELETE /campaigns/:id          — delete draft only
 *   POST   /campaigns/:id/send     — send campaign to segment customers
 *   POST   /campaigns/:id/ai-draft — AI message drafting (2 variants)
 */

import { Router } from "express";
import {
  paginationQuerySchema,
  campaignCreateSchema,
  campaignUpdateSchema,
  segmentRulesSchema,
  type CampaignSummary
} from "@smartcrm/shared";
import { asyncRoute, parseBody, parseQuery } from "../http.js";
import { getPrisma } from "../prisma.js";
import { draftCampaignMessages, summarizeCampaignInsight } from "../ai-client.js";
import { evaluateSegment, fetchAllMatchingIds } from "../rule-engine.js";
import type { Campaign, Segment } from "@prisma/client";
import { env } from "../env.js";
import {
  buildCampaignSummary,
  getCampaignPerformance,
  getInsightsDashboard
} from "../insight-stats.js";

export const campaignsRouter = Router();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function serializeCampaign(
  campaign: Campaign & { segment: Segment },
  prisma: ReturnType<typeof getPrisma>
): Promise<CampaignSummary> {
  return buildCampaignSummary(prisma, campaign);
}

// ─────────────────────────────────────────────────────────────
// GET /campaigns
// ─────────────────────────────────────────────────────────────
campaignsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { page, pageSize } = parseQuery(paginationQuerySchema, req);
    const prisma = getPrisma();
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { segment: true }
      }),
      prisma.campaign.count()
    ]);
    const data = await Promise.all(campaigns.map(c => serializeCampaign(c, prisma)));
    res.json({ data, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  })
);

// ─────────────────────────────────────────────────────────────
// GET /campaigns/:id
// ─────────────────────────────────────────────────────────────
campaignsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const prisma = getPrisma();
    const campaign = await prisma.campaign.findUnique({
      where: { id: String(req.params.id) },
      include: { segment: true }
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ data: await serializeCampaign(campaign, prisma) });
  })
);

// ─────────────────────────────────────────────────────────────
// GET /campaigns/:id/stats
// ─────────────────────────────────────────────────────────────
campaignsRouter.get(
  "/:id/stats",
  asyncRoute(async (req, res) => {
    const prisma = getPrisma();
    const performance = await getCampaignPerformance(prisma, String(req.params.id));
    if (!performance) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ data: performance });
  })
);

// ─────────────────────────────────────────────────────────────
// GET /campaigns/:id/insight
// ─────────────────────────────────────────────────────────────
campaignsRouter.get(
  "/:id/insight",
  asyncRoute(async (req, res) => {
    const prisma = getPrisma();
    const performance = await getCampaignPerformance(prisma, String(req.params.id));
    if (!performance) { res.status(404).json({ error: "Campaign not found" }); return; }

    const dashboard = await getInsightsDashboard(prisma);
    const result = await summarizeCampaignInsight(
      performance,
      dashboard.channelPerformance,
      dashboard.segmentPerformance
    );

    if (result.ok) {
      res.json({ data: result.result, meta: { generatedBy: "ai" } });
      return;
    }

    res.json({ data: result.fallback, meta: { generatedBy: "fallback", error: result.error } });
  })
);

// ─────────────────────────────────────────────────────────────
// POST /campaigns — create draft
// ─────────────────────────────────────────────────────────────
campaignsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const input = parseBody(campaignCreateSchema, req);
    const prisma = getPrisma();
    const segment = await prisma.segment.findUnique({ where: { id: input.segmentId } });
    if (!segment) { res.status(422).json({ error: "Segment not found" }); return; }

    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        segmentId: input.segmentId,
        channel: input.channel,
        messageTemplate: input.messageTemplate,
        status: "draft"
      },
      include: { segment: true }
    });
    res.status(201).json({ data: await serializeCampaign(campaign, prisma) });
  })
);

// ─────────────────────────────────────────────────────────────
// PATCH /campaigns/:id — update draft
// ─────────────────────────────────────────────────────────────
campaignsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const input = parseBody(campaignUpdateSchema, req);
    const prisma = getPrisma();
    const id = String(req.params.id);

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (existing.status !== "draft") {
      res.status(409).json({ error: "Only draft campaigns can be edited" }); return;
    }
    if (input.segmentId) {
      const seg = await prisma.segment.findUnique({ where: { id: input.segmentId } });
      if (!seg) { res.status(422).json({ error: "Segment not found" }); return; }
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.segmentId && { segmentId: input.segmentId }),
        ...(input.channel && { channel: input.channel }),
        ...(input.messageTemplate && { messageTemplate: input.messageTemplate })
      },
      include: { segment: true }
    });
    res.json({ data: await serializeCampaign(campaign, prisma) });
  })
);

// ─────────────────────────────────────────────────────────────
// DELETE /campaigns/:id
// ─────────────────────────────────────────────────────────────
campaignsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const prisma = getPrisma();
    const id = String(req.params.id);
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (existing.status !== "draft") {
      res.status(409).json({ error: "Only draft campaigns can be deleted" }); return;
    }
    await prisma.campaign.delete({ where: { id } });
    res.json({ data: { deleted: true } });
  })
);

// ─────────────────────────────────────────────────────────────
// POST /campaigns/:id/ai-draft
// ─────────────────────────────────────────────────────────────
campaignsRouter.post(
  "/:id/ai-draft",
  asyncRoute(async (req, res) => {
    const prisma = getPrisma();
    const id = String(req.params.id);
    const campaign = await prisma.campaign.findUnique({
      where: { id }, include: { segment: true }
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    let customerCount = 0;
    try {
      const rules = segmentRulesSchema.parse(campaign.segment.rules);
      const preview = await evaluateSegment(prisma, rules);
      customerCount = preview.count;
    } catch { /* non-fatal */ }

    const result = await draftCampaignMessages(campaign.segment.name, campaign.channel, customerCount);
    if (!result.ok) { res.status(422).json({ error: result.error }); return; }

    res.json({ data: result.result });
  })
);

// ─────────────────────────────────────────────────────────────
// POST /campaigns/:id/send
// ─────────────────────────────────────────────────────────────
campaignsRouter.post(
  "/:id/send",
  asyncRoute(async (req, res) => {
    const prisma = getPrisma();
    const id = String(req.params.id);

    const campaign = await prisma.campaign.findUnique({
      where: { id }, include: { segment: true }
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (campaign.status !== "draft") {
      res.status(409).json({ error: "Campaign has already been sent or is sending" }); return;
    }

    // Resolve all customer IDs matching the segment
    let customerIds: string[] = [];
    let customers: { id: string; name: string; email: string }[] = [];
    try {
      const rules = segmentRulesSchema.parse(campaign.segment.rules);
      customerIds = await fetchAllMatchingIds(prisma, rules);
      customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, email: true }
      });
    } catch {
      res.status(422).json({ error: "Failed to evaluate segment rules" }); return;
    }

    if (customers.length === 0) {
      res.status(422).json({ error: "Segment has no matching customers — nothing to send" }); return;
    }

    // Create Communication rows (deterministic externalId for idempotency)
    const communications = await prisma.$transaction(
      customers.map(customer =>
        prisma.communication.upsert({
          where: { externalId: `${campaign.id}:${customer.id}` },
          create: {
            campaignId: campaign.id,
            customerId: customer.id,
            status: "queued",
            externalId: `${campaign.id}:${customer.id}`
          },
          update: {
            status: "queued"
          }
        })
      )
    );

    // Mark campaign as sending
    await prisma.campaign.update({ where: { id }, data: { status: "sending", sentAt: new Date() } });

    // Build payload for channel service
    const channelPayload = {
      campaignId: campaign.id,
      channel: campaign.channel,
      callbackUrl: `${env.CRM_CALLBACK_URL}/receipts`,
      messages: communications.map((comm, i) => ({
        externalId: comm.externalId,
        recipient: customers[i]!.email,
        recipientName: customers[i]!.name,
        message: campaign.messageTemplate
          .replace(/\{\{name\}\}/g, customers[i]!.name.split(" ")[0] ?? customers[i]!.name)
          .replace(/\{\{last_category\}\}/g, "fashion")
      }))
    };

    // Call channel service — fire and forget (it returns 202, callbacks happen async)
    try {
      const channelRes = await fetch(`${env.CHANNEL_SERVICE_URL}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(channelPayload),
        signal: AbortSignal.timeout(5000)
      });
      if (!channelRes.ok) throw new Error(`Channel service returned ${channelRes.status}`);
    } catch (err) {
      await prisma.campaign.update({ where: { id }, data: { status: "failed" } });
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(502).json({ error: `Channel service unreachable: ${msg}` });
      return;
    }

    // Mark campaign sent (channel service accepted the batch)
    await prisma.campaign.update({ where: { id }, data: { status: "sent" } });

    const updated = await prisma.campaign.findUnique({ where: { id }, include: { segment: true } });
    res.json({
      data: await serializeCampaign(updated!, prisma),
      meta: { communicationCount: communications.length }
    });
  })
);
