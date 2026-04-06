import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CertificadosAutomatizados() {
  const [filtroProveedor, setFiltroProveedor] = useState('');

  const { data: certificados = [], isLoading, refetch } = useQuery({
    queryKey: ['certificados-automatizados'],
    queryFn: async () => {
      const certs = await base44.entities.Certificado.filter({ 
        generado_automaticamente: true 
      }, '-created_date');
      return certs;
    }
  });

  const ejecutarMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('generateMonthlyCertificates', {});
    },
    onSuccess: () => {
      refetch();
    }
  });

  const filtrados = certificados.filter(c => 
    !filtroProveedor || c.contratista.toLowerCase().includes(filtroProveedor.toLowerCase())
  );

  const agrupadosPorProveedor = filtrados.reduce((acc, cert) => {
    if (!acc[cert.contratista]) {
      acc[cert.contratista] = [];
    }
    acc[cert.contratista].push(cert);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Certificados Generados Automáticamente</h2>
          <p className="text-sm text-muted-foreground mt-1">Última ejecución: mes anterior, último día hábil</p>
        </div>
        <Button 
          onClick={() => ejecutarMutation.mutate()}
          disabled={ejecutarMutation.isPending}
          className="gap-2"
        >
          {ejecutarMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {ejecutarMutation.isPending ? 'Generando...' : 'Generar Ahora'}
        </Button>
      </div>

      {/* Filtro */}
      <Card className="p-4">
        <input
          type="text"
          placeholder="Filtrar por proveedor..."
          value={filtroProveedor}
          onChange={(e) => setFiltroProveedor(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm"
        />
      </Card>

      {/* Listado por proveedor */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando certificados...</div>
      ) : Object.keys(agrupadosPorProveedor).length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No hay certificados generados automáticamente</p>
        </Card>
      ) : (
        Object.entries(agrupadosPorProveedor).map(([proveedor, certs]) => (
          <Card key={proveedor} className="p-6">
            <h3 className="text-lg font-semibold mb-4">{proveedor}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {certs.map((cert) => (
                <Card key={cert.id} className="p-4 bg-muted/50 border">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold">Cert. #{cert.numero}</p>
                      <p className="text-xs text-muted-foreground">{cert.mes_periodo}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {cert.estado}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs mb-4">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      Generado: {format(new Date(cert.created_date), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>

                  {cert.pdf_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => window.open(cert.pdf_url, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                      Descargar PDF
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}