import React, { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fmt } from '@/components/reportes/shared';
import { netoCertificado, mesesEntre, mesesTranscurridos } from '@/components/finanzas/abonoNeto';

const ESTADO_CLS = {
  activo: 'bg-emerald-500/12 text-emerald-400',
  completado: 'bg-blue-500/12 text-blue-400',
  pausado: 'bg-amber-500/12 text-amber-400',
};

// Listado por contrato de abono con progreso de certificación y monto pendiente.
// Fila expandible muestra los certificados mensuales generados del contrato.
export default function AbonosContratosTable({ abonos, certificadosAbono }) {
  const [expanded, setExpanded] = useState(null);

  // Indexa certificados de abono por (ada_numero + contratista) para el detalle expandido.
  const certsPorAbono = useMemo(() => {
    const map = {};
    (certificadosAbono || []).forEach((c) => {
      const k = `${(c.ada_numero || '').trim()}__${(c.contratista || '').trim()}`;
      if (!map[k]) map[k] = [];
      map[k].push(c);
    });
    return map;
  }, [certificadosAbono]);

  const rows = useMemo(() => {
    const now = new Date();
    return (abonos || []).map((a) => {
      const montoMensual = Number(a.monto_mensual) || 0;
      const duracion = Number(a.duracion_meses) || 0;
      const emitidos = Number(a.certificados_emitidos) || 0;
      const transcurridos = a.fecha_inicio_validez ? mesesTranscurridos(a.fecha_inicio_validez) : 0;
      const mesesFaltan = a.fecha_fin_validez ? Math.max(0, mesesEntre(formatYM(now), a.fecha_fin_validez)) : 0;
      const montoPendiente = montoMensual * mesesFaltan;
      return { a, montoMensual, duracion, emitidos, transcurridos, mesesFaltan, montoPendiente };
    }).sort((a, b) => b.montoPendiente - a.montoPendiente);
  }, [abonos]);

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/30">
        <p className="text-sm font-semibold text-foreground">Contratos de Abono</p>
        <p className="text-xs text-muted-foreground">{rows.length} contratos · clic en una fila para ver certificados mensuales</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Contratista</TableHead>
              <TableHead className="hidden md:table-cell">Comuna</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead className="text-right">Mensual</TableHead>
              <TableHead className="text-center">Progreso</TableHead>
              <TableHead className="hidden lg:table-cell text-center">Vigencia</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">No hay contratos de abono</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const key = `${(r.a.ada_numero || '').trim()}__${(r.a.contratista || '').trim()}`;
              const certs = certsPorAbono[key] || [];
              const isOpen = expanded === r.a.id;
              const pctDuracion = r.duracion > 0 ? Math.min(100, Math.round((r.emitidos / r.duracion) * 100)) : 0;
              return (
                <React.Fragment key={r.a.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/20"
                    onClick={() => setExpanded(isOpen ? null : r.a.id)}
                  >
                    <TableCell className="w-8">
                      {certs.length > 0 && (isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />)}
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[220px] truncate" title={r.a.contratista}>{r.a.contratista || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{r.a.comuna || '—'}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmt(r.a.monto_total_contrato)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmt(r.montoMensual)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="h-1.5 w-14 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pctDuracion}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{r.emitidos}/{r.duracion}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center text-[11px] text-muted-foreground">
                      {r.a.fecha_inicio_validez ? `${r.a.fecha_inicio_validez.slice(0,7)} → ${r.a.fecha_fin_validez ? r.a.fecha_fin_validez.slice(0,7) : '—'}` : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ESTADO_CLS[r.a.estado] || 'bg-muted/30 text-muted-foreground'}`}>{r.a.estado}</span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm tabular-nums text-amber-400">{fmt(r.montoPendiente)}</TableCell>
                  </TableRow>
                  {isOpen && certs.length > 0 && (
                    <TableRow className="bg-muted/10">
                      <TableCell colSpan={9} className="py-3 px-8">
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Certificados mensuales generados ({certs.length})</p>
                          {certs.sort((a, b) => (a.mes_periodo || '').localeCompare(b.mes_periodo || '')).map((c) => (
                            <div key={c.id} className="flex items-center justify-between text-xs py-1">
                              <span className="text-muted-foreground">{c.mes_periodo || '—'} · N°{c.numero || '—'}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">Bruto: {fmt(c.subtotal)}</span>
                                <span className="font-bold text-foreground tabular-nums">Neto: {fmt(netoCertificado(c))}</span>
                                <Badge variant="secondary" className="text-[9px] px-1 py-0">{c.estado}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatYM(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}