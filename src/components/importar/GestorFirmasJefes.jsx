import React, { useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PenTool, Upload, Trash2, CheckCircle2, Loader2, Search, UserCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function FirmaCanvas({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasFirma, setHasFirma] = useState(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => { e.preventDefault(); setDrawing(true); lastPos.current = getPos(e, canvasRef.current); };
  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a3a6e'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(); lastPos.current = pos; setHasFirma(true);
  };
  const stopDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasFirma(false);
  };

  const handleSave = async () => {
    if (!hasFirma) { toast.error('Dibujá la firma primero'); return; }
    const canvas = canvasRef.current;
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], 'firma.png', { type: 'image/png' });
    onSave(file);
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-slate-600 rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef} width={400} height={150}
          className="w-full cursor-crosshair"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={clearCanvas} className="gap-1.5 text-xs"><Trash2 className="h-3 w-3" /> Limpiar</Button>
        <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={!hasFirma} className="gap-1.5 text-xs">
          <CheckCircle2 className="h-3 w-3" /> Guardar firma
        </Button>
      </div>
    </div>
  );
}

function JefeSitioCard({ empleado, onUpdated }) {
  const [mode, setMode] = useState(null); // null | 'canvas' | 'upload'
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSaveFile = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Employee.update(empleado.id, { firma_url: file_url });
      toast.success(`Firma guardada para ${empleado.full_name}`);
      setMode(null);
      onUpdated();
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleSaveFile(file);
    e.target.value = '';
  };

  const handleRemove = async () => {
    await base44.entities.Employee.update(empleado.id, { firma_url: '' });
    toast.success('Firma eliminada');
    onUpdated();
  };

  const tieneFirma = !!empleado.firma_url;

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardContent className="p-4 space-y-3">
        {/* Header del jefe */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{empleado.full_name}</p>
              <p className="text-xs text-slate-400 truncate">{empleado.assigned_location || empleado.email || 'Sin ubicación'}</p>
            </div>
          </div>
          <Badge variant={tieneFirma ? 'default' : 'outline'} className={tieneFirma ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-slate-600'}>
            {tieneFirma ? '✓ Firmado' : 'Sin firma'}
          </Badge>
        </div>

        {/* Firma existente */}
        {tieneFirma && mode === null && (
          <div className="flex items-center gap-3">
            <div className="border border-slate-600 rounded-lg bg-white p-2 flex-1 flex justify-center">
              <img src={empleado.firma_url} alt="Firma" className="h-12 object-contain max-w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setMode('canvas')} className="text-xs h-7 px-2 gap-1">
                <PenTool className="h-3 w-3" /> Redibujar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('upload')} className="text-xs h-7 px-2 gap-1">
                <Upload className="h-3 w-3" /> Imagen
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRemove} className="text-xs h-7 px-2 gap-1 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" /> Quitar
              </Button>
            </div>
          </div>
        )}

        {/* Sin firma — botones */}
        {!tieneFirma && mode === null && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode('canvas')} className="flex-1 gap-1.5 text-xs">
              <PenTool className="h-3 w-3" /> Dibujar firma
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('upload')} className="flex-1 gap-1.5 text-xs">
              <Upload className="h-3 w-3" /> Subir imagen
            </Button>
          </div>
        )}

        {/* Canvas para dibujar */}
        {mode === 'canvas' && (
          <FirmaCanvas onSave={handleSaveFile} onCancel={() => setMode(null)} />
        )}

        {/* Upload de imagen */}
        {mode === 'upload' && (
          <div className="space-y-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <Button
              size="sm" variant="outline" className="w-full gap-2 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Subiendo...' : 'Seleccionar imagen de firma'}
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setMode(null)}>Cancelar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GestorFirmasJefes() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: empleados = [], isLoading, refetch } = useQuery({
    queryKey: ['empleados-jefes-sitio'],
    queryFn: () => base44.entities.Employee.filter({ role: 'jefe_sitio' }, 'full_name', 200),
  });

  // Si no hay resultados con role=jefe_sitio, traer todos y filtrar por rol que contenga "jefe"
  const { data: todosEmpleados = [], isLoading: loadingTodos } = useQuery({
    queryKey: ['empleados-todos-firma'],
    queryFn: () => base44.entities.Employee.list('full_name', 200),
    enabled: !isLoading && empleados.length === 0,
  });

  const lista = empleados.length > 0
    ? empleados
    : todosEmpleados.filter(e => e.role?.toLowerCase().includes('jefe') || e.role?.toLowerCase().includes('site'));

  const filtrados = lista.filter(e =>
    !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.assigned_location?.toLowerCase().includes(search.toLowerCase())
  );

  const conFirma = filtrados.filter(e => e.firma_url).length;
  const sinFirma = filtrados.filter(e => !e.firma_url).length;

  const handleUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['empleados-jefes-sitio'] });
    queryClient.invalidateQueries({ queryKey: ['empleados-todos-firma'] });
  };

  const loading = isLoading || loadingTodos;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total jefes', value: filtrados.length, color: 'text-white' },
          { label: 'Con firma', value: conFirma, color: 'text-emerald-400' },
          { label: 'Sin firma', value: sinFirma, color: sinFirma > 0 ? 'text-amber-400' : 'text-slate-400' },
        ].map(s => (
          <Card key={s.label} className="bg-slate-800/60 border-slate-700/50">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar jefe de sitio o ubicación..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/50 border-slate-700/50"
          />
        </div>
        <Button variant="outline" size="icon" onClick={refetch} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="bg-slate-800/60 border-slate-700/50">
          <CardContent className="py-16 text-center">
            <UserCheck className="h-10 w-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">
              {search ? 'No hay jefes que coincidan con la búsqueda.' : 'No hay jefes de sitio cargados aún.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((emp, i) => (
            <motion.div key={emp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <JefeSitioCard empleado={emp} onUpdated={handleUpdated} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}