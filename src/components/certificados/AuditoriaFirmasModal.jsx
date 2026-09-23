import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, PenTool, CheckCircle2, XCircle, Clock, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmtFecha = (iso) => {
  if (!iso) return null;
  try {
    return format(new Date(iso), "dd/MM/yyyy 'a las' HH:mm:ss", { locale: es });
  } catch {
    return null;
  }
};

const fmtFechaCorta = (iso) => {
  if (!iso) return null;
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: es });
  } catch {
    return null;
  }
};

export default function AuditoriaFirmasModal({ open, onClose, cert }) {
  if (!cert) return null;

  const cadena = Array.isArray(cert.cadena_firmas) ? cert.cadena_firmas : [];
  const firmaJefe = cert.firma_jefe_sitio_url;
  const firmaGerente = cert.firma_gerente_url;

  // Construir el timeline de eventos en orden cronológico lógico
  const eventos = [];

  // 1. Creación
  eventos.push({
    tipo: 'creacion',
    icon: FileText,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    titulo: 'Certificado creado',
    autor: cert.creado_por_email || 'Usuario del sistema',
    fecha: cert.created_date,
    estado: null,
    detalle: `Certificado N° ${cert.numero || '—'} · ${cert.tipo || ''}`,
  });

  // 2. Cadena de firmas intermedias (en orden)
  cadena.forEach((f, idx) => {
    const estado = f.estado || 'pendiente';
    let icon, color, bg, border, titulo;

    if (estado === 'firmado') {
      icon = PenTool;
      color = 'text-emerald-400';
      bg = 'bg-emerald-500/10';
      border = 'border-emerald-500/30';
      titulo = `Firmado por ${f.firmado_por || f.full_name || 'Firmante'}`;
    } else if (estado === 'rechazado') {
      icon = XCircle;
      color = 'text-red-400';
      bg = 'bg-red-500/10';
      border = 'border-red-500/30';
      titulo = `Rechazado por ${f.full_name || 'Firmante'}`;
    } else {
      icon = Clock;
      color = 'text-amber-400';
      bg = 'bg-amber-500/10';
      border = 'border-amber-500/30';
      titulo = `Pendiente: ${f.full_name || 'Firmante'}`;
    }

    eventos.push({
      tipo: 'firma_intermedia',
      icon,
      color,
      bg,
      border,
      titulo,
      autor: f.email || '',
      fecha: f.fecha_firma,
      estado,
      detalle: `Firmante ${idx + 1} de ${cadena.length} en la cadena`,
      comentario: f.motivo_rechazo || null,
      firmaUrl: f.firma_url || null,
    });
  });

  // 3. Firma del jefe de sitio (solo obra)
  if (cert.tipo === 'obra' && (firmaJefe || cert.firmado_por_jefe)) {
    eventos.push({
      tipo: 'firma_jefe',
      icon: PenTool,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      titulo: `Firmado por ${cert.firmado_por_jefe || 'Jefe de Sitio'}`,
      autor: cert.firmado_por_jefe || '',
      fecha: cert.fecha_firma_jefe,
      estado: 'firmado',
      detalle: 'Jefe de Sitio',
      firmaUrl: firmaJefe,
    });
  }

  // 4. Aprobación del gerente
  if (firmaGerente || cert.aprobado_por) {
    eventos.push({
      tipo: 'aprobacion_gerente',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      titulo: `Aprobado por ${cert.aprobado_por || 'Gerente'}`,
      autor: cert.aprobado_por_email || cert.aprobado_por || '',
      fecha: cert.fecha_aprobacion,
      estado: 'firmado',
      detalle: 'Gerente de Contratos',
      firmaUrl: firmaGerente,
    });
  }

  const estadoLabels = {
    borrador: { label: 'Borrador', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
    pendiente_firmas: { label: 'Pend. Firmas', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    emitido: { label: 'Emitido', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    aprobado: { label: 'Aprobado', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-lg">Auditoría de Firmas</DialogTitle>
            <Badge className={`text-xs border ${estadoLabels[cert.estado]?.cls || ''}`}>
              {estadoLabels[cert.estado]?.label || cert.estado}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Certificado N° {cert.numero || '—'} · {cert.contratista || '—'}
          </p>
        </DialogHeader>

        {/* Timeline */}
        <div className="space-y-0 mt-4">
          {eventos.map((ev, idx) => {
            const Icon = ev.icon;
            const isLast = idx === eventos.length - 1;
            return (
              <div key={idx} className="flex gap-3">
                {/* Línea conectora + ícono */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center border ${ev.bg} ${ev.border}`}>
                    <Icon className={`h-4 w-4 ${ev.color}`} />
                  </div>
                  {!isLast && (
                    <div className="w-px flex-1 bg-border/50 min-h-[24px] my-1" />
                  )}
                </div>

                {/* Contenido del evento */}
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                  <div className="bg-card border border-border/60 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{ev.titulo}</p>
                        {ev.autor && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {ev.autor}
                          </p>
                        )}
                      </div>
                      {ev.estado === 'pendiente' && (
                        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-300 bg-amber-500/10">
                          En espera
                        </Badge>
                      )}
                      {ev.estado === 'firmado' && (
                        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                          Completado
                        </Badge>
                      )}
                      {ev.estado === 'rechazado' && (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-300 bg-red-500/10">
                          Rechazado
                        </Badge>
                      )}
                    </div>

                    {ev.detalle && (
                      <p className="text-xs text-muted-foreground mt-1">{ev.detalle}</p>
                    )}

                    {ev.fecha && (
                      <p className="text-xs font-medium text-foreground/70 mt-1.5 tabular-nums">
                        📅 {fmtFecha(ev.fecha)}
                      </p>
                    )}

                    {/* Comentario de rechazo */}
                    {ev.comentario && (
                      <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-md p-2">
                        <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-300">Motivo de rechazo</p>
                          <p className="text-xs text-red-200/80 mt-0.5">{ev.comentario}</p>
                        </div>
                      </div>
                    )}

                    {/* Miniatura de firma */}
                    {ev.firmaUrl && (
                      <div className="mt-2">
                        <img
                          src={ev.firmaUrl}
                          alt="Firma"
                          className="h-10 object-contain border border-border/40 rounded bg-muted/20 px-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-card border border-border/60 rounded-lg p-3">
              <p className="text-muted-foreground">Total firmantes en cadena</p>
              <p className="font-bold text-base mt-0.5">{cadena.length}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3">
              <p className="text-muted-foreground">Firmas completadas</p>
              <p className="font-bold text-base mt-0.5 text-emerald-400">
                {cadena.filter(f => f.estado === 'firmado').length}
                {firmaJefe && ' + jefe'}
                {firmaGerente && ' + gerente'}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}