import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, CheckCircle2, Star, AlertTriangle, Info, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ENTITY_OPTIONS = [
  { value: 'Client', label: 'Clientes/Proveedores' },
  { value: 'Employee', label: 'Empleados' },
  { value: 'Material', label: 'Materiales' },
  { value: 'Project', label: 'Proyectos' },
  { value: 'WorkOrder', label: 'Órdenes de Trabajo' },
  { value: 'Asset', label: 'Activos' },
  { value: 'PrecarioMinisterio', label: 'Preciario Ministerial' },
  { value: 'Quote', label: 'Presupuestos' },
  { value: 'Invoice', label: 'Facturas' },
  { value: 'LocationData', label: 'Ubicaciones Técnicas' },
  { value: 'InformePlaneacion', label: 'Informes Planificación' },
  { value: 'Informe', label: 'Informes Inspección' },
  { value: 'skip', label: '— Ignorar esta hoja —' },
];

const ENTITY_FIELDS = {
  Client: ['name', 'type', 'cuit', 'contact_name', 'email', 'phone', 'address', 'city', 'status', 'notes'],
  Employee: ['full_name', 'dni', 'role', 'specialty', 'status', 'phone', 'email', 'hire_date', 'hourly_rate', 'notes'],
  Material: ['name', 'code', 'category', 'unit', 'stock', 'min_stock', 'unit_cost', 'supplier', 'location', 'notes'],
  Project: ['name', 'code', 'client_name', 'type', 'status', 'priority', 'description', 'address', 'start_date', 'end_date', 'estimated_budget', 'progress', 'notes'],
  WorkOrder: ['title', 'code', 'project_name', 'asset_name', 'location', 'type', 'status', 'priority', 'description', 'assigned_name', 'scheduled_date', 'estimated_hours', 'notes'],
  Asset: ['name', 'code', 'type', 'brand', 'model', 'serial_number', 'location', 'project_name', 'status', 'criticality', 'purchase_date', 'purchase_cost', 'notes'],
  PrecarioMinisterio: ['codigo', 'descripcion', 'unidad', 'categoria', 'subcategoria', 'comuna', 'pu_mat', 'pu_mo', 'coef_pase', 'coef_oferta'],
  Quote: ['title', 'client_name', 'description', 'status', 'subtotal', 'tax_rate', 'total', 'valid_until', 'notes'],
  Invoice: ['client_name', 'project_name', 'status', 'subtotal', 'tax_rate', 'total', 'issue_date', 'due_date', 'notes'],
  LocationData: ['ubic_tecnica', 'establecimiento', 'elem_pep', 'm2', 'comuna', 'jefe_sitio', 'inspector', 'estado'],
  InformePlaneacion: ['mes', 'descripcion', 'proveedor_2025', 'contacto_2025', 'proveedor_invitado_2026', 'estado_contacto', 'proveedor_contratado_2026', 'fecha_envio_contratar', 'estado_actual', 'notas'],
  Informe: ['titulo', 'establecimiento', 'direccion', 'jefe_sitio', 'estado', 'secciones', 'informe_generado', 'fecha_inspeccion'],
};

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
  LocationData: ['ubic_tecnica'],
  InformePlaneacion: ['descripcion', 'estado_contacto'],
  Informe: ['establecimiento', 'titulo'],
};

function ConfidenceBadge({ confidence }) {
  if (confidence >= 0.85) return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Alta confianza</Badge>;
  if (confidence >= 0.6) return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Confianza media</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Revisar</Badge>;
}

function SheetCard({ sheet, sheetIdx, isExpanded, onToggle, onUpdateEntity, onUpdateField }) {
  const entityFields = ENTITY_FIELDS[sheet.target_entity] || [];
  const keyFields = KEY_FIELDS[sheet.target_entity] || [];
  const mappedCount = Object.values(sheet.field_mapping || {}).filter(v => v).length;
  const totalCols = Object.keys(sheet.field_mapping || {}).length;
  const isSkipped = sheet.target_entity === 'skip' || !sheet.target_entity;
  const mappingCompleteness = totalCols > 0 ? Math.round((mappedCount / totalCols) * 100) : 0;

  return (
    <Card className={`overflow-hidden transition-all ${isSkipped ? 'opacity-50' : 'border-primary/20'}`}>
      <CardHeader
        className="cursor-pointer py-3 px-4 hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Confidence indicator */}
            <div className={`h-10 w-1.5 rounded-full flex-shrink-0 ${
              sheet.confidence >= 0.85 ? 'bg-emerald-500' :
              sheet.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{sheet.sheet_name}</p>
                <ConfidenceBadge confidence={sheet.confidence} />
                {!isSkipped && mappingCompleteness >= 70 && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">✓ Listo</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sheet.row_count} filas · {mappedCount}/{totalCols} columnas · {mappingCompleteness}% mapeado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={sheet.target_entity || 'skip'}
              onChange={(e) => { e.stopPropagation(); onUpdateEntity(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background font-medium focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50"
            >
              {ENTITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && !isSkipped && (
        <CardContent className="p-0 border-t border-border">
          {/* Key fields warning */}
          {keyFields.some(kf => !Object.values(sheet.field_mapping || {}).includes(kf)) && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Campos clave sin mapear: <strong>{keyFields.filter(kf => !Object.values(sheet.field_mapping || {}).includes(kf)).join(', ')}</strong></span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-1/3">Columna en archivo</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-1/3">Campo en sistema</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Muestra de datos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {Object.entries(sheet.field_mapping || {}).map(([col, field], i) => {
                  const isKey = field && keyFields.includes(field);
                  const sample = sheet.sample_data?.[col];
                  return (
                    <tr key={i} className={`hover:bg-muted/10 transition-colors ${isKey ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {isKey && <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                          <span className="font-mono text-foreground">{col}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={field || ''}
                          onChange={(e) => onUpdateField(col, e.target.value)}
                          className={`w-full px-2 py-1.5 border rounded-md text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary ${
                            isKey ? 'border-amber-400 font-medium' : field ? 'border-border' : 'border-dashed border-muted-foreground/30 text-muted-foreground'
                          }`}
                        >
                          <option value="">— ignorar —</option>
                          {entityFields.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        {sample ? (
                          <span className="text-muted-foreground truncate block max-w-40" title={sample}>{sample}</span>
                        ) : (
                          <span className="text-muted-foreground/40 italic">sin datos</span>
                        )}
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
  );
}

export default function ImportStepMapping({ mappingResult, onConfirm, onBack }) {
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
      return { ...s, field_mapping: { ...s.field_mapping, [colName]: newField } };
    }));
  };

  const validSheets = sheets.filter(s => s.target_entity && s.target_entity !== 'skip');
  const totalRows = validSheets.reduce((acc, s) => acc + (s.row_count || 0), 0);
  const highConfidence = validSheets.filter(s => s.confidence >= 0.85).length;

  return (
    <div className="space-y-4">
       {/* Quick actions bar */}
       <div className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
         <div className="flex-1">
           <p className="font-semibold text-white text-sm mb-1">Mapeo automático listo</p>
           <p className="text-xs text-slate-400">
             Revisa los campos abajo. Ajusta si es necesario. Los <Star className="h-3 w-3 text-amber-500 inline" /> son campos clave.
           </p>
         </div>
       </div>

       {/* Summary banner */}
       <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
         <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
         <div className="flex-1">
           <p className="font-semibold text-emerald-800 text-sm">Resumen de importación</p>
           <p className="text-xs text-emerald-700 mt-0.5">
             <strong>{validSheets.length} entidade{validSheets.length !== 1 ? 's' : ''}</strong> con <strong>{totalRows.toLocaleString()} fila{totalRows !== 1 ? 's' : ''}</strong> 
             {highConfidence > 0 && <> · <strong>{highConfidence} con alta confianza</strong></>}
           </p>
         </div>
       </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Los campos marcados con <Star className="h-3 w-3 text-amber-500 inline" /> son clave para identificar registros únicos.</span>
      </div>

      {/* Sheets */}
      {sheets.map((sheet, sheetIdx) => (
        <SheetCard
          key={sheetIdx}
          sheet={sheet}
          sheetIdx={sheetIdx}
          isExpanded={expandedSheet === sheetIdx}
          onToggle={() => setExpandedSheet(expandedSheet === sheetIdx ? null : sheetIdx)}
          onUpdateEntity={(entity) => updateSheetEntity(sheetIdx, entity)}
          onUpdateField={(col, field) => updateFieldMapping(sheetIdx, col, field)}
        />
      ))}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          ← Volver
        </Button>
        <Button
          onClick={() => onConfirm({ ...mappingResult, sheets })}
          disabled={validSheets.length === 0}
          className="flex-1 gap-2"
        >
          <Zap className="h-4 w-4" />
          Continuar · {totalRows.toLocaleString()} fila{totalRows !== 1 ? 's' : ''} en {validSheets.length} entidade{validSheets.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}