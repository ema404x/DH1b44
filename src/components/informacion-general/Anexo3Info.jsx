import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Wrench, Zap, Shield, Building2, CalendarDays, FileText,
  ClipboardList, ChevronDown, AlertTriangle, CheckCircle2, Flame,
  Droplets, Bolt, Wind, ArrowUpRight, Lock, Star
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/* ─── datos ─────────────────────────────────────────────── */
const RUBROS = [
  { nombre: 'Relevamiento e Inventario', rutinas: 2,  grupo: 'general' },
  { nombre: 'Predio Superficie Verde',   rutinas: 3,  grupo: 'general' },
  { nombre: 'Predio Superficie Seca',    rutinas: 2,  grupo: 'general' },
  { nombre: 'Fachadas',                  rutinas: 4,  grupo: 'estructura' },
  { nombre: 'Estructura',                rutinas: 5,  grupo: 'estructura' },
  { nombre: 'Cubiertas y Drenajes',      rutinas: 4,  grupo: 'estructura' },
  { nombre: 'Mampostería',               rutinas: 3,  grupo: 'estructura' },
  { nombre: 'Terminaciones',             rutinas: 3,  grupo: 'estructura' },
  { nombre: 'Cerramientos y Tabiquería', rutinas: 4,  grupo: 'estructura' },
  { nombre: 'Mobiliario Fijo',           rutinas: 2,  grupo: 'estructura' },
  { nombre: 'Desagües Pluviales',        rutinas: 3,  grupo: 'instalaciones' },
  { nombre: 'Desagües Cloacales',        rutinas: 3,  grupo: 'instalaciones' },
  { nombre: 'Instalación de Agua',       rutinas: 4,  grupo: 'instalaciones' },
  { nombre: 'Instalación Contra Incendio', rutinas: 10, grupo: 'instalaciones', destacado: true },
  { nombre: 'Instalaciones de Gas',      rutinas: 4,  grupo: 'instalaciones' },
  { nombre: 'Instalación Eléctrica',     rutinas: 12, grupo: 'instalaciones', destacado: true },
  { nombre: 'Instalación Baja Tensión',  rutinas: 3,  grupo: 'instalaciones' },
  { nombre: 'Calefacción',               rutinas: 5,  grupo: 'climatizacion' },
  { nombre: 'Refrigeración',             rutinas: 3,  grupo: 'climatizacion' },
  { nombre: 'Ventilación',               rutinas: 2,  grupo: 'climatizacion' },
  { nombre: 'Elevadores',                rutinas: 3,  grupo: 'especiales' },
  { nombre: 'Plataformas Elevadoras',    rutinas: 2,  grupo: 'especiales' },
  { nombre: 'Saneamiento',               rutinas: 4,  grupo: 'especiales' },
];

const MAX_RUTINAS = Math.max(...RUBROS.map(r => r.rutinas));

const GRUPO_META = {
  general:       { label: 'General',        color: '#60a5fa' },
  estructura:    { label: 'Estructura',      color: '#34d399' },
  instalaciones: { label: 'Instalaciones',   color: '#f59e0b' },
  climatizacion: { label: 'Climatización',   color: '#fb923c' },
  especiales:    { label: 'Especiales',      color: '#a78bfa' },
};

const FRECUENCIAS = [
  { ciclo: 'Mensual',       cantidad: 33, pct: 34, color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
  { ciclo: 'Trimestral',    cantidad: 19, pct: 20, color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  { ciclo: 'Anual',         cantidad: 18, pct: 19, color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  { ciclo: 'Semestral',     cantidad: 16, pct: 17, color: '#22d3ee', bg: 'rgba(34,211,238,0.15)' },
  { ciclo: 'Bimestral',     cantidad: 5,  pct: 5,  color: '#a3e635', bg: 'rgba(163,230,53,0.15)' },
  { ciclo: 'Quincenal',     cantidad: 2,  pct: 2,  color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  { ciclo: 'Bienal',        cantidad: 2,  pct: 2,  color: '#c084fc', bg: 'rgba(192,132,252,0.15)' },
  { ciclo: 'Cuatrimestral', cantidad: 1,  pct: 1,  color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)' },
];

const ESTACIONALIDAD = [
  { sistema: 'Calefacción', detalle: 'calderas y calefactores', inicio: 2, fin: 8,  color: '#fb923c', icono: Flame },
  { sistema: 'Refrigeración', detalle: 'unidades enfriadoras', inicio: 8, fin: 2,  color: '#60a5fa', icono: Droplets, invertido: true },
  { sistema: 'Ventiladores', detalle: '',                        inicio: 9, fin: 2,  color: '#4ade80', icono: Wind },
  { sistema: 'Iluminación / Juegos', detalle: 'recesos escolares', inicio: null, fin: null, color: '#a78bfa', icono: Star, custom: 'Jul + Feb' },
];

const MESES = ['E','F','M','A','M','J','J','A','S','O','N','D'];

const ORDENES_TIPIFICADAS = [
  { code: 'MEES', titulo: 'Ext. Superficie Verde', desc: 'Genera un corte de césped adicional fuera del ciclo programado', color: '#4ade80' },
  { code: 'MEPL', titulo: 'Observ. Cielorrasos',  desc: 'Carga de novedades detectadas en cielorrasos durante recorrido', color: '#60a5fa' },
  { code: 'MEL',  titulo: 'Unid. Enfriadoras',    desc: 'Asociada específicamente a equipos de refrigeración central', color: '#22d3ee' },
];

const CERT_ITEMS = [
  'Fundaciones', 'Hormigón', 'Estructura metálica', 'Estructura de madera',
  'Bovedilla', 'Mampostería', 'Cateo de cielorrasos', 'Inst. eléctrica general',
  'Puesta a tierra y pararrayos', 'Inst. de gas', 'Contra incendio',
  'Calefacción', 'Elevadores / plataformas',
];

/* ─── helpers ────────────────────────────────────────────── */
function GoldLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#D4AF37' }}>
      {children}
    </p>
  );
}

function SectionCard({ title, icon: Icon, iconColor, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border border-white/10"
      style={{ background: 'rgba(10,37,64,0.45)', backdropFilter: 'blur(12px)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left group transition-colors hover:bg-white/5"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}>
            <Icon className="h-4 w-4" style={{ color: iconColor }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{title}</p>
            {badge && <p className="text-[10px] mt-0.5" style={{ color: iconColor + 'cc' }}>{badge}</p>}
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-white/30 group-hover:text-white/50 transition-colors" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── componente principal ───────────────────────────────── */
export default function Anexo3Info() {
  const [rubroGrupo, setRubroGrupo] = useState('todos');

  const rubrosFiltrados = rubroGrupo === 'todos'
    ? RUBROS
    : RUBROS.filter(r => r.grupo === rubroGrupo);

  return (
    <div className="space-y-5 pb-8">

      {/* ── HERO ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden border p-7"
        style={{ borderColor: 'rgba(212,175,55,0.4)', background: 'linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(10,37,64,0.75) 50%, rgba(15,52,96,0.6) 100%)' }}
      >
        {/* glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)' }} />

        <div className="relative flex items-start gap-5">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)', boxShadow: '0 8px 32px rgba(212,175,55,0.35)' }}>
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-2xl font-black text-white tracking-tight">Anexo 3 · PETP</h2>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
                style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37', borderColor: 'rgba(212,175,55,0.45)' }}>
                DOCUMENTO CONTRACTUAL
              </span>
            </div>
            <p className="text-sm font-semibold mb-3" style={{ color: '#D4AF37cc' }}>
              Pliego de Especificaciones Técnicas Particulares · DGMESC · Ministerio de Educación GCBA
            </p>
            <p className="text-sm text-white/70 leading-relaxed max-w-2xl">
              Catálogo de <span className="text-white font-bold">96 rutinas de mantenimiento preventivo</span> que el contratista
              debe ejecutar sobre los edificios escolares de CABA. Define para cada componente: qué hacer, con qué periodicidad
              y en qué plazo. Es el <span style={{ color: '#D4AF37' }} className="font-semibold">piso contractual de cumplimiento</span>.
            </p>
            <p className="mt-4 text-xs text-white/35 italic border-l-2 pl-3" style={{ borderColor: 'rgba(212,175,55,0.4)' }}>
              "Las rutinas que no sean aplicables a los edificios serán eliminadas." — el catálogo es universal, cada edificio activa su subconjunto.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── KPIs ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { value: '96',  label: 'Rutinas totales',        sub: 'en 24 rubros',        icon: ClipboardList, color: '#D4AF37' },
          { value: '52',  label: 'Ciclo corto',            sub: 'mensual + trimestral', icon: Zap,           color: '#4ade80' },
          { value: '~16', label: 'Req. matriculado',       sub: 'arq. o ing. firmante', icon: Shield,        color: '#a78bfa' },
          { value: '24',  label: 'Rubros',                 sub: 'sistemas constructivos',icon: Building2,     color: '#60a5fa' },
        ].map(({ value, label, sub, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-white/10 p-4 relative overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="absolute top-3 right-3 h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: `${color}15` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <p className="text-3xl font-black text-white tabular-nums mb-0.5">{value}</p>
            <p className="text-xs font-semibold text-white/70">{label}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{sub}</p>
            {/* bottom glow */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl"
              style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
          </motion.div>
        ))}
      </div>

      {/* ── RÉGIMEN ECONÓMICO ────────────────── */}
      <SectionCard title="Régimen económico: Mantenimiento vs. TOM" icon={Wrench} iconColor="#f59e0b"
        badge="Eje contractual de facturación y certificación" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Mantenimiento */}
          <div className="rounded-xl p-4 border relative overflow-hidden"
            style={{ borderColor: 'rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.07)' }}>
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)' }} />
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-blue-400" />
              <p className="text-sm font-bold text-blue-200">Mantenimiento (abono)</p>
            </div>
            <p className="text-xs text-blue-200/65 leading-relaxed">
              Verificación · reparación menor · reposición de piezas chicas · limpieza · lubricación · ajuste.
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px] text-blue-300 font-semibold">Cubierto por el contrato</span>
            </div>
          </div>
          {/* TOM */}
          <div className="rounded-xl p-4 border relative overflow-hidden"
            style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.07)' }}>
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)' }} />
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-bold text-amber-200">TOM — Trabajo de Obra</p>
            </div>
            <p className="text-xs text-amber-200/65 leading-relaxed">
              Reemplazos integrales · provisión de equipos · reparaciones estructurales · réplicas APH.
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] text-amber-300 font-semibold">Se presupuesta y certifica por separado</span>
            </div>
          </div>
        </div>
        {/* Regla 50% */}
        <div className="rounded-xl p-4 border flex items-start gap-3"
          style={{ borderColor: 'rgba(251,146,60,0.35)', background: 'rgba(251,146,60,0.08)' }}>
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(251,146,60,0.2)' }}>
            <AlertTriangle className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-200 mb-1">Regla del 50%</p>
            <p className="text-xs text-orange-200/70 leading-relaxed">
              En <b className="text-orange-200">cubiertas y carpinterías</b>: cuando los elementos a reparar/reponer superan el 50% del total,
              la DGMESC puede derivar la intervención completa a TOM. El corte de césped <b className="text-orange-200">nunca</b> puede derivarse
              a TOM — en todo caso se amplía vía orden MEES.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── FRECUENCIAS ──────────────────────── */}
      <SectionCard title="Distribución por frecuencia de ejecución" icon={CalendarDays} iconColor="#4ade80"
        badge="Más del 50% de las rutinas se ejecutan al menos cada trimestre" defaultOpen>
        <div className="space-y-2.5">
          {FRECUENCIAS.map(({ ciclo, cantidad, pct, color, bg }) => (
            <div key={ciclo} className="flex items-center gap-3">
              <span className="text-xs text-white/60 w-24 flex-shrink-0 text-right">{ciclo}</span>
              <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
                  className="h-full rounded-full flex items-center px-2"
                  style={{ background: bg, border: `1px solid ${color}30` }}
                >
                  <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{cantidad}</span>
                </motion.div>
              </div>
              <span className="text-[11px] text-white/35 w-8 text-right tabular-nums">{pct}%</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── ESTACIONALIDAD ───────────────────── */}
      <SectionCard title="Estacionalidad — rutinas con ventana de meses" icon={CalendarDays} iconColor="#fb923c"
        badge="~12 rutinas no corren todo el año — se desactivan fuera de temporada">
        <div className="space-y-4">
          {/* grilla de meses */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-separate" style={{ borderSpacing: '2px' }}>
              <thead>
                <tr>
                  <td className="text-white/40 pb-1 pr-3 text-xs w-36">Sistema</td>
                  {MESES.map(m => (
                    <td key={m} className="text-center text-white/30 font-mono pb-1">{m}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ESTACIONALIDAD.map(({ sistema, inicio, fin, color, icono: Icono, invertido, custom }) => (
                  <tr key={sistema}>
                    <td className="pr-3 py-1">
                      <div className="flex items-center gap-1.5">
                        <Icono className="h-3 w-3 flex-shrink-0" style={{ color }} />
                        <span className="text-white/70 whitespace-nowrap">{sistema}</span>
                      </div>
                    </td>
                    {MESES.map((_, idx) => {
                      let activo = false;
                      if (custom) {
                        activo = idx === 1 || idx === 6; // feb / jul
                      } else if (!invertido) {
                        activo = idx >= inicio && idx <= fin;
                      } else {
                        activo = idx >= inicio || idx <= fin; // sep→mar cruzando año
                      }
                      return (
                        <td key={idx} className="text-center py-1">
                          <div className="mx-auto w-5 h-5 rounded"
                            style={{ background: activo ? `${color}30` : 'rgba(255,255,255,0.04)', border: activo ? `1px solid ${color}60` : '1px solid transparent' }}>
                            {activo && <div className="w-full h-full rounded flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                            </div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* ── CERTIFICACIÓN ────────────────────── */}
      <SectionCard title="Certificación profesional obligatoria" icon={Shield} iconColor="#a78bfa"
        badge="~16 rutinas requieren informe firmado por profesional matriculado">
        <GoldLabel>Materias que exigen firma de matriculado</GoldLabel>
        <div className="flex flex-wrap gap-2 mb-5">
          {CERT_ITEMS.map(item => (
            <span key={item} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border"
              style={{ background: 'rgba(168,139,250,0.1)', color: '#c4b5fd', borderColor: 'rgba(168,139,250,0.25)' }}>
              {item}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { titulo: 'Registro de Verificadores', desc: 'Conservador inscripto para elevadores y plataformas elevadoras', icon: Lock, color: '#a78bfa' },
            { titulo: 'Registros CABA', desc: 'CI, desinfección, limpieza de tanques y fachadas (Ley 257 / Ley 6116)', icon: Building2, color: '#60a5fa' },
            { titulo: 'Oblea QR', desc: 'Instalaciones a presión: agua, gas y bombas requieren sello del organismo de control', icon: CheckCircle2, color: '#4ade80' },
          ].map(({ titulo, desc, icon: Icon, color }) => (
            <div key={titulo} className="p-3 rounded-xl border flex items-start gap-3"
              style={{ borderColor: `${color}25`, background: `${color}08` }}>
              <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18` }}>
                <Icon className="h-3.5 w-3.5" style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-bold text-white mb-0.5">{titulo}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: `${color}99` }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── SISMESC ──────────────────────────── */}
      <SectionCard title="SISMESC — Sistema de Gestión DGMESC" icon={FileText} iconColor="#22d3ee"
        badge="Toda la operación contractual se documenta aquí">
        <p className="text-xs text-white/55 mb-4 leading-relaxed">
          Plataforma donde se cargan rutinas, informes firmados, comprobantes de fumigación, check lists y
          certificados de potabilidad. Las órdenes tipificadas generan cargas específicas en el sistema.
        </p>
        <GoldLabel>Órdenes tipificadas</GoldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ORDENES_TIPIFICADAS.map(({ code, titulo, desc, color }) => (
            <div key={code} className="rounded-xl border p-4 relative overflow-hidden"
              style={{ borderColor: `${color}25`, background: `${color}07` }}>
              <div className="flex items-start gap-3 mb-2">
                <span className="text-xs font-mono font-black px-2 py-1 rounded-lg flex-shrink-0"
                  style={{ background: `${color}20`, color, border: `1px solid ${color}35` }}>
                  {code}
                </span>
                <p className="text-xs font-semibold text-white leading-tight mt-1">{titulo}</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: `${color}88` }}>{desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── APH ──────────────────────────────── */}
      <SectionCard title="Edificios APH — Protección Histórica" icon={Building2} iconColor="#60a5fa"
        badge="Transversal a casi todos los rubros — aplica Anexo 4 APH">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { paso: '01', titulo: 'Detección', desc: 'El edificio tiene flag APH activo. Las rutinas afectadas cambian de régimen automáticamente.', color: '#60a5fa' },
            { paso: '02', titulo: 'Retiro cuidadoso', desc: 'Las partes en riesgo se retiran con tratamiento diferenciado — sin demolición, sin reemplazo estándar.', color: '#a78bfa' },
            { paso: '03', titulo: 'Derivación a TOM', desc: 'La restauración/réplica se presupuesta como TOM y se ejecuta consensuado con la Inspección.', color: '#f59e0b' },
          ].map(({ paso, titulo, desc, color }) => (
            <div key={paso} className="rounded-xl border p-4 relative"
              style={{ borderColor: `${color}25`, background: `${color}07` }}>
              <span className="text-4xl font-black absolute right-3 top-2 tabular-nums"
                style={{ color: `${color}15` }}>{paso}</span>
              <p className="text-xs font-bold mb-1.5" style={{ color }}>{titulo}</p>
              <p className="text-[11px] text-white/55 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── RUBROS ───────────────────────────── */}
      <SectionCard title="Los 24 rubros del Anexo 3" icon={ClipboardList} iconColor="#D4AF37"
        badge="Instalación Eléctrica (12) y Contra Incendio (10) son los de mayor densidad">
        {/* filtros de grupo */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['todos', ...Object.keys(GRUPO_META)].map(g => (
            <button key={g} onClick={() => setRubroGrupo(g)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
              style={rubroGrupo === g
                ? { background: g === 'todos' ? 'rgba(212,175,55,0.2)' : `${GRUPO_META[g]?.color}20`, color: g === 'todos' ? '#D4AF37' : GRUPO_META[g]?.color, borderColor: g === 'todos' ? 'rgba(212,175,55,0.4)' : `${GRUPO_META[g]?.color}40` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.1)' }
              }>
              {g === 'todos' ? 'Todos' : GRUPO_META[g]?.label}
            </button>
          ))}
        </div>

        {/* tabla de barras */}
        <div className="space-y-2">
          {rubrosFiltrados.map(({ nombre, rutinas, grupo, destacado }) => {
            const meta = GRUPO_META[grupo];
            const pct = (rutinas / MAX_RUTINAS) * 100;
            return (
              <motion.div key={nombre} layout
                className="flex items-center gap-3 py-1.5 rounded-lg px-2 hover:bg-white/5 transition-colors group">
                <span className="text-xs text-white/60 flex-1 min-w-0 truncate group-hover:text-white/80 transition-colors">
                  {nombre}
                  {destacado && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37' }}>TOP</span>}
                </span>
                <div className="w-28 h-4 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `${meta?.color}40`, border: `1px solid ${meta?.color}50` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums w-4 text-right flex-shrink-0"
                  style={{ color: meta?.color }}>{rutinas}</span>
              </motion.div>
            );
          })}
        </div>
      </SectionCard>

    </div>
  );
}