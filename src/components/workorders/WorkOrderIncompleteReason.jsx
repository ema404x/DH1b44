import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertOctagon, Plus, Trash2, ClipboardX } from 'lucide-react';

const MOTIVOS_COMUNES = [
  'Faltó material',
  'No había acceso al lugar',
  'Faltó herramienta o equipo',
  'Clima no permitió trabajar',
  'Problema con el equipo/instalación más grave de lo esperado',
  'Faltó personal',
  'El establecimiento estaba cerrado',
  'Se necesita otro tipo de trabajo primero',
];

export default function WorkOrderIncompleteReason({ motivos = [], onChange }) {
  const [adding, setAdding] = useState(false);
  const [texto, setTexto] = useState('');

  const add = (motivo) => {
    if (!motivo.trim()) return;
    if (motivos.some(m => m.texto === motivo.trim())) return;
    onChange([...motivos, { id: Date.now().toString(), texto: motivo.trim() }]);
    setTexto('');
    setAdding(false);
  };

  const remove = (id) => onChange(motivos.filter(m => m.id !== id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardX className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold">¿Por qué no se terminó?</span>
          {motivos.length > 0 && (
            <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-semibold">
              {motivos.length} motivo{motivos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-400 hover:text-red-300"
          onClick={() => setAdding(v => !v)}>
          <Plus className="h-3.5 w-3.5" /> Agregar motivo
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Si la OT quedó incompleta, contanos por qué. Esto ayuda al supervisor a tomar acción.
      </p>

      {/* Motivos registrados */}
      {motivos.length > 0 && (
        <div className="space-y-1.5">
          {motivos.map(m => (
            <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
              <AlertOctagon className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              <span className="flex-1">{m.texto}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive flex-shrink-0" onClick={() => remove(m.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Panel agregar */}
      {adding && (
        <div className="border border-red-500/30 rounded-xl p-3 space-y-3 bg-red-500/5">
          <p className="text-xs font-semibold text-red-400 uppercase">Seleccioná o escribí el motivo</p>

          {/* Motivos rápidos */}
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_COMUNES.filter(mc => !motivos.some(m => m.texto === mc)).map(mc => (
              <button
                key={mc}
                onClick={() => add(mc)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-muted hover:bg-red-500/20 hover:text-red-300 border border-border hover:border-red-500/40 transition-colors text-muted-foreground"
              >
                {mc}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="O escribí tu propio motivo..."
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add(texto)}
            />
            <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700 px-3"
              onClick={() => add(texto)} disabled={!texto.trim()}>
              Agregar
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs w-full text-muted-foreground"
            onClick={() => setAdding(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {motivos.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-1">Sin motivos de incompleto — ¡bien! ✓</p>
      )}
    </div>
  );
}