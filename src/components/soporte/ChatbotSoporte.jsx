import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import {
  MessageCircle, X, Send, Loader2, Bot, RotateCcw, Sparkles, Heart,
  HelpCircle, Image as ImageIcon, ClipboardList, Wrench, AlertTriangle, GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

// Mapa de rutas a nombres de módulo
const RUTA_MODULO = {
  '/': 'Dashboard',
  '/proyectos': 'Proyectos',
  '/ordenes': 'Órdenes de Trabajo',
  '/activos': 'Pendientes SAP',
  '/inventario': 'Inventario/Pañol',
  '/clientes': 'Clientes/Proveedores',
  '/empleados': 'Empleados',
  '/presupuestos': 'Presupuestos',
  '/presupuestos-obra': 'Presupuestos de Obra',
  '/certificados': 'Certificados',
  '/inspeccion-colegio': 'Inspecciones de Colegios',
  '/mapa': 'Mapa',
  '/emergencias': 'Emergencias',
  '/reportes': 'Reportes y Finanzas',
  '/finanzas': 'Reportes y Finanzas',
  '/alertas': 'Alertas',
  '/automatizaciones': 'Automatizaciones',
  '/seguridad': 'Seguridad y Auditoría',
  '/auditoria': 'Seguridad y Auditoría',
  '/calendario': 'Calendario',
  '/informes': 'Informes',
  '/facturacion': 'Facturación',
  '/control-riesgo': 'Control de Riesgos',
};

const MODULOS_POR_ROL = {
  admin: [
    'Dashboard', 'Proyectos', 'Órdenes de Trabajo', 'Pendientes SAP', 'Inventario/Pañol',
    'Clientes/Proveedores', 'Empleados', 'Activos', 'Presupuestos', 'Certificados',
    'Inspecciones de Colegios', 'Mapa', 'Emergencias', 'Fichaje/Asistencia',
    'Reportes y Finanzas', 'Alertas', 'Automatizaciones', 'Seguridad y Auditoría',
  ],
  user: [
    'Dashboard', 'Órdenes de Trabajo', 'Pendientes SAP', 'Inventario/Pañol',
    'Inspecciones de Colegios', 'Mapa', 'Emergencias', 'Fichaje/Asistencia',
  ],
  jefe_sitio: [
    'Dashboard', 'Proyectos', 'Órdenes de Trabajo', 'Pendientes SAP', 'Inventario/Pañol',
    'Empleados', 'Inspecciones de Colegios', 'Mapa', 'Emergencias', 'Fichaje/Asistencia',
    'Reportes y Finanzas',
  ],
  inspector: [
    'Dashboard', 'Pendientes SAP', 'Órdenes de Trabajo', 'Inspecciones de Colegios',
    'Mapa', 'Emergencias',
  ],
};

const SUGERENCIAS_POR_MODULO = {
  'Pendientes SAP':           { categoria: '📋 Pendientes SAP', preguntas: ['¿Cómo importo pendientes desde SAP?', '¿Cómo asigno un jefe de sitio?'] },
  'Órdenes de Trabajo':       { categoria: '🔧 Órdenes de trabajo', preguntas: ['¿Cómo creo una orden de trabajo?', '¿Cómo registro materiales en una OT?'] },
  'Inspecciones de Colegios': { categoria: '🏫 Inspecciones', preguntas: ['¿Cómo hago una inspección de colegio?', '¿Cómo genero el informe con IA?'] },
  'Inventario/Pañol':         { categoria: '📦 Inventario', preguntas: ['¿Cómo registro entrada de materiales?', '¿Cómo configuro alertas de stock bajo?'] },
  'Presupuestos':             { categoria: '📄 Presupuestos', preguntas: ['¿Cómo creo un presupuesto de obra?', '¿Qué es el preciario ministerial?'] },
  'Mapa':                     { categoria: '🗺️ Mapa y fichaje', preguntas: ['¿Cómo ficha el personal con QR?', '¿Cómo veo ubicaciones en el mapa?'] },
  'Proyectos':                { categoria: '🏗️ Proyectos', preguntas: ['¿Cómo creo un proyecto nuevo?', '¿Cómo asigno equipo a un proyecto?'] },
  'Emergencias':              { categoria: '🚨 Emergencias', preguntas: ['¿Cómo registro una emergencia?', '¿Cómo asigno una cuadrilla?'] },
  'Reportes y Finanzas':      { categoria: '📊 Reportes', preguntas: ['¿Cómo veo el flujo de caja?', '¿Cómo analizo la rentabilidad?'] },
  'Certificados':             { categoria: '📜 Certificados', preguntas: ['¿Cómo genero un certificado?', '¿Cómo subo una ADA?'] },
};

const MODULOS_POR_ROL_EXTRA = {
  administrativo: ['Certificados', 'Presupuestos', 'Reportes y Finanzas'],
  supervisor: ['Dashboard', 'Proyectos', 'Órdenes de Trabajo', 'Pendientes SAP', 'Reportes y Finanzas', 'Emergencias'],
  tecnico: ['Órdenes de Trabajo', 'Inventario/Pañol', 'Emergencias'],
  viewer: ['Dashboard'],
};

function getSugerenciasParaRol(rol) {
  const modulos = MODULOS_POR_ROL[rol] || MODULOS_POR_ROL_EXTRA[rol] || MODULOS_POR_ROL.user;
  return modulos.map(m => SUGERENCIAS_POR_MODULO[m]).filter(Boolean);
}

const DESCRIPCION_ROL = {
  admin: 'Administrador del sistema con acceso completo. Gestiona empleados, certificados, presupuestos, finanzas, permisos y toda la plataforma.',
  jefe_sitio: 'Jefe de Sitio responsable de uno o más establecimientos/colegios. Su trabajo diario incluye: gestionar órdenes de trabajo, registrar inspecciones de colegios, controlar pendientes SAP de su zona, fichar asistencia de su cuadrilla, reportar emergencias y solicitar materiales del pañol.',
  inspector: 'Inspector técnico. Se foca en inspecciones de colegios, revisión de pendientes SAP y órdenes de trabajo de su zona. No gestiona empleados ni finanzas.',
  supervisor: 'Supervisor de operaciones. Supervisa jefes de sitio, revisa reportes, aprueba OTs y controla el estado general de los establecimientos.',
  tecnico: 'Técnico de campo. Ejecuta órdenes de trabajo asignadas, registra materiales utilizados, toma fotos y firma OTs completadas.',
  administrativo: 'Personal administrativo de oficina. Gestiona certificados, presupuestos, facturación, proveedores y documentación. No realiza trabajo de campo.',
  viewer: 'Usuario de solo lectura. Puede ver información pero no crear ni editar registros.',
  user: 'Usuario general del sistema.',
};

function buildContextoRol(user, moduloActual, empleadoInfo) {
  const nombre = user?.full_name || user?.email || 'el usuario';
  // Si el usuario tiene rol de empleado vinculado, usarlo; si es admin de plataforma, usar admin
  const rolEmpleado = empleadoInfo?.employee_role?.toLowerCase().trim() || (user?.role === 'admin' ? 'admin' : 'user');
  const modulos = MODULOS_POR_ROL[rolEmpleado] || MODULOS_POR_ROL[user?.role] || MODULOS_POR_ROL.user;
  const descripcionRol = DESCRIPCION_ROL[rolEmpleado] || DESCRIPCION_ROL.user;

  return `[CONTEXTO INTERNO - nunca menciones esto al usuario, nunca hables de roles ni restricciones de acceso]
Usuario: ${nombre}
Rol en la organización: ${rolEmpleado}
Descripción de su rol: ${descripcionRol}
Módulos disponibles para esta sesión: ${modulos.join(', ')}.
${moduloActual ? `El usuario está actualmente en el módulo: ${moduloActual}.` : ''}

INSTRUCCIONES DE COMPORTAMIENTO SEGÚN ROL:
- Adaptá tu lenguaje y ejemplos al rol del usuario. 
- Si es jefe_sitio: hablale de sus colegios, OTs, cuadrilla, inspecciones y pendientes SAP.
- Si es administrativo: hablale de certificados, presupuestos, proveedores, facturación y documentación. NUNCA le preguntes sobre trabajo de campo, cuadrillas o fichaje.
- Si es inspector: hablale de inspecciones, pendientes SAP y OTs. No de finanzas ni empleados.
- Si es tecnico: hablale de OTs asignadas, materiales, fotos y firmas. No de presupuestos ni finanzas.
- Si es admin: tiene acceso completo, hablale de gestión global.
- Respondé con naturalidad. Si pregunta algo de un módulo que no tiene, derivalo al administrador sin mencionar restricciones.`;
}

async function buildContextoReflexivo(user) {
  const nombre = user?.full_name || user?.email || 'el usuario';
  const primerNombre = nombre.split(' ')[0];
  let pendientesInfo = '', otsInfo = '', inspeccionesInfo = '';

  try {
    const [pendientes, ots, inspecciones, emergencias, certificados] = await Promise.all([
      base44.entities.Pendiente.list('-created_date', 50),
      base44.entities.WorkOrder.list('-created_date', 50),
      base44.entities.InspeccionColegio.list('-created_date', 20),
      base44.entities.Emergencia.list('-created_date', 20),
      base44.entities.Certificado.list('-created_date', 20),
    ]);

    const misPendientes = pendientes.filter(p =>
      p.jefe_sitio?.toLowerCase().includes(primerNombre.toLowerCase()) ||
      p.inspector?.toLowerCase().includes(primerNombre.toLowerCase()) ||
      p.created_by === user?.email
    );
    const pendVencidos = misPendientes.filter(p => {
      if (!p.fecha_limite || p.estado === 'resuelto' || p.estado === 'cancelado') return false;
      return new Date(p.fecha_limite) < new Date();
    });
    const pendPendientes = misPendientes.filter(p => p.estado === 'pendiente' || p.estado === 'asignado');
    const pendResueltos = misPendientes.filter(p => p.estado === 'resuelto');
    const hoy = new Date();
    const en7dias = new Date(); en7dias.setDate(hoy.getDate() + 7);
    const pendProximos = misPendientes.filter(p => {
      if (!p.fecha_limite || p.estado === 'resuelto' || p.estado === 'cancelado') return false;
      const fl = new Date(p.fecha_limite);
      return fl >= hoy && fl <= en7dias;
    });

    if (misPendientes.length > 0) {
      pendientesInfo = `Pendientes SAP relacionados a ${primerNombre}: ${misPendientes.length} en total.\n- Sin resolver: ${pendPendientes.length}\n- Vencidos: ${pendVencidos.length}\n- Resueltos: ${pendResueltos.length}`;
    }

    const misOTs = ots.filter(ot =>
      ot.assigned_name?.toLowerCase().includes(primerNombre.toLowerCase()) ||
      ot.created_by === user?.email
    );
    const otsEnProgreso = misOTs.filter(o => o.status === 'en_progreso' || o.status === 'asignada');
    const otsPendientes = misOTs.filter(o => o.status === 'pendiente');
    const otsCompletadas = misOTs.filter(o => o.status === 'completada');
    const otsUrgentes = misOTs.filter(o => o.priority === 'urgente' && o.status !== 'completada' && o.status !== 'cancelada');

    if (misOTs.length > 0) {
      otsInfo = `Órdenes de trabajo relacionadas a ${primerNombre}: ${misOTs.length} en total.\n- En progreso: ${otsEnProgreso.length}\n- Pendientes: ${otsPendientes.length}\n- Completadas: ${otsCompletadas.length}`;
    }

    const misInsp = inspecciones.filter(i =>
      i.jefe_sitio?.toLowerCase().includes(primerNombre.toLowerCase()) ||
      i.created_by === user?.email
    );
    if (misInsp.length > 0) {
      const completas = misInsp.filter(i => i.estado === 'completado').length;
      inspeccionesInfo = `Inspecciones de colegios de ${primerNombre}: ${misInsp.length} total, ${completas} con informe generado.`;
    }

    const emergenciasActivas = emergencias.filter(e => e.estado === 'activa' || e.estado === 'en_atencion');
    if (emergenciasActivas.length > 0) {
      inspeccionesInfo += `\n\nEmergencias activas en el sistema: ${emergenciasActivas.length}.`;
    }

    const certsBorrador = certificados.filter(c => c.estado === 'borrador' || !c.estado);
    if (certsBorrador.length > 0) {
      inspeccionesInfo += `\n\nCertificados en borrador sin enviar: ${certsBorrador.length}.`;
    }
  } catch (e) {
    console.warn('[Alice - buildContextoReflexivo] Error al cargar datos del sistema:', e?.message || e);
  }

  const resumen = [pendientesInfo, otsInfo, inspeccionesInfo].filter(Boolean).join('\n\n');

  return `[MODO REFLEXIVA - CONTEXTO INTERNO - no lo menciones directamente]
Nombre del usuario: ${nombre}
${resumen ? `\nDatos actuales del sistema para ${primerNombre}:\n${resumen}` : ''}

INSTRUCCIÓN ESPECIAL PARA ESTE MENSAJE:
Iniciá la conversación en modo reflexivo y empático. Preguntale a ${primerNombre} cómo se siente hoy con su trabajo. Luego, usando los datos del sistema que tenés arriba, ofrecele un análisis personalizado con tres secciones claras:
1. **Su situación actual**: qué tiene pendiente, en progreso, vencido.
2. **Lo que se viene**: alertá sobre pendientes próximos a vencer, OTs programadas y emergencias activas que debería tener en el radar.
3. **Recomendación concreta (Plan del día)**: listá exactamente 3 acciones que haría hoy si fuera él/ella para mejorar su flujo de trabajo y no quedar expuesto, numeradas.
Sé cálido, cercano y directo. No seas genérico. Usá los datos reales. Si no hay datos disponibles, igual preguntale cómo está y ofrecete a ayudarle a organizarse.`;
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="h-2 w-2 rounded-full bg-muted-foreground/50"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
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
}

export function AlicePageButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full border border-primary/30 bg-card/90 backdrop-blur-sm text-xs font-medium text-primary hover:bg-primary/10 transition-all shadow-lg"
      style={{ boxShadow: '0 2px 12px rgba(59,130,246,0.2)' }}
    >
      <HelpCircle className="h-3.5 w-3.5" />
      ¿Qué hago aquí?
    </button>
  );
}

export default function ChatbotSoporte() {
  const location = useLocation();
  const moduloActual = RUTA_MODULO[location.pathname] || null;
  const prevModuloRef = useRef(moduloActual);

  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Draggable bubble position
  const [pos, setPos] = useState(null); // null = default bottom-right
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    dragging.current = true;
    didDrag.current = false;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      didDrag.current = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newX = clientX - dragOffset.current.x;
      const newY = clientY - dragOffset.current.y;
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      setPos({ x: Math.max(0, Math.min(newX, maxX)), y: Math.max(0, Math.min(newY, maxY)) });
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

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState(0);
  const [unread, setUnread] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [empleadoInfo, setEmpleadoInfo] = useState(null);
  const [loadingReflexiva, setLoadingReflexiva] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [criticalAlerts, setCriticalAlerts] = useState(0);
  const [proactiveShown, setProactiveShown] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isThinking = messages.length > 0 && messages[messages.length - 1]?.role === 'user';
  const rolEfectivo = empleadoInfo?.employee_role?.toLowerCase().trim() || (currentUser?.role === 'admin' ? 'admin' : 'user');
  const sugerencias = getSugerenciasParaRol(rolEfectivo);

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      // Cargar info del empleado vinculado para personalizar Alice según rol real
      base44.functions.invoke('vincularEmpleado', {})
        .then(res => setEmpleadoInfo(res?.data || null))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    base44.entities.AlertaLog.filter({ leida: false }, '-fecha_alerta', 10)
      .then(alertas => {
        const criticas = alertas.filter(a => a.nivel === 'critical').length;
        setCriticalAlerts(criticas);
        if (criticas > 0 && !proactiveShown) {
          setUnread(prev => prev + criticas);
          setProactiveShown(true);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    if (open && !conversation && currentUser !== null) {
      // Esperar a que empleadoInfo esté disponible (puede llegar async después de currentUser)
      const init = async () => {
        const conv = await base44.agents.createConversation({
          agent_name: 'soporte_app',
          metadata: { name: 'Soporte', user_role: rolEfectivo },
        });
        const contexto = buildContextoRol(currentUser, moduloActual, empleadoInfo);
        await base44.agents.addMessage(conv, { role: 'user', content: contexto });
        setConversation(conv);
        setMessages([]);
      };
      init();
    }
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, conversation, currentUser, empleadoInfo]);

  // Referencia para rastrear cantidad de mensajes ya vistos (evitar unread inflado)
  const lastVisibleCount = useRef(0);

  useEffect(() => {
    if (!conversation?.id) return;
    // Prefijos internos que NUNCA debe ver el usuario
    const INTERNAL_PREFIXES = ['[CONTEXTO', '[MODO REFLEXIVA', '[AYUDA PÁGINA', '[CERTIFICADO CREADO'];
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const allMsgs = data.messages || [];
      const visible = allMsgs.filter((m, i) =>
        !(i === 0 && m.role === 'user') && // siempre ocultar primer mensaje (contexto inicial)
        !(m.role === 'user' && INTERNAL_PREFIXES.some(p => m.content?.startsWith(p)))
      );
      setMessages(visible);
      // Incrementar unread solo cuando llegan mensajes NUEVOS del bot (no updates de streaming)
      if (!open) {
        const botMsgs = visible.filter(m => m.role === 'assistant');
        if (botMsgs.length > lastVisibleCount.current) {
          setUnread(u => u + (botMsgs.length - lastVisibleCount.current));
          lastVisibleCount.current = botMsgs.length;
        }
      } else {
        lastVisibleCount.current = visible.filter(m => m.role === 'assistant').length;
      }
    });
    return unsub;
  }, [conversation?.id, open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = async (text, fileUrls) => {
    const msg = (text || input).trim();
    if ((!msg && !fileUrls) || sending || !conversation) return;
    setInput('');
    setShowSugerencias(false);
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: msg || '(imagen adjunta)',
        ...(fileUrls ? { file_urls: fileUrls } : {}),
      });
    } finally {
      setSending(false);
    }
  };

  const handleAyudaPagina = async () => {
    if (!moduloActual) return;
    setOpen(true);
    // Esperar a que la conversación exista antes de enviar
    const conv = conversation;
    if (!conv) return;
    const prompt = `[AYUDA PÁGINA - contexto interno, no lo menciones]\nEl usuario está en el módulo "${moduloActual}" y quiere saber qué puede hacer aquí.\nExplicale en 3-4 puntos concretos las funciones principales de este módulo y cómo empezar. Sé directo y práctico.`;
    setSending(true);
    try {
      await base44.agents.addMessage(conv, { role: 'user', content: prompt });
    } finally {
      setSending(false);
    }
  };

  const handleModoReflexiva = async () => {
    if (!conversation || !currentUser) return;
    setLoadingReflexiva(true);
    setShowSugerencias(false);
    try {
      const contexto = await buildContextoReflexivo(currentUser);
      await base44.agents.addMessage(conversation, { role: 'user', content: contexto });
    } finally {
      setLoadingReflexiva(false);
    }
  };

  const MAX_PHOTO_MB = 8;

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      alert(`La imagen es demasiado grande. El límite es ${MAX_PHOTO_MB} MB.`);
      e.target.value = '';
      return;
    }
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await handleSend('(foto adjunta para consulta)', [file_url]);
    } catch (err) {
      console.error('Error al subir foto:', err);
      alert('No se pudo subir la imagen. Intentá de nuevo.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleReset = () => {
    setConversation(null);
    setMessages([]);
    setShowSugerencias(false);
    lastVisibleCount.current = 0;
  };

  // Reiniciar contexto de Alice cuando el usuario cambia de módulo (sin resetear mensajes)
  useEffect(() => {
    if (!conversation || !currentUser) return;
    if (prevModuloRef.current === moduloActual) return;
    prevModuloRef.current = moduloActual;
    if (!moduloActual) return;
    const aviso = `[CONTEXTO ACTUALIZADO - no lo menciones]\nEl usuario acaba de navegar al módulo: "${moduloActual}". Tenelo en cuenta para las próximas preguntas.`;
    base44.agents.addMessage(conversation, { role: 'user', content: aviso }).catch(() => {});
  }, [moduloActual, conversation, currentUser]);

  const handleAccionRapida = async (tipo) => {
    const mensajes = {
      ot: '¿Cómo creo una orden de trabajo nueva?',
      pendiente: '¿Cómo creo un nuevo pendiente SAP manualmente?',
      emergencia: '¿Cómo registro una emergencia?',
    };
    await handleSend(mensajes[tipo]);
  };

  // Posición de la burbuja
  const bubbleStyle = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: 24, right: 24 };

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="fixed bottom-6 right-6 z-50 h-8 px-3 rounded-full bg-card border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-md flex items-center gap-1.5"
        title="Mostrar asistente Alice"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Alice
      </button>
    );
  }

  return (
    <>
      {/* Botón "¿Qué hago aquí?" */}
      <AnimatePresence>
        {!open && moduloActual && !pos && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            transition={{ delay: 0.5 }}
          >
            <AlicePageButton onClick={handleAyudaPagina} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante principal (draggable) */}
      <AnimatePresence>
        {!open && (
          <div style={{ ...bubbleStyle, zIndex: 50 }} className="group">
            {/* Botón cerrar (ocultar) */}
            <button
              onClick={() => setHidden(true)}
              title="Ocultar asistente"
              className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-slate-700 border border-border text-muted-foreground hover:text-white hover:bg-slate-600 items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
            >
              <X className="h-3 w-3" />
            </button>

            {/* Handle de arrastre */}
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-slate-700 border border-border flex items-center justify-center cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Mover"
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>

            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
              onClick={() => { if (!didDrag.current) setOpen(true); didDrag.current = false; }}
              className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center"
              style={{ boxShadow: criticalAlerts > 0 ? '0 4px 24px rgba(239,68,68,0.5)' : '0 4px 24px rgba(59,130,246,0.45)' }}
            >
              <MessageCircle className="h-6 w-6" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
                >
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
                    <p className="text-[10px] text-white/80">
                      {moduloActual ? `En ${moduloActual}` : 'En línea · Lista para ayudarte'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {moduloActual && messages.length === 0 && (
                  <button
                    onClick={handleAyudaPagina}
                    title={`¿Qué hago en ${moduloActual}?`}
                    className="h-7 px-2 rounded-lg flex items-center gap-1 hover:bg-white/20 transition-colors text-white/80 hover:text-white text-[10px] font-medium"
                  >
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
                {/* Ocultar completamente */}
                <button onClick={() => { setOpen(false); setHidden(true); }} title="Ocultar asistente"
                  className="h-7 px-2 rounded-lg flex items-center gap-1 hover:bg-white/20 transition-colors text-white/60 hover:text-white text-[10px]">
                  Ocultar
                </button>
                <button onClick={() => setOpen(false)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {!conversation && (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {conversation && messages.length === 0 && (
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

                  <button
                    onClick={handleModoReflexiva}
                    disabled={loadingReflexiva}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10 transition-all group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-pink-500/15 border border-pink-500/25 flex items-center justify-center flex-shrink-0">
                      {loadingReflexiva ? <Loader2 className="h-4 w-4 text-pink-400 animate-spin" /> : <Heart className="h-4 w-4 text-pink-400" />}
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-xs font-semibold text-pink-300">Modo Reflexiva</p>
                      <p className="text-[10px] text-muted-foreground">¿Cómo estás hoy? Analizá tu situación y plan del día</p>
                    </div>
                  </button>

                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1">Acciones rápidas</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => handleAccionRapida('ot')}
                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center">
                        <Wrench className="h-4 w-4 text-primary" />
                        <span className="text-[10px] text-muted-foreground leading-tight">Nueva OT</span>
                      </button>
                      <button onClick={() => handleAccionRapida('pendiente')}
                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center">
                        <ClipboardList className="h-4 w-4 text-amber-400" />
                        <span className="text-[10px] text-muted-foreground leading-tight">Pendiente SAP</span>
                      </button>
                      <button onClick={() => handleAccionRapida('emergencia')}
                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <span className="text-[10px] text-muted-foreground leading-tight">Emergencia</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1">¿Sobre qué querés preguntar?</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {sugerencias.map((cat, i) => (
                        <button key={i}
                          onClick={() => { setCategoriaActiva(i); setShowSugerencias(true); }}
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

              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}

              {(isThinking || loadingReflexiva || uploadingPhoto) && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

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
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!conversation || uploadingPhoto}
                  title="Adjuntar foto"
                  className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center border border-border hover:bg-muted transition-colors disabled:opacity-40"
                >
                  {uploadingPhoto
                    ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    : <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Escribí tu pregunta..."
                  disabled={!conversation || sending || loadingReflexiva}
                  rows={1}
                  className="flex-1 text-sm bg-muted rounded-xl px-3 py-2.5 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:opacity-50 resize-none leading-snug max-h-24 overflow-y-auto"
                  style={{ scrollbarWidth: 'none' }}
                />
                <Button size="icon" className="h-9 w-9 rounded-xl flex-shrink-0"
                  onClick={() => handleSend()} disabled={!input.trim() || !conversation || sending || loadingReflexiva}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">Enter para enviar · 📷 podés adjuntar fotos para consultas</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}