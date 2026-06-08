import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CertificacionesVinculadas from '@/components/finanzas/CertificacionesVinculadas';
import ReporteMensualComparativo from '@/components/reportes/ReporteMensualComparativo';
import GastoMensualAbonosMensuales from '@/components/reportes/GastoMensualAbonosMensuales';

function ReporteSection({ title, description, color = 'blue', children }) {
  return (
    <div className="space-y-4">
      <Card className={`border-border/30 bg-gradient-to-r from-${color}-500/5 to-transparent p-4`}>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </Card>
      {children}
    </div>
  );
}

export default function ReportesFacturacion() {
  return (
    <div className="space-y-10">
      <ReporteSection
        title="Gasto Mensual — Abonos Mensuales"
        description="Análisis de gastos en certificados de abonos mensuales"
        color="blue"
      >
        <GastoMensualAbonosMensuales />
      </ReporteSection>

      <div className="border-t border-border/30 pt-8">
        <ReporteSection
          title="Certificación por Mantenimiento"
          description="Dinero que sale de la empresa — Pagos a proveedores"
          color="purple"
        >
          <ReporteMensualComparativo />
        </ReporteSection>
      </div>

      <div className="border-t border-border/30 pt-8">
        <ReporteSection
          title="Obra / Proyecto"
          description="Dinero que entra a la empresa — Certificaciones de obras"
          color="teal"
        >
          <CertificacionesVinculadas />
        </ReporteSection>
      </div>
    </div>
  );
}