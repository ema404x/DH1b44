import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const ESTADO_COLORS = {
  activa: '#ef4444',
  en_atencion: '#eab308',
  resuelta: '#22c55e',
  cancelada: '#64748b',
};

const TIPO_LABELS = {
  incendio: '🔥 Incendio',
  inundacion: '💧 Inundación',
  corte_electrico: '⚡ Corte Eléctrico',
  derrumbe: '🧱 Derrumbe',
  rotura_gas: '💨 Rotura Gas',
  vandalismo: '🚨 Vandalismo',
  accidente: '🏥 Accidente',
  otro: '⚠️ Otro',
};

const TIPO_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#f97316', '#a855f7', '#ec4899', '#f43f5e', '#64748b'];
const COMUNA_COLORS = ['#3b82f6', '#a855f7', '#22c55e'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      {label && <p className="text-slate-300 font-semibold mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
  if (value === 0) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold">
      {value}
    </text>
  );
};

export default function EmergenciasDashboard({ emergencias }) {
  const dataEstado = useMemo(() => {
    const counts = {};
    emergencias.forEach(e => { counts[e.estado] = (counts[e.estado] || 0) + 1; });
    return Object.entries(counts).map(([estado, value]) => ({
      name: estado === 'activa' ? 'Activa' : estado === 'en_atencion' ? 'En Atención' : estado === 'resuelta' ? 'Resuelta' : 'Cancelada',
      value,
      color: ESTADO_COLORS[estado] || '#64748b',
    }));
  }, [emergencias]);

  const dataTipo = useMemo(() => {
    const counts = {};
    emergencias.forEach(e => { counts[e.tipo] = (counts[e.tipo] || 0) + 1; });
    return Object.entries(counts)
      .map(([tipo, total]) => ({ tipo: TIPO_LABELS[tipo] || tipo, total }))
      .sort((a, b) => b.total - a.total);
  }, [emergencias]);

  const dataComuna = useMemo(() => {
    const counts = {};
    emergencias.forEach(e => { if (e.comuna) counts[e.comuna] = (counts[e.comuna] || 0) + 1; });
    return Object.entries(counts).map(([comuna, total]) => ({ comuna, total }));
  }, [emergencias]);

  const tiempoPromedio = useMemo(() => {
    const resueltas = emergencias.filter(e => e.estado === 'resuelta' && e.tiempo_respuesta_min > 0);
    if (!resueltas.length) return null;
    return Math.round(resueltas.reduce((s, e) => s + e.tiempo_respuesta_min, 0) / resueltas.length);
  }, [emergencias]);

  if (emergencias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <p className="text-lg font-medium">Sin datos para mostrar</p>
        <p className="text-sm mt-1">Registrá emergencias para ver estadísticas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total registradas', value: emergencias.length, color: 'text-white' },
          { label: 'Activas ahora', value: dataEstado.find(d => d.name === 'Activa')?.value || 0, color: 'text-red-400' },
          { label: 'Tipos distintos', value: dataTipo.length, color: 'text-blue-400' },
          { label: 'Tiempo prom. resolución', value: tiempoPromedio ? `${tiempoPromedio} min` : '—', color: 'text-emerald-400' },
        ].map((k, i) => (
          <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Fila: Torta por estado + Barras por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Torta — por estado */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">Por Estado</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={dataEstado}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                labelLine={false}
                label={CustomPieLabel}
              >
                {dataEstado.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Barras — por tipo */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">Por Tipo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dataTipo} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="tipo" tick={{ fill: '#94a3b8', fontSize: 11 }} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {dataTipo.map((_, i) => (
                  <Cell key={i} fill={TIPO_COLORS[i % TIPO_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Barras por comuna */}
      {dataComuna.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">Por Comuna</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dataComuna} margin={{ left: 8, right: 16 }}>
              <XAxis dataKey="comuna" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {dataComuna.map((_, i) => (
                  <Cell key={i} fill={COMUNA_COLORS[i % COMUNA_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}