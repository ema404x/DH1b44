import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Pencil, Trash2, Calendar, Clock, CheckCircle2, Loader2, AlertTriangle,
  FileText, Zap, ChevronDown, ChevronUp, Link2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { parseMonto, fmt, mesPeriodoLabel } from './abonoUtils';
import { Link } from 'react-router-dom';

function detectarProblemas(abono) {
  const p = [];
  if (!abono.ada_numero) p.push('Sin N° ADA');
  if (!abono.monto_total_contrato || parseMonto(abono.monto_total_contrato) === 0) p.push('Monto en $0');
  if (!abono.duracion_meses || abono.duracion_meses < 1) p.push('Duración inválida');
  if (!abono.fecha_inicio_validez) p.push('Sin fecha de inicio');
  return p;
}

export default function AbonoMaestroCard({ abono, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const qc = useQueryClient();

  const problemas = detectarProblemas(abono);
  const total = abono.duracion_meses || 1;
  const emitidos = abono.certificados_emitidos || 0;
  const progreso = Math.min(100, (emitidos / total) * 100);
  const loteGenerado = abono.lote_generado;

  const estadoStyle = {
    activo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    completado: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    pausado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };

  const handleGenerarLote = async () => {
    if (!window.confirm(`¿Generar ${total} certificados en lote para ${abono.contratista}?\n\nSe crearán todos los certificados mensuales del contrato con su PDF.`)) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generarLoteAbonos', { abono_id: abono.id });
      const data = res.data;
      setResult(data);
      if (data.success) {
        toast.success(`${data.generated?.length || 0} certificados generados`);
        qc.invalidateQueries({ queryKey: ['abonos-maestro'] });
        qc.invalidateQueries({ queryKey: ['certificados'] });
      } else {
        toast.error(data.error || 'Error en la generación');
      }
    } catch (e) {
      toast.error('Error: ' + (e.response?.data?.error || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerar = async () => {
    if (!window.confirm(`¿Regenerar el lote de certificados?\n\nSe eliminarán los certificados automáticos previos y se crearán nuevamente.`)) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generarLoteAbonos', { abono_id: abono.id, regenerar: true });
      const data = res.data;
      setResult(data);
      if (data.success) {
        toast.success(`Lote regenerado: ${data.generated?.length || 0} certificados`);
        qc.invalidateQueries({ queryKey: ['abonos-maestro'] });
        qc.invalidateQueries({ queryKey: ['certificados'] });
      }
    } catch (e) {
      toast.error('Error: ' + (e.response?.data?.error || e.message));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className={`p-0 overflow-hidden ${problemas.length > 0 && !loteGenerado ? 'border-amber-500/40' : ''} ${loteGenerado ? 'border-emerald-500/30' : ''}`}>
      {/* Cabecera */}
      <div className="p-4 pb-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm leading-tight">{abono.contratista || '—'}</h3>
            {abono.obra_servicio && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{abono.obra_servicio}</p>
            )}
          </div>
          <Badge className={`text-[10px] border shrink-0 ${estadoStyle[abono.estado] || ''}`}>
            {abono.estado}
          </Badge>
        </div>

        {/* Alertas */}
        {problemas.length > 0 && !loteGenerado && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5 space-y-0.5">
            {problemas.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {p}
              </div>
            ))}
          </div>
        )}

        {/* IDs */}
        <div className="flex gap-1.5 flex-wrap">
          {abono.ada_numero && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono font-semibold">
              ADA {abono.ada_numero}
            </span>
          )}
          {abono.oc_numero && (
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">
              OC {abono.oc_numero}
            </span>
          )}
          {abono.comuna && (
            <span className="text-[10px] bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full font-semibold border border-indigo-500/30">
              Comuna {abono.comuna}
            </span>
          )}
          {abono.emprendimiento && (
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {abono.emprendimiento}
            </span>
          )}
        </div>

        {/* Montos */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/40 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">Mensual</p>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">{fmt(abono.monto_mensual)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">Total contrato</p>
            <p className="text-sm font-bold text-primary mt-0.5">{fmt(abono.monto_total_contrato)}</p>
          </div>
        </div>

        {/* Progreso del lote */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">
              {loteGenerado ? `${emitidos} de ${total} certificados generados` : 'Lote no generado'}
            </span>
            <span className={loteGenerado ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
              {loteGenerado ? (progreso >= 100 ? '✓ Completo' : `${Math.round(progreso)}%`) : 'Pendiente'}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${progreso >= 100 ? 'bg-emerald-500' : loteGenerado ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              style={{ width: `${loteGenerado ? progreso : 0}%` }}
            />
          </div>
        </div>

        {/* Fechas */}
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {mesPeriodoLabel(abono.fecha_inicio_validez)}
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            {mesPeriodoLabel(abono.fecha_fin_validez)} <Clock className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Resultado de generación */}
      {result && (
        <div className="mx-4 mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-400">✓ {result.message}</p>
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setResult(null)}>✕</Button>
          </div>
          {result.generated?.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {result.generated.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] bg-background/60 rounded px-2 py-1">
                  <span>N° {c.numero} — {c.mes}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">{fmt(c.monto)}</span>
                    {c.pdf_url && (
                      <a href={c.pdf_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        <FileText className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expandible: ítems */}
      {abono.items?.length > 0 && (
        <div className="border-t border-border">
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setExpanded(e => !e)}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              {abono.items.length} ítem{abono.items.length > 1 ? 's' : ''} de certificado
            </span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-1">
              {abono.items.map((it, i) => (
                <div key={i} className="flex justify-between items-start text-[11px] py-1 border-b border-border/50 last:border-0">
                  <span className="text-foreground flex-1 pr-2">{it.descripcion || `Ítem ${i + 1}`}</span>
                  <span className="text-primary font-semibold shrink-0">{fmt(it.importe_total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 px-4 py-3 border-t border-border bg-muted/20">
        {!loteGenerado ? (
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-xs h-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg"
            onClick={handleGenerarLote}
            disabled={generating || problemas.length > 0}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {generating ? 'Generando...' : `Generar ${total} certificados`}
          </Button>
        ) : (
          <>
            <Link to="/certificados" className="flex-1">
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-8">
                <Link2 className="h-3.5 w-3.5" /> Ver certificados
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 text-amber-400 hover:bg-amber-500/10"
              onClick={handleRegenerar}
              disabled={generating}
              title="Regenerar lote"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-8 w-8" onClick={() => onEdit(abono)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => { if (window.confirm(`¿Eliminar el abono de ${abono.contratista}?`)) onDelete(abono.id); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}