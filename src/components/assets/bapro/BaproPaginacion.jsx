import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BaproPaginacion({ pagina, totalPaginas, desde, hasta, total, onPagina }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="tabular-nums">Mostrando {desde}–{hasta} de {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <span className="tabular-nums">{pagina} / {totalPaginas}</span>
        <Button variant="outline" size="sm" className="gap-1" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
          Siguiente <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}