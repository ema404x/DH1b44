import React from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function GeoProgreso({ hechas, total }) {
  const pct = total ? Math.round((hechas / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 space-y-2">
      <p className="text-sm flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" /> Buscando {Math.min(hechas, total)} de {total}
      </p>
      <Progress value={pct} className="h-2" />
    </div>
  );
}