import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, ChevronDown, ChevronUp, Loader2, Send, Paperclip, X, File, Copy, Check } from 'lucide-react';
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
  const workOrders = sheets.filter(s => s.target_entity === 'WorkOrder');
  const highConf = sheets.filter(s => s.confidence >= 0.85);
  const lowConf = sheets.filter(s => s.confidence < 0.6);
  const needsUnpivot = sheets.filter(s => s.needs_unpivot);

  // Detectar comunas
  const comunasDetectadas = new Set();
  sheets.forEach(s => {
    if (s.detected_comuna) comunasDetectadas.add(s.detected_comuna);
  });
  const comunasList = Array.from(comunasDetectadas).sort();

  // Detectar modelos de planilla
  const modelosDetectados = new Set();
  sheets.forEach(s => {
    if (s.detected_planilla_model) modelosDetectados.add(s.detected_planilla_model);
  });
  const modelosList = Array.from(modelosDetectados).sort();

  let msg = `**Análisis de ingeniero senior completado** ✓\n\n`;
  msg += `Detecté **${total.toLocaleString()} pendientes/órdenes** en **${sheets.length} hoja${sheets.length !== 1 ? 's' : ''}**.\n\n`;

  if (comunasList.length > 0) {
    msg += `🏘️ **Comuna${comunasList.length > 1 ? 's' : ''} detectada${comunasList.length > 1 ? 's' : ''}:** ${comunasList.map(c => `**${c}**`).join(', ')}\n`;
  }
  
  if (modelosList.length > 0) {
    const modelDescs = {
      '8A': 'Inspector + estructura SAP completa',
      '8B': 'Formato pivotado (dirección/jefe como columnas)',
      '10A': 'Sin inspector (simplificado)'
    };
    msg += `📋 **Modelo${modelosList.length > 1 ? 's' : ''} de planilla:** ${modelosList.map(m => `**${m}** - ${modelDescs[m] || ''}`).join(', ')}\n\n`;
  }

  if (needsUnpivot.length > 0) {
    msg += `⚠️ **Requiere desagregación (8B):** ${needsUnpivot.map(s => `"${s.sheet_name}"`).join(', ')}\n`;
    msg += `   Las direcciones están como columnas. Se desagregará automáticamente al importar.\n\n`;
  }

  if (highConf.length > 0) {
    msg += `✅ **Detectadas (${highConf.length} hojas):**\n`;
    highConf.forEach(s => {
      const modelTag = s.detected_planilla_model ? ` [${s.detected_planilla_model}]` : '';
      const pendientesTag = s.target_entity === 'WorkOrder' ? ` — ${s.row_count} pendientes` : '';
      msg += `   • "${s.sheet_name}" → ${s.target_entity}${modelTag}${pendientesTag}\n`;
    });
    msg += '\n';
  }

  if (lowConf.length > 0) {
    msg += `⚠️ **Auxiliares (será omitido en importación):** ${lowConf.map(s => `"${s.sheet_name}"`).join(', ')}\n\n`;
  }

  msg += `🚀 Listo para importar. ${workOrders.length > 0 ? `Se crearán ${workOrders.reduce((a, s) => a + (s.row_count || 0), 0)} órdenes de trabajo.` : 'Sin pendientes detectadas.'}`;

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

const AVATAR_GRADIENT = "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500";

function ChatAvatar({ size = 'lg' }) {
  const dim = size === 'lg' ? 'h-9 w-9' : 'h-7 w-7';
  const icon = size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <div className={`${dim} ${AVATAR_GRADIENT} rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-purple-500/20`}>
      <Sparkles className={`${icon} text-white`} />
    </div>
  );
}

export default function AliceImportAssistant({ step, mappingResult, importResult }) {
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [initDone, setInitDone] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const conversationInitRef = useRef(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Inicializa la conversación de forma lazy (solo cuando el usuario necesita respuesta del agente)
  const ensureConversation = async () => {
    if (conversation) return conversation;
    if (conversationInitRef.current) {
      // ya está en curso, esperar
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (conversationInitRef.current === false) {
            clearInterval(interval);
            resolve(null); // se resolverá en el próximo render via state
          }
        }, 100);
      });
    }
    conversationInitRef.current = true;
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'soporte_app',
        metadata: { name: 'Alice Importación' },
      });
      const contexto = `[CONTEXTO INTERNO]
El usuario está en el módulo de Importación de Datos del sistema DH1.
Sos Alice, asistente especializada en importación. Ayudá al usuario a entender cómo preparar sus archivos, qué entidades puede importar, qué significa cada campo, y cómo resolver errores de importación.
Sé concisa, práctica y amigable.`;
      await base44.agents.addMessage(conv, { role: 'user', content: contexto });
      setConversation(conv);
      conversationInitRef.current = false;
      return conv;
    } catch {
      conversationInitRef.current = false;
      return null;
    }
  };

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

  // Suscribirse a la conversación del agente una vez creada
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

  const handleFileSelect = async (files) => {
    if (!files.length) return;
    setUploadingFile(true);
    try {
      const fileUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrls.push(file_url);
      }
      setSelectedFiles(prev => [...prev, ...files.map((f, i) => ({ name: f.name, url: fileUrls[i], type: f.type }))]);
    } catch (err) {
      console.error('Error uploading file:', err);
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = (idx) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  const copyMessage = (id, content) => {
    navigator.clipboard?.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if ((!msg && !selectedFiles.length) || sending) return;
    setInput('');
    setSending(true);

    const userMsg = { role: 'user', content: msg || '📎 Archivos adjuntos para analizar' };
    if (selectedFiles.length > 0) userMsg.file_urls = selectedFiles.map(f => f.url);

    setMessages(prev => [...prev, userMsg]);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: selectedFiles.length > 0
        ? `📂 Recibí ${selectedFiles.length} archivo${selectedFiles.length !== 1 ? 's' : ''}: ${selectedFiles.map(f => f.name).join(', ')}. Analizando...`
        : '...',
      _typing: true
    }]);
    setSelectedFiles([]);

    // Crear conversación lazy si aún no existe
    const conv = conversation || await ensureConversation();
    if (!conv) { setSending(false); return; }

    await base44.agents.addMessage(conv, userMsg);
  };

  const currentSuggestions = STEP_MESSAGES[step]?.suggestions || [];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ChatAvatar />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-card" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Alice
              <span className="text-[10px] font-normal text-muted-foreground">· Asistente de importación</span>
            </p>
            <p className="text-[11px] text-emerald-400/80 flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> En línea · Preguntame lo que necesites
            </p>
          </div>
        </div>
        <div className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground group-hover:bg-muted transition-colors">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-border">
              {/* Messages */}
              <div className="max-h-80 min-h-48 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg, i) => {
                  const isAssistant = msg.role === 'assistant';
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {isAssistant && <ChatAvatar size="sm" />}
                      <div className={`group relative max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                          : 'bg-muted/60 border border-border rounded-2xl rounded-tl-md text-foreground'
                      }`}>
                        {msg._typing ? (
                          <div className="flex gap-1 items-center py-1">
                            {[0,1,2].map(d => (
                              <motion.div key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }}
                              />
                            ))}
                          </div>
                        ) : msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <>
                            <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-foreground prose-strong:text-foreground prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-a:text-primary">
                              {msg.content}
                            </ReactMarkdown>
                            <button
                              onClick={() => copyMessage(i, msg.content)}
                              className="absolute -top-1.5 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary"
                              title="Copiar respuesta"
                            >
                              {copiedId === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions */}
              {currentSuggestions.length > 0 && !sending && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {currentSuggestions.map((s, i) => (
                    <motion.button
                      key={i}
                      onClick={() => handleSend(s)}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      className="text-xs pl-2.5 pr-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground flex items-center gap-1.5 max-w-full"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      <span className="text-left">{s}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* File attachments preview */}
              {selectedFiles.length > 0 && (
                <div className="px-4 pb-2 space-y-1.5">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-muted/50 border border-border rounded-full pl-2.5 pr-1.5 py-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <File className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="truncate text-foreground">{file.name}</span>
                      </div>
                      <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive transition-colors ml-2 flex-shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input bar — estilo Google/Gemini */}
              <div className="px-3 pb-3 pt-1">
                <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-full pl-1.5 pr-1.5 py-1 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv,.json,.pdf"
                    onChange={e => handleFileSelect(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingFile}
                    className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground"
                    title="Adjuntar archivos para que Alice analice"
                  >
                    {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Preguntale a Alice sobre la importación..."
                    disabled={sending}
                    className="flex-1 bg-transparent border-0 outline-none text-sm px-1 py-1 placeholder:text-muted-foreground disabled:opacity-50 text-foreground"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={(!input.trim() && !selectedFiles.length) || sending}
                    className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90 transition-all flex-shrink-0 shadow-sm"
                    title="Enviar"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}