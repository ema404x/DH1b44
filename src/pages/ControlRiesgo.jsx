import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShieldAlert, AlertTriangle, CheckCircle2, AlertCircle, Zap, Sparkles, Send, Loader2, X, Bot } from 'lucide-react';
import MatrizRiesgos from '@/components/riesgo/MatrizRiesgos';
import ReactMarkdown from 'react-markdown';

const NIVEL_CONFIG = {
  aceptable: { label: 'Aceptable', color: 'bg-emerald-500', text: 'text-emerald-900', border: 'border-emerald-400', max: 3 },
  tolerable:  { label: 'Tolerable', color: 'bg-yellow-400',  text: 'text-yellow-900', border: 'border-yellow-400', min: 4,  max: 15 },
  alto:       { label: 'Alto',      color: 'bg-orange-500',  text: 'text-white',       border: 'border-orange-500', min: 16, max: 31 },
  extremo:    { label: 'Extremo',   color: 'bg-red-600',     text: 'text-white',       border: 'border-red-600',    min: 32 },
};

export function getNivelConfig(n) {
  if (n < 4)  return { key: 'aceptable', ...NIVEL_CONFIG.aceptable };
  if (n < 16) return { key: 'tolerable', ...NIVEL_CONFIG.tolerable };
  if (n < 32) return { key: 'alto',      ...NIVEL_CONFIG.alto };
  return { key: 'extremo', ...NIVEL_CONFIG.extremo };
}

const SECTORES = ['Todos', 'EDUCACION', 'SALUD', 'BAPRO'];

function AliceRiesgoPanel() {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [init, setInit] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = async () => {
    setOpen(true);
    if (init) return;
    setInit(true);
    const conv = await base44.agents.createConversation({
      agent_name: 'soporte_app',
      metadata: { name: 'Consulta Riesgos' },
    });
    // Contexto inicial silencioso
    await base44.agents.addMessage(conv, {
      role: 'user',
      content: '[CONTEXTO INTERNO - no lo menciones] El usuario está en el módulo Control de Riesgos, que muestra la matriz de riesgos operativos por sector (EDUCACION, SALUD, BAPRO) con probabilidad, consecuencia, nivel de riesgo, método de control y frecuencia. Saludalo brevemente y ofrecete a responder consultas sobre la matriz de riesgos.',
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      const visible = (data.messages || []).filter((m, i) =>
        !(i === 0 && m.role === 'user' && m.content?.startsWith('[CONTEXTO'))
      );
      setMessages(visible);
    });
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || sending || !conversation) return;
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    } finally {
      setSending(false);
    }
  };

  const isThinking = messages.length > 0 && messages[messages.length - 1]?.role === 'user';

  const SUGERENCIAS = [
    '¿Qué riesgos son más críticos en EDUCACION?',
    '¿Cómo se clasifica el nivel de riesgo?',
    '¿Qué significa MP y MC en los métodos?',
    '¿Cuál es la frecuencia más recomendada?',
  ];

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header clickeable */}
      <button
        onClick={open ? () => setOpen(false) : openChat}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Consultá a Alice</p>
            <p className="text-xs text-muted-foreground">Hacé preguntas sobre la matriz de riesgos</p>
          </div>
        </div>
        <X className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-0' : 'rotate-45'}`} />
      </button>

      {/* Panel expandido */}
      {open && (
        <div className="border-t border-primary/10">
          {/* Mensajes */}
          <div className="h-64 overflow-y-auto px-3 py-3 space-y-2.5 bg-background/40">
            {!conversation && (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {conversation && messages.length === 0 && !isThinking && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Sugerencias rápidas:</p>
                {SUGERENCIAS.map((s, i) => (
                  <button key={i} onClick={() => { setInput(s); }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-1.5`}>
                  {!isUser && (
                    <div className="h-5 w-5 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0 mb-0.5">
                      <Bot className="h-2.5 w-2.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    isUser ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    {isUser ? <p>{msg.content}</p> : (
                      <ReactMarkdown className="prose prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              );
            })}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-border/30 flex gap-2 items-end bg-card/50">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Preguntale a Alice sobre los riesgos..."
              rows={1}
              className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring resize-none"
            />
            <Button size="icon" className="h-8 w-8 rounded-lg flex-shrink-0"
              onClick={handleSend} disabled={!input.trim() || !conversation || sending}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ControlRiesgo() {
  const [sector, setSector] = useState('Todos');
  const [nivelFilter, setNivelFilter] = useState('Todos');
  const [search, setSearch] = useState('');

  const { data: riesgos = [], isLoading } = useQuery({
    queryKey: ['riesgos-control'],
    queryFn: () => base44.entities.RiesgoControl.list('numero', 200),
  });

  const filtered = riesgos.filter(r => {
    const nc = getNivelConfig(r.nivel_riesgo || 0);
    if (sector !== 'Todos' && r.sector !== sector) return false;
    if (nivelFilter !== 'Todos' && nc.key !== nivelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.evento_riesgo?.toLowerCase().includes(q) &&
          !r.metodo_control?.toLowerCase().includes(q) &&
          !r.comentarios?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = riesgos.reduce((acc, r) => {
    const nc = getNivelConfig(r.nivel_riesgo || 0);
    acc[nc.key] = (acc[nc.key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-orange-500" />
            Control de Riesgos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Matriz de riesgos por sector — EDUCACION · SALUD · BAPRO</p>
        </div>
      </div>

      {/* Matriz de Riesgos visual */}
      <MatrizRiesgos />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'extremo',   label: 'Extremo',   icon: Zap,           color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
          { key: 'alto',      label: 'Alto',       icon: AlertTriangle, color: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200' },
          { key: 'tolerable', label: 'Tolerable',  icon: AlertCircle,   color: 'text-yellow-600',  bg: 'bg-yellow-50 border-yellow-200' },
          { key: 'aceptable', label: 'Aceptable',  icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <div
            key={key}
            className={`rounded-xl border p-4 cursor-pointer transition-all ${bg} ${nivelFilter === key ? 'ring-2 ring-offset-1 ring-primary' : 'hover:shadow-sm'}`}
            onClick={() => setNivelFilter(nivelFilter === key ? 'Todos' : key)}
          >
            <div className="flex items-center justify-between">
              <Icon className={`h-5 w-5 ${color}`} />
              <span className={`text-2xl font-bold ${color}`}>{stats[key] || 0}</span>
            </div>
            <p className={`text-xs font-semibold mt-1 ${color}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar evento, método de control..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {SECTORES.map(s => (
            <Button key={s} size="sm" variant={sector === s ? 'default' : 'outline'}
              className="text-xs" onClick={() => setSector(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Panel Alice */}
      <AliceRiesgoPanel />

      {/* Tabla planilla */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando riesgos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldAlert className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>No hay riesgos que coincidan con los filtros</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-auto">
          <table className="w-full text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-10">N°</th>
                <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-16">Sector</th>
                <th className="px-3 py-3 text-left font-semibold border-r border-slate-600">Evento / Riesgo Posible</th>
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-24">Probabilidad</th>
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-24">Consecuencia</th>
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-20">Nivel Riesgo</th>
                <th className="px-3 py-3 text-left font-semibold border-r border-slate-600">Método de Control</th>
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-32">Frecuencia</th>
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-20">En Alcance</th>
                <th className="px-3 py-3 text-left font-semibold w-48">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const nc = getNivelConfig(r.nivel_riesgo || 0);
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 transition-colors hover:bg-primary/5 ${isEven ? 'bg-card' : 'bg-muted/20'}`}
                  >
                    {/* N° */}
                    <td className="px-3 py-2.5 text-center border-r border-border/30 font-mono text-muted-foreground align-top">{r.numero || idx + 1}</td>

                    {/* Sector */}
                    <td className="px-3 py-2.5 border-r border-border/30 align-top">
                      <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{r.sector}</span>
                    </td>

                    {/* Evento */}
                    <td className="px-3 py-2.5 border-r border-border/30 align-top font-medium leading-snug max-w-xs">
                      {r.evento_riesgo}
                    </td>

                    {/* Probabilidad */}
                    <td className="px-3 py-2.5 border-r border-border/30 text-center align-top">
                      <ProbBadge value={r.probabilidad} />
                    </td>

                    {/* Consecuencia */}
                    <td className="px-3 py-2.5 border-r border-border/30 text-center align-top">
                      <ConsBadge value={r.consecuencia} />
                    </td>

                    {/* Nivel */}
                    <td className="px-3 py-2.5 border-r border-border/30 text-center align-top">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold ${nc.color} ${nc.text}`}>
                        {r.nivel_riesgo || '—'}
                      </span>
                      <div className={`text-[9px] font-semibold mt-1 ${nc.text.includes('white') ? 'text-foreground' : ''}`} style={{ color: 'inherit' }}>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${nc.color} ${nc.text}`}>{nc.label}</span>
                      </div>
                    </td>

                    {/* Método de control */}
                    <td className="px-3 py-2.5 border-r border-border/30 align-top text-muted-foreground leading-relaxed max-w-sm">
                      {r.metodo_control || <span className="text-border">—</span>}
                    </td>

                    {/* Frecuencia */}
                    <td className="px-3 py-2.5 border-r border-border/30 text-center align-top text-muted-foreground leading-snug">
                      {r.frecuencia || <span className="text-border">—</span>}
                    </td>

                    {/* En alcance */}
                    <td className="px-3 py-2.5 border-r border-border/30 text-center align-top">
                      {r.en_alcance === 'SI' || r.en_alcance === 'Sí' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> SI
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{r.en_alcance || '—'}</span>
                      )}
                    </td>

                    {/* Comentarios */}
                    <td className="px-3 py-2.5 align-top text-muted-foreground leading-snug max-w-xs">
                      {r.comentarios || <span className="text-border">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-muted/20 border-t text-xs text-muted-foreground">
            {filtered.length} riesgos · {sector !== 'Todos' ? sector : 'Todos los sectores'}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-componentes de badge para probabilidad y consecuencia
function ProbBadge({ value }) {
  const colors = {
    'Muy Alta': 'bg-red-100 text-red-800 border-red-300',
    'Alta':     'bg-orange-100 text-orange-800 border-orange-300',
    'Media':    'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Baja':     'bg-blue-100 text-blue-800 border-blue-300',
    'Muy baja': 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${colors[value] || 'bg-muted text-muted-foreground border-border'}`}>
      {value || '—'}
    </span>
  );
}

function ConsBadge({ value }) {
  const colors = {
    'Maxima':   'bg-red-100 text-red-800 border-red-300',
    'Mayor':    'bg-orange-100 text-orange-800 border-orange-300',
    'Moderada': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Menor':    'bg-blue-100 text-blue-800 border-blue-300',
    'Minima':   'bg-slate-100 text-slate-600 border-slate-300',
  };
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${colors[value] || 'bg-muted text-muted-foreground border-border'}`}>
      {value || '—'}
    </span>
  );
}