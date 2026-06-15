export const CHART_COLORS = {
  delivered: "#60a5fa",
  opened: "#8b5cf6",
  clicked: "#22d3ee",
  converted: "#34d399",
  failed: "#f87171",
  bounced: "#fb923c",
  sent: "#94a3b8",
  queued: "#64748b",
  email: "#8b5cf6",
  sms: "#22d3ee",
  whatsapp: "#34d399"
} as const;

export const CHART_AXIS = {
  stroke: "rgba(148, 163, 184, 0.35)",
  tick: { fill: "#94a3b8", fontSize: 12 },
  grid: "rgba(148, 163, 184, 0.12)"
};

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    borderRadius: "12px",
    color: "#e2e8f0"
  },
  labelStyle: { color: "#94a3b8" }
};
