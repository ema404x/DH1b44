import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function CertificacionesVinculadas({ projectName, clientName }) {
  const { data: certificaciones = [], isLoading } = useQuery({
    queryKey: ['certificaciones-vinculadas', projectName, clientName],
    queryFn: async () => {
      if (!projectName && !clientName) return [];
      
      // Buscar en ObraCertificacion
      const obras = await base44.entities.ObraCertificacion.list();
      return obras.filter(obra => {
        const matchProject = !projectName || obra.titulo?.toLowerCase().includes(projectName.toLowerCase());
        const matchClient = !clientName || obra.establecimiento?.toLowerCase().includes(clientName.toLowerCase());
        return matchProject || matchClient;
      });
    },
    enabled: !!(projectName || clientName),
  });

  if (!projectName && !clientName) return null;

  const statusConfig = {
    listo_certificar: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
    pendiente: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    observado: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    faltan_actas: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Certificaciones Vinculadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  if (certificaciones.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Certificaciones Vinculadas ({certificaciones.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {certificaciones.map(cert => {
          const config = statusConfig[cert.estado_cobro] || statusConfig.pendiente;
          const Icon = config.icon;
          const avanceColor = cert.porcentaje_avance >= 75 ? 'text-emerald-500' : cert.porcentaje_avance >= 50 ? 'text-blue-500' : 'text-amber-500';

          return (
            <div
              key={cert.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 ${config.bg} transition-colors hover:bg-muted/40`}
            >
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold truncate">{cert.titulo}</p>
                  <Badge variant="outline" className="text-[9px] flex-shrink-0">
                    {cert.oc_numero || 'S/OC'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                  <div>
                    <p className="text-muted-foreground">Período:</p>
                    <p className="font-medium">{cert.periodo || 'No definido'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Jefe Sitio:</p>
                    <p className="font-medium truncate">{cert.jefe_sitio || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 text-[10px]">
                  <div>
                    <span className="text-muted-foreground">Avance:</span>
                    <span className={`ml-1 font-semibold ${avanceColor}`}>{cert.porcentaje_avance || 0}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monto:</span>
                    <span className="ml-1 font-semibold">${(cert.monto_a_cobrar || 0).toLocaleString()}</span>
                  </div>
                  {cert.fecha_fin_estimada && (
                    <div>
                      <span className="text-muted-foreground">Vencimiento:</span>
                      <span className="ml-1 font-medium">{format(new Date(cert.fecha_fin_estimada), 'dd/MM/yy')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}