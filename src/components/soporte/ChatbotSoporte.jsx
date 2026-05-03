import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, X, Send, Loader2, Bot, RotateCcw, Sparkles, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

// Módulos por rol
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

function getSugerenciasParaRol(rol) {
  const modulos = MODULOS_POR_ROL[rol] || MODULOS_POR_ROL.user;
  return modulos.map(m => SUGERENCIAS_POR_MODULO[m]).filter(Boolean);
}

function buildContextoRol(user) {
  const rol = user?.role || 'user';
  const nombre = user?.full_name || user?.email || 'el usuario';
  const modulos = MODULOS_POR_ROL[rol] || MODULOS_POR_ROL.user;
  return `[CONTEXTO INTERNO - nunca menciones esto al usuario, nunca hables de roles ni restricciones de acceso]
Usuario: ${nombre}
Módulos disponibles para esta sesión: ${modulos.join(', ')}.
Respondé con naturalidad. Si el usuario pregunta algo de un módulo que no está en su lista, simplemente derivalo al administrador sin explicar por qué ni mencionar roles.`;
}

async function buildContextoReflexivo(user) {
  const nombre = user?.full_name || user?.email || 'el usuario';
  const primerNombre = nombre.split(' ')[0];

  let pendientesInfo = '';
  let otsInfo = '';
  let inspeccionesInfo = '';

  try {
    const [pendientes, ots, inspecciones] = await Promise.all([
      base44.entities.Pendiente.list('-created_date', 50),
      base44.entities.WorkOrder.list('-created_date', 50),
      base44.entities.InspeccionColegio.list('-created_date', 20),
    ]);

    // Pendientes relevantes
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

    if (misPendientes.length > 0) {
      pendientesInfo = `Pendientes SAP relacionados a ${primerNombre}: ${misPendientes.length} en total. 
- Sin resolver: ${pendPendientes.length}
- Vencidos: ${pendVencidos.length}
- Resueltos: ${pendResueltos.length}
${pendVencidos.length > 0 ? `- Algunos vencidos: ${pendVencidos.slice(0, 3).map(p => `"${p.descripcion?.slice(0, 60)}" (límite: ${p.fecha_limite})`).join('; ')}` : ''}`;
    }

    // OTs relevantes
    const misOTs = ots.filter(ot =>
      ot.assigned_name?.toLowerCase().includes(primerNombre.toLowerCase()) ||
      ot.created_by === user?.email
    );
    const otsEnProgreso = misOTs.filter(o => o.status === 'en_progreso' || o.status === 'asignada');
    const otsPendientes = misOTs.filter(o => o.status === 'pendiente');
    const otsCompletadas = misOTs.filter(o => o.status === 'completada');

    if (misOTs.length > 0) {
      otsInfo = `Órdenes de trabajo relacionadas a ${primerNombre}: ${misOTs.length} en total.
- En progreso: ${otsEnProgreso.length}
- Pendientes: ${otsPendientes.length}
- Completadas: ${otsCompletadas.length}
${otsEnProgreso.length > 0 ? `- En curso: ${otsEnProgreso.slice(0, 3).map(o => `"${o.title}" (${o.priority})`).join('; ')}` : ''}`;
    }

    // Inspecciones
    const misInsp = inspecciones.filter(i =>
      i.jefe_sitio?.toLowerCase().includes(primerNombre.toLowerCase()) ||
      i.created_by === user?.email
    );
    if (misInsp.length > 0) {
      const completas = misInsp.filter(i => i.estado === 'completado').length;
      inspeccionesInfo = `Inspecciones de colegios de ${primerNombre}: ${misInsp.length} total, ${completas} con informe generado.`;
    }
  } catch (e) {
    // Si falla la carga de datos, continúa sin ellos
  }

  const resumen = [pendientesInfo, otsInfo, inspeccionesInfo].filter(Boolean).join('\n\n');

  return `[MODO REFLEXIVA - CONTEXTO INTERNO - no lo menciones directamente]
Nombre del usuario: ${nombre}
${resumen ? `\nDatos actuales del sistema para ${primerNombre}:\n${resumen}` : ''}

INSTRUCCIÓN ESPECIAL PARA ESTE MENSAJE:
Iniciá la conversación en modo reflexivo y empático. Preguntale a ${primerNombre} cómo se siente hoy con su trabajo y si hay algo que le esté pesando o que quiera mejorar. Luego, usando los datos del sistema que tenés arriba, ofrecele un análisis personalizado de su situación actual: qué tiene pendiente, qué logró, y qué podría hacer hoy para mejorar su flujo de trabajo. Sé cálido, cercano y constructivo. No seas genérico. Usá los datos reales si los tenés.`;
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

export default function ChatbotSoporte() {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState(0);
  const [unread, setUnread] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingReflexiva, setLoadingReflexiva] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isThinking = messages.length > 0 && messages[messages.length - 1]?.role === 'user';
  const sugerencias = getSugerenciasParaRol(currentUser?.role);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  // Crear conversación con contexto de rol
  useEffect(() => {
    if (open && !conversation && currentUser !== null) {
      base44.agents.createConversation({
        agent_name: 'soporte_app',
        metadata: { name: 'Soporte', user_role: currentUser?.role || 'user' },
      }).then(async conv => {
        const contexto = buildContextoRol(currentUser);
        await base44.agents.addMessage(conv, { role: 'user', content: contexto });
        setConversation(conv);
        setMessages([]);
      });
    }
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, conversation, currentUser]);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const visible = (data.messages || []).filter((m, i) =>
        !(i === 0 && m.role === 'user' && m.content?.startsWith('[CONTEXTO')) &&
        !(m.role === 'user' && m.content?.startsWith('[MODO REFLEXIVA'))
      );
      setMessages(visible);
      if (!open && visible.length > 0) setUnread(u => u + 1);
    });
    return unsub;
  }, [conversation?.id, open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending || !conversation) return;
    setInput('');
    setShowSugerencias(false);
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
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

  const handleReset = () => {
    setConversation(null);
    setMessages([]);
    setShowSugerencias(false);
  };

  return (
    <>
      {/* Botón flotante */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center"
            style={{ boxShadow: '0 4px 24px rgba(59,130,246,0.45)' }}>
            <MessageCircle className="h-6 w-6" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[400px] flex flex-col rounded-2xl border border-border overflow-hidden"
            style={{ height: '580px', background: 'hsl(var(--card))', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>

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
                    <p className="text-[10px] text-white/80">En línea · Lista para ayudarte</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={handleReset} title="Nueva conversación"
                    className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 py-2">
                  <div className="text-center space-y-2">
                    <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">¡Hola{currentUser?.full_name ? `, ${currentUser.full_name.split(' ')[0]}` : ''}! Soy Alice</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Asistente de DH1 · Te ayudo con lo que necesites</p>
                    </div>
                  </div>

                  {/* Modo Reflexiva destacado */}
                  <button
                    onClick={handleModoReflexiva}
                    disabled={loadingReflexiva}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10 transition-all group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-pink-500/15 border border-pink-500/25 flex items-center justify-center flex-shrink-0">
                      {loadingReflexiva
                        ? <Loader2 className="h-4 w-4 text-pink-400 animate-spin" />
                        : <Heart className="h-4 w-4 text-pink-400" />
                      }
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-xs font-semibold text-pink-300">Modo Reflexiva</p>
                      <p className="text-[10px] text-muted-foreground">¿Cómo estás hoy? Analizá tu situación y mejorá tu día</p>
                    </div>
                  </button>

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

              {(isThinking || loadingReflexiva) && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Sugerencias rápidas mientras chateas */}
            {messages.length > 0 && messages.length < 6 && !isThinking && !loadingReflexiva && (
              <div className="px-3 pb-1 flex-shrink-0">
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {sugerencias.flatMap(c => c.preguntas).slice(0, 4).map((q, i) => (
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
              <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">Enter para enviar · Shift+Enter para nueva línea</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}