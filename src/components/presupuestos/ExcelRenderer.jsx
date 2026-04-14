import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function ExcelRenderer({ onDataLoaded }) {
  const [excelData, setExcelData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSheet, setActiveSheet] = useState('PCP');

  // Subir y parsear Excel
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // Subir archivo
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      
      // Parsear con la función backend
      const parseRes = await base44.functions.invoke('parseExcelPresupuesto', {
        file_url: uploadRes.file_url,
      });

      if (parseRes.data?.sheets) {
        setExcelData(parseRes.data);
        setActiveSheet('PCP');
        onDataLoaded?.(parseRes.data);
        toast.success('Excel cargado exitosamente');
      }
    } catch (error) {
      toast.error('Error al cargar el Excel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!excelData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg border-2 border-dashed" style={{ borderColor: '#9B1C1C', background: '#FEF2F2' }}>
        <Upload className="h-8 w-8" style={{ color: '#C53030' }} />
        <p className="text-sm font-semibold" style={{ color: '#2D3748' }}>
          Cargá tu archivo Excel "Nuevo formato presupuestos 8AA"
        </p>
        <label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
          />
          <Button
            as="span"
            disabled={loading}
            style={{ background: '#9B1C1C', color: 'white', cursor: 'pointer' }}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {loading ? 'Cargando...' : 'Seleccionar Excel'}
          </Button>
        </label>
      </div>
    );
  }

  const sheets = Object.keys(excelData.sheets);
  const sheetData = excelData.sheets[activeSheet];

  return (
    <div className="space-y-4">
      {/* TABS */}
      <div className="flex gap-2 border-b">
        {sheets.map((sheet) => (
          <button
            key={sheet}
            onClick={() => setActiveSheet(sheet)}
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-all"
            style={{
              borderColor: activeSheet === sheet ? '#9B1C1C' : 'transparent',
              color: activeSheet === sheet ? '#9B1C1C' : '#718096',
            }}
          >
            {sheet}
          </button>
        ))}
      </div>

      {/* SHEET RENDERER */}
      <div className="overflow-x-auto rounded-lg border">
        <ExcelSheet sheetData={sheetData} />
      </div>
    </div>
  );
}

function ExcelSheet({ sheetData }) {
  if (!sheetData) return null;

  const { rows } = sheetData;
  const maxCols = Math.max(...rows.map((r) => r.length));

  return (
    <table className="w-full border-collapse text-xs">
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {Array.from({ length: maxCols }).map((_, colIdx) => {
              const cell = row[colIdx];
              const value = cell?.value;
              const style = cell?.style || {};

              // Colores de fondo según el patrón del Excel
              let bgColor = '#FFFFFF';
              if (rowIdx < 3) bgColor = '#9B1C1C'; // Header rojo
              else if (rowIdx % 2 === 1) bgColor = '#F7FAFC'; // Alternado gris

              return (
                <td
                  key={colIdx}
                  style={{
                    padding: '8px 6px',
                    border: '1px solid #E2E8F0',
                    background: bgColor,
                    color: rowIdx < 3 ? '#FFFFFF' : '#2D3748',
                    textAlign: style.alignment?.horizontal || 'left',
                    fontWeight: rowIdx < 3 ? 'bold' : 'normal',
                    fontSize: '11px',
                    minWidth: '80px',
                  }}
                >
                  {typeof value === 'object' ? JSON.stringify(value) : value || ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}