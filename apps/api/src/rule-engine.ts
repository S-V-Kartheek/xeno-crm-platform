/**
 * Rule Engine — converts SegmentRules DSL into Prisma WHERE clauses.
 *
 * Design decisions:
 * - "Simple" fields (city, categoryAffinity, aovTier) are direct Prisma WHERE conditions.
 * - "Computed" fields (orderCount, totalSpent, daysSinceLastOrder) cannot be expressed
 *   as a single Prisma WHERE — they require aggregation. We fetch all customer IDs
 *   that satisfy the direct-field conditions first, then filter in application memory
 *   on the aggregated values. This is fine for our data volume (~hundreds of records)
 *   and is noted as a scale tradeoff (would use a materialised view or denormalised
 *   columns at production scale).
 */

import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { type SegmentCondition, type SegmentRules, COMPUTED_FIELDS } from "@smartcrm/shared";


// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function applyStringOperator(
  op: SegmentCondition["operator"],
  value: string | number | string[]
): Prisma.StringFilter | string {
  const v = String(value);
  switch (op) {
    case "eq":
      return v;
    case "neq":
      return { not: v };
    case "contains":
      return { contains: v, mode: "insensitive" };
    case "in":
      if (!Array.isArray(value)) {
        throw new Error(`Operator "${op}" expects an array value for string fields`);
      }
      return { in: value, mode: "insensitive" };
    default:
      throw new Error(`Operator "${op}" is not valid for string fields`);
  }
}

function applyEnumOperator(
  op: SegmentCondition["operator"],
  value: string | number | string[]
): unknown {
  if (op === "eq") return String(value);
  if (op === "neq") return { not: String(value) };
  if (op === "in" && Array.isArray(value)) return { in: value };
  throw new Error(`Operator "${op}" is not valid for enum fields`);
}

function applyNumberFilter(
  op: SegmentCondition["operator"],
  value: string | number | string[]
): unknown {
  const n = Number(value);
  if (isNaN(n)) throw new Error(`Expected a number, got "${value}"`);
  switch (op) {
    case "eq":
      return n;
    case "neq":
      return { not: n };
    case "gt":
      return { gt: n };
    case "gte":
      return { gte: n };
    case "lt":
      return { lt: n };
    case "lte":
      return { lte: n };
    default:
      throw new Error(`Operator "${op}" is not valid for number fields`);
  }
}


// ────────────────────────────────────────────────────────────────────────────
// Direct-field WHERE builder (runs in the DB query)
// ────────────────────────────────────────────────────────────────────────────

function buildDirectCondition(condition: SegmentCondition): Prisma.CustomerWhereInput | null {
  const { field, operator, value } = condition;

  switch (field) {
    case "city":
      return { city: applyStringOperator(operator, value) as Prisma.StringNullableFilter };
    case "categoryAffinity":
      return {
        categoryAffinity: applyStringOperator(operator, value) as Prisma.StringNullableFilter
      };
    case "aovTier":
      return { aovTier: applyEnumOperator(operator, value) as Prisma.EnumAovTierFilter };
    default:
      // Computed fields handled separately
      return null;
  }
}

export function buildPrismaWhere(rules: SegmentRules): Prisma.CustomerWhereInput {
  const directConditions = rules.conditions
    .map(buildDirectCondition)
    .filter((c): c is Prisma.CustomerWhereInput => c !== null);

  if (directConditions.length === 0) return {};

  return rules.logic === "AND" ? { AND: directConditions } : { OR: directConditions };
}

// ────────────────────────────────────────────────────────────────────────────
// Computed-field predicate (runs in application memory after DB fetch)
// ────────────────────────────────────────────────────────────────────────────

type CustomerStats = {
  customerId: string;
  orderCount: number;
  totalSpent: number;
  daysSinceLastOrder: number;
};

async function fetchCustomerStats(
  prisma: PrismaClient,
  customerIds: string[]
): Promise<Map<string, CustomerStats>> {
  if (customerIds.length === 0) return new Map();

  // Aggregate orders per customer
  const rows = await prisma.order.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customerIds }, status: "completed" },
    _count: { id: true },
    _sum: { amount: true },
    _max: { orderDate: true }
  });

  const now = Date.now();
  const map = new Map<string, CustomerStats>();

  // Default stats for customers with no completed orders
  for (const id of customerIds) {
    map.set(id, { customerId: id, orderCount: 0, totalSpent: 0, daysSinceLastOrder: 99999 });
  }

  for (const row of rows) {
    const daysSinceLastOrder = row._max.orderDate
      ? Math.floor((now - row._max.orderDate.getTime()) / 86_400_000)
      : 99999;

    map.set(row.customerId, {
      customerId: row.customerId,
      orderCount: row._count.id,
      totalSpent: Number(row._sum.amount ?? 0),
      daysSinceLastOrder
    });
  }

  return map;
}

function testComputedCondition(stats: CustomerStats, condition: SegmentCondition): boolean {
  const { field, operator, value } = condition;
  const n = Number(value);
  if (isNaN(n)) return false;

  let actual: number;
  switch (field) {
    case "orderCount":
      actual = stats.orderCount;
      break;
    case "totalSpent":
      actual = stats.totalSpent;
      break;
    case "daysSinceLastOrder":
      actual = stats.daysSinceLastOrder;
      break;
    default:
      return false;
  }

  switch (operator) {
    case "eq":
      return actual === n;
    case "neq":
      return actual !== n;
    case "gt":
      return actual > n;
    case "gte":
      return actual >= n;
    case "lt":
      return actual < n;
    case "lte":
      return actual <= n;
    default:
      return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export type SegmentPreviewResult = {
  count: number;
  sample: { id: string; name: string; email: string; city: string | null }[];
};

/**
 * Execute the full rule engine:
 * 1. Build a Prisma WHERE for direct fields → DB query
 * 2. Fetch aggregated stats for the matched customers
 * 3. Apply computed-field conditions in memory
 * 4. Return count + sample
 */
export async function evaluateSegment(
  prisma: PrismaClient,
  rules: SegmentRules
): Promise<SegmentPreviewResult> {
  const computedConditions = rules.conditions.filter((c) =>
    COMPUTED_FIELDS.includes(c.field as (typeof COMPUTED_FIELDS)[number])
  );
  const hasComputed = computedConditions.length > 0;

  const directWhere = buildPrismaWhere(rules);

  // If no computed fields, we can get the count directly from the DB.
  if (!hasComputed) {
    const [customers, count] = await Promise.all([
      prisma.customer.findMany({
        where: directWhere,
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, city: true }
      }),
      prisma.customer.count({ where: directWhere })
    ]);
    return { count, sample: customers };
  }

  // With computed fields: fetch all IDs that pass direct filter, then apply
  // computed conditions in memory. Paginate in batches to avoid loading all data.
  const PAGE = 500;
  const matchedIds: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.customer.findMany({
      where: directWhere,
      select: { id: true },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;

    const ids = batch.map((c) => c.id);
    const statsMap = await fetchCustomerStats(prisma, ids);

    for (const id of ids) {
      const stats = statsMap.get(id)!;
      const passes =
        rules.logic === "AND"
          ? computedConditions.every((c) => testComputedCondition(stats, c))
          : computedConditions.some((c) => testComputedCondition(stats, c));
      if (passes) matchedIds.push(id);
    }

    if (batch.length < PAGE) break;
  }

  const sample = await prisma.customer.findMany({
    where: { id: { in: matchedIds.slice(0, 5) } },
    select: { id: true, name: true, email: true, city: true }
  });

  return { count: matchedIds.length, sample };
}

/**
 * Returns ALL customer IDs that match the segment rules (including computed fields).
 * Used by the campaign send route to build Communication rows for every matched customer.
 */
export async function fetchAllMatchingIds(
  prisma: PrismaClient,
  rules: SegmentRules
): Promise<string[]> {
  const computedConditions = rules.conditions.filter((c) =>
    COMPUTED_FIELDS.includes(c.field as (typeof COMPUTED_FIELDS)[number])
  );

  const directWhere = buildPrismaWhere(rules);

  // No computed fields — just query all IDs directly
  if (computedConditions.length === 0) {
    const customers = await prisma.customer.findMany({
      where: directWhere,
      select: { id: true }
    });
    return customers.map((c) => c.id);
  }

  // With computed fields — batch through all candidates
  const PAGE = 500;
  const matchedIds: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.customer.findMany({
      where: directWhere,
      select: { id: true },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;

    const ids = batch.map((c) => c.id);
    const statsMap = await fetchCustomerStats(prisma, ids);

    for (const id of ids) {
      const stats = statsMap.get(id)!;
      const passes =
        rules.logic === "AND"
          ? computedConditions.every((c) => testComputedCondition(stats, c))
          : computedConditions.some((c) => testComputedCondition(stats, c));
      if (passes) matchedIds.push(id);
    }

    if (batch.length < PAGE) break;
  }

  return matchedIds;
}
