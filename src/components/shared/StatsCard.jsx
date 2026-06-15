import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  primary: {
    icon: 'bg-primary/10 text-primary border-primary/20',
    trend: 'text-primary',
    glow: 'shadow-primary/5',
  },
  blue: {
    icon: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    trend: 'text-blue-400',
    glow: 'shadow-blue-500/5',
  },
  green: {
    icon: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    trend: 'text-emerald-400',
    glow: 'shadow-emerald-500/5',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    trend: 'text-amber-400',
    glow: 'shadow-amber-500/5',
  },
  red: {
    icon: 'bg-red-500/10 text-red-400 border-red-500/20',
    trend: 'text-red-400',
    glow: 'shadow-red-500/5',
  },
  purple: {
    icon: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    trend: 'text-purple-400',
    glow: 'shadow-purple-500/5',
  },
  cyan: {
    icon: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    trend: 'text-cyan-400',
    glow: 'shadow-cyan-500/5',
  },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'primary' }) {
  const c = colorMap[color] || colorMap.primary;

  return (
    <Card className={cn(
      'p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group border-border/60',
      c.glow
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 border transition-transform duration-200 group-hover:scale-105',
            c.icon
          )}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend !== undefined && trend !== null && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5">
          {trend > 0
            ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          }
          <p className={cn(
            'text-xs font-semibold',
            trend > 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {trend > 0 ? '+' : ''}{Math.abs(trend)}% vs mes anterior
          </p>
        </div>
      )}
    </Card>
  );
}