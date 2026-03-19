import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function RevenueChart({ invoices }) {
  const monthlyData = React.useMemo(() => {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { month: d.toLocaleString('es', { month: 'short' }), facturado: 0, cobrado: 0 };
    }
    invoices.forEach((inv) => {
      const d = inv.issue_date || inv.created_date;
      if (!d) return;
      const key = d.substring(0, 7);
      if (months[key]) {
        months[key].facturado += inv.total || 0;
        if (inv.status === 'pagada') months[key].cobrado += inv.total || 0;
      }
    });
    return Object.values(months);
  }, [invoices]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Facturación últimos 6 meses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value) => [`$${value.toLocaleString()}`, '']}
              />
              <Bar dataKey="facturado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Facturado" />
              <Bar dataKey="cobrado" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Cobrado" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}