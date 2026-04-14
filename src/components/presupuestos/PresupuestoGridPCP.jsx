import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Save, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';

// Paleta corporativa Mejores: Rojos y Grises
const COLORS = {
  redDark: '#9B1C1C',
  redMain: '#C53030',
  redLight: '#FED7D7',
  grayDark: '#2D3748',
  grayMed: '#718096',
  grayLight: '#EDF2F7',
  white: '#FFFFFF',
};

// Catálogo de Órdenes de Tareas (Rubros ministeriales)
const ORDENES_TAREAS = [
  'Demoliciones',
  'Movimiento de Suelos',
  'Estructuras',
  'Generales',
  'Acabados',
  'Instalaciones',
  'Tramitaciones',
];

const COLUMNS = [
  { id: 'item_presup', header: 'ITEM PRESUP', width: 80 },
  { id: 'item_preciario', header: 'ITEM PRECIARIO', width: 100 },
  { id: 'descripcion', header: 'DESCRIPCIÓN', width: 250 },
  { id: 'unidad', header: 'UNID.', width: 60 },
  { id: 'cantidad', header: 'CANT.', width: 70 },
  { id: 'pu_mat', header: 'P.U.MAT.', width: 100 },
  { id: 'pu_mo', header: 'P.U.M.O.', width: 100 },
  { id: 'total_pu', header: 'TOTAL PU', width: 100 },
  { id: 'precio_actual', header: 'PRECIO ACTUAL SIN IVA', width: 130 },
  { id: 'coef_deflactor', header: 'COEF. DEFLACTOR', width: 110 },
  { id: 'precio_deflacionado', header: 'PRECIO DEFLACIONADO', width: 130 },
  { id: 'coef_pase_col', header: 'COEF. PASE', width: 100 },
  { id: 'total_pase', header: 'TOTAL PASE', width: 100 },
  { id: 'coef_oferta_col', header: 'COEF. OFERTA', width: 100 },
  { id: 'precio_resultante', header: 'PRECIO RESULTANTE', width: 130 },
  { id: 'subtotal', header: 'SUBTOTAL', width: 120 },
  { id: 'avance_ant', header: 'ANTERIOR', width: 90 },
  { id: 'avance_actual', header: 'ACTUAL', width: 90 },
  { id: 'avance_acum', header: 'ACUMULADO', width: 90 },
];

// Función de cálculo automático
function calcularFila(row, coefPase, coefOferta) {
  const puMat = parseFloat(row.pu_mat) || 0;
  const puMo = parseFloat(row.pu_mo) || 0;
  const totalPu = puMat + puMo;
  const cant = parseFloat(row.cantidad) || 0;
  
  const precioActual = parseFloat(row.precio_actual) || 0;
  const coefDef = parseFloat(row.coef_deflactor) || 1;
  const precioDeflacionado = precioActual * coefDef;
  
  const totalPase = totalPu * coefPase;
  const precioResultante = totalPase * coefOferta;
  const subtotal = precioResultante * cant;

  return {
    ...row,
    total_pu: totalPu.toFixed(2),
    precio_deflacionado: precioDeflacionado.toFixed(2),
    total_pase: totalPase.toFixed(2),
    precio_resultante: precioResultante.toFixed(2),
    subtotal: subtotal.toFixed(2),
  };
}

export default function PresupuestoGridPCP({
  cabecera,
  onCabeceraChange,
  items = [],
  onItemsChange,
  onGenerarPlanTrabajos,
}) {
  const [editingCell, setEditingCell] = useState(null);
  const [newItem, setNewItem] = useState(null);

  // Cálculos automáticos cuando cambian coeficientes o datos
  const itemsCalculados = useMemo(() => {
    return items.map(row => calcularFila(row, cabecera.coef_pase, cabecera.coef_oferta));
  }, [items, cabecera.coef_pase, cabecera.coef_oferta]);

  // Total del presupuesto
  const totalPresupuesto = useMemo(() => {
    return itemsCalculados.reduce((sum, row) => sum + (parseFloat(row.subtotal) || 0), 0);
  }, [itemsCalculados]);

  // Manejo de cambios en cabecera
  const handleCabeceraChange = useCallback((field, value) => {
    onCabeceraChange({ ...cabecera, [field]: value });
  }, [cabecera, onCabeceraChange]);

  // Manejo de edición de celda
  const handleCellChange = (rowIdx, colId, value) => {
    const newItems = [...items];
    newItems[rowIdx] = { ...newItems[rowIdx], [colId]: value };
    onItemsChange(newItems);
    setEditingCell(null);
  };

  // Agregar nueva fila
  const handleAddRow = () => {
    const newRow = {
      id: Date.now(),
      item_presup: items.length + 1,
      item_preciario: '',
      descripcion: '',
      unidad: '',
      cantidad: 0,
      pu_mat: 0,
      pu_mo: 0,
      precio_actual: 0,
      coef_deflactor: 1,
      avance_ant: 0,
      avance_actual: 0,
    };
    onItemsChange([...items, newRow]);
  };

  // Eliminar fila
  const handleDeleteRow = (rowIdx) => {
    onItemsChange(items.filter((_, i) => i !== rowIdx));
  };

  return (
    <div className="w-full space-y-4 p-4 rounded-lg" style={{ background: COLORS.grayLight }}>
      {/* CABECERA */}
      <div className="rounded-lg border-2 p-4" style={{ borderColor: COLORS.redDark, background: COLORS.white }}>
        <h3 className="text-sm font-bold uppercase mb-4" style={{ color: COLORS.redDark }}>
          Cabecera del Presupuesto
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">COMITENTE</label>
            <Input
              value={cabecera.cliente_nombre || ''}
              onChange={(e) => handleCabeceraChange('cliente_nombre', e.target.value)}
              className="text-xs"
              placeholder="GCBA - MINISTERIO..."
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">LICITACIÓN</label>
            <Input
              value={cabecera.licitacion || ''}
              onChange={(e) => handleCabeceraChange('licitacion', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Nº PRESUPUESTO</label>
            <Input
              value={cabecera.codigo || ''}
              onChange={(e) => handleCabeceraChange('codigo', e.target.value)}
              className="text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">EMPRESA</label>
            <Input value="MEJORES HOSPITALES S.A." disabled className="text-xs bg-gray-50" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">DIRECCIÓN</label>
            <Input
              value={cabecera.direccion_obra || ''}
              onChange={(e) => handleCabeceraChange('direccion_obra', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">ESCUELA</label>
            <Input
              value={cabecera.escuela || ''}
              onChange={(e) => handleCabeceraChange('escuela', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">OBRA</label>
            <Input
              value={cabecera.titulo || ''}
              onChange={(e) => handleCabeceraChange('titulo', e.target.value)}
              className="text-xs font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">MTOM Nº</label>
            <Input
              value={cabecera.mtom || ''}
              onChange={(e) => handleCabeceraChange('mtom', e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">SUPERVISOR</label>
            <Input
              value={cabecera.supervisor || ''}
              onChange={(e) => handleCabeceraChange('supervisor', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">INSPECTOR</label>
            <Input
              value={cabecera.inspector || ''}
              onChange={(e) => handleCabeceraChange('inspector', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">FECHA INGRESO SAP</label>
            <Input
              type="date"
              value={cabecera.fecha_ingreso_sap || ''}
              onChange={(e) => handleCabeceraChange('fecha_ingreso_sap', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">PLAZO (días)</label>
            <Input
              type="number"
              value={cabecera.plazo_dias || ''}
              onChange={(e) => handleCabeceraChange('plazo_dias', parseInt(e.target.value))}
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Preciario Utilizado</label>
            <Input
              type="date"
              value={cabecera.preciario_utilizado || ''}
              onChange={(e) => handleCabeceraChange('preciario_utilizado', e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Coef. Pase</label>
            <Input
              type="number"
              step="0.0001"
              value={cabecera.coef_pase || ''}
              onChange={(e) => handleCabeceraChange('coef_pase', parseFloat(e.target.value))}
              className="text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Coef. Oferta</label>
            <Input
              type="number"
              step="0.01"
              value={cabecera.coef_oferta || ''}
              onChange={(e) => handleCabeceraChange('coef_oferta', parseFloat(e.target.value))}
              className="text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* GRILLA PCP */}
      <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: COLORS.redDark }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            {/* HEADER */}
            <thead>
              <tr style={{ background: COLORS.redDark }}>
                <th style={{ width: 40, padding: 6, color: COLORS.white, textAlign: 'center' }}>DEL</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    style={{
                      width: col.width,
                      padding: '6px 4px',
                      color: COLORS.white,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      borderRight: `1px solid ${COLORS.redLight}`,
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            {/* ROWS */}
            <tbody>
              {itemsCalculados.map((row, idx) => (
                <tr key={row.id || idx} style={{ background: idx % 2 === 0 ? COLORS.white : COLORS.grayLight }}>
                  {/* DELETE BUTTON */}
                  <td style={{ padding: 4, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteRow(idx)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      ✕
                    </button>
                  </td>

                  {/* DATA CELLS */}
                  {COLUMNS.map((col) => {
                    const isEditable = !['total_pu', 'precio_deflacionado', 'total_pase', 'precio_resultante', 'subtotal'].includes(col.id);
                    const value = row[col.id] || '';
                    const isEditing = editingCell?.rowIdx === idx && editingCell?.colId === col.id;

                    return (
                      <td
                        key={col.id}
                        style={{
                          width: col.width,
                          padding: '4px 2px',
                          borderRight: `1px solid ${COLORS.grayLight}`,
                          background: !isEditable ? '#F0F0F0' : COLORS.white,
                          cursor: isEditable ? 'pointer' : 'default',
                        }}
                        onClick={() => isEditable && setEditingCell({ rowIdx: idx, colId: col.id })}
                      >
                        {isEditing && isEditable ? (
                          <input
                            autoFocus
                            type={['cantidad', 'pu_mat', 'pu_mo', 'precio_actual', 'coef_deflactor'].includes(col.id) ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => handleCellChange(idx, col.id, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingCell(null);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full px-1 py-1 border border-blue-500 text-xs"
                            step={col.id === 'coef_deflactor' ? '0.01' : '1'}
                          />
                        ) : (
                          <div style={{ textAlign: 'right', padding: '2px', fontSize: '11px' }}>
                            {typeof value === 'number' ? value.toFixed(2) : value}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACCIONES */}
      <div className="flex gap-2 items-center justify-between flex-wrap">
        <div className="flex gap-2">
          <Button onClick={handleAddRow} size="sm" style={{ background: COLORS.redMain, color: COLORS.white }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Fila
          </Button>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold mb-1" style={{ color: COLORS.grayDark }}>TOTAL PRESUPUESTO:</p>
          <p className="text-lg font-bold" style={{ color: COLORS.redDark }}>
            ${totalPresupuesto.toFixed(2)}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => onGenerarPlanTrabajos({ ...cabecera, items: itemsCalculados, total: totalPresupuesto })}
            size="sm"
            style={{ background: COLORS.redDark, color: COLORS.white }}
          >
            <Calendar className="h-4 w-4 mr-1" /> Generar Plan de Trabajos
          </Button>
        </div>
      </div>
    </div>
  );
}