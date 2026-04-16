import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Bell, BellOff, Plus, Trash2, Save, ShieldAlert, Package, Clock,
  Mail, Monitor, AlertTriangle, CheckCircle2, Loader2, Play, Settings
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_CONFIG = {
  garantia_activo: {
    label: 'Garantía de Activos',
    icon: ShieldAlert,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    desc: 'Alerta cuando la garantía de un activo está próxima a vencer.',
  },
  stock_material: {
    label: 'Stock Crítico de Materiales',
    icon: Package,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    desc: 'Alerta cuando el stock de un material cae por debajo del umbral definido.',
  },
  pendiente_vencido: {
    label: 'Pendientes Altamente Vencidos',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    desc: 'Alerta cuando un pendiente SAP lleva más días vencidos del límite configurado.',
  },
};

const DEFAULT_CONFIGS = {
  garantia_activo:   { tipo: 'garantia_activo',   nombre: 'Alerta de Garantías', dias_anticipacion: 30, notificar_email: true, notificar_banner: true, email_destinatarios: [], activo: true },
  stock_material:    { tipo: 'stock_material',    nombre: 'Alerta de Stock',     umbral_stock_pct: 0,   notificar_email: true, notificar_banner: true, email_destinatarios: [], activo: true },
  pendiente_vencido: { tipo: 'pendiente_vencido', nombre: 'Pendientes Vencidos', dias_vencimiento_pendiente: 7, notificar_email: true, notificar_banner: true, email_destinatarios: [], activo: true },
};

function EmailTagInput({ value = [], onChange }) {
  const [input, setInput] = useState('');

  const addEmail = () => {
    const email = input.trim();
    if (!email || !email.includes('@')) return;
    if (!value.includes(email)) onChange([...value, email]);
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="email@ejemplo.com"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
          className="h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={addEmail}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(email => (
            <span key={email} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
              {email}
              <button onClick={() => onChange(value.filter(e => e !== email))} className="hover:text-red-500 transition-colors">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigCard({ config, onSave, onDelete, onTest }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const tipo = TIPO_CONFIG[form.tipo];
  const Icon = tipo.icon;

  // Sync form when config changes from outside (after save)
  React.useEffect(() => { setForm({ ...config }); }, [config.updated_date]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const handleTest = async () => {
    if (!form.email_destinatarios || form.email_destinatarios.length === 0) {
      toast.error('Agregá al menos un email destinatario y guardá antes de probar.');
      return;
    }
    // Guardar primero para asegurarse de que los datos estén en la DB
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setTesting(true);
    await onTest(form);
    setTesting(false);
  };

  return (
    <Card className={`border ${form.activo ? tipo.border : 'border-border/40'} transition-all`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg ${tipo.bg} ${tipo.border} border flex items-center justify-center flex-shrink-0`}>
              <Icon className={`h-4 w-4 ${tipo.color}`} />
            </div>
            <div>
              <Input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="h-7 text-sm font-semibold border-0 p-0 focus-visible:ring-0 bg-transparent"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">{tipo.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.activo}
              onCheckedChange={v => setForm(f => ({ ...f, activo: v }))}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(config.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Parámetros según tipo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {form.tipo === 'garantia_activo' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Días de anticipación</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={365}
                  value={form.dias_anticipacion ?? 30}
                  onChange={e => setForm(f => ({ ...f, dias_anticipacion: Number(e.target.value) }))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">días antes</span>
              </div>
            </div>
          )}

          {form.tipo === 'stock_material' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Umbral adicional sobre mínimo</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={200}
                  value={form.umbral_stock_pct ?? 0}
                  onChange={e => setForm(f => ({ ...f, umbral_stock_pct: Number(e.target.value) }))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">% sobre mínimo</span>
              </div>
              <p className="text-[10px] text-muted-foreground">0% = alertar exactamente en mínimo. 20% = alertar cuando quede 20% más que el mínimo.</p>
            </div>
          )}

          {form.tipo === 'pendiente_vencido' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Días vencidos para alertar</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={365}
                  value={form.dias_vencimiento_pendiente ?? 7}
                  onChange={e => setForm(f => ({ ...f, dias_vencimiento_pendiente: Number(e.target.value) }))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">días vencido</span>
              </div>
            </div>
          )}

          {/* Notificaciones */}
          <div className="space-y-2">
            <Label className="text-xs">Canales de notificación</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch size="sm"
                  checked={form.notificar_email}
                  onCheckedChange={v => setForm(f => ({ ...f, notificar_email: v }))}
                />
                <span className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch size="sm"
                  checked={form.notificar_banner}
                  onCheckedChange={v => setForm(f => ({ ...f, notificar_banner: v }))}
                />
                <span className="text-xs flex items-center gap-1"><Monitor className="h-3 w-3" /> Banner</span>
              </label>
            </div>
          </div>
        </div>

        {/* Emails destinatarios */}
        {form.notificar_email && (
          <div className="space-y-1.5">
            <Label className="text-xs">Destinatarios de email</Label>
            <EmailTagInput
              value={form.email_destinatarios || []}
              onChange={v => setForm(f => ({ ...f, email_destinatarios: v }))}
            />
            {(!form.email_destinatarios || form.email_destinatarios.length === 0) && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  No se enviarán emails hasta que agregues al menos un destinatario.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Última notificación */}
        {config.ultima_notificacion && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Última notificación: {format(parseISO(config.ultima_notificacion), "d 'de' MMMM HH:mm", { locale: es })}
          </p>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Probar ahora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConfigAlertas() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['alerta-configs'],
    queryFn: () => base44.entities.AlertaConfig.list('-created_date'),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['alerta-logs'],
    queryFn: () => base44.entities.AlertaLog.list('-fecha_alerta', 20),
  });

  const createConfig = useMutation({
    mutationFn: (tipo) => base44.entities.AlertaConfig.create(DEFAULT_CONFIGS[tipo]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerta-configs'] }); toast.success('Configuración creada'); },
  });

  const saveConfig = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AlertaConfig.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerta-configs'] }); toast.success('Configuración guardada'); },
  });

  const deleteConfig = useMutation({
    mutationFn: (id) => base44.entities.AlertaConfig.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerta-configs'] }); toast.success('Configuración eliminada'); },
  });

  const testConfig = async (form) => {
    try {
      const res = await base44.functions.invoke('checkAlertas', {});
      if (res.data?.success) {
        const { totalAlertas, resumen, emailsEnviados } = res.data;
        const cfgResumen = resumen?.find(r => r.tipo === form.tipo);
        const alertasDetectadas = cfgResumen?.alertas ?? totalAlertas;
        const emailSent = cfgResumen?.emailEnviado;

        if (alertasDetectadas === 0) {
          toast.info('No se detectaron alertas activas para esta configuración.');
        } else if (emailSent) {
          toast.success(`✅ Email enviado a ${form.email_destinatarios?.join(', ')} con ${alertasDetectadas} alerta(s).`);
        } else if (form.notificar_email && form.email_destinatarios?.length > 0) {
          toast.warning(`⚠️ Se detectaron ${alertasDetectadas} alerta(s) pero el email falló. Revisá los logs.`);
        } else {
          toast.success(`${alertasDetectadas} alerta(s) detectada(s). Email no configurado.`);
        }
        qc.invalidateQueries({ queryKey: ['alerta-logs'] });
        qc.invalidateQueries({ queryKey: ['alertas-activas'] });
        qc.invalidateQueries({ queryKey: ['alerta-configs'] });
      } else {
        toast.error(res.data?.error || 'Error al ejecutar');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const tiposExistentes = configs.map(c => c.tipo);
  const tiposDisponibles = Object.keys(TIPO_CONFIG).filter(t => !tiposExistentes.includes(t));

  const NIVEL_COLORS = { critical: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700', info: 'bg-blue-100 text-blue-700' };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Configuración de Alertas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestiona las alertas proactivas del sistema para garantías, stock y pendientes.</p>
        </div>
        {tiposDisponibles.length > 0 && (
          <div className="relative">
            <Button size="sm" className="gap-1.5" onClick={() => setCreating(c => !c)}>
              <Plus className="h-4 w-4" /> Nueva alerta
            </Button>
            {creating && (
              <div className="absolute right-0 top-10 z-20 bg-card border rounded-xl shadow-xl p-2 min-w-48 space-y-1">
                {tiposDisponibles.map(tipo => {
                  const cfg = TIPO_CONFIG[tipo];
                  const Icon = cfg.icon;
                  return (
                    <button key={tipo}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-left"
                      onClick={() => { createConfig.mutate(tipo); setCreating(false); }}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                      <span className="text-sm">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configs */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : configs.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <BellOff className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Sin alertas configuradas</p>
              <p className="text-sm text-muted-foreground mt-1">Creá alertas para recibir notificaciones proactivas sobre el estado del sistema.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.keys(TIPO_CONFIG).map(tipo => {
                const cfg = TIPO_CONFIG[tipo];
                const Icon = cfg.icon;
                return (
                  <Button key={tipo} variant="outline" size="sm" className="gap-2"
                    onClick={() => createConfig.mutate(tipo)}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} /> {cfg.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map(cfg => (
            <ConfigCard
              key={cfg.id}
              config={cfg}
              onSave={(form) => saveConfig.mutate({ id: cfg.id, data: form })}
              onDelete={(id) => deleteConfig.mutate(id)}
              onTest={testConfig}
            />
          ))}
        </div>
      )}

      {/* Log reciente */}
      {logs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" /> Historial reciente ({logs.length})
          </h2>
          <div className="rounded-xl border overflow-hidden">
            {logs.map((log, i) => {
              const tipo = TIPO_CONFIG[log.tipo] || TIPO_CONFIG.pendiente_vencido;
              const Icon = tipo.icon;
              return (
                <div key={log.id} className={`flex items-start gap-3 px-4 py-2.5 ${i % 2 === 0 ? 'bg-muted/20' : 'bg-card'} ${log.leida ? 'opacity-60' : ''}`}>
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tipo.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{log.titulo}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{log.mensaje}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${NIVEL_COLORS[log.nivel] || NIVEL_COLORS.warning}`}>{log.nivel}</span>
                    {log.fecha_alerta && (
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(log.fecha_alerta), 'd/M HH:mm')}
                      </span>
                    )}
                    {log.leida && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}