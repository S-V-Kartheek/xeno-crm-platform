"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { SegmentPerformance } from "@smartcrm/shared";
import { CHART_AXIS, CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

type Props = { data: SegmentPerformance[] };

export default function SegmentLeaderboardChart({ data }: Props) {
  const chartData = data.slice(0, 6).map((segment) => ({
    name: segment.segmentName.length > 18 ? `${segment.segmentName.slice(0, 16)}…` : segment.segmentName,
    clickRate: segment.clickRate,
    delivered: segment.delivered,
    clicked: segment.clicked
  }));

  return (
    <div className="chart-shell" aria-label="Segment engagement leaderboard">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={CHART_AXIS.tick}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            axisLine={false}
            tickLine={false}
            tick={CHART_AXIS.tick}
          />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value, name) => {
              if (name === "clickRate") return [`${Number(value ?? 0)}%`, "Click rate"];
              return [Number(value ?? 0), String(name)];
            }}
          />
          <Bar dataKey="clickRate" name="clickRate" fill={CHART_COLORS.clicked} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
