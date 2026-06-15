import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {Icon && (
        <div className="relative mb-5">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl scale-125" />
          <div className="relative h-20 w-20 rounded-2xl bg-card border border-border/60 flex items-center justify-center shadow-xl">
            <Icon className="h-9 w-9 text-muted-foreground/60" />
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">{description}</p>
      {actionLabel && (
        <Button
          onClick={onAction}
          className="gap-2 shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}