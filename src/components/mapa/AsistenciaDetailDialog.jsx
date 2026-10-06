import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { LogIn, LogOut, MapPin, Clock, PenLine, CheckCircle2, AlertTriangle, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const ESTADO_ADMIN = {
  pendiente: { label: 'Pendiente', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  revisado: { label: 'Revisado', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  incidencia: { label: 'Incidencia', class: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const DISTANCE_THRESHOLD_M = 150;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function calcDuration(entrada, salida) {
  if (!entrada || !salida) return null;
  const ms = new Date(salida).getTime() - new Date(entrada).getTime();
  if (ms < 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function SignatureBlock({ title, timestamp, signatureUrl, latitude, longitude, icon: Icon, tone, distance }) {
  const tones = {
    in: 'text-emerald-400 bg-emerald-500/10',
    out: 'text-blue-400 bg-blue-500/10',
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold">{title}</span>
        {timestamp && (
          <span className="text-xs text-muted-foreground tabular-nums ml-auto">
            {format(new Date(timestamp), "dd/MM/yyyy 'a las' HH:mm'hs'", { locale: es })}
          </span>
        )}
      </div>
      {signatureUrl ? (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <img src={signatureUrl} alt={`Firma ${title}`} className="w-full max-h-24 object-contain" />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/50 flex items-center justify-center py-6 text-xs text-muted-foreground">
          Sin firma registrada
        </div>
      )}
      {latitude && longitude && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </div>
      )}
      {distance && (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${distance.status === 'far' ? 'text-red-400' : distance.status === 'ok' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
          {distance.status === 'far' && <AlertTriangle className="h-3 w-3" />}
          <span>Distancia al sitio: {distance.text}</span>
        </div>
      )}
    </div>
  );
}

export default function AsistenciaDetailDialog({ fichaje, onClose, locCoords }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [estadoAdmin, setEstadoAdmin] = useState('pendiente');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fichaje) {
      setEstadoAdmin(fichaje.estado_admin || 'pendiente');
      setNotas(fichaje.notas_admin || '');
    }
  }, [fichaje]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.FichajeUbicacion.update(fichaje.id, {
        estado_admin: estadoAdmin,
        notas_admin: notas.trim(),
        revisado_por: user?.full_name || user?.email || 'Sistema',
        fecha_revision: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['fichajes-ubicacion'] });
      toast.success('Estado administrativo actualizado');
      onClose();
    } catch (err) {
      toast.error('No se pudo guardar: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  if (!fichaje) return null;

  const ea = ESTADO_ADMIN[estadoAdmin] || ESTADO_ADMIN.pendiente;
  const duracion = calcDuration(fichaje.entrada_timestamp, fichaje.salida_timestamp);

  const refCoords = locCoords?.lat != null ? locCoords : null;
  const calcDist = (lat, lng) => {
    if (!refCoords || lat == null || lng == null) return null;
    const dist = haversine(refCoords.lat, refCoords.lng, lat, lng);
    if (dist > DISTANCE_THRESHOLD_M) return { status: 'far', text: `${dist}m` };
    return { status: 'ok', text: `${dist}m` };
  };
  const entradaDist = calcDist(fichaje.entrada_latitude, fichaje.entrada_longitude);
  const salidaDist = calcDist(fichaje.salida_latitude, fichaje.salida_longitude);

  return (
    <Dialog open={!!fichaje} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Detalle de Asistencia
          </DialogTitle>
        </DialogHeader>

        {/* Operario info */}
        <div className="flex items-center gap-3 bg-muted/40 border border-border rounded-lg px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {(fichaje.operario_nombre || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{fichaje.operario_nombre || '—'}</p>
            <p className="text-xs text-muted-foreground tabular-nums">DNI: {fichaje.dni || 'Sin DNI'}</p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className={fichaje.estado === 'abierta' ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}>
              {fichaje.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
            </Badge>
          </div>
        </div>

        {/* Ubicación */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{fichaje.location_name || 'Ubicación no registrada'}</span>
        </div>

        {/* Duración */}
        {duracion && (
          <div className="flex items-center justify-between bg-muted/30 border border-border/50 rounded-lg px-4 py-2.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Duración de la jornada
            </span>
            <span className="text-sm font-bold tabular-nums text-primary">{duracion}</span>
          </div>
        )}

        {/* Firmas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <SignatureBlock
            title="Entrada"
            tone="in"
            icon={LogIn}
            timestamp={fichaje.entrada_timestamp}
            signatureUrl={fichaje.entrada_signature_url}
            latitude={fichaje.entrada_latitude}
            longitude={fichaje.entrada_longitude}
            distance={entradaDist}
          />
          <SignatureBlock
            title="Salida"
            tone="out"
            icon={LogOut}
            timestamp={fichaje.salida_timestamp}
            signatureUrl={fichaje.salida_signature_url}
            latitude={fichaje.salida_latitude}
            longitude={fichaje.salida_longitude}
            distance={salidaDist}
          />
        </div>

        {/* Estado administrativo */}
        <div className="space-y-2.5 pt-2 border-t border-border/50">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5" /> Estado administrativo
          </label>
          <div className="flex gap-2">
            {Object.entries(ESTADO_ADMIN).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setEstadoAdmin(key)}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  estadoAdmin === key
                    ? val.class + ' ring-1 ring-ring/30'
                    : 'border-border/50 text-muted-foreground hover:bg-accent/30'
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>

          {estadoAdmin === 'incidencia' && (
            <Textarea
              placeholder="Describí la incidencia..."
              value={notas}
              onChange={e => setNotas(e.target.value)}
              className="text-sm resize-none"
              rows={2}
            />
          )}

          {fichaje.revisado_por && (
            <p className="text-xs text-muted-foreground">
              Última revisión por <strong className="text-foreground">{fichaje.revisado_por}</strong>
              {fichaje.fecha_revision && ` el ${format(new Date(fichaje.fecha_revision), "dd/MM/yyyy 'a las' HH:mm'hs'", { locale: es })}`}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar estado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}