import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

export default function FiltroAlertas({ logs, onFilter }) {
  const [filtros, setFiltros] = useState({
    tipo: 'todos',
    nivel: 'todos',
    leida: 'todos',
    busqueda: '',
  });

  const aplicarFiltro = () => {
    const filtered = logs.filter(log => {
      if (filtros.tipo !== 'todos' && log.tipo !== filtros.tipo) return false;
      if (filtros.nivel !== 'todos' && log.nivel !== filtros.nivel) return false;
      if (filtros.leida !== 'todos') {
        const isLeida = log.leida;
        if (filtros.leida === 'no_leidas' && isLeida) return false;
        if (filtros.leida === 'leidas' && !isLeida) return false;
      }
      if (filtros.busqueda) {
        const busquedaLower = filtros.busqueda.toLowerCase();
        return (
          log.titulo?.toLowerCase().includes(busquedaLower) ||
          log.entidad_nombre?.toLowerCase().includes(busquedaLower)
        );
      }
      return true;
    });
    onFilter(filtered);
  };

  const resetear = () => {
    setFiltros({
      tipo: 'todos',
      nivel: 'todos',
      leida: 'todos',
      busqueda: '',
    });
    onFilter(logs);
  };

  React.useEffect(() => {
    aplicarFiltro();
  }, [filtros]);

  const tipos = [...new Set(logs.map(l => l.tipo))].filter(Boolean);
  const niveles = [...new Set(logs.map(l => l.nivel))].filter(Boolean);

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Buscar alerta..."
          value={filtros.busqueda}
          onChange={e => setFiltros({ ...filtros, busqueda: e.target.value })}
          className="text-xs h-8"
        />
        <Select value={filtros.leida} onValueChange={v => setFiltros({ ...filtros, leida: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="no_leidas">No leídas</SelectItem>
            <SelectItem value="leidas">Leídas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={filtros.tipo} onValueChange={v => setFiltros({ ...filtros, tipo: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.nivel} onValueChange={v => setFiltros({ ...filtros, nivel: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Nivel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los niveles</SelectItem>
            {niveles.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full h-7 text-xs gap-1.5"
        onClick={resetear}
      >
        <X className="h-3 w-3" /> Limpiar filtros
      </Button>
    </div>
  );
}