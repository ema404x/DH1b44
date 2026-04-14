import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ENTITY_OPTIONS = [
  { value: 'Client', label: 'Clientes' },
  { value: 'Employee', label: 'Empleados' },
  { value: 'Material', label: 'Materiales' },
  { value: 'Project', label: 'Proyectos' },
  { value: 'WorkOrder', label: 'Órdenes de Trabajo' },
  { value: 'Asset', label: 'Activos' },
  { value: 'PrecarioMinisterio', label: 'Preciario Ministerial' },
  { value: 'Quote', label: 'Presupuestos' },
  { value: 'Invoice', label: 'Facturas' },
  { value: 'skip', label: '— Ignorar esta hoja —' },
];

// Key fields per entity — used to highlight important mappings
const KEY_FIELDS = {
  Client: ['cuit', 'name'],
  Employee: ['dni', 'full_name'],
  Material: ['code', 'name'],
  Project: ['code', 'name'],
  WorkOrder: ['code', 'title'],
  Asset: ['serial_number', 'code'],
  PrecarioMinisterio: ['codigo'],
  Quote: ['title', 'client_name'],
  Invoice: ['client_name', 'issue_date'],
};

export default function ImportStepMapping({ mappingResult, onConfirm, onBack }) {
  // Already sorted by confidence from backend; preserve order
  const [sheets, setSheets] = useState(
    [...(mappingResult.sheets || [])].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  );
  const [expandedSheet, setExpandedSheet] = useState(0);

  const updateSheetEntity = (sheetIdx, newEntity) => {
    setSheets(prev => prev.map((s, i) => i === sheetIdx ? { ...s, target_entity: newEntity } : s));
  };

  const updateFieldMapping = (sheetIdx, colName, newField) => {
    setSheets(prev => prev.map((s, i) => {
      if (i !== sheetIdx) return s;
      return {
        ...s,
        field_mapping: { ...s.field_mapping, [colName]: newField }
      };
    }));
  };

  const validSheets = sheets.filter(s => s.target_entity && s.target_entity !== 'skip');
  const totalRows = validSheets.reduce((acc, s) => acc + (s.row_count || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <Brain className="h-5 w-5 text-emerald-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-emerald-800 text-sm">Análisis completado</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Se detectaron <strong>{sheets.length} hojas</strong> con <strong>{totalRows} filas</strong> para importar en <strong>{validSheets.length} entidades</strong>.
          </p>
        </div>
      </div>

      {/* Sheets */}
      {sheets.map((sheet, sheetIdx) => (
        <Card key={sheetIdx} className={sheet.target_entity === 'skip' ? 'opacity-60' : ''}>
          <CardHeader
            className="cursor-pointer py-4"
            onClick={() => setExpandedSheet(expandedSheet === sheetIdx ? null : sheetIdx)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  sheet.confidence >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                  sheet.confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {sheet.confidence >= 0.8 ? '✓' : sheet.confidence >= 0.5 ? '~' : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{sheet.sheet_name}</p>
                  <p className="text-xs text-muted-foreground">{sheet.row_count} filas · {Object.keys(sheet.field_mapping || {}).length} columnas mapeadas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Entity selector */}
                <select
                  value={sheet.target_entity || 'skip'}
                  onChange={(e) => { e.stopPropagation(); updateSheetEntity(sheetIdx, e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background font-medium"
                >
                  {ENTITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {expandedSheet === sheetIdx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>

          {expandedSheet === sheetIdx && (
            <CardContent className="pt-0 pb-4">
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Columna en archivo</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Campo en sistema</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Muestra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(sheet.field_mapping || {}).map(([col, field], i) => {
                      const isKeyField = field && (KEY_FIELDS[sheet.target_entity] || []).includes(field);
                      return (
                        <tr key={i} className={`border-t border-border/50 hover:bg-muted/20 ${isKeyField ? 'bg-amber-50/60' : ''}`}>
                          <td className="px-3 py-2 font-mono text-foreground">
                            <span className="flex items-center gap-1">
                              {isKeyField && <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                              {col}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={field || ''}
                              onChange={(e) => updateFieldMapping(sheetIdx, col, e.target.value)}
                              placeholder="ignorar"
                              className={`px-2 py-1 border rounded text-xs bg-background w-full ${isKeyField ? 'border-amber-400 font-medium' : 'border-border'}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-32">
                            {(sheet.sample_data?.[col] || '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>Volver</Button>
        <Button
          onClick={() => onConfirm({ ...mappingResult, sheets })}
          disabled={validSheets.length === 0}
          className="flex-1 gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Confirmar mapeo — importar {totalRows} registros en {validSheets.length} entidades
        </Button>
      </div>
    </div>
  );
}