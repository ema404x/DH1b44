import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';

const COLORS = {
  redDark: '#9B1C1C',
  redMain: '#C53030',
  redLight: '#FED7D7',
  grayDark: '#2D3748',
  grayMed: '#718096',
  grayLight: '#EDF2F7',
  white: '#FFFFFF',
};

export default function PlanTrabajosGenerator({ cabecera, items, onBack }) {
  // Generar días dinámicamente
  const dias = useMemo(() => {
    const count = cabecera.plazo_dias || 30;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [cabecera.plazo_dias]);

  // Agrupar items por rubro/orden de tareas (simulado)
  const rubrosAgrupados = useMemo(() => {
    const grupos = {};
    items.forEach((item) => {
      const rubro = item.orden_tareas || 'Sin Clasificar';
      if (!grupos[rubro]) grupos[rubro] = [];
      grupos[rubro].push(item);
    });
    return grupos;
  }, [items]);

  const handleExportPDF = () => {
    alert('Función de exportación a PDF en desarrollo');
  };

  return (
    <div className="w-full space-y-4 p-4 rounded-lg" style={{ background: COLORS.grayLight }}>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold hover:opacity-80"
          style={{ color: COLORS.redDark }}
        >
          <ArrowLeft className="h-4 w-4" /> Volver a PCP
        </button>
        <h2 className="text-xl font-bold" style={{ color: COLORS.redDark }}>
          PLAN DE TRABAJOS
        </h2>
        <Button
          onClick={handleExportPDF}
          size="sm"
          style={{ background: COLORS.redMain, color: COLORS.white }}
        >
          <Download className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {/* CABECERA HEREDADA */}
      <div className="rounded-lg border-2 p-3 bg-white" style={{ borderColor: COLORS.redDark }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="font-semibold text-gray-600">COMITENTE:</span> {cabecera.cliente_nombre}
          </div>
          <div>
            <span className="font-semibold text-gray-600">OBRA:</span> {cabecera.titulo}
          </div>
          <div>
            <span className="font-semibold text-gray-600">PLAZO:</span> {cabecera.plazo_dias} días
          </div>
          <div>
            <span className="font-semibold text-gray-600">PRESUPUESTO:</span> {cabecera.codigo}
          </div>
        </div>
      </div>

      {/* TABLA PLAN DE TRABAJOS */}
      <div className="rounded-lg overflow-x-auto border-2" style={{ borderColor: COLORS.redDark }}>
        <table className="w-full text-xs border-collapse">
          {/* HEADER */}
          <thead>
            <tr style={{ background: COLORS.redDark }}>
              <th style={{ width: 200, padding: '8px 4px', color: COLORS.white, textAlign: 'left', borderRight: `1px solid ${COLORS.redLight}` }}>
                RUBRO / TAREA
              </th>
              <th style={{ width: 150, padding: '8px 4px', color: COLORS.white, textAlign: 'left', borderRight: `1px solid ${COLORS.redLight}` }}>
                UBICACIÓN - ZONA
              </th>
              {dias.map((day) => (
                <th
                  key={day}
                  style={{
                    width: 40,
                    padding: '8px 2px',
                    color: COLORS.white,
                    textAlign: 'center',
                    borderRight: `1px solid ${COLORS.redLight}`,
                    minWidth: 40,
                  }}
                >
                  D{day}
                </th>
              ))}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {Object.entries(rubrosAgrupados).map(([rubro, tareas], rubIdx) => (
              <React.Fragment key={rubro}>
                {/* FILA DE RUBRO */}
                <tr style={{ background: COLORS.redLight }}>
                  <td
                    colSpan={2}
                    style={{
                      padding: '8px 4px',
                      fontWeight: 'bold',
                      color: COLORS.redDark,
                      borderRight: `1px solid ${COLORS.redLight}`,
                    }}
                  >
                    {rubro.toUpperCase()}
                  </td>
                  {dias.map((day) => (
                    <td
                      key={`rubro-${day}`}
                      style={{
                        padding: '4px 2px',
                        textAlign: 'center',
                        borderRight: `1px solid ${COLORS.redLight}`,
                        background: COLORS.redLight,
                      }}
                    />
                  ))}
                </tr>

                {/* FILAS DE TAREAS */}
                {tareas.map((tarea, tareaIdx) => (
                  <tr key={tarea.id || tareaIdx} style={{ background: tareaIdx % 2 === 0 ? COLORS.white : COLORS.grayLight }}>
                    <td style={{ padding: '6px 4px', fontSize: '11px', borderRight: `1px solid ${COLORS.grayLight}` }}>
                      {tarea.descripcion}
                    </td>
                    <td style={{ padding: '6px 4px', fontSize: '11px', borderRight: `1px solid ${COLORS.grayLight}` }}>
                      {tarea.ubicacion || '—'}
                    </td>
                    {dias.map((day) => (
                      <td
                        key={`tarea-${day}`}
                        style={{
                          width: 40,
                          padding: '4px 2px',
                          textAlign: 'center',
                          borderRight: `1px solid ${COLORS.grayLight}`,
                          background: tareaIdx % 2 === 0 ? COLORS.white : COLORS.grayLight,
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title={`${tarea.descripcion} - Día ${day}`}
                      >
                        {/* Célula editable para marcar avance */}
                        <input
                          type="checkbox"
                          defaultChecked={false}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* LEYENDA */}
      <div className="rounded-lg p-3 bg-white border-2" style={{ borderColor: COLORS.grayLight }}>
        <p className="text-xs" style={{ color: COLORS.grayMed }}>
          <strong>Instrucciones:</strong> Marque las casillas para indicar el avance de cada tarea por día. El sistema registrará automáticamente el progreso del proyecto.
        </p>
      </div>
    </div>
  );
}