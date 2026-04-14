import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Database } from 'lucide-react';
import { toast } from 'sonner';
import ExcelRenderer from '@/components/presupuestos/ExcelRenderer';

const COLORS = {
  redDark: '#9B1C1C',
  redMain: '#C53030',
};

export default function Presupuestos() {
  const [tab, setTab] = useState('excel');
  const [loadedExcelData, setLoadedExcelData] = useState(null);

  const handleExcelLoaded = (data) => {
    setLoadedExcelData(data);
    toast.success('Excel listo para trabajar');
  };

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: COLORS.redDark }}>
          Presupuestos - Sistema DH1
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Cargá tu Excel "Nuevo formato presupuestos 8AA" y trabajá directamente dentro del software.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-gray-100 h-10">
          <TabsTrigger value="excel" className="gap-2">
            <FileText className="h-4 w-4" />
            Plantilla Excel
          </TabsTrigger>
          <TabsTrigger value="ordenes" className="gap-2">
            <Database className="h-4 w-4" />
            Orden de Tareas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="excel" className="mt-6">
          <ExcelRenderer onDataLoaded={handleExcelLoaded} />
        </TabsContent>

        <TabsContent value="ordenes" className="mt-6">
          <div className="p-6 rounded-lg border-2" style={{ borderColor: COLORS.redDark }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: COLORS.redDark }}>
              Catálogo de Órdenes de Tareas
            </h2>
            {loadedExcelData?.sheets?.['ORDEN TAREAS'] ? (
              <OrdenesTareasRenderer sheetData={loadedExcelData.sheets['ORDEN TAREAS']} />
            ) : (
              <p className="text-sm text-gray-500">Cargá un Excel para ver las órdenes de tareas.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrdenesTareasRenderer({ sheetData }) {
  const { rows } = sheetData;

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr style={{ background: COLORS.redDark }}>
          <th style={{ padding: '10px', color: 'white', textAlign: 'left', fontWeight: 'bold' }}>
            #
          </th>
          <th style={{ padding: '10px', color: 'white', textAlign: 'left', fontWeight: 'bold' }}>
            Orden de Tarea
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 21).map((row, idx) => {
          const num = row[0]?.value;
          const tarea = row[1]?.value;
          return (
            <tr key={idx} style={{ background: idx % 2 === 0 ? '#F7FAFC' : '#FFFFFF' }}>
              <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0', color: COLORS.redDark, fontWeight: 'bold' }}>
                {num}
              </td>
              <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>
                {tarea}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}