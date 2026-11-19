import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, MapPinned, Move, CheckCircle2, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RevisionMiniMapa from './RevisionMiniMapa';
import CoordenadasManual from './CoordenadasManual';
import { revisarUbicaciones, errorTexto, ESTADOS, metros, coordTexto, REVISADA_CLS, ultimaAccion } from './api';

const ETIQUETA = { LocationData: 'Colegio (mapa)', LocationQR: 'Punto de fichaje' };

export default function RevisionDetalle({ item, onHecho, onCerrar }) {
  const [manual, setManual] = useState(null);
  const [foco, setFoco] = useState(null);
  const accion = useMutation({
    mutationFn: (p) => revisarUbicaciones(p.action, { clave: item.clave, ...p }),
    onSuccess: (_, p) => { toast.success(p.action === 'ok' ? 'Marcada como revisada' : 'Ubicación actualizada'); onHecho(); },
    onError: (e) => toast.error(errorTexto(e)),
  });
  const actuales = item.targets.filter((t) => t.tieneCoords).map((t) => ({ key: t.id, lat: t.lat, lng: t.lng, label: `${ETIQUETA[t.entidad]}: actual` }));
  const ocupado = accion.isPending;
  const empezarManual = () => setManual(item.actual || item.sugerida || { lat: -34.6037, lng: -58.3816 });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{item.nombre}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{item.direccion}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className={`inline-block text-[11px] px-2 py-0.5 rounded-md border ${ESTADOS[item.estado].cls}`}>{ESTADOS[item.estado].label}</span>
            {item.revisada && <span className={`inline-block text-[11px] px-2 py-0.5 rounded-md border ${REVISADA_CLS}`}>Revisada</span>}
          </div>
          {item.revision && <p className="text-[11px] text-muted-foreground mt-1">Última acción: {ultimaAccion(item.revision)}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
      </div>

      <RevisionMiniMapa actuales={actuales} sugerida={item.sugerida} manual={manual} foco={foco} onManualMove={(ll) => setManual({ lat: ll.lat, lng: ll.lng })} />
      {manual && <CoordenadasManual manual={manual} onCambio={(ll) => { setManual(ll); setFoco(ll); }} />}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sugerida</span>
        {manual && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Nueva (arrastrá o tocá el mapa)</span>}
      </div>

      <div className="space-y-1.5 text-xs">
        {item.targets.map((t) => (
          <div key={t.id} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{ETIQUETA[t.entidad]}{t.entidad === 'LocationQR' && t.nombre ? ` · ${t.nombre}` : ''}</span>
            <span className="tabular-nums text-right">{coordTexto(t.lat, t.lng)}{t.distancia != null && ` · ${metros(t.distancia)}`}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Sugerida</span>
          <span className="tabular-nums text-right">{item.sugerida ? coordTexto(item.sugerida.lat, item.sugerida.lng) : '—'}</span>
        </div>
      </div>

      {item.usaFichaje && (
        <p className="flex gap-2 text-xs rounded-lg bg-primary/10 text-primary px-3 py-2">
          <Info className="h-4 w-4 shrink-0" /> Cambiar esta ubicación también mueve el punto de fichaje (radio de 350 m).
        </p>
      )}

      {manual ? (
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" disabled={ocupado} onClick={() => accion.mutate({ action: 'aplicar', modo: 'manual', lat: manual.lat, lng: manual.lng })}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar esta ubicación
          </Button>
          <Button variant="outline" disabled={ocupado} onClick={() => setManual(null)}>Cancelar</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" disabled={ocupado || !item.sugerida} onClick={() => accion.mutate({ action: 'aplicar', modo: 'sugerida' })}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />} Usar la ubicación sugerida
          </Button>
          <Button variant="outline" className="gap-2" disabled={ocupado} onClick={empezarManual}><Move className="h-4 w-4" /> Ajustar a mano</Button>
          <Button variant="outline" className="gap-2" disabled={ocupado} onClick={() => accion.mutate({ action: 'ok' })}><CheckCircle2 className="h-4 w-4" /> Está bien así</Button>
        </div>
      )}
    </div>
  );
}