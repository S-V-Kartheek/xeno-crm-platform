import type {
  CampaignPerformance,
  CampaignStats,
  CampaignSummary,
  CampaignTimelinePoint,
  ChannelPerformance,
  CommStatus,
  GrowthIntelligence,
  GrowthOpportunity,
  InsightsDashboard,
  NextBestAction,
  SegmentPerformance,
  SegmentStatsDetail
} from "@smartcrm/shared";
import { getPrisma } from "./prisma.js";

const STATUSES: CommStatus[] = ["queued", "sent", "delivered", "opened", "clicked", "failed", "bounced"];
const ATTRIBUTION_WINDOW_HOURS = 48;

type PrismaClient = ReturnType<typeof getPrisma>;

type CommunicationForStats = {
  id: string;
  customerId: string;
  status: CommStatus;
  createdAt: Date;
  events: { status: CommStatus; occurredAt: Date }[];
};

function emptyStatusCounts(): Record<CommStatus, number> {
  return {
    queued: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    bounced: 0
  };
}

function emptyStats(): CampaignStats {
  return {
    total: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    bounced: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0
  };
}

function rate(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTimelineBucket(
  timeline: Map<string, CampaignTimelinePoint>,
  date: Date
): CampaignTimelinePoint {
  const key = dateKey(date);
  const existing = timeline.get(key);
  if (existing) return existing;

  const created: CampaignTimelinePoint = {
    date: key,
    queued: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    bounced: 0
  };
  timeline.set(key, created);
  return created;
}

export function computeCampaignStats(communications: CommunicationForStats[]): CampaignStats {
  if (communications.length === 0) return emptyStats();

  const counts = emptyStatusCounts();

  for (const communication of communications) {
    const eventStatuses = new Set(communication.events.map((event) => event.status));
    const currentStatus = communication.status;

    if (currentStatus === "queued") counts.queued++;
    if (eventStatuses.has("sent") || ["sent", "delivered", "opened", "clicked"].includes(currentStatus)) counts.sent++;
    if (eventStatuses.has("delivered") || ["delivered", "opened", "clicked"].includes(currentStatus)) counts.delivered++;
    if (eventStatuses.has("opened") || ["opened", "clicked"].includes(currentStatus)) counts.opened++;
    if (eventStatuses.has("clicked") || currentStatus === "clicked") counts.clicked++;
    if (currentStatus === "failed") counts.failed++;
    if (currentStatus === "bounced") counts.bounced++;
  }

  return {
    total: communications.length,
    ...counts,
    deliveryRate: rate(counts.delivered, communications.length),
    openRate: rate(counts.opened, communications.length),
    clickRate: rate(counts.clicked, communications.length)
  };
}

function computeEventCounts(communications: CommunicationForStats[]) {
  const counts = emptyStatusCounts();
  counts.queued = communications.length;

  for (const communication of communications) {
    for (const event of communication.events) {
      counts[event.status]++;
    }
  }

  return counts;
}

function computeTimeline(communications: CommunicationForStats[]) {
  const timeline = new Map<string, CampaignTimelinePoint>();

  for (const communication of communications) {
    getTimelineBucket(timeline, communication.createdAt).queued++;
    for (const event of communication.events) {
      getTimelineBucket(timeline, event.occurredAt)[event.status]++;
    }
  }

  return [...timeline.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function computeAttribution(
  prisma: PrismaClient,
  communications: CommunicationForStats[]
) {
  const attributedOrderIds = new Set<string>();
  let attributedRevenue = 0;

  for (const communication of communications) {
    const clickedAt = communication.events
      .filter((event) => event.status === "clicked")
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0]?.occurredAt;

    if (!clickedAt) continue;

    const windowEnd = new Date(clickedAt.getTime() + ATTRIBUTION_WINDOW_HOURS * 60 * 60 * 1000);
    const orders = await prisma.order.findMany({
      where: {
        customerId: communication.customerId,
        status: "completed",
        orderDate: { gte: clickedAt, lte: windowEnd }
      },
      select: { id: true, amount: true }
    });

    for (const order of orders) {
      if (attributedOrderIds.has(order.id)) continue;
      attributedOrderIds.add(order.id);
      attributedRevenue += Number(order.amount);
    }
  }

  return {
    attributedOrders: attributedOrderIds.size,
    attributedRevenue: Math.round(attributedRevenue)
  };
}

export async function getCampaignPerformance(
  prisma: PrismaClient,
  campaignId: string
): Promise<CampaignPerformance | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      segment: true,
      communications: {
        select: {
          id: true,
          customerId: true,
          status: true,
          createdAt: true,
          events: {
            select: { status: true, occurredAt: true },
            orderBy: { occurredAt: "asc" }
          }
        }
      }
    }
  });

  if (!campaign) return null;

  const communications = campaign.communications as CommunicationForStats[];
  const stats = computeCampaignStats(communications);
  const eventCounts = computeEventCounts(communications);
  const timeline = computeTimeline(communications);
  const attribution = await computeAttribution(prisma, communications);

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    segmentId: campaign.segmentId,
    segmentName: campaign.segment.name,
    channel: campaign.channel,
    status: campaign.status,
    sentAt: campaign.sentAt?.toISOString() ?? null,
    stats: {
      ...stats,
      ...attribution,
      conversionRate: rate(attribution.attributedOrders, stats.clicked)
    },
    timeline,
    eventCounts,
    attributionWindowHours: ATTRIBUTION_WINDOW_HOURS
  };
}

export async function getCampaignSummaryStats(prisma: PrismaClient, campaignId: string) {
  const performance = await getCampaignPerformance(prisma, campaignId);
  return performance?.stats ?? emptyStats();
}

export async function buildCampaignSummary(
  prisma: PrismaClient,
  campaign: {
    id: string;
    name: string;
    segmentId: string;
    channel: CampaignSummary["channel"];
    messageTemplate: string;
    status: CampaignSummary["status"];
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    segment: { name: string };
  }
): Promise<CampaignSummary> {
  const stats = await getCampaignSummaryStats(prisma, campaign.id);
  return {
    id: campaign.id,
    name: campaign.name,
    segmentId: campaign.segmentId,
    segmentName: campaign.segment.name,
    channel: campaign.channel,
    messageTemplate: campaign.messageTemplate,
    status: campaign.status,
    sentAt: campaign.sentAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    stats
  };
}

function aggregateChannelPerformance(performances: CampaignPerformance[]): ChannelPerformance[] {
  const channels = new Map<string, ChannelPerformance>();

  for (const performance of performances) {
    const existing = channels.get(performance.channel) ?? {
      channel: performance.channel,
      campaigns: 0,
      total: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0
    };

    existing.campaigns++;
    existing.total += performance.stats.total;
    existing.delivered += performance.stats.delivered;
    existing.opened += performance.stats.opened;
    existing.clicked += performance.stats.clicked;
    existing.failed += performance.stats.failed;
    channels.set(performance.channel, existing);
  }

  return [...channels.values()]
    .map((channel) => ({
      ...channel,
      deliveryRate: rate(channel.delivered, channel.total),
      openRate: rate(channel.opened, channel.total),
      clickRate: rate(channel.clicked, channel.total)
    }))
    .sort((a, b) => b.clickRate - a.clickRate);
}

function aggregateSegmentPerformance(performances: CampaignPerformance[]): SegmentPerformance[] {
  const segments = new Map<string, SegmentPerformance>();

  for (const performance of performances) {
    const existing = segments.get(performance.segmentId) ?? {
      segmentId: performance.segmentId,
      segmentName: performance.segmentName,
      campaigns: 0,
      total: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      bounced: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      attributedOrders: 0,
      attributedRevenue: 0
    };

    existing.campaigns++;
    existing.total += performance.stats.total;
    existing.delivered += performance.stats.delivered;
    existing.opened += performance.stats.opened;
    existing.clicked += performance.stats.clicked;
    existing.failed += performance.stats.failed;
    existing.bounced += performance.stats.bounced;
    existing.attributedOrders += performance.stats.attributedOrders;
    existing.attributedRevenue += performance.stats.attributedRevenue;
    segments.set(performance.segmentId, existing);
  }

  return [...segments.values()]
    .map((segment) => ({
      ...segment,
      deliveryRate: rate(segment.delivered, segment.total),
      openRate: rate(segment.opened, segment.total),
      clickRate: rate(segment.clicked, segment.total)
    }))
    .sort((a, b) => b.clickRate - a.clickRate)
    .slice(0, 6);
}

function buildRecommendations(
  channels: ChannelPerformance[],
  segments: SegmentPerformance[],
  totals: InsightsDashboard["totals"]
) {
  const bestChannel = channels[0];
  const bestSegment = segments[0];
  const recommendations: string[] = [];

  if (bestChannel && bestChannel.total > 0) {
    recommendations.push(
      `${bestChannel.channel.toUpperCase()} is currently the strongest channel at ${bestChannel.clickRate}% click rate.`
    );
  }

  if (bestSegment && bestSegment.total > 0) {
    recommendations.push(
      `${bestSegment.segmentName} is your warmest audience with ${bestSegment.clickRate}% click rate.`
    );
  }

  if (totals.failed > 0 && rate(totals.failed, totals.communications) > 10) {
    recommendations.push("Failure rate is above 10%; review list hygiene before scaling sends.");
  } else {
    recommendations.push("Delivery health is stable enough to focus optimization on creative and offer testing.");
  }

  return recommendations;
}

async function buildGrowthIntelligence(
  prisma: PrismaClient,
  totals: InsightsDashboard["totals"],
  rates: InsightsDashboard["rates"],
  channels: ChannelPerformance[],
  segments: SegmentPerformance[]
): Promise<GrowthIntelligence> {
  const customers = await prisma.customer.findMany({
    include: {
      orders: {
        where: { status: "completed" },
        select: { amount: true, orderDate: true, category: true },
        orderBy: { orderDate: "desc" }
      }
    }
  });

  const completedOrders = customers.flatMap((customer) => customer.orders);
  const totalRevenue = completedOrders.reduce((sum, order) => sum + Number(order.amount), 0);
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 1800;
  const avgCustomerValue = customers.length > 0 ? totalRevenue / customers.length : 0;
  const now = new Date();
  const bestChannel: GrowthOpportunity["suggestedChannel"] = channels[0]?.channel ?? "whatsapp";
  const bestSegment = segments[0];

  const customerSignals = customers.map((customer) => {
    const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.amount), 0);
    const lastOrder = customer.orders[0]?.orderDate ?? null;
    const daysSinceLastOrder = lastOrder
      ? Math.floor((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24))
      : Number.POSITIVE_INFINITY;
    return {
      id: customer.id,
      aovTier: customer.aovTier,
      categoryAffinity: customer.categoryAffinity,
      totalSpent,
      orderCount: customer.orders.length,
      daysSinceLastOrder
    };
  });

  const dormantHighValue = customerSignals.filter(
    (customer) =>
      customer.orderCount > 0 &&
      customer.totalSpent >= Math.max(6000, avgCustomerValue * 1.15) &&
      customer.daysSinceLastOrder >= 60
  );
  const repeatReady = customerSignals.filter(
    (customer) => customer.orderCount >= 2 && customer.daysSinceLastOrder >= 14 && customer.daysSinceLastOrder <= 45
  );
  const secondPurchasePush = customerSignals.filter(
    (customer) => customer.orderCount === 1 && customer.daysSinceLastOrder >= 10 && customer.daysSinceLastOrder <= 60
  );
  const premiumOccasionBuyers = customerSignals.filter(
    (customer) =>
      customer.aovTier === "high" &&
      ["Festive Wear", "Accessories", "Footwear"].includes(customer.categoryAffinity ?? "")
  );

  const estimateRevenue = (audienceSize: number, conversionAssumption: number) =>
    Math.round(audienceSize * avgOrderValue * conversionAssumption);

  const rawOpportunities: GrowthOpportunity[] = [
    {
      id: "dormant-high-value-winback",
      title: "High-value winback sprint",
      description: "Recover premium shoppers whose purchase intent has gone cold before they churn fully.",
      audienceSize: dormantHighValue.length,
      estimatedRevenue: estimateRevenue(dormantHighValue.length, 0.12),
      suggestedChannel: "whatsapp",
      confidence: dormantHighValue.length >= 10 ? "high" : dormantHighValue.length >= 4 ? "medium" : "low",
      priority: 95,
      playbook: "Send a WhatsApp-first limited-time comeback offer with recently viewed/category affinity personalization.",
      rulesPreview: ["totalSpent >= premium threshold", "daysSinceLastOrder >= 60", "orderCount > 0"]
    },
    {
      id: "repeat-ready-nudge",
      title: "Repeat purchase nudge",
      description: "Target shoppers in the natural replenishment window while the brand is still fresh in memory.",
      audienceSize: repeatReady.length,
      estimatedRevenue: estimateRevenue(repeatReady.length, 0.16),
      suggestedChannel: bestChannel,
      confidence: repeatReady.length >= 12 ? "high" : repeatReady.length >= 5 ? "medium" : "low",
      priority: 88,
      playbook: "Use the best-performing channel with a category-based recommendation and soft urgency.",
      rulesPreview: ["orderCount >= 2", "daysSinceLastOrder between 14 and 45", `channel preference: ${bestChannel}`]
    },
    {
      id: "second-order-activation",
      title: "Second-order activation",
      description: "Convert first-time buyers into repeat shoppers before they become one-and-done customers.",
      audienceSize: secondPurchasePush.length,
      estimatedRevenue: estimateRevenue(secondPurchasePush.length, 0.14),
      suggestedChannel: "email",
      confidence: secondPurchasePush.length >= 10 ? "high" : secondPurchasePush.length >= 4 ? "medium" : "low",
      priority: 82,
      playbook: "Send a style guide email with a small second-order incentive and product recommendations.",
      rulesPreview: ["orderCount = 1", "daysSinceLastOrder between 10 and 60", "exclude recent purchasers"]
    },
    {
      id: "premium-occasion-cross-sell",
      title: "Premium occasion cross-sell",
      description: "Bundle occasion-led fashion shoppers into higher-AOV festive and accessory campaigns.",
      audienceSize: premiumOccasionBuyers.length,
      estimatedRevenue: estimateRevenue(premiumOccasionBuyers.length, 0.1),
      suggestedChannel: "whatsapp",
      confidence: premiumOccasionBuyers.length >= 8 ? "high" : premiumOccasionBuyers.length >= 3 ? "medium" : "low",
      priority: 76,
      playbook: "Launch a curated festive/accessory bundle with VIP tone and early-access positioning.",
      rulesPreview: ["aovTier = high", "categoryAffinity in Festive Wear, Accessories, Footwear"]
    }
  ];

  const opportunities = rawOpportunities
    .filter((opportunity) => opportunity.audienceSize > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  const issueRate = totals.communications > 0
    ? Math.round(((totals.failed + totals.bounced) / totals.communications) * 100)
    : 0;
  const healthScore = totals.communications === 0
    ? 0
    : Math.max(
        0,
        Math.min(
          100,
          Math.round(
            rates.deliveryRate * 0.35 +
              rates.openRate * 0.25 +
              rates.clickRate * 1.15 +
              rates.conversionRate * 0.85 -
              issueRate * 0.45
          )
        )
      );
  const healthLabel: GrowthIntelligence["healthLabel"] =
    totals.communications === 0
      ? "Insufficient data"
      : healthScore >= 75
        ? "Excellent"
        : healthScore >= 55
          ? "Healthy"
          : "Needs attention";

  const nextBestActions: NextBestAction[] = [];
  if (opportunities[0]) {
    nextBestActions.push({
      id: "launch-top-opportunity",
      title: `Launch: ${opportunities[0].title}`,
      rationale: `${opportunities[0].audienceSize} shoppers qualify with estimated upside of ₹${opportunities[0].estimatedRevenue.toLocaleString("en-IN")}.`,
      impact: opportunities[0].estimatedRevenue > avgOrderValue * 10 ? "high" : "medium",
      effort: "low",
      ownerHint: "marketer"
    });
  }
  if (bestSegment && bestSegment.total > 0) {
    nextBestActions.push({
      id: "scale-best-segment",
      title: `Scale winning audience: ${bestSegment.segmentName}`,
      rationale: `${bestSegment.clickRate}% click rate across ${bestSegment.total.toLocaleString("en-IN")} sends makes it the strongest proven audience.`,
      impact: "high",
      effort: "medium",
      ownerHint: "marketer"
    });
  }
  if (issueRate > 8) {
    nextBestActions.push({
      id: "clean-delivery-list",
      title: "Clean delivery list before scaling",
      rationale: `${issueRate}% of communications failed or bounced, which can hide true campaign quality.`,
      impact: "medium",
      effort: "medium",
      ownerHint: "ops"
    });
  } else {
    nextBestActions.push({
      id: "run-channel-test",
      title: "Run a controlled channel test",
      rationale: `Delivery quality is stable, so the next learning should compare ${bestChannel} against one challenger channel on the same audience.`,
      impact: "medium",
      effort: "low",
      ownerHint: "data"
    });
  }

  const topOpportunity = opportunities[0];
  const executiveSummary =
    totals.communications === 0
      ? "No campaign events yet. Launch one campaign to unlock channel, audience, and revenue intelligence."
      : `${healthLabel} growth engine (${healthScore}/100). ${
          bestSegment ? `${bestSegment.segmentName} is leading at ${bestSegment.clickRate}% click rate.` : "Audience signal is still forming."
        } ${
          topOpportunity
            ? `Best next play: ${topOpportunity.title} for ${topOpportunity.audienceSize} shoppers.`
            : "No large audience opportunity is available yet; collect more campaign data."
        }`;

  return {
    healthScore,
    healthLabel,
    executiveSummary,
    opportunities,
    nextBestActions: nextBestActions.slice(0, 3)
  };
}

export async function getInsightsDashboard(prisma: PrismaClient): Promise<InsightsDashboard> {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { segment: true }
  });

  const performances = (
    await Promise.all(campaigns.map((campaign) => getCampaignPerformance(prisma, campaign.id)))
  ).filter((performance): performance is CampaignPerformance => performance !== null);

  const recentCampaigns = await Promise.all(
    campaigns.slice(0, 5).map((campaign) => buildCampaignSummary(prisma, campaign))
  );

  const totals = performances.reduce<InsightsDashboard["totals"]>(
    (acc, performance) => ({
      campaigns: acc.campaigns + 1,
      communications: acc.communications + performance.stats.total,
      sent: acc.sent + performance.stats.sent,
      delivered: acc.delivered + performance.stats.delivered,
      opened: acc.opened + performance.stats.opened,
      clicked: acc.clicked + performance.stats.clicked,
      failed: acc.failed + performance.stats.failed,
      bounced: acc.bounced + performance.stats.bounced,
      attributedOrders: acc.attributedOrders + performance.stats.attributedOrders,
      attributedRevenue: acc.attributedRevenue + performance.stats.attributedRevenue
    }),
    {
      campaigns: 0,
      communications: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      bounced: 0,
      attributedOrders: 0,
      attributedRevenue: 0
    }
  );

  const channelPerformance = aggregateChannelPerformance(performances);
  const segmentPerformance = aggregateSegmentPerformance(performances);
  const rates = {
    deliveryRate: rate(totals.delivered, totals.communications),
    openRate: rate(totals.opened, totals.communications),
    clickRate: rate(totals.clicked, totals.communications),
    conversionRate: rate(totals.attributedOrders, totals.clicked)
  };
  const growthIntelligence = await buildGrowthIntelligence(
    prisma,
    totals,
    rates,
    channelPerformance,
    segmentPerformance
  );

  return {
    totals,
    rates,
    channelPerformance,
    segmentPerformance,
    recentCampaigns,
    recommendations: buildRecommendations(channelPerformance, segmentPerformance, totals),
    growthIntelligence
  };
}

export async function getSegmentStats(
  prisma: PrismaClient,
  segmentId: string
): Promise<SegmentStatsDetail | null> {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) return null;

  const campaigns = await prisma.campaign.findMany({
    where: { segmentId },
    orderBy: { createdAt: "desc" },
    include: { segment: true }
  });

  const performances = (
    await Promise.all(campaigns.map((campaign) => getCampaignPerformance(prisma, campaign.id)))
  ).filter((performance): performance is CampaignPerformance => performance !== null);

  const campaignSummaries = await Promise.all(
    campaigns.map((campaign) => buildCampaignSummary(prisma, campaign))
  );

  const totals = performances.reduce<SegmentStatsDetail["totals"]>(
    (acc, performance) => ({
      communications: acc.communications + performance.stats.total,
      delivered: acc.delivered + performance.stats.delivered,
      opened: acc.opened + performance.stats.opened,
      clicked: acc.clicked + performance.stats.clicked,
      failed: acc.failed + performance.stats.failed,
      bounced: acc.bounced + performance.stats.bounced,
      attributedOrders: acc.attributedOrders + performance.stats.attributedOrders,
      attributedRevenue: acc.attributedRevenue + performance.stats.attributedRevenue
    }),
    {
      communications: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      bounced: 0,
      attributedOrders: 0,
      attributedRevenue: 0
    }
  );

  return {
    segmentId: segment.id,
    segmentName: segment.name,
    campaigns: campaignSummaries,
    totals,
    rates: {
      deliveryRate: rate(totals.delivered, totals.communications),
      openRate: rate(totals.opened, totals.communications),
      clickRate: rate(totals.clicked, totals.communications),
      conversionRate: rate(totals.attributedOrders, totals.clicked)
    }
  };
}
