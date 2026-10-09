'use client';
import { ChartContainer } from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { money, chartDate, type Row } from '@/lib/client';

export function AdminSalesChart({ data }: { data: Row }) {
  return (
    <ChartContainer
      config={{
        total: { label: 'Ventas', color: 'var(--primary)' },
      }}
      className="sales-chart"
    >
      <AreaChart data={data.trend}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 5" />
        <XAxis
          dataKey="date"
          tickFormatter={chartDate}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 100000)}k`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          labelFormatter={chartDate}
          formatter={(v: any) => money(Number(v))}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#salesGradient)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function AdminRevenueChart({ data }: { data: Row }) {
  return (
    <ChartContainer
      config={{
        revenueMinor: {
          label: 'Venta neta',
          color: 'var(--primary)',
        },
      }}
      className="sales-chart"
    >
      <AreaChart data={data.trend}>
        <defs>
          <linearGradient id="reportGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 5" />
        <XAxis
          dataKey="date"
          tickFormatter={chartDate}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(value) => `${Math.round(value / 100000)}k`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          labelFormatter={chartDate}
          formatter={(value: any) => money(Number(value))}
        />
        <Area
          type="monotone"
          dataKey="revenueMinor"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#reportGradient)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function AdminFundsChart({ data }: { data: Row }) {
  return (
    <ChartContainer
      config={{
        projectedKnownFundsMinor: {
          label: 'Fondos proyectados',
          color: 'var(--primary)',
        },
      }}
      className="sales-chart"
    >
      <AreaChart data={data.daily}>
        <CartesianGrid vertical={false} strokeDasharray="4 5" />
        <XAxis
          dataKey="date"
          tickFormatter={chartDate}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(value) => `${Math.round(value / 100000)}k`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          labelFormatter={chartDate}
          formatter={(value: any) => money(Number(value))}
        />
        <Area
          type="monotone"
          dataKey="projectedKnownFundsMinor"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#salesGradient)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
