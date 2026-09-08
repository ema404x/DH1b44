import React, { useMemo } from 'react';
import AbonosMensualesChart from '@/components/finanzas/AbonosMensualesChart';
import AbonosProyeccion from '@/components/finanzas/AbonosProyeccion';
import AbonosContratosTable from '@/components/finanzas/AbonosContratosTable';

// Orquestador del tab "Abonos" del Centro Financiero.
// Separa los certificados de abono_mensual de los de obra/informe para
// que las métricas no mezclen ingresos recurrentes con obras.
export default function AbonosFinancieros({ abonos, certificados }) {
  const { certificadosAbono, certificadosObra } = useMemo(() => {
    const abono = [];
    const obra = [];
    (certificados || []).forEach((c) => {
      if (c.tipo === 'abono_mensual') abono.push(c);
      else obra.push(c);
    });
    return { certificadosAbono: abono, certificadosObra: obra };
  }, [certificados]);

  return (
    <div className="space-y-6">
      <AbonosMensualesChart certificadosAbono={certificadosAbono} certificadosObra={certificadosObra} />
      <AbonosProyeccion abonos={abonos} />
      <AbonosContratosTable abonos={abonos} certificadosAbono={certificadosAbono} />
    </div>
  );
}