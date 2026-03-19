import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function PageHeader({ title, subtitle, actionLabel, onAction, icon: Icon }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actionLabel && (
        <Button onClick={onAction} className="gap-2 shadow-lg shadow-primary/20">
          {Icon ? <Icon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}