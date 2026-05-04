import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot, Sparkles, ChevronDown, ChevronUp, Loader2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

// Mensajes contextuales según el paso
const STEP_MESSAGES = {
  0: {
    intro: `¡Hola! Soy Alice, tu asistente de importación. 🗂️

Puedo ayudarte a cargar datos en el sistema de forma inteligente. Acá te cuento **qué podés importar** y cómo preparar tu archivo:

**Entidades soportadas:**
- 👥 **Empleados** — Nombre, DNI, rol, especialidad, teléfono
- 🏢 **Clientes/Proveedores** — Razón social, CUIT, contacto, ciudad
- 📦 **Materiales** — Código, nombre, unidad, stock, precio
- 🏗️ **Proyectos** — Nombre, cliente, fechas, presupuesto
- 🔧 **Órdenes de Trabajo** — Título, asignado, fecha programada
- ⚙️ **Activos** — Equipos, marca, modelo, N° de serie
- 📄 **Preciario Ministerial** — Código, descripción, PU mat, PU MO

**Tip:** No importa cómo se llamen tus columnas — la IA las va a detectar automáticamente. Podés subir un Excel con múltiples hojas y cada una se importa a su entidad correspondiente.

¿Tenés preguntas antes de subir tu archivo?`,
    suggestions: [
      '¿Cómo preparo el Excel de empleados?',
      '¿Puedo importar materiales y proveedores juntos?',
      '¿Qué pasa si tengo columnas extra que no usa el sistema?',
    ]
  },
  2: {
    intro: null, // Se genera dinámicamente según el análisis
    suggestions: [
      '¿Por qué el sistema sugiere esa entidad?',
      '¿Qué hago si una columna quedó sin mapear?',
      '¿Puedo importar solo algunas hojas?',
    ]
  },
  3: {
    intro: null, // Se genera dinámicamente según el resultado
    suggestions: [
      '¿Por qué fallaron esos registros?',
      '¿Cómo corrijo los errores y reimporto?',
      '¿Puedo importar más datos ahora?',
    ]
  }
};

function buildAnalysisMessage(mappingResult) {
  if (!mappingResult?.sheets) return null;
  const sheets = mappingResult.sheets.filter(s => s.target_entity !== 'skip');
  const total = sheets.reduce((acc, s) => acc + (s.row_count || 0), 0);
  const highConf = sheets.filter(s => s.confidence >= 0.85);
  const lowConf = sheets.filter(s => s.confidence < 0.6);

  let msg = `Analicé tu archivo y encontré **${sheets.length} hoja${sheets.length !== 1 ? 's' : ''}** con **${total.toLocaleString()} registros** listos para importar.\n\n`;

  if (highConf.length > 0) {
    msg += `✅ **Alta confianza:** ${highConf.map(s => `"${s.sheet_name}" → ${s.target_entity}`).join(', ')}\n`;
  }
  if (lowConf.length > 0) {
    msg += `⚠️ **Necesitan revisión:** ${lowConf.map(s => `"${s.sheet_name}"`).join(', ')} — te recomiendo expandirlas y revisar el mapeo de columnas.\n`;
  }

  const unmappedSheets = sheets.filter(s => {
    const mapped = Object.values(s.field_mapping || {}).filter(v => v).length;
    const total = Object.keys(s.field_mapping || {}).length;
    return mapped < total * 0.5;
  });

  if (unmappedSheets.length > 0) {
    msg += `\n💡 Algunas columnas quedaron sin mapear en **${unmappedSheets.map(s => s.sheet_name).join(', ')}**. Expandilas para ajustar manualmente.`;
  } else {
    msg += `\n🎯 El mapeo se ve bien. Revisá los detalles si querés ajustar algo antes de importar.`;
  }

  return msg;
}

function buildResultMessage(result) {
  if (!result?.results) return null;
  const total = result.results.reduce((acc, r) => acc + (r.imported || 0), 0);
  const errors = result.results.reduce((acc, r) => acc + (r.errors || 0), 0);

  if (errors === 0) {
    return `🎉 **¡Importación exitosa!** Se cargaron **${total.toLocaleString()} registros** sin ningún error.\n\nYa podés ver los datos en sus respectivos módulos. ¿Querés importar otro archivo o tenés alguna consulta sobre los datos cargados?`;
  }

  if (total > 0) {
    const pct = Math.round((total / (total + errors)) * 100);
    return `✅ Se importaron **${total.toLocaleString()} registros** (${pct}% de éxito).\n\n⚠️ **${errors} registros fallaron** — generalmente por datos vacíos o formatos incorrectos en campos obligatorios. Podés exportar el detalle de errores y corregirlos en tu Excel para reimportar.`;
  }

  return `❌ La importación no pudo completarse. Revisá que el archivo tenga el formato correcto y que los campos obligatorios estén completos.`;
}

export default function AliceImportAssistant({ step, mappingResult, importResult }) {
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [initDone, setInitDone] = useState(false);
  const messagesEndRef = useRef(null);

  // Inicializar conversación con contexto del módulo de importación
  useEffect(() => {
    base44.agents.createConversation({
      agent_name: 'soporte_app',
      metadata: { name: 'Alice Importación' },
    }).then(async conv => {
      const contexto = `[CONTEXTO INTERNO]
El usuario está en el módulo de Importación de Datos del sistema DH1.
Sos Alice, asistente especializada en importación. Ayudá al usuario a entender cómo preparar sus archivos, qué entidades puede importar, qué significa cada campo, y cómo resolver errores de importación.
Sé concisa, práctica y amigable.`;
      await base44.agents.addMessage(conv, { role: 'user', content: contexto });
      setConversation(conv);
    }).catch(() => {});
  }, []);

  // Mensaje inicial y mensajes contextuales según el paso
  useEffect(() => {
    if (!initDone && step === 0) {
      setMessages([{ role: 'assistant', content: STEP_MESSAGES[0].intro }]);
      setInitDone(true);
    }
  }, [step, initDone]);

  useEffect(() => {
    if (step === 2 && mappingResult) {
      const msg = buildAnalysisMessage(mappingResult);
      if (msg) setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    }
  }, [step, mappingResult]);

  useEffect(() => {
    if (step === 3 && importResult) {
      const msg = buildResultMessage(importResult);
      if (msg) setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    }
  }, [step, importResult]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suscribirse a la conversación del agente para recibir respuestas
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const visible = (data.messages || []).filter((m, i) =>
        !(i === 0 && m.role === 'user' && m.content?.startsWith('[CONTEXTO'))
      );
      // Solo agregar mensajes del asistente que vengan del agente
      const lastAgent = visible.filter(m => m.role === 'assistant').pop();
      if (lastAgent) {
        setMessages(prev => {
          const alreadyHas = prev.some(m => m.role === 'assistant' && m.content === lastAgent.content);
          if (alreadyHas) return prev;
          // Reemplazar el typing placeholder si existe
          const withoutTyping = prev.filter(m => m._typing !== true);
          return [...withoutTyping, { role: 'assistant', content: lastAgent.content }];
        });
        setSending(false);
      }
    });
    return unsub;
  }, [conversation?.id]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending || !conversation) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '...', _typing: true }]);
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: msg });
  };

  const currentSuggestions = STEP_MESSAGES[step]?.suggestions || [];

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Alice · Asistente de Importación</p>
            <p className="text-[10px] text-muted-foreground">Preguntame lo que necesites sobre la importación</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-primary/10">
              {/* Messages */}
              <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                    {msg.role === 'assistant' && (
                      <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card border border-border rounded-bl-sm'
                    }`}>
                      {msg._typing ? (
                        <div className="flex gap-1 items-center py-0.5">
                          {[0,1,2].map(i => (
                            <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                              animate={{ y: [0, -3, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                            />
                          ))}
                        </div>
                      ) : msg.role === 'user' ? (
                        <p>{msg.content}</p>
                      ) : (
                        <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions */}
              {currentSuggestions.length > 0 && !sending && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {currentSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 hover:bg-primary/10 transition-colors text-primary whitespace-nowrap"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-3 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Preguntale a Alice sobre la importación..."
                  disabled={sending || !conversation}
                  className="flex-1 text-sm bg-background border border-input rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sending || !conversation}
                  className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors flex-shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}