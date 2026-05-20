import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Pencil, Trash2, Eye, Calendar, AlertCircle, CheckCircle2, 
  Clock, Filter, Download, Zap, Upload 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Convertir número serial de Excel a Date
const excelSerialToDate = (serial) => {
  if (!serial || typeof serial !== 'number') return null;
  // Excel serial date starts from Jan 1, 1900
  const excelEpoch = new Date(1900, 0, 1);
  const date = new Date(excelEpoch.getTime() + (serial - 1) * 86400000);
  return date;
};

export default function InformePlaneacion() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMes, setFilterMes] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const queryClient = useQueryClient();

  const { data: informes = [], isLoading } = useQuery({
    queryKey: ['informes-planeacion'],
    queryFn: () => base44.entities.InformePlaneacion.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InformePlaneacion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['informes-planeacion'] });
    },
  });

  const handleImportFile = async (file) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.functions.invoke('importarInformesPlaneacion', { file_url });
      queryClient.invalidateQueries({ queryKey: ['informes-planeacion'] });
      alert(`✓ Se importaron ${result.success} de ${result.total} informes`);
    } catch (err) {
      alert(`Error al importar: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const meses = ['FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO'];
  const statusOptions = ['CONTRATADO', 'SE SOLICITO INFORME', 'se sinvito a cotizar', 'EN PROCESO', 'PENDIENTE', 'PRESENTADOS A SAP'];

  const filteredInformes = informes.filter(inf => {
    const searchMatch = inf.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       inf.proveedor_2025?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       inf.proveedor_contratado_2026?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       inf.contacto_2025?.toLowerCase().includes(searchTerm.toLowerCase());
    
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

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'CONTRATADO':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'EN PROCESO':
        return <Clock className="h-4 w-4" />;
      case 'SE SOLICITO INFORME':
      case 'se sinvito a cotizar':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6 p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              Informes de Planificación
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Gestiona contrataciones, proveedores y solicitudes</p>
          </div>
          <div className="flex gap-2">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Nuevo Informe
            </Button>
            <Button 
              variant="outline" 
              className="gap-2" 
              disabled={isImporting}
              onClick={() => document.getElementById('excel-input').click()}
            >
              <Upload className="h-4 w-4" /> {isImporting ? 'Importando...' : 'Importar Excel'}
            </Button>
            <input 
              id="excel-input" 
              type="file" 
              accept=".xlsx,.xls" 
              className="hidden" 
              onChange={(e) => handleImportFile(e.target.files?.[0])}
            />
          </div>
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                placeholder="Buscar por descripción, proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white"
              />
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
                <Download className="h-3 w-3" /> Exportar
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabla de informes */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Cargando informes...</div>
        ) : filteredInformes.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-500 mb-3 opacity-50" />
            <p className="text-slate-400">No hay informes que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredInformes.map((inf) => (
              <motion.div key={inf.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm hover:from-slate-800/60 hover:to-slate-900/60 transition-all">
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start">
                      {/* Mes */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Mes</p>
                        <Badge variant="secondary" className="text-xs">{inf.mes || '—'}</Badge>
                      </div>

                      {/* Descripción */}
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Descripción</p>
                        <p className="text-sm text-white font-medium line-clamp-2">{inf.descripcion || '—'}</p>
                      </div>

                      {/* Proveedor 2025 */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Proveedor 2025</p>
                        <p className="text-xs text-slate-300 line-clamp-2">{inf.proveedor_2025 || '—'}</p>
                      </div>

                      {/* Contacto 2025 */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Contacto 2025</p>
                        <p className="text-xs text-slate-300 line-clamp-2">{inf.contacto_2025 || '—'}</p>
                      </div>

                      {/* Fecha de Envío a Contratar */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Fecha Envío</p>
                        <p className="text-xs text-slate-300">
                          {inf.fecha_envio_contratar ? 
                            format(excelSerialToDate(parseInt(inf.fecha_envio_contratar)), 'dd/MM/yyyy', { locale: es })
                            : '—'
                          }
                        </p>
                      </div>

                      {/* Proveedor 2026 */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Contratado 2026</p>
                        <p className="text-xs text-slate-300 line-clamp-2">{inf.proveedor_contratado_2026 || '—'}</p>
                      </div>

                      {/* Estado */}
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Estado</p>
                          <Badge className={`text-xs flex items-center gap-1 w-fit ${statusColors[inf.estado_contacto] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                            <StatusIcon status={inf.estado_contacto} />
                            {inf.estado_contacto || 'PENDIENTE'}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700/50"
                            onClick={() => setEditingId(inf.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400/70 hover:text-red-300 hover:bg-red-950/30"
                            onClick={() => deleteMutation.mutate(inf.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Nota adicional */}
                    {inf.notas && (
                      <div className="mt-3 pt-3 border-t border-slate-700/30">
                        <p className="text-xs text-slate-400"><strong>Notas:</strong> {inf.notas}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Resumen */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-8">
        {[
          { label: 'Total', value: filteredInformes.length, color: 'from-blue-500', icon: Zap },
          { label: 'Contratados', value: filteredInformes.filter(i => i.estado_contacto === 'CONTRATADO').length, color: 'from-emerald-500', icon: CheckCircle2 },
          { label: 'En Proceso', value: filteredInformes.filter(i => i.estado_contacto === 'EN PROCESO').length, color: 'from-purple-500', icon: Clock },
          { label: 'Por Cotizar', value: filteredInformes.filter(i => i.estado_contacto === 'se sinvito a cotizar').length, color: 'from-amber-500', icon: AlertCircle },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className={`border-0 bg-gradient-to-br ${stat.color}/20 to-transparent backdrop-blur`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${stat.color.replace('from-', 'text-').split('/')[0]}`} />
                  <p className="text-xs font-semibold text-slate-400">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>
    </div>
  );
}