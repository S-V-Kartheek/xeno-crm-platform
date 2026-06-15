"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CHART_AXIS, CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

type FunnelPoint = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
};

export default function FunnelChart({ deliveryRate, openRate, clickRate, conversionRate }: Props) {
  const data: FunnelPoint[] = [
    { label: "Delivered", value: deliveryRate, color: CHART_COLORS.delivered },
    { label: "Opened/read", value: openRate, color: CHART_COLORS.opened },
    { label: "Clicked", value: clickRate, color: CHART_COLORS.clicked },
    { label: "Post-click orders", value: conversionRate, color: CHART_COLORS.converted }
  ];

  return (
    <div className="chart-shell" aria-label="Campaign performance funnel">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={CHART_AXIS.tick}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value) => [`${Number(value ?? 0)}%`, "Rate"]}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
