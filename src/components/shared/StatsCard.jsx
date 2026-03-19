import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    red: 'bg-red-500/10 text-red-600',
    purple: 'bg-purple-500/10 text-purple-600',
  };

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && (
        <p className={cn('text-xs font-medium mt-3', trend > 0 ? 'text-emerald-600' : 'text-red-500')}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mes anterior
        </p>
      )}
    </Card>
  );
}