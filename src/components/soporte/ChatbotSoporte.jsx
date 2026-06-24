import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import {
  MessageCircle, X, Send, Loader2, Bot, RotateCcw, Sparkles, Heart,
  HelpCircle, Image as ImageIcon, ClipboardList, Wrench, AlertTriangle, GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

// ── Constantes estáticas ──────────────────────────────────────────────────────
const RUTA_MODULO = {
  '/': 'Dashboard', '/proyectos': 'Proyectos', '/ordenes': 'Órdenes de Trabajo',
  '/activos': 'Pendientes SAP', '/inventario': 'Inventario/Pañol',
  '/clientes': 'Clientes/Proveedores', '/empleados': 'Empleados',
  '/presupuestos': 'Presupuestos', '/presupuestos-obra': 'Presupuestos de Obra',
  '/certificados': 'Certificados', '/inspeccion-colegio': 'Inspecciones de Colegios',
  '/mapa': 'Mapa', '/emergencias': 'Emergencias', '/reportes': 'Reportes y Finanzas',
  '/finanzas': 'Reportes y Finanzas', '/alertas': 'Alertas',
  '/automatizaciones': 'Automatizaciones', '/seguridad': 'Seguridad y Auditoría',
  '/auditoria': 'Seguridad y Auditoría', '/calendario': 'Calendario',
  '/informes': 'Informes', '/facturacion': 'Facturación', '/control-riesgo': 'Control de Riesgos',
};

const MODULOS_POR_ROL = {
  admin:         ['Dashboard','Proyectos','Órdenes de Trabajo','Pendientes SAP','Inventario/Pañol','Clientes/Proveedores','Empleados','Presupuestos','Certificados','Inspecciones de Colegios','Mapa','Emergencias','Reportes y Finanzas','Alertas','Automatizaciones','Seguridad y Auditoría'],
  user:          ['Dashboard','Órdenes de Trabajo','Pendientes SAP','Inventario/Pañol','Inspecciones de Colegios','Mapa','Emergencias'],
  jefe_sitio:    ['Dashboard','Proyectos','Órdenes de Trabajo','Pendientes SAP','Inventario/Pañol','Empleados','Inspecciones de Colegios','Mapa','Emergencias','Reportes y Finanzas'],
  inspector:     ['Dashboard','Pendientes SAP','Órdenes de Trabajo','Inspecciones de Colegios','Mapa','Emergencias'],
  administrativo:['Certificados','Presupuestos','Reportes y Finanzas'],
  supervisor:    ['Dashboard','Proyectos','Órdenes de Trabajo','Pendientes SAP','Reportes y Finanzas','Emergencias'],
  tecnico:       ['Órdenes de Trabajo','Inventario/Pañol','Emergencias'],
  viewer:        ['Dashboard'],
};

const DESCRIPCION_ROL = {
  admin:          'Administrador con acceso completo.',
  jefe_sitio:     'Jefe de Sitio: gestiona OTs, inspecciones, pendientes SAP, cuadrilla y pañol de su zona.',
  inspector:      'Inspector técnico: inspecciones de colegios, pendientes SAP y OTs.',
  supervisor:     'Supervisor: revisa reportes, aprueba OTs, controla establecimientos.',
  tecnico:        'Técnico de campo: ejecuta OTs, registra materiales, fotos y firmas.',
  administrativo: 'Administrativo: certificados, presupuestos, facturación y documentación.',
  viewer:         'Solo lectura.',
  user:           'Usuario general.',
};

const SUGERENCIAS_POR_MODULO = {
  'Pendientes SAP':           { categoria: '📋 Pendientes SAP',    preguntas: ['¿Cómo importo pendientes desde SAP?','¿Cómo asigno un jefe de sitio?'] },
  'Órdenes de Trabajo':       { categoria: '🔧 Órdenes de trabajo', preguntas: ['¿Cómo creo una orden de trabajo?','¿Cómo registro materiales en una OT?'] },
  'Inspecciones de Colegios': { categoria: '🏫 Inspecciones',       preguntas: ['¿Cómo hago una inspección de colegio?','¿Cómo genero el informe con IA?'] },
  'Inventario/Pañol':         { categoria: '📦 Inventario',         preguntas: ['¿Cómo registro entrada de materiales?','¿Cómo configuro alertas de stock bajo?'] },
  'Presupuestos':             { categoria: '📄 Presupuestos',       preguntas: ['¿Cómo creo un presupuesto de obra?','¿Qué es el preciario ministerial?'] },
  'Mapa':                     { categoria: '🗺️ Mapa y fichaje',     preguntas: ['¿Cómo ficha el personal con QR?','¿Cómo veo ubicaciones en el mapa?'] },
  'Proyectos':                { categoria: '🏗️ Proyectos',          preguntas: ['¿Cómo creo un proyecto nuevo?','¿Cómo asigno equipo a un proyecto?'] },
  'Emergencias':              { categoria: '🚨 Emergencias',         preguntas: ['¿Cómo registro una emergencia?','¿Cómo asigno una cuadrilla?'] },
  'Reportes y Finanzas':      { categoria: '📊 Reportes',            preguntas: ['¿Cómo veo el flujo de caja?','¿Cómo analizo la rentabilidad?'] },
  'Certificados':             { categoria: '📜 Certificados',        preguntas: ['¿Cómo genero un certificado?','¿Cómo subo una ADA?'] },
};

const INTERNAL_PREFIXES = ['[CONTEXTO', '[MODO REFLEXIVA', '[AYUDA PÁGINA', '[CERT'];

function getSugerenciasParaRol(rol) {
  const modulos = MODULOS_POR_ROL[rol] || MODULOS_POR_ROL.user;
  return modulos.map(m => SUGERENCIAS_POR_MODULO[m]).filter(Boolean);
}

function buildContextoRol(user, moduloActual, empleadoInfo) {
  const nombre = user?.full_name || user?.email || 'el usuario';
  const rol = empleadoInfo?.employee_role?.toLowerCase().trim() || (user?.role === 'admin' ? 'admin' : 'user');
  const desc = DESCRIPCION_ROL[rol] || DESCRIPCION_ROL.user;
  return `[CONTEXTO INTERNO]\nUsuario: ${nombre} | Rol: ${rol} | ${desc}${moduloActual ? ` | Módulo actual: ${moduloActual}.` : ''}\nAdaptá respuestas al rol. No menciones restricciones de acceso.`;
}

async function buildContextoReflexivo(user) {
  const nombre = user?.full_name || user?.email || 'el usuario';
  const primerNombre = nombre.split(' ')[0];
  const resumenParts = [];
  try {
    const [pendientes, ots, emergencias] = await Promise.all([
      base44.entities.Pendiente.filter({ estado: 'pendiente' }, '-created_date', 20),
      base44.entities.WorkOrder.filter({ status: 'en_progreso' }, '-created_date', 15),
      base44.entities.Emergencia.filter({ estado: 'activa' }, '-created_date', 5),
    ]);
    const q = primerNombre.toLowerCase();
    const misPend = pendientes.filter(p => p.jefe_sitio?.toLowerCase().includes(q) || p.inspector?.toLowerCase().includes(q));
    if (misPend.length > 0) {
      const vencidos = misPend.filter(p => p.fecha_limite && new Date(p.fecha_limite) < new Date()).length;
      const hoy = new Date(); const en7d = new Date(hoy); en7d.setDate(hoy.getDate() + 7);
      const proximos = misPend.filter(p => { if (!p.fecha_limite) return false; const d = new Date(p.fecha_limite); return d >= hoy && d <= en7d; }).length;
      resumenParts.push(`Pendientes de ${primerNombre}: ${misPend.length} sin resolver, ${vencidos} vencidos, ${proximos} vencen en 7 días.`);
    }
    const misOTs = ots.filter(o => o.assigned_name?.toLowerCase().includes(q));
    if (misOTs.length > 0) {
      const urgentes = misOTs.filter(o => o.priority === 'urgente').length;
      resumenParts.push(`OTs en progreso de ${primerNombre}: ${misOTs.length}${urgentes > 0 ? `, ${urgentes} urgentes` : ''}.`);
    }
    if (emergencias.length > 0) resumenParts.push(`Emergencias activas: ${emergencias.length}.`);
  } catch { /* silencioso — funciona sin datos */ }
  const resumen = resumenParts.join('\n');
  return `[MODO REFLEXIVA]\nUsuario: ${nombre}.\n${resumen ? `Datos del sistema:\n${resumen}\n` : ''}Saludalo por su nombre, analizá su situación con los datos reales, y dale un plan concreto de 3 acciones para hoy. Sé cálido y directo.`;
}

// ── Sub-componentes puros ─────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="h-2 w-2 rounded-full bg-muted-foreground/50"
            animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </div>
  );
}

// Memoizado para evitar re-renders en cada token de streaming
const MessageBubble = React.memo(function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0 mb-0.5">
          <Bot className="h-3 w-3 text-primary" />
        </div>
      )}
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
      }`}>
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:font-semibold">
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </motion.div>
  );
});

export function AlicePageButton({ onClick }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-24 lg:bottom-20 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full border border-primary/30 bg-card/90 backdrop-blur-sm text-xs font-medium text-primary hover:bg-primary/10 transition-all shadow-lg"
      style={{ boxShadow: '0 2px 12px rgba(59,130,246,0.2)' }}>
      <HelpCircle className="h-3.5 w-3.5" />
      ¿Qué hago aquí?
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChatbotSoporte() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const moduloActual = RUTA_MODULO[location.pathname] || null;
  const prevModuloRef  = useRef(moduloActual);

  const [open,   setOpen]   = useState(false);
  const [hidden, setHidden] = useState(false);
  const openRef = useRef(false); // ref para closures estables — evita stale closure en subscripción

  // Draggable
  const [pos, setPos]   = useState(null);
  const dragging   = useRef(false);
  const didDrag    = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    dragging.current = true;
    didDrag.current  = false;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      didDrag.current = true;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      setPos({
        x: Math.max(0, Math.min(cx - dragOffset.current.x, window.innerWidth - 56)),
        y: Math.max(0, Math.min(cy - dragOffset.current.y, window.innerHeight - 56)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  // Chat state
  const [conversation,     setConversation]     = useState(null);
  const [messages,         setMessages]         = useState([]);
  const [input,            setInput]            = useState('');
  const [sending,          setSending]          = useState(false);
  const [showSugerencias,  setShowSugerencias]  = useState(false);
  const [categoriaActiva,  setCategoriaActiva]  = useState(0);
  const [unread,           setUnread]           = useState(0);
  const [currentUser,      setCurrentUser]      = useState(null);
  const [empleadoInfo,     setEmpleadoInfo]     = useState(null);
  const [loadingReflexiva, setLoadingReflexiva] = useState(false);
  const [uploadingPhoto,   setUploadingPhoto]   = useState(false);
  const [criticalAlerts,   setCriticalAlerts]   = useState(0);
  const [initError,        setInitError]        = useState(false); // permite reintentar
  const [userReady,        setUserReady]        = useState(false); // true cuando ambos (user+emp) cargaron

  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const fileInputRef     = useRef(null);
  const lastBotCount     = useRef(0);
  const initInProgress   = useRef(false); // guard contra doble init concurrente
  // prompt pendiente cuando se llama ayudaPagina ANTES de que conv exista
  const pendingPromptRef = useRef(null);

  const conversationRef = useRef(null); // ref estable para callbacks sin stale closure
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);

  const isThinking  = messages.length > 0 && messages[messages.length - 1]?.role === 'user';
  const rolEfectivo = useMemo(
    () => empleadoInfo?.employee_role?.toLowerCase().trim() || (currentUser?.role === 'admin' ? 'admin' : 'user'),
    [empleadoInfo, currentUser]
  );
  const sugerencias = useMemo(() => getSugerenciasParaRol(rolEfectivo), [rolEfectivo]);

  // ── Carga inicial: usuario + empleado en paralelo ─────────────────────────
  useEffect(() => {
    Promise.all([
      base44.auth.me().catch(() => null),
      base44.functions.invoke('vincularEmpleado', {}).then(r => r?.data || null).catch(() => null),
    ]).then(([u, emp]) => {
      setCurrentUser(u);
      setEmpleadoInfo(emp);
      setUserReady(true);
    });
  }, []);

  // Alertas críticas — solo una vez, solo con usuario válido
  useEffect(() => {
    if (!currentUser?.id) return;
    base44.entities.AlertaLog.filter({ leida: false, nivel: 'critical' }, '-fecha_alerta', 5)
      .then(alertas => {
        if (alertas.length > 0) { setCriticalAlerts(alertas.length); setUnread(alertas.length); }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  // ── Inicialización de conversación ───────────────────────────────────────
  // FIX: initInProgress guard (no initDone) — permite reintentar tras error
  const initConversation = useCallback(async (user, empInfo, modulo) => {
    if (initInProgress.current || conversationRef.current) return;
    initInProgress.current = true;
    setInitError(false);
    try {
      const rol = empInfo?.employee_role?.toLowerCase().trim() || (user?.role === 'admin' ? 'admin' : 'user');
      const conv = await base44.agents.createConversation({
        agent_name: 'soporte_app',
        metadata: { name: 'Soporte', user_role: rol },
      });
      const contexto = buildContextoRol(user, modulo, empInfo);
      await base44.agents.addMessage(conv, { role: 'user', content: contexto });
      setConversation(conv);
      setMessages([]);
      // FIX: si había un prompt pendiente (ej: ayudaPagina llamado antes de conv), enviarlo ahora
      if (pendingPromptRef.current) {
        const prompt = pendingPromptRef.current;
        pendingPromptRef.current = null;
        await base44.agents.addMessage(conv, { role: 'user', content: prompt });
      }
    } catch {
      setInitError(true);
      initInProgress.current = false; // permite reintentar
    }
  }, []);

  // FIX: disparar init cuando: se abre el panel Y el usuario ya cargó Y no hay conv
  useEffect(() => {
    if (open && userReady && currentUser && !conversationRef.current && !initInProgress.current) {
      initConversation(currentUser, empleadoInfo, moduloActual);
    }
  }, [open, userReady, currentUser, empleadoInfo, initConversation]);

  useEffect(() => {
    if (open) {
      openRef.current = true;
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      openRef.current = false;
    }
  }, [open]);

  // ── Suscripción — FIX: usa openRef en lugar de `open` para evitar stale closure ──
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const allMsgs = data.messages || [];
      const visible = allMsgs.filter((m, idx) =>
        !(idx === 0 && m.role === 'user') &&
        !(m.role === 'user' && INTERNAL_PREFIXES.some(p => m.content?.startsWith(p)))
      );
      setMessages(visible);
      // FIX: usa openRef.current (siempre fresco) en lugar del stale `open`
      if (!openRef.current) {
        const botCount = visible.filter(m => m.role === 'assistant').length;
        if (botCount > lastBotCount.current) {
          setUnread(u => u + (botCount - lastBotCount.current));
          lastBotCount.current = botCount;
        }
      } else {
        lastBotCount.current = visible.filter(m => m.role === 'assistant').length;
      }
    });
    return unsub;
  }, [conversation?.id]); // FIX: ya NO depende de `open` — usa ref

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Cambio de módulo: mostrar burbuja + notificar a Alice
  useEffect(() => {
    if (prevModuloRef.current === moduloActual) return;
    prevModuloRef.current = moduloActual;
    setHidden(false);
    if (conversationRef.current && currentUser && moduloActual) {
      base44.agents.addMessage(conversationRef.current, {
        role: 'user',
        content: `[CONTEXTO ACTUALIZADO]\nMódulo actual: "${moduloActual}".`,
      }).catch(() => {});
    }
  }, [moduloActual, currentUser]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => { setOpen(false); setHidden(true); }, []);

  const handleSend = useCallback(async (text, fileUrls) => {
    const msg = (text || input).trim();
    const conv = conversationRef.current;
    if ((!msg && !fileUrls) || sending || !conv) return;
    setInput('');
    setShowSugerencias(false);
    setSending(true);
    try {
      await base44.agents.addMessage(conv, {
        role: 'user',
        content: msg || '(imagen adjunta)',
        ...(fileUrls ? { file_urls: fileUrls } : {}),
      });
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  // FIX: si no hay conv todavía, guarda el prompt para enviarlo cuando esté lista
  const handleAyudaPagina = useCallback(async () => {
    if (!moduloActual) return;
    setOpen(true);
    const prompt = `[AYUDA PÁGINA]\nMódulo "${moduloActual}": explicá en 3-4 puntos sus funciones principales. Sé directo y práctico.`;
    const conv = conversationRef.current;
    if (!conv) {
      // La conv se está creando; guardar prompt para envío post-init
      pendingPromptRef.current = prompt;
      return;
    }
    setSending(true);
    try {
      await base44.agents.addMessage(conv, { role: 'user', content: prompt });
    } finally {
      setSending(false);
    }
  }, [moduloActual]);

  const handleModoReflexiva = useCallback(async () => {
    const conv = conversationRef.current;
    if (!conv || !currentUser) return;
    setLoadingReflexiva(true);
    setShowSugerencias(false);
    try {
      const contexto = await buildContextoReflexivo(currentUser);
      await base44.agents.addMessage(conv, { role: 'user', content: contexto });
    } finally {
      setLoadingReflexiva(false);
    }
  }, [currentUser]);

  const handlePhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert('La imagen supera el límite de 8 MB.'); e.target.value = ''; return; }
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await handleSend('(foto adjunta para consulta)', [file_url]);
    } catch { alert('No se pudo subir la imagen. Intentá de nuevo.'); }
    finally { setUploadingPhoto(false); e.target.value = ''; }
  }, [handleSend]);

  // FIX: reset completo y limpio — resetea todos los guards
  const handleReset = useCallback(() => {
    setConversation(null);
    conversationRef.current = null;
    setMessages([]);
    setShowSugerencias(false);
    setInitError(false);
    lastBotCount.current = 0;
    initInProgress.current = false;
    pendingPromptRef.current = null;
    // Reinicia init inmediatamente si el panel está abierto
    if (openRef.current && currentUser) {
      initConversation(currentUser, empleadoInfo, moduloActual);
    }
  }, [currentUser, empleadoInfo, moduloActual, initConversation]);

  const handleAccionRapida = useCallback((tipo) => {
    const mensajes = {
      ot:         '¿Cómo creo una orden de trabajo nueva?',
      pendiente:  '¿Cómo creo un nuevo pendiente SAP manualmente?',
      emergencia: '¿Cómo registro una emergencia?',
    };
    handleSend(mensajes[tipo]);
  }, [handleSend]);

  // ── Render ────────────────────────────────────────────────────────────────
  const bubbleStyle = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : 24, right: isMobile ? 16 : 24 };

  if (hidden) return null;

  return (
    <>
      {/* Botón "¿Qué hago aquí?" */}
      <AnimatePresence>
        {!open && moduloActual && !pos && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: 0.5 }}>
            <AlicePageButton onClick={handleAyudaPagina} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Burbuja flotante */}
      <AnimatePresence>
        {!open && (
          <div style={{ ...bubbleStyle, zIndex: 50 }} className="group">
            <button onClick={() => setHidden(true)} title="Ocultar"
              className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-slate-700 border border-border text-muted-foreground hover:text-white hover:bg-slate-600 items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex">
              <X className="h-3 w-3" />
            </button>
            <div onMouseDown={handleDragStart} onTouchStart={handleDragStart}
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-slate-700 border border-border flex items-center justify-center cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover:opacity-100 transition-opacity" title="Mover">
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
              onClick={() => { if (!didDrag.current) setOpen(true); didDrag.current = false; }}
              className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center relative"
              style={{ boxShadow: criticalAlerts > 0 ? '0 4px 24px rgba(239,68,68,0.5)' : '0 4px 24px rgba(59,130,246,0.45)' }}>
              <MessageCircle className="h-6 w-6" />
              {unread > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread}
                </motion.span>
              )}
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* Panel de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ duration: 0.2 }}
            className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] flex flex-col sm:rounded-2xl border border-border overflow-hidden"
            style={{ height: '92dvh', maxHeight: '600px', background: 'hsl(var(--card))', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(213,90%,42%) 100%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">Alice · Asistente DH1</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-[10px] text-white/80">{moduloActual ? `En ${moduloActual}` : 'En línea'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {moduloActual && messages.length === 0 && !initError && (
                  <button onClick={handleAyudaPagina}
                    className="h-7 px-2 rounded-lg flex items-center gap-1 hover:bg-white/20 transition-colors text-white/80 hover:text-white text-[10px] font-medium">
                    <HelpCircle className="h-3 w-3" />
                    <span className="hidden sm:inline">¿Qué hago aquí?</span>
                  </button>
                )}
                {messages.length > 0 && (
                  <button onClick={handleReset} title="Nueva conversación"
                    className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={handleClose}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">

              {/* FIX: pantalla de error con botón de reintento */}
              {initError && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <AlertTriangle className="h-8 w-8 text-amber-400" />
                  <p className="text-sm text-muted-foreground">No se pudo conectar con Alice.<br />Verificá tu conexión e intentá de nuevo.</p>
                  <button onClick={handleReset}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                    Reintentar
                  </button>
                </div>
              )}

              {!initError && !conversation && (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!initError && conversation && messages.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 py-2">
                  <div className="text-center space-y-2">
                    <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">¡Hola{currentUser?.full_name ? `, ${currentUser.full_name.split(' ')[0]}` : ''}! Soy Alice</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Asistente de DH1 · Te ayudo con lo que necesites</p>
                    </div>
                  </div>

                  {criticalAlerts > 0 && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/5">
                      <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-300">
                        Tenés <strong>{criticalAlerts}</strong> alerta{criticalAlerts !== 1 ? 's' : ''} crítica{criticalAlerts !== 1 ? 's' : ''} activa{criticalAlerts !== 1 ? 's' : ''}. ¿Querés revisarlas?
                      </p>
                    </div>
                  )}

                  <button onClick={handleModoReflexiva} disabled={loadingReflexiva}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10 transition-all disabled:opacity-60">
                    <div className="h-8 w-8 rounded-lg bg-pink-500/15 border border-pink-500/25 flex items-center justify-center flex-shrink-0">
                      {loadingReflexiva ? <Loader2 className="h-4 w-4 text-pink-400 animate-spin" /> : <Heart className="h-4 w-4 text-pink-400" />}
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-xs font-semibold text-pink-300">Modo Reflexiva</p>
                      <p className="text-[10px] text-muted-foreground">Analizá tu situación y plan del día</p>
                    </div>
                  </button>

                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1">Acciones rápidas</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { tipo: 'ot',         icon: <Wrench className="h-4 w-4 text-primary" />,           label: 'Nueva OT' },
                        { tipo: 'pendiente',  icon: <ClipboardList className="h-4 w-4 text-amber-400" />,  label: 'Pendiente SAP' },
                        { tipo: 'emergencia', icon: <AlertTriangle className="h-4 w-4 text-red-400" />,    label: 'Emergencia' },
                      ].map(({ tipo, icon, label }) => (
                        <button key={tipo} onClick={() => handleAccionRapida(tipo)}
                          className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center">
                          {icon}
                          <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1">¿Sobre qué querés preguntar?</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {sugerencias.map((cat, i) => (
                        <button key={i} onClick={() => { setCategoriaActiva(i); setShowSugerencias(true); }}
                          className="text-left text-xs px-3 py-2 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all">
                          {cat.categoria}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {showSugerencias && sugerencias[categoriaActiva] && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="space-y-1.5">
                          {sugerencias[categoriaActiva].preguntas.map((q, i) => (
                            <button key={i} onClick={() => handleSend(q)}
                              className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-primary/8 border border-primary/20 hover:bg-primary/15 transition-colors text-foreground">
                              {q}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {messages.map((msg, i) => <MessageBubble key={`${msg.role}-${i}`} msg={msg} />)}
              {(isThinking || loadingReflexiva || uploadingPhoto) && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Chips de sugerencias */}
            {messages.length > 0 && messages.length < 6 && !isThinking && !loadingReflexiva && (
              <div className="px-3 pb-1 flex-shrink-0">
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {moduloActual && (
                    <button onClick={handleAyudaPagina}
                      className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-primary/30 hover:bg-primary/10 transition-all whitespace-nowrap text-primary flex items-center gap-1">
                      <HelpCircle className="h-2.5 w-2.5" /> ¿Qué hago en {moduloActual}?
                    </button>
                  )}
                  {sugerencias.flatMap(c => c.preguntas).slice(0, 3).map((q, i) => (
                    <button key={i} onClick={() => handleSend(q)}
                      className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 transition-all whitespace-nowrap text-muted-foreground">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-3 pb-3 pt-1 border-t border-border flex-shrink-0">
              <div className="flex gap-2 items-end">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <button onClick={() => fileInputRef.current?.click()} disabled={!conversation || uploadingPhoto || initError}
                  title="Adjuntar foto"
                  className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center border border-border hover:bg-muted transition-colors disabled:opacity-40">
                  {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                </button>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={initError ? 'Error de conexión — reintentá' : 'Escribí tu pregunta...'}
                  disabled={!conversation || sending || loadingReflexiva || initError}
                  rows={1}
                  className="flex-1 text-sm bg-muted rounded-xl px-3 py-2.5 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:opacity-50 resize-none leading-snug max-h-24 overflow-y-auto"
                  style={{ scrollbarWidth: 'none' }} />
                <Button size="icon" className="h-9 w-9 rounded-xl flex-shrink-0"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || !conversation || sending || loadingReflexiva || initError}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">Enter para enviar · 📷 podés adjuntar fotos</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}