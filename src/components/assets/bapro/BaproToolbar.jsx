import React from 'react';
import { Plus, Upload, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BuscadorActivos from '@/components/assets/bapro/BuscadorActivos';
import ExportarMenu from '@/components/assets/bapro/ExportarMenu';
import { TYPE_LABELS } from '@/components/assets/bapro/sedesBapro';

export default function BaproToolbar({ f, actualizar, resetKey, hayFiltros, onLimpiar, onImportar, onExcel, onPdf, onNuevo }) {
  return (
    <div className="flex flex-col flex-wrap gap-3 lg:flex-row">
      <BuscadorActivos key={resetKey} value={f.q} onChange={q => actualizar({ q })} />
      <Select value={f.tipo} onValueChange={tipo => actualizar({ tipo })}>
        <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={f.estado} onValueChange={estado => actualizar({ estado })}>
        <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="operativo">Operativo</SelectItem>
          <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
          <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
          <SelectItem value="baja">Baja</SelectItem>
        </SelectContent>
      </Select>
      {hayFiltros && (
        <Button variant="ghost" className="gap-1.5" onClick={onLimpiar}><FilterX className="h-4 w-4" /> Limpiar filtros</Button>
      )}
      <div className="flex gap-2 lg:ml-auto">
        <Button variant="outline" className="gap-1.5" onClick={onImportar}>
          <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importar</span>
        </Button>
        <ExportarMenu onExcel={onExcel} onPdf={onPdf} />
        <Button onClick={onNuevo} className="gap-1.5"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo</span></Button>
      </div>
    </div>
  );
}