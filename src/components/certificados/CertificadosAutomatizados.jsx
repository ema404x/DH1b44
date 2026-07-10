import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertCircle, CheckCircle2, Loader2, Calendar, Zap, SkipForward, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

// Calcula el próximo último día hábil
function getNextLastBizDay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const feriados = [
    [1,1],[3,24],[4,2],[5,1],[5,25],[6,20],[7,9],[8,17],[10,12],[11,20],[12,8],[12,25]
  ];
  const isHoliday = (d) => feriados.some(([m,day]) => m === d.getMonth()+1 && day === d.getDate());
  const isBizDay = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !isHoliday(d);

  const lastDay = new Date(year, month, 0);
  let d = new Date(lastDay);
  while (!isBizDay(d)) d.setDate(d.getDate() - 1);
  return d;
}

export default function CertificadosAutomatizados() {
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [resultMessage, setResultMessage] = useState(null);
  const queryClient = useQueryClient();

  const nextBizDay = useMemo(() => getNextLastBizDay(), []);
  const isToday = useMemo(() => {
    const today = new Date();
    return today.getDate() === nextBizDay.getDate() && today.getMonth() === nextBizDay.getMonth();
  }, [nextBizDay]);

  // Próximo mes a emitir
  const now = new Date();
  let nextCertYear = now.getFullYear();
  let nextCertMonth = now.getMonth() + 2; // mes siguiente
  if (nextCertMonth > 12) { nextCertMonth = 1; nextCertYear++; }
  const proximoMes = `${nextCertYear}-${String(nextCertMonth).padStart(2, '0')}`;

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ['certificados-automatizados'],
    queryFn: () => base44.entities.Certificado.filter({ generado_automaticamente: true }, '-created_date'),
  });

  const ejecutarMutation = useMutation({
    mutationFn: (forceRun) => base44.functions.invoke('generateMonthlyCertificates', { forceRun }),
    onSuccess: (res) => {
      setResultMessage(res.data?.message || 'Proceso completado');
      queryClient.invalidateQueries({ queryKey: ['certificados-automatizados'] });
    },
    onError: (err) => {
      setResultMessage(null);
      toast.error('Error al ejecutar: ' + (err?.response?.data?.error || err?.message || 'Error desconocido'));
    }
  });

  const filtrados = certificados.filter(c =>
    !filtroProveedor || c.contratista?.toLowerCase().includes(filtroProveedor.toLowerCase())
  );

  const agrupadosPorMes = filtrados.reduce((acc, cert) => {
    const key = cert.mes_periodo || 'Sin período';
    if (!acc[key]) acc[key] = [];
    acc[key].push(cert);
    return acc;
  }, {});

  const mesesOrdenados = Object.keys(agrupadosPorMes).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Header con info de próxima emisión */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Próxima emisión automática</p>
              <p className="font-bold text-sm mt-1">{format(nextBizDay, "d 'de' MMMM yyyy", { locale: es })}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Emitirá certificados para <strong>{proximoMes}</strong></p>
            </div>
          </div>
          {isToday && (
            <Badge className="mt-2 bg-green-100 text-green-700 border-green-200 text-xs">¡Hoy es el día!</Badge>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total emitidos</p>
              <p className="font-bold text-2xl mt-1">{certificados.length}</p>
              <p className="text-xs text-muted-foreground">certificados automáticos históricos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Acciones</p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => ejecutarMutation.mutate(false)}
                  disabled={ejecutarMutation.isPending}
                  className="gap-1.5 text-xs"
                >
                  {ejecutarMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Ejecutar (día hábil)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => ejecutarMutation.mutate(true)}
                  disabled={ejecutarMutation.isPending}
                  className="gap-1.5 text-xs"
                >
                  <SkipForward className="h-3 w-3" />
                  Forzar ahora
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {resultMessage && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <p className="text-sm text-green-700">{resultMessage}</p>
            <button className="ml-auto text-green-600 hover:text-green-700 text-xs" onClick={() => setResultMessage(null)}>✕</button>
          </div>
        </Card>
      )}

      {/* Filtro */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Filtrar por contratista..."
          value={filtroProveedor}
          onChange={(e) => setFiltroProveedor(e.target.value)}
          className="flex-1 px-3 py-2 border border-input rounded-lg text-sm bg-background"
        />
      </div>

      {/* Listado agrupado por mes */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando certificados...</div>
      ) : mesesOrdenados.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No hay certificados generados automáticamente</p>
          <p className="text-xs text-muted-foreground mt-1">Se emiten automáticamente el último día hábil de cada mes</p>
        </Card>
      ) : (
        mesesOrdenados.map((mes) => {
          const certs = agrupadosPorMes[mes];
          const totalMes = certs.reduce((acc, c) => acc + (c.subtotal || 0), 0);

          return (
            <Card key={mes} className="overflow-hidden">
              <div className="px-5 py-3 bg-muted/30 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{mes}</h3>
                  <Badge variant="secondary" className="text-xs">{certs.length} certificados</Badge>
                </div>
                {totalMes > 0 && <span className="text-sm font-medium text-primary">{fmt(totalMes)}</span>}
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {certs.map((cert) => (
                  <div key={cert.id} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm">{cert.contratista}</p>
                        <p className="text-xs text-muted-foreground">Cert. #{cert.numero}</p>
                      </div>
                      <Badge
                        className={`text-xs border ${
                          cert.estado === 'aprobado' ? 'bg-green-50 text-green-700 border-green-200' :
                          cert.estado === 'emitido' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {cert.estado}
                      </Badge>
                    </div>

                    {cert.subtotal > 0 && (
                      <p className="text-sm font-medium text-primary mb-2">{fmt(cert.subtotal)}</p>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {format(new Date(cert.created_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </div>

                    {cert.pdf_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs h-7"
                        onClick={() => window.open(cert.pdf_url, '_blank')}
                      >
                        <Download className="h-3 w-3" />
                        Descargar PDF
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center">Sin PDF adjunto</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}