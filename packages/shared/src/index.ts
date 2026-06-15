import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Base enums
// ────────────────────────────────────────────────────────────────────────────

export const aovTierSchema = z.enum(["value", "mid", "high"]);
export const orderStatusSchema = z.enum(["completed", "returned", "cancelled"]);
export const segmentCreatedViaSchema = z.enum(["manual", "ai_generated"]);

// Phase 3 enums
export const campaignStatusSchema = z.enum(["draft", "sending", "sent", "failed"]);
export const campaignChannelSchema = z.enum(["email", "sms", "whatsapp"]);
export const commStatusSchema = z.enum([
  "queued", "sent", "delivered", "opened", "clicked", "failed", "bounced"
]);

// ────────────────────────────────────────────────────────────────────────────
// Shared primitive schemas
// ────────────────────────────────────────────────────────────────────────────

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date format YYYY-MM-DD");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional()
});

// ────────────────────────────────────────────────────────────────────────────
// Customer schemas
// ────────────────────────────────────────────────────────────────────────────

export const customerCreateSchema = z.object({
  externalId: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(8).max(24).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  signupDate: isoDateSchema,
  categoryAffinity: z.string().trim().min(2).max(80).optional(),
  aovTier: aovTierSchema.default("value")
});

export const customerUpdateSchema = customerCreateSchema.partial();

// ────────────────────────────────────────────────────────────────────────────
// Order schemas
// ────────────────────────────────────────────────────────────────────────────

export const orderCreateSchema = z
  .object({
    orderNumber: z.string().trim().min(2).max(80),
    customerId: z.string().trim().min(1).optional(),
    customerEmail: z.string().trim().email().toLowerCase().optional(),
    orderDate: isoDateSchema,
    amount: z.coerce.number().positive(),
    currency: z.string().trim().length(3).default("INR"),
    category: z.string().trim().min(2).max(80),
    productName: z.string().trim().min(2).max(120),
    status: orderStatusSchema.default("completed")
  })
  .refine((value) => value.customerId || value.customerEmail, {
    message: "Provide either customerId or customerEmail",
    path: ["customerEmail"]
  });

export const importCsvBodySchema = z.object({
  csv: z.string().min(1)
});

// ────────────────────────────────────────────────────────────────────────────
// Segment Rule DSL
// ────────────────────────────────────────────────────────────────────────────

/** Fields that map directly to a DB column — handled in the Prisma WHERE */
export const DIRECT_FIELDS = ["city", "categoryAffinity", "aovTier"] as const;

/**
 * Fields that require aggregation — evaluated in application memory after the
 * direct-field DB query. At production scale these would be denormalised columns
 * or a materialised view, but for this data volume app-memory is fine.
 */
export const COMPUTED_FIELDS = ["orderCount", "totalSpent", "daysSinceLastOrder"] as const;

export const ALL_SEGMENT_FIELDS = [...DIRECT_FIELDS, ...COMPUTED_FIELDS] as const;
export type SegmentField = (typeof ALL_SEGMENT_FIELDS)[number];

export const segmentConditionSchema = z.object({
  field: z.enum(ALL_SEGMENT_FIELDS),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"]),
  value: z.union([z.string(), z.number(), z.array(z.string())])
});

export const segmentRulesSchema = z
  .object({
    logic: z.enum(["AND", "OR"]),
    conditions: z
      .array(segmentConditionSchema)
      .min(1, "At least one condition is required")
      .max(6, "Maximum 6 conditions allowed")
  })
  .superRefine((data, ctx) => {
    for (const [i, c] of data.conditions.entries()) {
      const isComputed = COMPUTED_FIELDS.includes(c.field as (typeof COMPUTED_FIELDS)[number]);
      const isString = DIRECT_FIELDS.slice(0, 2).includes(
        c.field as (typeof DIRECT_FIELDS)[number]
      );
      if (isComputed && ["contains", "in"].includes(c.operator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditions", i, "operator"],
          message: `Operator "${c.operator}" is not valid for numeric field "${c.field}"`
        });
      }
      if (isString && ["gt", "gte", "lt", "lte"].includes(c.operator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditions", i, "operator"],
          message: `Operator "${c.operator}" is not valid for string field "${c.field}"`
        });
      }
    }
  });

export const segmentCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  rules: segmentRulesSchema,
  createdVia: segmentCreatedViaSchema.default("manual")
});

export const segmentUpdateSchema = segmentCreateSchema.partial();

// ────────────────────────────────────────────────────────────────────────────
// Campaign schemas (Phase 3)
// ────────────────────────────────────────────────────────────────────────────

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  segmentId: z.string().trim().min(1),
  channel: campaignChannelSchema,
  messageTemplate: z.string().trim().min(5).max(2000)
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

export const campaignAiDraftSchema = z.object({
  segmentId: z.string().trim().min(1),
  channel: campaignChannelSchema
});

// Receipt posted by the channel service back to CRM
export const receiptSchema = z.object({
  externalId: z.string().trim().min(1),
  status: commStatusSchema,
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// ────────────────────────────────────────────────────────────────────────────
// TypeScript types
// ────────────────────────────────────────────────────────────────────────────

export type AovTier = z.infer<typeof aovTierSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type SegmentCreatedVia = z.infer<typeof segmentCreatedViaSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type SegmentCondition = z.infer<typeof segmentConditionSchema>;
export type SegmentRules = z.infer<typeof segmentRulesSchema>;
export type SegmentCreateInput = z.infer<typeof segmentCreateSchema>;
export type SegmentUpdateInput = z.infer<typeof segmentUpdateSchema>;

// Phase 3
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type CampaignChannel = z.infer<typeof campaignChannelSchema>;
export type CommStatus = z.infer<typeof commStatusSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type Receipt = z.infer<typeof receiptSchema>;

// ────────────────────────────────────────────────────────────────────────────
// API response shapes
// ────────────────────────────────────────────────────────────────────────────

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PageMeta;
};

export type CustomerSummary = {
  id: string;
  externalId: string | null;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  signupDate: string;
  categoryAffinity: string | null;
  aovTier: AovTier;
  orderCount: number;
  totalSpent: number;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderDate: string;
  amount: number;
  currency: string;
  category: string;
  productName: string;
  status: OrderStatus;
};

export type SegmentSummary = {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRules;
  createdVia: SegmentCreatedVia;
  createdAt: string;
  updatedAt: string;
  customerCount: number;
};

export type ImportRowError = {
  row: number;
  message: string;
  raw: Record<string, string>;
};

export type ImportReport = {
  received: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: ImportRowError[];
};

// Phase 3
export type CampaignStats = {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
};

export type CampaignTimelinePoint = {
  date: string;
  queued: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
};

export type CampaignPerformance = {
  campaignId: string;
  campaignName: string;
  segmentId: string;
  segmentName: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  sentAt: string | null;
  stats: CampaignStats & {
    conversionRate: number;
    attributedOrders: number;
    attributedRevenue: number;
  };
  timeline: CampaignTimelinePoint[];
  eventCounts: Record<CommStatus, number>;
  attributionWindowHours: number;
};

export type ChannelPerformance = {
  channel: CampaignChannel;
  campaigns: number;
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
};

export type SegmentPerformance = {
  segmentId: string;
  segmentName: string;
  campaigns: number;
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  attributedOrders: number;
  attributedRevenue: number;
};

export type SegmentStatsDetail = {
  segmentId: string;
  segmentName: string;
  campaigns: CampaignSummary[];
  totals: {
    communications: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    bounced: number;
    attributedOrders: number;
    attributedRevenue: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  };
};

export type GrowthOpportunity = {
  id: string;
  title: string;
  description: string;
  audienceSize: number;
  estimatedRevenue: number;
  suggestedChannel: CampaignChannel;
  confidence: "high" | "medium" | "low";
  priority: number;
  playbook: string;
  rulesPreview: string[];
};

export type NextBestAction = {
  id: string;
  title: string;
  rationale: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  ownerHint: "marketer" | "ops" | "data";
};

export type GrowthIntelligence = {
  healthScore: number;
  healthLabel: "Excellent" | "Healthy" | "Needs attention" | "Insufficient data";
  executiveSummary: string;
  opportunities: GrowthOpportunity[];
  nextBestActions: NextBestAction[];
};

export type InsightsDashboard = {
  totals: {
    campaigns: number;
    communications: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    bounced: number;
    attributedOrders: number;
    attributedRevenue: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  };
  channelPerformance: ChannelPerformance[];
  segmentPerformance: SegmentPerformance[];
  recentCampaigns: CampaignSummary[];
  recommendations: string[];
  growthIntelligence: GrowthIntelligence;
};

export type AiCampaignInsight = {
  summary: string;
  recommendations: string[];
  caveats: string[];
};

export type CampaignSummary = {
  id: string;
  name: string;
  segmentId: string;
  segmentName: string;
  channel: CampaignChannel;
  messageTemplate: string;
  status: CampaignStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: CampaignStats;
};

export type AiDraftVariant = {
  tone: "friendly" | "urgency";
  label: string;
  message: string;
};

export type AiDraftResult = {
  variants: [AiDraftVariant, AiDraftVariant];
};
