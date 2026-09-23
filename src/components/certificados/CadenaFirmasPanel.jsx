import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, X, CheckCircle2, PenTool, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function CadenaFirmasPanel({ value = [], onChange }) {
  const [search, setSearch] = useState('');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-cadena-firmas'],
    queryFn: () => base44.entities.Employee.list('-full_name', 500),
  });

  const empleadosConUsuario = employees.filter(e => e.user_id || e.email);
  const disponibles = empleadosConUsuario
    .filter(e => !value.some(v => (v.email || '').toLowerCase() === (e.email || '').toLowerCase()))
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (e.full_name || '').toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q);
    });

  const addFirmante = (emp) => {
    onChange([...value, {
      user_id: emp.user_id || null,
      email: (emp.email || '').toLowerCase().trim(),
      full_name: emp.full_name || '',
      estado: 'pendiente',
    }]);
    setSearch('');
  };

  const removeFirmante = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = [...value];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered);
  };

  return (
    <div className="bg-card rounded-lg border border-dashed border-primary/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PenTool className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground uppercase tracking-wide">Cadena de Firmas</h3>
        <span className="text-xs text-muted-foreground ml-auto">Firma secuencial · {value.length} firmante(s)</span>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Sin cadena: el certificado va directo a aprobación gerencial.
          Agregá firmantes para que revisen y firmen antes de llegar al gerente.
        </p>
      )}

      {value.length > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="cadena-firmas">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {value.map((f, idx) => {
                  const emp = employees.find(e => (e.email || '').toLowerCase() === (f.email || '').toLowerCase());
                  const hasFirma = emp?.firma_url;
                  return (
                    <Draggable key={(f.email || '') + idx} draggableId={`firmante-${idx}`} index={idx}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border/60 hover:border-primary/30 transition-colors"
                        >
                          <div {...prov.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}°</span>
                          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{(f.full_name || '?').charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                          </div>
                          {hasFirma ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-500 shrink-0">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Firma
                            </span>
                          ) : (
                            <span className="text-xs text-amber-500 shrink-0">Sin firma</span>
                          )}
                          <button onClick={() => removeFirmante(idx)} className="text-destructive hover:opacity-70 shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Buscador de empleados */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar empleado para agregar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          disabled={isLoading}
        />
        {search && disponibles.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {disponibles.slice(0, 8).map(emp => (
              <button
                key={emp.id}
                onClick={() => addFirmante(emp)}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-accent transition-colors text-left"
              >
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{(emp.full_name || '?').charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{emp.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                </div>
                {emp.firma_url && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}
        {search && disponibles.length === 0 && !isLoading && (
          <div className="absolute z-20 mt-1 w-full bg-popover border rounded-lg shadow-lg p-3 text-center text-xs text-muted-foreground">
            No se encontraron empleados con ese nombre o email
          </div>
        )}
      </div>
    </div>
  );
}