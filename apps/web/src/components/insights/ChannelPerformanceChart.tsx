"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ChannelPerformance } from "@smartcrm/shared";
import { CHART_AXIS, CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

type Props = { data: ChannelPerformance[] };

export default function ChannelPerformanceChart({ data }: Props) {
  const chartData = data.map((channel) => ({
    name: channel.channel.toUpperCase(),
    delivered: channel.deliveryRate,
    opened: channel.openRate,
    clicked: channel.clickRate
  }));

  return (
    <div className="chart-shell" aria-label="Channel performance comparison">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={CHART_AXIS.tick}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value) => [`${Number(value ?? 0)}%`, ""]}
          />
          <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "0.85rem" }} />
          <Bar dataKey="delivered" name="Delivered" fill={CHART_COLORS.delivered} radius={[6, 6, 0, 0]} />
          <Bar dataKey="opened" name="Opened/read" fill={CHART_COLORS.opened} radius={[6, 6, 0, 0]} />
          <Bar dataKey="clicked" name="Clicked" fill={CHART_COLORS.clicked} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
