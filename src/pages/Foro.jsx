import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, Plus, SortAsc, Filter, Megaphone } from "lucide-react";
import ForoCategoriasSidebar from "@/components/foro/ForoCategoriasSidebar";
import ForoHiloCard from "@/components/foro/ForoHiloCard";
import ForoHiloDetalle from "@/components/foro/ForoHiloDetalle";
import ForoNuevoHiloDialog from "@/components/foro/ForoNuevoHiloDialog";
import ForoNotificacionesBell from "@/components/foro/ForoNotificacionesBell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Foro() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [hiloActivo, setHiloActivo] = useState(null);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [search, setSearch] = useState("");
  const [orden, setOrden] = useState("reciente");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [nuevoHiloOpen, setNuevoHiloOpen] = useState(false);
  const [nuevaCatOpen, setNuevaCatOpen] = useState(false);
  const [nuevaCat, setNuevaCat] = useState({ nombre: "", icono: "💬", descripcion: "" });

  // Data
  const { data: hilos = [], isLoading } = useQuery({
    queryKey: ["foro-hilos"],
    queryFn: () => base44.entities.ForoHilo.list("-created_date", 200),
    refetchInterval: 15000,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["foro-categorias"],
    queryFn: () => base44.entities.ForoCategoria.list("orden", 50),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => base44.entities.User.list(),
  });

  // Mutations
  const crearHiloMut = useMutation({
    mutationFn: (data) => base44.entities.ForoHilo.create(data),
    onSuccess: async (hiloCreado) => {
      // Notificar a todos si es anuncio
      if (hiloCreado.tipo === 'anuncio') {
        const otrosUsuarios = usuarios.filter(u => u.id !== user?.id);
        await Promise.all(otrosUsuarios.map(u =>
          base44.entities.ForoNotificacion.create({
            usuario_id: u.id,
            tipo: 'anuncio',
            hilo_id: hiloCreado.id,
            hilo_titulo: hiloCreado.titulo,
            actor_nombre: user?.full_name || user?.email,
            leida: false,
          })
        ));
      }
      // Notificar menciones
      if (hiloCreado.menciones?.length) {
        const mencionados = usuarios.filter(u =>
          hiloCreado.menciones.some(m => (u.full_name || "").toLowerCase().includes(m.toLowerCase()))
        );
        await Promise.all(mencionados.map(u =>
          base44.entities.ForoNotificacion.create({
            usuario_id: u.id,
            tipo: 'mencion',
            hilo_id: hiloCreado.id,
            hilo_titulo: hiloCreado.titulo,
            actor_nombre: user?.full_name || user?.email,
            leida: false,
          })
        ));
      }
      qc.invalidateQueries(["foro-hilos"]);
      setNuevoHiloOpen(false);
    },
  });

  const eliminarHiloMut = useMutation({
    mutationFn: async (id) => {
      const respuestas = await base44.entities.ForoRespuesta.filter({ hilo_id: id });
      await Promise.all(respuestas.map(r => base44.entities.ForoRespuesta.delete(r.id)));
      return base44.entities.ForoHilo.delete(id);
    },
    onSuccess: () => { qc.invalidateQueries(["foro-hilos"]); setHiloActivo(null); },
  });

  const crearCategoriaMut = useMutation({
    mutationFn: (data) => base44.entities.ForoCategoria.create(data),
    onSuccess: () => { qc.invalidateQueries(["foro-categorias"]); setNuevaCatOpen(false); setNuevaCat({ nombre: "", icono: "💬", descripcion: "" }); },
  });

  // Filtrado y ordenamiento
  const conteosPorCategoria = useMemo(() => {
    const map = {};
    hilos.forEach(h => { if (h.categoria_id) map[h.categoria_id] = (map[h.categoria_id] || 0) + 1; });
    return map;
  }, [hilos]);

  const hilosFiltrados = useMemo(() => {
    let lista = [...hilos];
    if (categoriaActiva) lista = lista.filter(h => h.categoria_id === categoriaActiva);
    if (filtroTipo !== 'todos') lista = lista.filter(h => h.tipo === filtroTipo);
    if (search.trim()) lista = lista.filter(h =>
      h.titulo.toLowerCase().includes(search.toLowerCase()) ||
      h.cuerpo?.toLowerCase().includes(search.toLowerCase()) ||
      h.autor_nombre?.toLowerCase().includes(search.toLowerCase())
    );
    // Fijados primero
    const fijados = lista.filter(h => h.fijado);
    const normales = lista.filter(h => !h.fijado);
    const sortFn = orden === 'reciente'
      ? (a, b) => new Date(b.created_date) - new Date(a.created_date)
      : orden === 'popular'
        ? (a, b) => (b.total_respuestas || 0) - (a.total_respuestas || 0)
        : (a, b) => (b.vistas || 0) - (a.vistas || 0);
    return [...fijados.sort(sortFn), ...normales.sort(sortFn)];
  }, [hilos, categoriaActiva, filtroTipo, search, orden]);

  const hiloActivoData = useMemo(() => hilos.find(h => h.id === hiloActivo?.id) || hiloActivo, [hilos, hiloActivo]);

  if (hiloActivo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <ForoHiloDetalle
          hilo={hiloActivoData}
          user={user}
          onVolver={() => setHiloActivo(null)}
          onEliminarHilo={(id) => eliminarHiloMut.mutate(id)}
          usuarios={usuarios}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Foro de Comunicaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{hilos.length} hilos — {usuarios.length} participantes</p>
        </div>
        <div className="flex items-center gap-2">
          <ForoNotificacionesBell
            userId={user?.id}
            onClickNotif={(notif) => {
              const h = hilos.find(h => h.id === notif.hilo_id);
              if (h) setHiloActivo(h);
            }}
          />
          <Button onClick={() => setNuevoHiloOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo hilo
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-52 shrink-0 hidden md:block">
          <ForoCategoriasSidebar
            categorias={categorias}
            categoriaActiva={categoriaActiva}
            onSeleccionar={setCategoriaActiva}
            onNueva={() => setNuevaCatOpen(true)}
            conteosPorCategoria={conteosPorCategoria}
            user={user}
          />
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar hilos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-36">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="hilo">💬 Hilos</SelectItem>
                <SelectItem value="anuncio">📢 Anuncios</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orden} onValueChange={setOrden}>
              <SelectTrigger className="w-36">
                <SortAsc className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reciente">Más reciente</SelectItem>
                <SelectItem value="popular">Más comentados</SelectItem>
                <SelectItem value="vistas">Más vistos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
            </div>
          ) : hilosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay hilos todavía</p>
              <p className="text-sm mt-1">¡Sé el primero en publicar!</p>
              <Button onClick={() => setNuevoHiloOpen(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Nuevo hilo
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {hilosFiltrados.map(hilo => (
                <ForoHiloCard
                  key={hilo.id}
                  hilo={hilo}
                  onClick={() => setHiloActivo(hilo)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diálogos */}
      <ForoNuevoHiloDialog
        open={nuevoHiloOpen}
        onClose={() => setNuevoHiloOpen(false)}
        onCrear={(data) => crearHiloMut.mutate(data)}
        categorias={categorias}
        usuarios={usuarios}
        user={user}
        loading={crearHiloMut.isPending}
      />

      <Dialog open={nuevaCatOpen} onOpenChange={setNuevaCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex gap-2">
              <Input
                placeholder="🏗️"
                value={nuevaCat.icono}
                onChange={e => setNuevaCat(p => ({ ...p, icono: e.target.value }))}
                className="w-16 text-center text-xl"
              />
              <Input
                placeholder="Nombre de la categoría"
                value={nuevaCat.nombre}
                onChange={e => setNuevaCat(p => ({ ...p, nombre: e.target.value }))}
                className="flex-1"
              />
            </div>
            <Input
              placeholder="Descripción (opcional)"
              value={nuevaCat.descripcion}
              onChange={e => setNuevaCat(p => ({ ...p, descripcion: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNuevaCatOpen(false)}>Cancelar</Button>
              <Button onClick={() => crearCategoriaMut.mutate(nuevaCat)} disabled={!nuevaCat.nombre.trim()}>
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}