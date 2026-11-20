import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CONTROL_PERSONAL } from '@/lib/modulosNuevos';
import { usePuedeLeerModulo } from '@/hooks/usePuedeLeerModulo';

// Aviso discreto en la pestaña Asistencias del Mapa (solo con permiso del módulo).
export default function AsistenciasMovidoAviso() {
  const puede = usePuedeLeerModulo(CONTROL_PERSONAL.module);
  if (!puede) return null;
  const Icon = CONTROL_PERSONAL.icon;
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground flex-1">
        <Icon className="h-4 w-4 text-primary shrink-0" /> Ahora también está en {CONTROL_PERSONAL.label}.
      </p>
      <Button asChild variant="outline" size="sm" className="gap-2 self-start sm:self-auto">
        <Link to={CONTROL_PERSONAL.path}>Ir a {CONTROL_PERSONAL.label} <ArrowRight className="h-4 w-4" /></Link>
      </Button>
    </div>
  );
}