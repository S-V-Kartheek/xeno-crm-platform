"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { CampaignTimelinePoint } from "@smartcrm/shared";
import { CHART_AXIS, CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

type Props = { data: CampaignTimelinePoint[] };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function EventTimelineChart({ data }: Props) {
  const chartData = data.map((point) => ({
    ...point,
    label: formatDate(point.date),
    issues: point.failed + point.bounced
  }));

  return (
    <div className="chart-shell" aria-label="Callback event timeline">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="deliveredFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.delivered} stopOpacity={0.35} />
              <stop offset="95%" stopColor={CHART_COLORS.delivered} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="clickedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.clicked} stopOpacity={0.35} />
              <stop offset="95%" stopColor={CHART_COLORS.clicked} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
          <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS.tick} allowDecimals={false} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "0.85rem" }} />
          <Area
            type="monotone"
            dataKey="delivered"
            name="Delivered"
            stroke={CHART_COLORS.delivered}
            fill="url(#deliveredFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="opened"
            name="Opened/read"
            stroke={CHART_COLORS.opened}
            fill="transparent"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="clicked"
            name="Clicked"
            stroke={CHART_COLORS.clicked}
            fill="url(#clickedFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
