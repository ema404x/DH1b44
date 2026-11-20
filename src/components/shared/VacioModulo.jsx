import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Estado vacío común de los módulos nuevos: ícono, qué falta y, si aplica, adónde ir. */
export default function VacioModulo({ icon: Icon, titulo, texto, accion }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center">
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/60" />}
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">{texto}</p>}
      {accion && (
        <Button asChild variant="outline" className="mt-2 h-11 gap-2">
          <Link to={accion.to}>{accion.label} <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      )}
    </div>
  );
}