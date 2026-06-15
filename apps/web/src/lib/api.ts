import type {
  CustomerSummary,
  OrderSummary,
  PaginatedResponse,
  SegmentRules,
  SegmentSummary,
  CampaignSummary,
  AiDraftResult,
  CampaignChannel,
  CampaignPerformance,
  InsightsDashboard,
  AiCampaignInsight,
  SegmentStatsDetail
} from "@smartcrm/shared";

export type CustomerDetail = CustomerSummary & {
  orders: OrderSummary[];
};

export type SegmentPreview = {
  count: number;
  sample: { id: string; name: string; email: string; city: string | null }[];
};

export type AiGenerateResult = {
  rules: SegmentRules;
  preview: SegmentPreview;
};

type ApiEnvelope<T> = { data: T };

const fallbackApiUrl = "http://localhost:4000";

export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? fallbackApiUrl;
}

export async function fetchFromApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API ${response.status}`);
  }
  return (await response.json()) as T;
}

// ── Customers ────────────────────────────────────────────────
export async function getCustomers(page: number, search?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) params.set("search", search);
  return fetchFromApi<PaginatedResponse<CustomerSummary>>(`/customers?${params}`);
}
export async function getCustomer(id: string) {
  return (await fetchFromApi<ApiEnvelope<CustomerDetail>>(`/customers/${id}`)).data;
}

// ── Orders ───────────────────────────────────────────────────
export async function getOrders(page: number, search?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) params.set("search", search);
  return fetchFromApi<PaginatedResponse<OrderSummary>>(`/orders?${params}`);
}

// ── Segments ─────────────────────────────────────────────────
export async function getSegments(page = 1) {
  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  return fetchFromApi<PaginatedResponse<SegmentSummary>>(`/segments?${params}`);
}
export async function getSegment(id: string) {
  return (await fetchFromApi<ApiEnvelope<SegmentSummary>>(`/segments/${id}`)).data;
}
export async function createSegment(body: object) {
  return (await fetchFromApi<ApiEnvelope<SegmentSummary>>("/segments", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  })).data;
}
export async function updateSegment(id: string, body: object) {
  return (await fetchFromApi<ApiEnvelope<SegmentSummary>>(`/segments/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  })).data;
}
export async function deleteSegment(id: string) {
  return fetchFromApi<ApiEnvelope<{ deleted: boolean }>>(`/segments/${id}`, { method: "DELETE" });
}
export async function previewSegment(rules: SegmentRules): Promise<SegmentPreview> {
  return (await fetchFromApi<ApiEnvelope<SegmentPreview>>("/segments/preview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules })
  })).data;
}
export async function aiGenerateSegment(prompt: string): Promise<AiGenerateResult> {
  return (await fetchFromApi<ApiEnvelope<AiGenerateResult>>("/segments/ai-generate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt })
  })).data;
}

// ── Campaigns (Phase 3) ──────────────────────────────────────
export async function getCampaigns(page = 1) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  return fetchFromApi<PaginatedResponse<CampaignSummary>>(`/campaigns?${params}`);
}
export async function getCampaign(id: string) {
  return (await fetchFromApi<ApiEnvelope<CampaignSummary>>(`/campaigns/${id}`)).data;
}
export async function createCampaign(body: {
  name: string; segmentId: string; channel: CampaignChannel; messageTemplate: string;
}) {
  return (await fetchFromApi<ApiEnvelope<CampaignSummary>>("/campaigns", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  })).data;
}
export async function updateCampaign(id: string, body: object) {
  return (await fetchFromApi<ApiEnvelope<CampaignSummary>>(`/campaigns/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  })).data;
}
export async function deleteCampaign(id: string) {
  return fetchFromApi<ApiEnvelope<{ deleted: boolean }>>(`/campaigns/${id}`, { method: "DELETE" });
}
export async function sendCampaign(id: string): Promise<{ data: CampaignSummary; meta: { communicationCount: number } }> {
  return fetchFromApi(`/campaigns/${id}/send`, { method: "POST" });
}
export async function aiDraftCampaign(id: string): Promise<AiDraftResult> {
  return (await fetchFromApi<ApiEnvelope<AiDraftResult>>(`/campaigns/${id}/ai-draft`, { method: "POST" })).data;
}

export async function getInsightsDashboard() {
  return (await fetchFromApi<ApiEnvelope<InsightsDashboard>>("/insights")).data;
}

export async function getCampaignPerformance(id: string) {
  return (await fetchFromApi<ApiEnvelope<CampaignPerformance>>(`/campaigns/${id}/stats`)).data;
}

export async function getCampaignInsight(id: string) {
  return (await fetchFromApi<ApiEnvelope<AiCampaignInsight>>(`/campaigns/${id}/insight`)).data;
}

export async function getSegmentStats(id: string) {
  return (await fetchFromApi<ApiEnvelope<SegmentStatsDetail>>(`/segments/${id}/stats`)).data;
}
