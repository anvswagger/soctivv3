import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface HourlyCallEntry {
  hour: number;
  count: number;
}

interface SuperAdminHourlyCallsChartProps {
  data: HourlyCallEntry[];
}

export function SuperAdminHourlyCallsChart({ data }: SuperAdminHourlyCallsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="hour" tickFormatter={(value) => `${value}:00`} />
        <YAxis />
        <Tooltip formatter={(value: number) => [value, 'مكالمات']} labelFormatter={(label) => `الساعة ${label}:00`} />
        <Legend />
        <Bar dataKey="count" name="المكالمات" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
