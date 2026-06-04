import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Filter, Upload, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';

const excelSerialToDate = (serial) => {
  if (!serial) return null;
  const parsed = parseInt(serial);
  if (isNaN(parsed) || parsed <= 0) return null;
  try {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (parsed - 1) * 86400000);
    return date instanceof Date && !isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
};

export default function PlanificacionTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMes, setFilterMes] = useState('all');
  const [isImporting, setIsImporting] = useState(false);

  const { data: informes = [], isLoading } = useQuery({
    queryKey: ['informes-planeacion'],
    queryFn: () => base44.entities.InformePlaneacion.list(),
  });

  const handleImportFile = async (file) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke('importarInformesPlaneacion', { file_url });
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const meses = ['FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO'];
  const statusOptions = ['CONTRATADO', 'SE SOLICITO INFORME', 'se sinvito a cotizar', 'EN PROCESO', 'PENDIENTE', 'PRESENTADOS A SAP'];

  const filteredInformes = informes.filter(inf => {
    const searchMatch = inf.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       inf.proveedor_2025?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       inf.proveedor_contratado_2026?.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = filterStatus === 'all' || inf.estado_contacto === filterStatus;
    const mesMatch = filterMes === 'all' || inf.mes === filterMes;
    return searchMatch && statusMatch && mesMatch;
  });

  const statusColors = {
    'CONTRATADO': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'SE SOLICITO INFORME': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'se sinvito a cotizar': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'EN PROCESO': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'PENDIENTE': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    'PRESENTADOS A SAP': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                placeholder="Buscar descripción, proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-xs"
              />
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 text-xs h-9"
                disabled={isImporting}
                onClick={() => document.getElementById('excel-input-plan').click()}
              >
                <Upload className="h-3 w-3" /> {isImporting ? 'Importando...' : 'Importar'}
              </Button>
              <input 
                id="excel-input-plan" 
                type="file" 
                accept=".xlsx,.xls" 
                className="hidden" 
                onChange={(e) => handleImportFile(e.target.files?.[0])}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabla */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando planificación...</div>
        ) : filteredInformes.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground">No hay registros</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredInformes.map((inf) => (
              <motion.div key={inf.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Mes</p>
                        <Badge variant="secondary" className="text-xs">{inf.mes || '—'}</Badge>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Descripción</p>
                        <p className="text-sm font-medium line-clamp-2">{inf.descripcion || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Proveedor 2025</p>
                        <p className="text-xs line-clamp-2">{inf.proveedor_2025 || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Contacto 2025</p>
                        <p className="text-xs line-clamp-2">{inf.contacto_2025 || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Contratado 2026</p>
                        <p className="text-xs line-clamp-2">{inf.proveedor_contratado_2026 || '—'}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Estado</p>
                          <Badge className={`text-xs flex items-center gap-1 w-fit ${statusColors[inf.estado_contacto] || 'bg-slate-500/20'}`}>
                            {inf.estado_contacto || 'PENDIENTE'}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Resumen */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: filteredInformes.length, icon: Zap },
          { label: 'Contratados', value: filteredInformes.filter(i => i.estado_contacto === 'CONTRATADO').length, icon: CheckCircle2 },
          { label: 'En Proceso', value: filteredInformes.filter(i => i.estado_contacto === 'EN PROCESO').length, icon: Clock },
          { label: 'Por Cotizar', value: filteredInformes.filter(i => i.estado_contacto === 'se sinvito a cotizar').length, icon: AlertCircle },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>
    </div>
  );
}