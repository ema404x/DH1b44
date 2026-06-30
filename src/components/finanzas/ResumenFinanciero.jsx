import React from 'react';
import { Building2, FileCheck, Clock, RefreshCw } from 'lucide-react';
import { KpiCard } from '@/components/reportes/shared';

export default function ResumenFinanciero({ obras, certificados, abonos, projects }) {
  // ── KPIs alineados al flujo real de la empresa ──────────────────────────
  // 1. Cartera de Obras: monto total de contratos de obra
  const carteraObras = obras.reduce((s, o) => s + (o.monto_contrato || 0), 0);

  // 2. Certificado Emitido: subtotal de certificados en estado emitido o aprobado
  const certEmitidos = certificados.filter(c => c.estado === 'emitido' || c.estado === 'aprobado');
  const montoCertificado = certEmitidos.reduce((s, c) => s + (c.subtotal || 0), 0);

  // 3. Por Certificar: obras con estado_cobro = listo_certificar (pipeline inmediato)
  const porCertificar = obras
    .filter(o => o.estado_cobro === 'listo_certificar')
    .reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);

  // 4. Abonos Mensuales: recurrente mensual de contratos de abono activos
  const abonosActivos = abonos.filter(a => a.estado === 'activo');
  const montoMensualAbonos = abonosActivos.reduce((s, a) => s + (a.monto_mensual || 0), 0);
  const carteraAbonos = abonosActivos.reduce((s, a) => s + (a.monto_total_contrato || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Cartera de Obras"
        value={fmtCompact(carteraObras)}
        sub={`${obras.length} contratos · ${fmtCompact(carteraAbonos)} en abonos`}
        icon={Building2}
        accent="primary"
      />
      <KpiCard
        label="Certificado Emitido"
        value={fmtCompact(montoCertificado)}
        sub={`${certEmitidos.length} certificados`}
        icon={FileCheck}
        accent="blue"
      />
      <KpiCard
        label="Por Certificar"
        value={fmtCompact(porCertificar)}
        sub="Obras listas para certificar"
        icon={Clock}
        accent="emerald"
      />
      <KpiCard
        label="Abonos Mensuales"
        value={fmtCompact(montoMensualAbonos)}
        sub={`${abonosActivos.length} contratos activos`}
        icon={RefreshCw}
        accent="amber"
      />
    </div>
  );
}

function fmtCompact(n) {
  const v = n || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}K`;
  return `$${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}