import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionHeader({ icon: Icon, title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-4", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-muted/60 border border-border flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground tracking-tight leading-tight">{title}</h2>
          {subtitle && <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 leading-tight mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}