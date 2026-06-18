import React, { useState } from 'react';
import {
  BookOpen, Wrench, Zap, Shield, Building2, CalendarDays, FileText,
  ClipboardList, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RUBROS = [
  { nombre: 'Relevamiento e Inventario', rutinas: 2 },
  { nombre: 'Predio Superficie Verde', rutinas: 3 },
  { nombre: 'Predio Superficie Seca', rutinas: 2 },
  { nombre: 'Fachadas', rutinas: 4 },
  { nombre: 'Estructura', rutinas: 5 },
  { nombre: 'Cubiertas y Drenajes', rutinas: 4 },
  { nombre: 'Mampostería', rutinas: 3 },
  { nombre: 'Terminaciones', rutinas: 3 },
  { nombre: 'Cerramientos y Tabiquería', rutinas: 4 },
  { nombre: 'Mobiliario Fijo', rutinas: 2 },
  { nombre: 'Desagües Pluviales', rutinas: 3 },
  { nombre: 'Desagües Cloacales', rutinas: 3 },
  { nombre: 'Instalación de Agua', rutinas: 4 },
  { nombre: 'Instalación Contra Incendio', rutinas: 10 },
  { nombre: 'Instalaciones de Gas', rutinas: 4 },
  { nombre: 'Instalación Eléctrica', rutinas: 12 },
  { nombre: 'Instalación Baja Tensión', rutinas: 3 },
  { nombre: 'Calefacción', rutinas: 5 },
  { nombre: 'Refrigeración', rutinas: 3 },
  { nombre: 'Ventilación', rutinas: 2 },
  { nombre: 'Elevadores', rutinas: 3 },
  { nombre: 'Plataformas Elevadoras', rutinas: 2 },
  { nombre: 'Saneamiento', rutinas: 4 },
];

const FRECUENCIAS = [
  { ciclo: 'Mensual', cantidad: 33, color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', nota: 'Alta rotación' },
  { ciclo: 'Trimestral', cantidad: 19, color: 'bg-green-500/20 text-green-300 border-green-500/30', nota: '' },
  { ciclo: 'Semestral', cantidad: 16, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', nota: '' },
  { ciclo: 'Anual', cantidad: 18, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', nota: '' },
  { ciclo: 'Bimestral', cantidad: 5, color: 'bg-lime-500/20 text-lime-300 border-lime-500/30', nota: '' },
  { ciclo: 'Quincenal', cantidad: 2, color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', nota: '' },
  { ciclo: 'Bienal', cantidad: 2, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', nota: '' },
  { ciclo: 'Cuatrimestral', cantidad: 1, color: 'bg-teal-500/20 text-teal-300 border-teal-500/30', nota: '' },
];

const ESTACIONALIDAD = [
  { sistema: 'Calefacción (calderas, calefactores)', meses: 'Marzo – Septiembre' },
  { sistema: 'Refrigeración (unidades enfriadoras)', meses: 'Septiembre – Marzo' },
  { sistema: 'Ventiladores', meses: 'Octubre – Marzo' },
  { sistema: 'Iluminación y juegos', meses: 'Recesos invierno (jul) y verano (feb)' },
];

const ORDENES_TIPIFICADAS = [
  { code: 'MEES', desc: 'Genera un corte de césped adicional' },
  { code: 'MEPL', desc: 'Carga de observaciones de cielorrasos' },
  { code: 'MEL', desc: 'Asociada a unidades enfriadoras' },
];

function SeccionColapsable({ titulo, icono: Icono, color, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
        style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.08) 0%, rgba(10,37,64,0.5) 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
            <Icono className="h-4 w-4" style={{ color }} />
          </div>
          <span className="text-sm font-bold text-white">{titulo}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
      </button>
      {open && <div className="px-5 py-4 bg-black/20">{children}</div>}
    </div>
  );
}

export default function Anexo3Info() {
  return (
    <div className="space-y-6">

      {/* Hero documental */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(212,175,55,0.35)', background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(10,37,64,0.6) 100%)' }}>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #b8960f)' }}>
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-xl font-bold text-white">Anexo 3 al PETP</h2>
              <Badge variant="outline" className="text-[10px] border" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', borderColor: 'rgba(212,175,55,0.35)' }}>
                Documento Contractual
              </Badge>
            </div>
            <p className="text-sm font-medium" style={{ color: '#D4AF37' }}>
              Pliego de Especificaciones Técnicas Particulares · DGMESC · Ministerio de Educación GCBA
            </p>
            <p className="text-sm text-white/65 mt-2 leading-relaxed">
              Catálogo de <b className="text-white">96 rutinas de mantenimiento preventivo</b> que el contratista adjudicatario debe ejecutar sobre los edificios escolares de CABA.
              Define para cada componente del edificio: qué hay que hacer, con qué periodicidad y en qué plazo.
              Es el <span style={{ color: '#D4AF37' }}>piso contractual de cumplimiento del servicio</span>.
            </p>
            <p className="text-xs text-white/40 mt-3 italic">
              "Las rutinas que no sean aplicables a los edificios serán eliminadas." — Cada edificio activa solo su subconjunto del catálogo.
            </p>
          </div>
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Rutinas totales', value: '96', icon: ClipboardList, color: '#D4AF37' },
          { label: 'Rubros', value: '24', icon: Building2, color: '#60a5fa' },
          { label: 'Req. Matriculado', value: '~16', icon: Shield, color: '#a78bfa' },
          { label: '> 50% en ciclos cortos', value: '52', icon: Zap, color: '#34d399', sub: 'mensual + trimestral' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
            <Icon className="h-5 w-5 flex-shrink-0" style={{ color }} />
            <div>
              <p className="text-xl font-bold text-white tabular-nums">{value}</p>
              <p className="text-xs text-white/50 leading-tight">{label}</p>
              {sub && <p className="text-[10px] text-white/30">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Régimen económico */}
      <SeccionColapsable titulo="Régimen económico: Mantenimiento vs. TOM" icono={Wrench} color="#f59e0b" defaultOpen={true}>
        <p className="text-xs text-white/60 mb-4 leading-relaxed">
          Es el eje conceptual de todo el Anexo. Cada acción cae en una de dos categorías, y la distinción condiciona directamente la facturación y la certificación.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-blue-300" />
              <p className="text-sm font-bold text-blue-200">Por Mantenimiento (abono)</p>
            </div>
            <p className="text-xs text-blue-200/70 leading-relaxed">
              Verificación, reparación menor, reposición de piezas chicas, limpieza, lubricación y ajuste.
              Cubierto por el contrato — sin certificación separada.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-bold text-amber-200">TOM — Trabajo de Obra de Mantenimiento</p>
            </div>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              Reemplazos integrales, provisión de equipos, reparaciones estructurales, réplicas en APH.
              Se presupuestan y certifican por separado.
            </p>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-orange-500/30 bg-orange-500/10 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-orange-200 mb-0.5">Regla del 50%</p>
            <p className="text-xs text-orange-200/70 leading-relaxed">
              En cubiertas y carpinterías: cuando los elementos a reparar o reponer superan el 50% del total,
              la DGMESC puede derivar la intervención completa a TOM.
              El corte de césped nunca puede derivarse a TOM (en todo caso se amplía vía orden MEES).
            </p>
          </div>
        </div>
      </SeccionColapsable>

      {/* Distribución por frecuencia */}
      <SeccionColapsable titulo="Distribución por frecuencia de ejecución" icono={CalendarDays} color="#34d399" defaultOpen={true}>
        <p className="text-xs text-white/60 mb-4">
          Más del 50% de las rutinas se ejecutan al menos cada trimestre, lo que determina el volumen real del motor de generación de órdenes.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {FRECUENCIAS.map(({ ciclo, cantidad, color, nota }) => (
            <div key={ciclo} className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-semibold ${color}`}>
              <span>{ciclo}</span>
              <span className="font-bold text-base leading-none">{cantidad}</span>
              {nota && <span className="opacity-60 text-[10px]">· {nota}</span>}
            </div>
          ))}
        </div>
      </SeccionColapsable>

      {/* Estacionalidad */}
      <SeccionColapsable titulo="Estacionalidad — rutinas con ventana de meses" icono={CalendarDays} color="#fb923c">
        <p className="text-xs text-white/60 mb-3 leading-relaxed">
          Cerca de una docena de rutinas no corren todo el año. Estas necesitan la ventana de meses activos además de la frecuencia — fuera de temporada no se generan órdenes.
        </p>
        <div className="space-y-2">
          {ESTACIONALIDAD.map(({ sistema, meses }) => (
            <div key={sistema} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5">
              <span className="text-sm text-white/80">{sistema}</span>
              <Badge variant="outline" className="text-[10px] border bg-orange-500/15 text-orange-300 border-orange-500/30 whitespace-nowrap ml-3 flex-shrink-0">
                {meses}
              </Badge>
            </div>
          ))}
        </div>
      </SeccionColapsable>

      {/* Certificación profesional */}
      <SeccionColapsable titulo="Certificación profesional obligatoria" icono={Shield} color="#a78bfa">
        <p className="text-xs text-white/60 mb-3 leading-relaxed">
          Aproximadamente 16 rutinas exigen informe firmado por profesional matriculado (arquitecto o ingeniero según la materia).
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {['Fundaciones', 'Hormigón', 'Estructura metálica', 'Estructura de madera', 'Bovedilla', 'Mampostería',
            'Cateo de cielorrasos', 'Inst. eléctrica general', 'Puesta a tierra y pararrayos', 'Inst. de gas',
            'Contra incendio', 'Calefacción', 'Elevadores / plataformas'].map(item => (
            <Badge key={item} variant="outline" className="text-[11px] border bg-purple-500/10 text-purple-200 border-purple-500/25">{item}</Badge>
          ))}
        </div>
        <div className="p-3 rounded-xl border border-purple-500/25 bg-purple-500/10">
          <p className="text-xs text-purple-200/80 leading-relaxed">
            Elevadores y plataformas requieren <b>conservador inscripto en el Registro de Verificadores</b>.
            Instalaciones fijas contra incendio, desinfección/desinfestación, limpieza de tanques y certificación de fachadas
            (Ley 257/mod. Ley 6116/18) deben ser ejecutadas por <b>empresas inscriptas en registros específicos de CABA</b>.
            Instalaciones a presión (agua, gas, bombas) requieren además <b>oblea QR del organismo de control</b>.
          </p>
        </div>
      </SeccionColapsable>

      {/* SISMESC */}
      <SeccionColapsable titulo="SISMESC y tipos de orden" icono={FileText} color="#34d399">
        <p className="text-xs text-white/60 mb-3 leading-relaxed">
          Sistema de gestión de la DGMESC donde se documenta toda la operación contractual.
          Las rutinas, informes firmados, comprobantes de fumigación, check lists y certificados de potabilidad se cargan obligatoriamente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ORDENES_TIPIFICADAS.map(({ code, desc }) => (
            <div key={code} className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 flex items-start gap-3">
              <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">{code}</span>
              <p className="text-xs text-emerald-200/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </SeccionColapsable>

      {/* Edificios APH */}
      <SeccionColapsable titulo="Edificios con Protección Histórica (APH)" icono={Building2} color="#60a5fa">
        <div className="p-4 rounded-xl border border-blue-500/25 bg-blue-500/10">
          <p className="text-xs text-blue-200/80 leading-relaxed">
            Cuando el inmueble tiene protección histórica se aplica el <b className="text-blue-100">Anexo 4 APH</b> con tratamiento diferenciado:
            retiro cuidadoso de partes en riesgo por mantenimiento y posterior restauración/réplica vía TOM,
            consensuado con la Inspección. Es transversal a casi todos los rubros.
            <br /><br />
            En el sistema, el flag <b className="text-blue-100">APH</b> a nivel edificio altera el comportamiento de las rutinas
            y activa el flujo de derivación a TOM para tareas de réplica y restauración.
          </p>
        </div>
      </SeccionColapsable>

      {/* Rubros */}
      <SeccionColapsable titulo="Los 24 rubros del Anexo 3" icono={ClipboardList} color="#D4AF37">
        <p className="text-xs text-white/60 mb-3">
          Los de mayor densidad son <b className="text-white">Instalación Eléctrica</b> (12 rutinas) e
          <b className="text-white"> Instalación Contra Incendio</b> (10 rutinas), por ser los más regulados.
        </p>
        <div className="flex flex-wrap gap-2">
          {RUBROS.map(({ nombre, rutinas }) => (
            <div key={nombre} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs text-white/70">
              <span>{nombre}</span>
              <span className="font-bold tabular-nums" style={{ color: '#D4AF37' }}>{rutinas}</span>
            </div>
          ))}
        </div>
      </SeccionColapsable>

    </div>
  );
}