import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { getTips } from './tipsCertificado';

// Panel de tips de control de calidad que se muestra antes de firmar.
// El firmante debe tildar todos los items para habilitar el botón de firma.
// Si no hay tips para el tipo de certificado, no renderiza nada.
export default function TipsFirmaPanel({ tipoCertificado, onAllChecked }) {
  const grupos = useMemo(() => getTips(tipoCertificado), [tipoCertificado]);
  const [expanded, setExpanded] = useState(true);
  const [checked, setChecked] = useState({});

  // Reset al cambiar de certificado
  useEffect(() => {
    setChecked({});
    setExpanded(true);
  }, [tipoCertificado]);

  // Total de tips y cuántos están tildados
  const { total, checkedCount } = useMemo(() => {
    const total = grupos.reduce((acc, g) => acc + g.tips.length, 0);
    const checkedCount = Object.values(checked).filter(Boolean).length;
    return { total, checkedCount };
  }, [grupos, checked]);

  const allChecked = total > 0 && checkedCount === total;

  useEffect(() => {
    if (onAllChecked) onAllChecked(allChecked);
  }, [allChecked, onAllChecked]);

  if (grupos.length === 0) return null;

  const toggle = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-amber-500/10 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardCheck className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold text-foreground">Checklist de revisión</span>
          {allChecked ? (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">Completo</span>
          ) : (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">{checkedCount}/{total}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Lista de tips */}
      {expanded && (
        <div className="px-4 pb-3 space-y-3 max-h-[280px] overflow-y-auto">
          {!allChecked && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/10 rounded-md px-2 py-1.5 mb-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Debés revisar y tildar todos los puntos antes de firmar.</span>
            </div>
          )}
          {grupos.map((grupo, gi) => (
            <div key={gi} className="space-y-1.5">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide pt-1">{grupo.categoria}</p>
              {grupo.tips.map((tip, ti) => {
                const key = `${gi}-${ti}`;
                const isChecked = !!checked[key];
                return (
                  <label
                    key={key}
                    className="flex items-start gap-2 cursor-pointer group"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className={`mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-border bg-background group-hover:border-amber-400/60'
                      }`}
                    >
                      {isChecked && (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className={`text-xs leading-snug ${isChecked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {tip}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}