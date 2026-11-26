import React from 'react';
import { Building2, Cpu, Plus, Upload, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Estado vacío: sede sin activos, o búsqueda/filtros sin resultados. */
export default function BaproVacio({ sedeVacia, hayFiltros, onNuevo, onImportar, onLimpiar }) {
  if (sedeVacia) {
    return (
      <div className="space-y-3">
        <Building2 className="mx-auto h-10 w-10 opacity-20" />
        <p className="text-sm font-medium text-foreground">Esta sede todavía no tiene activos</p>
        <div className="flex justify-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={onNuevo}><Plus className="h-4 w-4" /> Nuevo</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onImportar}><Upload className="h-4 w-4" /> Importar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Cpu className="mx-auto h-10 w-10 opacity-20" />
      <p className="text-sm font-medium">No se encontraron activos</p>
      {hayFiltros && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onLimpiar}><FilterX className="h-4 w-4" /> Limpiar filtros</Button>
      )}
    </div>
  );
}