import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, FolderKanban, ClipboardList, Users, Package, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const categoryConfig = {
  projects: { label: 'Proyectos', icon: FolderKanban, path: '/proyectos', color: 'text-blue-500' },
  orders: { label: 'Órdenes de Trabajo', icon: ClipboardList, path: '/ordenes', color: 'text-amber-500' },
  clients: { label: 'Clientes', icon: Users, path: '/clientes', color: 'text-emerald-500' },
  materials: { label: 'Inventario', icon: Package, path: '/inventario', color: 'text-purple-500' },
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [everOpened, setEverOpened] = useState(false);
  const inputRef = useRef();
  const navigate = useNavigate();

  // Solo cargar datos cuando el buscador se abre por primera vez
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list(), enabled: everOpened, staleTime: 1000 * 60 * 15 });
  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list('-updated_date', 200), enabled: everOpened, staleTime: 1000 * 60 * 15 });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), enabled: everOpened, staleTime: 1000 * 60 * 15 });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list(), enabled: everOpened, staleTime: 1000 * 60 * 15 });

  const openSearch = () => { setEverOpened(true); setOpen(true); };

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results = query.trim().length < 2 ? [] : [
    ...projects.filter(p => p.name?.toLowerCase().includes(query.toLowerCase()) || p.code?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3).map(p => ({ id: p.id, label: p.name, sub: p.client_name, category: 'projects' })),
    ...orders.filter(o => o.title?.toLowerCase().includes(query.toLowerCase()) || o.code?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3).map(o => ({ id: o.id, label: o.title, sub: o.assigned_name, category: 'orders' })),
    ...clients.filter(c => c.name?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3).map(c => ({ id: c.id, label: c.name, sub: c.email, category: 'clients' })),
    ...materials.filter(m => m.name?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3).map(m => ({ id: m.id, label: m.name, sub: m.category, category: 'materials' })),
  ];

  const handleSelect = (result) => {
    navigate(categoryConfig[result.category].path);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => openSearch()}
        className="flex items-center gap-2 px-3 h-9 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors w-full max-w-xs"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline-flex text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar proyectos, OTs, clientes, materiales..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && <button onClick={() => setQuery('')}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>}
              <kbd className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 font-mono text-muted-foreground">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {query.length < 2 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Escribí al menos 2 caracteres para buscar
                </div>
              )}
              {query.length >= 2 && results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No se encontraron resultados para "<span className="font-medium">{query}</span>"
                </div>
              )}
              {results.length > 0 && (
                <div className="py-2">
                  {['projects','orders','clients','materials'].map(cat => {
                    const catResults = results.filter(r => r.category === cat);
                    if (catResults.length === 0) return null;
                    const conf = categoryConfig[cat];
                    const Icon = conf.icon;
                    return (
                      <div key={cat}>
                        <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{conf.label}</div>
                        {catResults.map(r => (
                          <button
                            key={r.id}
                            onClick={() => handleSelect(r)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors"
                          >
                            <Icon className={`h-4 w-4 ${conf.color} flex-shrink-0`} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{r.label}</div>
                              {r.sub && <div className="text-xs text-muted-foreground truncate">{r.sub}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}