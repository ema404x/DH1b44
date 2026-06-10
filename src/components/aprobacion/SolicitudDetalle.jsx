import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, MessageSquare, Paperclip, TrendingUp, DollarSign, Calendar, User, Building2, CheckSquare, ArrowLeft, Clock, FileText, ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import FirmaGerenteModal from '@/components/aprobacion/FirmaGerenteModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';

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
  const [aprobando, setAprobando] = useState(false);
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Cargar el certificado vinculado si existe
  const { data: certificado } = useQuery({
    queryKey: ['certificado-sol', solicitud.certificado_id],
    queryFn: () => base44.entities.Certificado.filter({ id: solicitud.certificado_id }),
    enabled: !!solicitud.certificado_id,
    select: (data) => data?.[0] || null,
  });

  const handleTogglePdf = async () => {
    if (showPdf) { setShowPdf(false); return; }

    // Si ya hay un pdf_url guardado, usarlo directo
    if (certificado?.pdf_url && !pdfBlobUrl) {
      setPdfBlobUrl(certificado.pdf_url);
      setShowPdf(true);
      return;
    }

    // Si ya generamos el blob, solo mostrar
    if (pdfBlobUrl) { setShowPdf(true); return; }

    if (!certificado) return;
    setGenerandoPdf(true);

    // Importar dinámicamente
    const [{ exportCertificadoPDF: exportFn }, jsPDFModule] = await Promise.all([
      import('@/utils/exportCertificadoPDF'),
      import('jspdf'),
    ]);
    const jsPDFClass = jsPDFModule.default;

    // Monkey-patch save para capturar el blob en lugar de descargar
    const origSave = jsPDFClass.prototype.save;
    jsPDFClass.prototype.save = function() {
      const blob = this.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setShowPdf(true);
      setGenerandoPdf(false);
    };
    await exportFn(certificado);
    jsPDFClass.prototype.save = origSave;
  };

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.SolicitudCertificado.update(solicitud.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes-cert'] });
      toast.success('Solicitud actualizada');
      onSaved();
    }
  });

  const { displayName } = useCurrentUser();

  const handleMarcarRevision = () => {
    if (solicitud.estado !== 'enviada') return;
    updateMutation.mutate({
      estado: 'en_revision',
      historial: [
        ...(solicitud.historial || []),
        { fecha: new Date().toISOString(), estado: 'en_revision', usuario: displayName, comentario: 'Tomada para revisión' }
      ]
    });
  };

  const puedeAprobar = user?.email?.toLowerCase() === 'rgarciamejores@gmail.com';

  // Para certificados de obra, verificar que el jefe ya firmó
  const esCertificadoObra = certificado?.tipo === 'obra';
  const jefeFirmo = !!certificado?.firma_jefe_sitio_url;
  const bloqueadoPorFirmaJefe = esCertificadoObra && !jefeFirmo;

  const handleAprobar = () => {
    if (!puedeAprobar) { toast.error('Solo Raúl García puede aprobar certificados'); return; }
    if (bloqueadoPorFirmaJefe) {
      toast.error('El jefe de sitio debe firmar el certificado primero antes de que pueda aprobarse');
      return;
    }
    setShowFirmaModal(true);
  };

  const confirmarAprobacion = async (firmaUrl, nombreGerente) => {
    setShowFirmaModal(false);
    setAprobando(true);
    const payload = {
      aprobado_por: nombreGerente,
      aprobado_por_email: user?.email,
      fecha_aprobacion: new Date().toISOString(),
      firma_gerente_url: firmaUrl,
      comentarios_admin: comentario,
      estado: 'aprobada',
      historial: [
        ...(solicitud.historial || []),
        { fecha: new Date().toISOString(), estado: 'aprobada', usuario: nombreGerente, comentario: comentario || 'Aprobado' }
      ]
    };
    updateMutation.mutate(payload);
    if (solicitud.certificado_id) {
      await base44.entities.Certificado.update(solicitud.certificado_id, {
        estado: 'aprobado',
        firma_gerente_url: firmaUrl,
        aprobado_por: nombreGerente,
        fecha_aprobacion: new Date().toISOString(),
      });
    }
    setAprobando(false);
  };

  const handleRechazar = () => {
    if (!motivo.trim()) { toast.error('Ingresá el motivo de rechazo'); return; }
    const nombreGerente = displayName;
    updateMutation.mutate({
      aprobado_por: nombreGerente,
      aprobado_por_email: user?.email,
      fecha_aprobacion: new Date().toISOString(),
      estado: 'rechazada',
      motivo_rechazo: motivo,
      historial: [
        ...(solicitud.historial || []),
        { fecha: new Date().toISOString(), estado: 'rechazada', usuario: nombreGerente, comentario: motivo }
      ]
    });
    if (solicitud.certificado_id) {
      base44.entities.Certificado.update(solicitud.certificado_id, { estado: 'borrador' });
    }
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

      {/* Certificado vinculado */}
      {solicitud.certificado_id && (
        <Card className="border-blue-200 bg-blue-50/20 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Certificado vinculado</p>
                  <p className="text-xs text-muted-foreground">
                    {certificado
                      ? `N° ${certificado.numero} · ${certificado.contratista || ''}`
                      : 'Cargando...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pdfBlobUrl && (
                  <a href={pdfBlobUrl} download={`Certificado_${certificado?.numero || ''}.pdf`}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 flex-shrink-0"
                  onClick={handleTogglePdf}
                  disabled={!certificado || generandoPdf}
                >
                  {generandoPdf
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</>
                    : showPdf
                      ? <><ChevronUp className="h-3.5 w-3.5" /> Ocultar PDF</>
                      : <><ChevronDown className="h-3.5 w-3.5" /> Ver PDF</>
                  }
                </Button>
              </div>
            </div>

            {/* Vista inline del PDF */}
            {showPdf && pdfBlobUrl && (
              <div className="mt-4 rounded-md overflow-hidden border border-border">
                <iframe
                  src={pdfBlobUrl}
                  className="w-full"
                  style={{ height: '600px' }}
                  title="Certificado PDF"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
      {solicitud.estado === 'aprobada' && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-emerald-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado por {solicitud.aprobado_por}
            </p>
            <div className="flex items-center gap-4">
              {solicitud.firma_gerente_url && (
                <img src={solicitud.firma_gerente_url} alt="Firma del gerente" className="h-16 object-contain border rounded bg-white p-1" />
              )}
              <div className="text-xs text-muted-foreground">
                <p className="font-bold text-foreground">{solicitud.aprobado_por}</p>
                <p>Gerente — Mejores Hospitales S.A.</p>
              </div>
            </div>
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

      {/* Estado de firma del jefe de sitio (solo para obra) */}
      {esCertificadoObra && (
        <Card className={jefeFirmo ? 'border-emerald-200 bg-emerald-50/20' : 'border-amber-200 bg-amber-50/20'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${jefeFirmo ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  {jefeFirmo
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    : <Clock className="h-4 w-4 text-amber-600" />
                  }
                </div>
                <div>
                  <p className={`text-sm font-semibold ${jefeFirmo ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {jefeFirmo ? 'Paso 1: Jefe de sitio firmó ✓' : 'Paso 1: Esperando firma del jefe de sitio'}
                  </p>
                  {jefeFirmo && certificado.firmado_por_jefe && (
                    <p className="text-xs text-muted-foreground">{certificado.firmado_por_jefe}</p>
                  )}
                  {!jefeFirmo && (
                    <p className="text-xs text-amber-600">El certificado debe ser firmado por el jefe antes de poder ser aprobado</p>
                  )}
                </div>
              </div>
              {jefeFirmo && certificado.firma_jefe_sitio_url && (
                <img src={certificado.firma_jefe_sitio_url} alt="Firma jefe" className="h-12 object-contain border rounded bg-white p-1 flex-shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Panel admin para revisar */}
      {isAdmin && (solicitud.estado === 'enviada' || solicitud.estado === 'en_revision') && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              {esCertificadoObra ? 'Paso 2: Aprobación gerencial' : 'Revisión y aprobación'}
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
                onClick={handleRechazar}
                disabled={updateMutation.isPending}
              >
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                onClick={handleAprobar}
                disabled={updateMutation.isPending || aprobando || !puedeAprobar || bloqueadoPorFirmaJefe}
                title={
                  !puedeAprobar ? 'Solo Raúl García puede aprobar' :
                  bloqueadoPorFirmaJefe ? 'El jefe de sitio debe firmar primero' : ''
                }
              >
                <CheckSquare className="h-4 w-4" />
                {bloqueadoPorFirmaJefe ? 'Esperando firma jefe' : 'Aprobar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de firma para aprobación */}
      <FirmaGerenteModal
        open={showFirmaModal}
        onClose={() => setShowFirmaModal(false)}
        onFirmada={confirmarAprobacion}
        user={user}
      />

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


    </div>
  );
}