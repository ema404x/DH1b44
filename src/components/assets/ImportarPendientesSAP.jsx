import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, User, X, ArrowRight, Users, Building2 } from 'lucide-react';
import { SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const COMUNAS = ['8A', '8B', '10A', 'Otra'];
const SKIP_SHEETS = ['PARA FORMATO CONDICIONAL', 'ESC'];

export default function ImportarPendientesSAP({ onImportDone, defaultComuna = '8A' }) {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [comuna, setComuna] = useState(defaultComuna);
  const [sheetInspectors, setSheetInspectors] = useState([]); // [{ sheet, inspector }]
  const [jefesMap, setJefesMap] = useState({}); // { "INSPECTOR NAME": { nombre, email } }
  const [preview, setPreview] = useState(null); // { sheets: [{name, rows}] }
  const [step, setStep] = useState('upload'); // upload | assign | importing | done
  const [importResults, setImportResults] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef();

  // Load employees for jefe assignment
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Load direcciones to auto-detect jefe por inspector
  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones-list'],
    queryFn: () => base44.entities.Direccion.list(),
  });

  // Filtramos jefes de sitio por la comuna seleccionada
  const jefesSitio = employees.filter(e => {
    if (e.role !== 'jefe_sitio') return false;
    if (!e.assigned_comuna) return true; // sin comuna asignada, aparece siempre
    return String(e.assigned_comuna).includes(comuna) || String(comuna).includes(e.assigned_comuna);
  });

  // Todos los jefes de sitio (para la opción de "otros")
  const todosJefes = employees.filter(e => e.role === 'jefe_sitio');

  // Detect format based on selected commune
  function getFormato(c) {
    if (String(c).includes('8B')) return 'formato_8b';
    if (String(c).includes('10')) return 'formato_10a';
    return 'formato_8a';
  }

  // Parse sheet locally for preview (mirrors backend logic)
  function parseSheetLocal(ws, formato) {
    const inspSet = new Set();
    let count = 0;

    if (formato === 'formato_8b') {
      // Col 0=inspector, 1=ubicacion, 2=ubicacion2(dup), 3=tareas, 4=nro_orden, 6=fecha_inicio, 7=fecha_limite, 8=clase, 9=status
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        if (!row || row.length < 4) continue;
        const nroOrden = row[4];
        const tareas = row[3] ? String(row[3]).trim() : null;
        if (!nroOrden || !tareas || tareas === '') continue;
        if (isNaN(Number(String(nroOrden).trim()))) continue;
        count++;
        if (row[0] && String(row[0]).trim() !== '' && row[0] !== '#N/A') {
          inspSet.add(String(row[0]).trim().toUpperCase());
        }
      }
    } else if (formato === 'formato_10a') {
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      for (const r of rows) {
        const orden = r['N° DE ORDEN'] || r['N° DE ORDEN '];
        const tareas = r['TAREAS A REALIZAR'] || r['TAREAS A REALIZAR '];
        if (!orden || !tareas || String(tareas).trim() === '') continue;
        count++;
        const inspector = r['INSPECTOR'] || r['INSPECTOR '];
        if (inspector && String(inspector).trim() !== '' && inspector !== '#N/A') {
          inspSet.add(String(inspector).trim().toUpperCase());
        }
      }
    } else {
      // formato_8a
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      for (const r of rows) {
        const orden = r['N° DE ORDEN'] || r['N° DE ORDEN '];
        const tareas = r['TAREAS A REALIZAR'] || r['TAREAS A REALIZAR '];
        const inspector = r['INSPECTOR'];
        if (!orden || !tareas || !inspector || inspector === '#N/A') continue;
        count++;
        inspSet.add(String(inspector).trim().toUpperCase());
      }
    }

    return { count, inspectors: inspSet };
  }

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    setIsUploading(true);

    const arrayBuf = await f.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuf), { type: 'array' });
    const formato = getFormato(comuna);

    const sheets = [];
    const inspectors = new Set();

    for (const sheetName of wb.SheetNames) {
      if (SKIP_SHEETS.some(s => sheetName.toUpperCase().includes(s))) continue;
      const ws = wb.Sheets[sheetName];
      const { count, inspectors: sheetInspSet } = parseSheetLocal(ws, formato);

      sheetInspSet.forEach(i => inspectors.add(i));
      sheets.push({
        name: sheetName,
        totalRows: count,
        inspectors: [...sheetInspSet],
      });
    }

    setPreview({ sheets });

    // Build initial inspector list
    const inspList = [...inspectors].map(name => ({ inspector: name }));
    setSheetInspectors(inspList);

    // Auto-detect jefe de sitio desde la entidad Direccion (inspector → jefe_sitio)
    const jMap = {};
    for (const { inspector } of inspList) {
      // Buscar por nombre de inspector (comparación insensible a mayúsculas)
      const dir = direcciones.find(d =>
        d.inspector && d.inspector.trim().toUpperCase() === inspector
      );
      if (dir && dir.jefe_sitio) {
        const emp = employees.find(e => e.full_name?.trim().toUpperCase() === dir.jefe_sitio.trim().toUpperCase());
        jMap[inspector] = { nombre: dir.jefe_sitio, email: emp?.email || '' };
      } else {
        jMap[inspector] = { nombre: '', email: '' };
      }
    }
    setJefesMap(jMap);

    // Upload file
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    setFileUrl(file_url);
    setIsUploading(false);
    setStep('assign');
    toast.success('Archivo analizado correctamente');
  }

  function assignJefe(inspector, empName) {
    if (!empName || empName === '__none__') {
      setJefesMap(prev => ({ ...prev, [inspector]: { nombre: '', email: '' } }));
      return;
    }
    const emp = employees.find(e => e.full_name === empName);
    setJefesMap(prev => ({
      ...prev,
      [inspector]: { nombre: empName, email: emp?.email || '' },
    }));
  }

  // Assign all inspectors at once to a single jefe
  function assignJefeToAll(empName) {
    if (!empName || empName === '__none__') return;
    const emp = employees.find(e => e.full_name === empName);
    const newMap = {};
    sheetInspectors.forEach(({ inspector }) => {
      newMap[inspector] = { nombre: empName, email: emp?.email || '' };
    });
    setJefesMap(prev => ({ ...prev, ...newMap }));
  }

  async function handleImport() {
    if (!fileUrl) return;
    setIsImporting(true);
    setStep('importing');

    const res = await base44.functions.invoke('importarPendientesSAP', {
      file_url: fileUrl,
      comuna,
      jefes_por_inspector: jefesMap,
    });

    setImportResults(res.data);
    setIsImporting(false);
    setStep('done');
    toast.success(`Importación completa: ${res.data.totalImported} pendientes creados`);
    if (onImportDone) onImportDone();
  }

  if (step === 'upload') {
    return (
      <Card className="border-dashed border-2 border-border">
        <CardContent className="py-10">
          <div
            className="flex flex-col items-center gap-4 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Subir Excel de SAP</p>
              <p className="text-sm text-muted-foreground mt-1">
                Arrastrá o hacé clic. Formato: PENDIENTESCOMUNAXXX.xlsx
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Comuna</Label>
                <Select value={comuna} onValueChange={setComuna}>
                  <SelectTrigger className="w-28" onClick={e => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMUNAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isUploading ? (
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Analizando archivo...</span>
              </div>
            ) : (
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" /> Seleccionar archivo
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </CardContent>
      </Card>
    );
  }

  if (step === 'assign') {
    return (
      <div className="space-y-5">
        {/* File + comuna info */}
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-sm">{file?.name}</p>
              <p className="text-xs text-muted-foreground">
                {preview?.sheets.reduce((a, s) => a + s.totalRows, 0).toLocaleString()} órdenes válidas
                · {preview?.sheets.length} hojas · Comuna <strong>{comuna}</strong>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { setStep('upload'); setFile(null); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Sheet preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {preview?.sheets.map(s => (
            <Card key={s.name} className="text-sm">
              <CardContent className="pt-3 pb-3">
                <p className="font-semibold truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.totalRows.toLocaleString()} órdenes</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.inspectors.map(i => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Assign jefes per inspector */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Asignar Jefe de Sitio
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Mostrando jefes de <span className="font-semibold text-foreground">Comuna {comuna}</span> primero. Un jefe puede tener múltiples inspectores.
                </p>
              </div>
              {/* Asignar todos */}
              {sheetInspectors.length > 1 && (
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Todos a:</span>
                  <Select onValueChange={assignJefeToAll}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Asignación masiva..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jefesSitio.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px] text-primary flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> Comuna {comuna}
                          </SelectLabel>
                          {jefesSitio.map(e => (
                            <SelectItem key={e.id} value={e.full_name}>{e.full_name}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {todosJefes.filter(e => !jefesSitio.find(j => j.id === e.id)).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel className="text-[10px] text-muted-foreground">Otras comunas</SelectLabel>
                            {todosJefes.filter(e => !jefesSitio.find(j => j.id === e.id)).map(e => (
                              <SelectItem key={e.id} value={e.full_name}>{e.full_name}</SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {sheetInspectors.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg bg-muted/30">
                Esta planilla no tiene columna INSPECTOR. Los pendientes se importarán sin inspector y podrás asignarlos manualmente.
              </div>
            )}
            {sheetInspectors.map(({ inspector }) => {
              const assigned = jefesMap[inspector]?.nombre;
              const isAssigned = !!assigned;
              return (
                <div
                  key={inspector}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${isAssigned ? 'bg-primary/5 border-primary/20' : 'bg-muted/20 border-border'}`}
                >
                  {/* Inspector */}
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {inspector.charAt(0)}
                  </div>
                  <div className="w-40 min-w-0 flex-shrink-0">
                    <p className="text-sm font-medium truncate leading-tight">{inspector}</p>
                    <p className="text-[10px] text-muted-foreground">Inspector</p>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                  {/* Select jefe */}
                  <div className="flex-1">
                    <Select
                      value={jefesMap[inspector]?.nombre || '__none__'}
                      onValueChange={v => assignJefe(inspector, v)}
                    >
                      <SelectTrigger className={`w-full ${isAssigned ? 'border-primary/30 bg-background' : ''}`}>
                        <SelectValue placeholder="Sin jefe asignado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Sin asignar</span>
                        </SelectItem>
                        {jefesSitio.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel className="text-[10px] text-primary flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> Comuna {comuna}
                              </SelectLabel>
                              {jefesSitio.map(e => (
                                <SelectItem key={e.id} value={e.full_name}>{e.full_name}</SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                        {todosJefes.filter(e => !jefesSitio.find(j => j.id === e.id)).length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel className="text-[10px] text-muted-foreground">Otras comunas</SelectLabel>
                              {todosJefes.filter(e => !jefesSitio.find(j => j.id === e.id)).map(e => (
                                <SelectItem key={e.id} value={e.full_name}>{e.full_name}</SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear button */}
                  {isAssigned && (
                    <button
                      onClick={() => assignJefe(inspector, '__none__')}
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Summary */}
            {sheetInspectors.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>
                  {Object.values(jefesMap).filter(v => v.nombre).length} de {sheetInspectors.length} inspectores asignados
                </span>
                <span className={Object.values(jefesMap).every(v => v.nombre) ? 'text-emerald-500 font-medium' : ''}>
                  {Object.values(jefesMap).every(v => v.nombre) ? '✓ Todos asignados' : 'Podés importar sin asignar todos'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setStep('upload')}>Cancelar</Button>
          <Button onClick={handleImport} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar {preview?.sheets.reduce((a, s) => a + s.totalRows, 0).toLocaleString()} órdenes
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="font-medium">Importando órdenes SAP...</p>
        <p className="text-sm text-muted-foreground">Esto puede tardar unos segundos</p>
      </div>
    );
  }

  if (step === 'done' && importResults) {
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-3 p-4 rounded-lg ${importResults.totalErrors === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold">{importResults.totalImported.toLocaleString()} órdenes importadas · {importResults.totalErrors} errores</p>
            <p className="text-sm text-muted-foreground">Comuna {comuna} · Los pendientes ya están disponibles en el sistema</p>
          </div>
        </div>

        <div className="space-y-2">
          {importResults.results?.map(r => (
            <div key={r.sheet} className="flex items-center justify-between text-sm border rounded-lg px-4 py-2.5">
              <span className="font-medium">{r.sheet}</span>
              <div className="flex items-center gap-3">
                <Badge className="bg-emerald-100 text-emerald-700">{r.imported} importadas</Badge>
                {r.errors > 0 && <Badge className="bg-red-100 text-red-700">{r.errors} errores</Badge>}
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => { setStep('upload'); setFile(null); setImportResults(null); }} variant="outline">
          Importar otro archivo
        </Button>
      </div>
    );
  }

  return null;
}