import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function ExportadorDatos({ locations }) {
  const [exporting, setExporting] = useState(false);

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const data = locations.map(loc => ({
        'Ubicación Técnica': loc.ubic_tecnica,
        Establecimiento: loc.establecimiento,
        Dirección: loc.direccion,
        'Elem. PEP': loc.elem_pep,
        'Superficie (m²)': loc.m2 || '',
        Inspector: loc.inspector,
        'Jefe de Sitio': loc.jefe_sitio,
        Comuna: loc.comuna,
        'Superficie Supervisión': loc.sup || '',
        Estado: loc.estado,
        'Creado': new Date(loc.created_date).toLocaleDateString('es-AR'),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Escuelas');

      // Estilos básicos
      ws['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 8 },
        { wch: 12 }, { wch: 10 }, { wch: 12 },
      ];

      XLSX.writeFile(wb, `Escuelas_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`✅ Exportadas ${locations.length} escuelas a Excel`);
    } catch (error) {
      toast.error('Error al exportar: ' + error.message);
    }
    setExporting(false);
  };

  const exportToJSON = async () => {
    setExporting(true);
    try {
      const data = {
        exportDate: new Date().toISOString(),
        totalRecords: locations.length,
        data: locations,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Escuelas_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`✅ Exportadas ${locations.length} escuelas a JSON`);
    } catch (error) {
      toast.error('Error al exportar: ' + error.message);
    }
    setExporting(false);
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const data = locations.map(loc => [
        loc.ubic_tecnica,
        loc.establecimiento,
        loc.direccion,
        loc.elem_pep,
        loc.m2 || '',
        loc.inspector,
        loc.jefe_sitio,
        loc.comuna,
        loc.sup || '',
        loc.estado,
        new Date(loc.created_date).toLocaleDateString('es-AR'),
      ]);

      const headers = [
        'Ubicación Técnica',
        'Establecimiento',
        'Dirección',
        'Elem. PEP',
        'Superficie (m²)',
        'Inspector',
        'Jefe de Sitio',
        'Comuna',
        'Superficie Supervisión',
        'Estado',
        'Creado',
      ];

      const csv = [
        headers.map(h => `"${h}"`).join(','),
        ...data.map(row => row.map(cell => `"${cell || ''}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Escuelas_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`✅ Exportadas ${locations.length} escuelas a CSV`);
    } catch (error) {
      toast.error('Error al exportar: ' + error.message);
    }
    setExporting(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={locations.length === 0 || exporting}>
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={exportToExcel} disabled={exporting}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-blue-600" />
          <span>Exportar a Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV} disabled={exporting}>
          <FileText className="h-4 w-4 mr-2 text-orange-600" />
          <span>Exportar a CSV</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToJSON} disabled={exporting}>
          <FileJson className="h-4 w-4 mr-2 text-slate-600" />
          <span>Exportar a JSON</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}