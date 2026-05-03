import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, X, Send, Loader2, Bot, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

// Módulos por rol — admin ve todo
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
  'Pendientes SAP':          { categoria: '📋 Pendientes SAP', preguntas: ['¿Cómo importo pendientes desde SAP?', '¿Cómo asigno un jefe de sitio?'] },
  'Órdenes de Trabajo':      { categoria: '🔧 Órdenes de trabajo', preguntas: ['¿Cómo creo una orden de trabajo?', '¿Cómo registro materiales en una OT?'] },
  'Inspecciones de Colegios':{ categoria: '🏫 Inspecciones', preguntas: ['¿Cómo hago una inspección de colegio?', '¿Cómo genero el informe con IA?'] },
  'Inventario/Pañol':        { categoria: '📦 Inventario', preguntas: ['¿Cómo registro entrada de materiales?', '¿Cómo configuro alertas de stock bajo?'] },
  'Presupuestos':            { categoria: '📄 Presupuestos', preguntas: ['¿Cómo creo un presupuesto de obra?', '¿Qué es el preciario ministerial?'] },
  'Mapa':                    { categoria: '🗺️ Mapa y fichaje', preguntas: ['¿Cómo ficha el personal con QR?', '¿Cómo veo ubicaciones en el mapa?'] },
  'Proyectos':               { categoria: '🏗️ Proyectos', preguntas: ['¿Cómo creo un proyecto nuevo?', '¿Cómo asigno equipo a un proyecto?'] },
  'Emergencias':             { categoria: '🚨 Emergencias', preguntas: ['¿Cómo registro una emergencia?', '¿Cómo asigno una cuadrilla?'] },
  'Reportes y Finanzas':     { categoria: '📊 Reportes', preguntas: ['¿Cómo veo el flujo de caja?', '¿Cómo analizo la rentabilidad?'] },
  'Certificados':            { categoria: '📜 Certificados', preguntas: ['¿Cómo genero un certificado?', '¿Cómo subo una ADA?'] },
};

function getSugerenciasParaRol(rol) {
  const modulos = MODULOS_POR_ROL[rol] || MODULOS_POR_ROL.user;
  return modulos
    .map(m => SUGERENCIAS_POR_MODULO[m])
    .filter(Boolean);
}

function buildContextoRol(user) {
  const rol = user?.role || 'user';
  const nombre = user?.full_name || user?.email || 'el usuario';
  const modulos = MODULOS_POR_ROL[rol] || MODULOS_POR_ROL.user;
  return `[CONTEXTO DEL USUARIO - no lo menciones explícitamente salvo que pregunten]
Nombre: ${nombre}
Rol: ${rol}
Módulos a los que tiene acceso: ${modulos.join(', ')}.
IMPORTANTE: Solo ayudá y explicá funcionalidades de los módulos listados arriba. Si el usuario pregunta por un módulo al que NO tiene acceso, decile amablemente que ese módulo no está disponible para su rol y que consulte con el administrador si cree que debería tenerlo.`;
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground/50"
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}
    >
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0 mb-0.5">
          <Bot className="h-3 w-3 text-primary" />
        </div>
      )}
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-sm'
          : 'bg-muted text-foreground rounded-bl-sm'
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isThinking = messages.length > 0 && messages[messages.length - 1]?.role === 'user';
  const sugerencias = getSugerenciasParaRol(currentUser?.role);

  // Cargar usuario
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
        // Enviar contexto de rol como primer mensaje del sistema (oculto para la UI)
        const contexto = buildContextoRol(currentUser);
        await base44.agents.addMessage(conv, { role: 'user', content: contexto });
        // Recargar conversación sin mostrar ese mensaje
        setConversation(conv);
        setMessages([]); // el contexto no se muestra
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
      // Filtrar el primer mensaje de contexto (oculto)
      const visible = (data.messages || []).filter((m, i) => !(i === 0 && m.role === 'user' && m.content?.startsWith('[CONTEXTO')));
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

  const handleReset = () => {
    setConversation(null);
    setMessages([]);
    setShowSugerencias(false);
  };

  const rolLabel = { admin: 'Administrador', jefe_sitio: 'Jefe de Sitio', inspector: 'Inspector', user: 'Usuario' }[currentUser?.role] || 'Usuario';

  return (
    <>
      {/* Botón flotante */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center"
            style={{ boxShadow: '0 4px 24px rgba(59,130,246,0.45)' }}
          >
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
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[400px] flex flex-col rounded-2xl border border-border overflow-hidden"
            style={{ height: '560px', background: 'hsl(var(--card))', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          >
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
                      {currentUser ? `${rolLabel} · Lista para ayudarte` : 'En línea · Lista para ayudarte'}
                    </p>
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
                      <p className="text-xs text-muted-foreground mt-0.5">Asistente de DH1 · Te ayudo con los módulos de tu perfil</p>
                    </div>
                    {currentUser?.role && (
                      <span className="inline-block text-[10px] px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                        Perfil: {rolLabel}
                      </span>
                    )}
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

              {isThinking && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Sugerencias rápidas mientras chateas */}
            {messages.length > 0 && messages.length < 6 && !isThinking && (
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
                  disabled={!conversation || sending}
                  rows={1}
                  className="flex-1 text-sm bg-muted rounded-xl px-3 py-2.5 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:opacity-50 resize-none leading-snug max-h-24 overflow-y-auto"
                  style={{ scrollbarWidth: 'none' }}
                />
                <Button size="icon" className="h-9 w-9 rounded-xl flex-shrink-0"
                  onClick={() => handleSend()} disabled={!input.trim() || !conversation || sending}>
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