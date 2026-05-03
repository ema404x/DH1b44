import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, MessageSquare, Paperclip, TrendingUp, DollarSign, Calendar, User, Building2, PenTool, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import FirmaGerenteModal from './FirmaGerenteModal';

const estadoConfig = {
  borrador:    { label: 'Borrador',     color: 'bg-slate-100 text-slate-600 border-slate-300' },
  enviada:     { label: 'Enviada',      color: 'bg-blue-100 text-blue-700 border-blue-300' },
  en_revision: { label: 'En revisión',  color: 'bg-amber-100 text-amber-700 border-amber-300' },
  aprobada:    { label: 'Aprobada',     color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  rechazada:   { label: 'Rechazada',    color: 'bg-red-100 text-red-700 border-red-300' },
};

export default function SolicitudDetalle({ solicitud, isAdmin, user, onClose, onSaved }) {
  const qc = useQueryClient();
  const [comentario, setComentario] = useState(solicitud.comentarios_admin || '');
  const [motivo, setMotivo] = useState('');
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState(null); // 'aprobar' | 'rechazar'

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.SolicitudCertificado.update(solicitud.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes-cert'] });
      toast.success('Solicitud actualizada');
      onSaved();
    }
  });

  const handleMarcarRevision = () => {
    if (solicitud.estado !== 'enviada') return;
    updateMutation.mutate({
      estado: 'en_revision',
      historial: [
        ...(solicitud.historial || []),
        { fecha: new Date().toISOString(), estado: 'en_revision', usuario: user?.full_name || user?.email, comentario: 'Tomada para revisión' }
      ]
    });
  };

  const handleIniciarAprobacion = () => {
    setAccionPendiente('aprobar');
    setFirmaOpen(true);
  };

  const handleIniciarRechazo = () => {
    if (!motivo.trim()) { toast.error('Ingresá el motivo de rechazo'); return; }
    setAccionPendiente('rechazar');
    setFirmaOpen(true);
  };

  const handleFirmada = async (firmaUrl, nombreGerente) => {
    setFirmaOpen(false);
    const base = {
      aprobado_por: nombreGerente,
      aprobado_por_email: user?.email,
      fecha_aprobacion: new Date().toISOString(),
      firma_gerente_url: firmaUrl,
      comentarios_admin: comentario,
    };

    if (accionPendiente === 'aprobar') {
      updateMutation.mutate({
        ...base,
        estado: 'aprobada',
        historial: [
          ...(solicitud.historial || []),
          { fecha: new Date().toISOString(), estado: 'aprobada', usuario: nombreGerente, comentario: comentario || 'Aprobado' }
        ]
      });
    } else if (accionPendiente === 'rechazar') {
      updateMutation.mutate({
        ...base,
        estado: 'rechazada',
        motivo_rechazo: motivo,
        historial: [
          ...(solicitud.historial || []),
          { fecha: new Date().toISOString(), estado: 'rechazada', usuario: nombreGerente, comentario: motivo }
        ]
      });
    }
    setAccionPendiente(null);
  };

  const estado = estadoConfig[solicitud.estado] || estadoConfig.borrador;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onClose} className="mt-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {solicitud.numero && <span className="text-xs font-mono text-muted-foreground">{solicitud.numero}</span>}
            <Badge variant="outline" className={`text-xs border ${estado.color}`}>{estado.label}</Badge>
          </div>
          <h2 className="text-lg font-bold">{solicitud.titulo}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Información</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{solicitud.establecimiento}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{solicitud.jefe_sitio}</span>
            </div>
            {solicitud.periodo && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{solicitud.periodo}</span>
              </div>
            )}
            {solicitud.monto_solicitado > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-semibold">${solicitud.monto_solicitado.toLocaleString('es-AR')}</span>
              </div>
            )}
            {solicitud.porcentaje_avance > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{solicitud.porcentaje_avance}% de avance</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Adjuntos */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5" /> Adjuntos ({solicitud.adjuntos?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {(!solicitud.adjuntos || solicitud.adjuntos.length === 0) ? (
              <p className="text-xs text-muted-foreground">Sin adjuntos</p>
            ) : solicitud.adjuntos.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline truncate">
                <Paperclip className="h-3 w-3 flex-shrink-0" />{a.nombre}
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Descripción */}
      {solicitud.descripcion_trabajo && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Descripción del trabajo</p>
            <p className="text-sm leading-relaxed">{solicitud.descripcion_trabajo}</p>
          </CardContent>
        </Card>
      )}

      {/* Firma aprobada */}
      {solicitud.estado === 'aprobada' && solicitud.firma_gerente_url && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-emerald-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado por {solicitud.aprobado_por}
            </p>
            <img src={solicitud.firma_gerente_url} alt="Firma gerente" className="h-16 object-contain border rounded bg-white p-1" />
            {solicitud.fecha_aprobacion && (
              <p className="text-xs text-muted-foreground">{format(new Date(solicitud.fecha_aprobacion), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
            )}
            {solicitud.comentarios_admin && (
              <p className="text-xs text-emerald-700 italic">"{solicitud.comentarios_admin}"</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rechazo */}
      {solicitud.estado === 'rechazada' && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-red-700 mb-1 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Rechazada por {solicitud.aprobado_por}
            </p>
            {solicitud.motivo_rechazo && <p className="text-sm text-red-700">{solicitud.motivo_rechazo}</p>}
            {solicitud.firma_gerente_url && (
              <img src={solicitud.firma_gerente_url} alt="Firma" className="h-12 object-contain border rounded bg-white p-1 mt-2" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Panel admin para revisar */}
      {isAdmin && (solicitud.estado === 'enviada' || solicitud.estado === 'en_revision') && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-primary" /> Revisión y aprobación
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {solicitud.estado === 'enviada' && (
              <Button variant="outline" size="sm" className="gap-2 w-full" onClick={handleMarcarRevision} disabled={updateMutation.isPending}>
                <Clock className="h-3.5 w-3.5" /> Marcar como "En revisión"
              </Button>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase">Comentarios</label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[70px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Añadí comentarios para el jefe de sitio..."
                value={comentario}
                onChange={e => setComentario(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase">Motivo de rechazo (si aplica)</label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Escribí el motivo antes de rechazar..."
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
              />
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 gap-2"
                onClick={handleIniciarRechazo}
                disabled={updateMutation.isPending}
              >
                <XCircle className="h-4 w-4" /> Rechazar con firma
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleIniciarAprobacion}
                disabled={updateMutation.isPending}
              >
                <PenTool className="h-4 w-4" /> Aprobar con firma
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial */}
      {solicitud.historial?.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Historial</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {[...solicitud.historial].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <div className="mt-1 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <div>
                    <span className="font-medium capitalize">{h.estado?.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground"> · {h.usuario} · {format(new Date(h.fecha), 'dd/MM/yy HH:mm')}</span>
                    {h.comentario && <p className="text-muted-foreground mt-0.5">{h.comentario}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <FirmaGerenteModal
        open={firmaOpen}
        onClose={() => { setFirmaOpen(false); setAccionPendiente(null); }}
        onFirmada={handleFirmada}
        user={user}
      />
    </div>
  );
}