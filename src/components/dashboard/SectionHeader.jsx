import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionHeader({ icon: Icon, title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground tracking-tight leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground leading-tight">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}