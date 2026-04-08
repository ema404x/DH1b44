import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, ChevronDown, ChevronRight, Search, X, BookOpen } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function RubroSection({ rubro, idx, precario, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');

  const subtotal = rubro.items.reduce((a, i) => a + (i.total || 0), 0);

  const addFromPrecario = (precItem) => {
    // Usar total_coef_oferta si existe, si no total_coef_pase, si no precio_unitario
    const precio = precItem.total_coef_oferta || precItem.total_coef_pase || precItem.precio_unitario || 0;
    const item = {
      precario_id: precItem.id,
      codigo: precItem.codigo || '',
      descripcion: precItem.descripcion,
      unidad: precItem.unidad,
      cantidad: 1,
      precio_unitario: precio,
      total: precio,
    };
    onChange({ ...rubro, items: [...rubro.items, item] });
  };

  const addEmptyItem = () => {
    onChange({ ...rubro, items: [...rubro.items, { codigo: '', descripcion: '', unidad: 'UN', cantidad: 1, precio_unitario: 0, total: 0 }] });
  };

  const updateItem = (iIdx, key, value) => {
    const items = [...rubro.items];
    items[iIdx] = { ...items[iIdx], [key]: value };
    if (key === 'cantidad' || key === 'precio_unitario') {
      items[iIdx].total = (items[iIdx].cantidad || 0) * (items[iIdx].precio_unitario || 0);
    }
    onChange({ ...rubro, items });
  };

  const removeItem = (iIdx) => {
    onChange({ ...rubro, items: rubro.items.filter((_, i) => i !== iIdx) });
  };

  // Categorías únicas del precario
  const categorias = [...new Set(precario.map(p => p.categoria).filter(Boolean))].sort();

  const filteredPrecario = precario.filter(p => {
    const matchSearch = !search ||
      p.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      p.subcategoria?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoriaFilter || p.categoria === categoriaFilter;
    return matchSearch && matchCat;
  }).slice(0, 150);

  return (
    <>
      <Card className="border border-border/80 shadow-sm">
        {/* Rubro header */}
        <CardHeader className="py-0 px-0">
          <div
            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors rounded-t-xl"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary text-xs font-bold shrink-0">
              {idx + 1}
            </div>
            <Input
              value={rubro.nombre}
              onChange={e => { e.stopPropagation(); onChange({ ...rubro, nombre: e.target.value }); }}
              onClick={e => e.stopPropagation()}
              className="font-semibold h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 flex-1 cursor-text"
            />
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm font-bold text-primary whitespace-nowrap">{fmt(subtotal)}</span>
              <Badge variant="outline" className="text-[10px] hidden sm:flex">{rubro.items.length} ítems</Badge>
              {expanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <Button
                variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0"
                onClick={e => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="px-0 pb-3 pt-0 border-t">
            {rubro.items.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="text-[11px] w-24 pl-3">Código</TableHead>
                      <TableHead className="text-[11px]">Descripción</TableHead>
                      <TableHead className="text-[11px] w-16">Unidad</TableHead>
                      <TableHead className="text-[11px] w-20 text-right">Cantidad</TableHead>
                      <TableHead className="text-[11px] w-28 text-right">P. Unitario</TableHead>
                      <TableHead className="text-[11px] w-28 text-right pr-3">Total</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rubro.items.map((item, iIdx) => (
                      <TableRow key={iIdx} className="hover:bg-muted/10 group/row">
                        <TableCell className="py-1.5 pl-3">
                          <Input
                            value={item.codigo || ''}
                            onChange={e => updateItem(iIdx, 'codigo', e.target.value)}
                            className="h-7 text-xs font-mono border-transparent bg-transparent px-1 focus-visible:border-input focus-visible:bg-background"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            value={item.descripcion || ''}
                            onChange={e => updateItem(iIdx, 'descripcion', e.target.value)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 focus-visible:border-input focus-visible:bg-background min-w-[200px]"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            value={item.unidad || ''}
                            onChange={e => updateItem(iIdx, 'unidad', e.target.value)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 focus-visible:border-input focus-visible:bg-background text-center"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            type="number"
                            value={item.cantidad ?? ''}
                            onChange={e => updateItem(iIdx, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 focus-visible:border-input focus-visible:bg-background text-right"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            type="number"
                            value={item.precio_unitario ?? ''}
                            onChange={e => updateItem(iIdx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 focus-visible:border-input focus-visible:bg-background text-right"
                          />
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-semibold text-sm pr-3 whitespace-nowrap">
                          {fmt(item.total)}
                        </TableCell>
                        <TableCell className="py-1.5 pr-2">
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                            onClick={() => removeItem(iIdx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p>Sin ítems. Agregá del precario o ingresá manualmente.</p>
              </div>
            )}

            <div className="flex gap-2 mt-2 px-3">
              <Button
                size="sm" variant="outline"
                className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => setSelectorOpen(true)}
              >
                <Search className="h-3 w-3" /> Del Preciario
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7 gap-1.5 text-muted-foreground" onClick={addEmptyItem}>
                <Plus className="h-3 w-3" /> Ítem manual
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Selector de preciario */}
      <Dialog open={selectorOpen} onOpenChange={(o) => { setSelectorOpen(o); if (!o) { setSearch(''); setCategoriaFilter(''); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle className="text-base">Seleccionar del Preciario Ministerial</DialogTitle>
          </DialogHeader>

          {/* Search & filters */}
          <div className="px-5 py-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por descripción, código o subcategoría..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
                autoFocus
              />
            </div>
            {categorias.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setCategoriaFilter('')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${!categoriaFilter ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  Todas
                </button>
                {categorias.slice(0, 8).map(c => (
                  <button
                    key={c}
                    onClick={() => setCategoriaFilter(c === categoriaFilter ? '' : c)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${categoriaFilter === c ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs w-24">Código</TableHead>
                  <TableHead className="text-xs">Descripción</TableHead>
                  <TableHead className="text-xs w-20 hidden sm:table-cell">Categoría</TableHead>
                  <TableHead className="text-xs w-14">UM</TableHead>
                  <TableHead className="text-xs text-right w-28">P.U. c/pase</TableHead>
                  <TableHead className="text-xs text-right w-28 hidden md:table-cell">Total oferta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrecario.map(p => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-primary/5 text-sm"
                    onClick={() => addFromPrecario(p)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground py-2">{p.codigo || '—'}</TableCell>
                    <TableCell className="py-2">
                      <div>
                        <p className="font-medium text-sm leading-tight">{p.descripcion}</p>
                        {p.subcategoria && <p className="text-[11px] text-muted-foreground mt-0.5">{p.subcategoria}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden sm:table-cell">
                      {p.categoria && <Badge variant="outline" className="text-[10px] py-0">{p.categoria}</Badge>}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{p.unidad}</TableCell>
                    <TableCell className="py-2 text-right font-medium text-sm">{fmt(p.total_coef_pase)}</TableCell>
                    <TableCell className="py-2 text-right hidden md:table-cell">
                      <span className="font-bold text-primary text-sm">{fmt(p.total_coef_oferta)}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPrecario.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-sm">
                      {precario.length === 0
                        ? 'No hay preciario cargado. Importá el archivo Excel del Ministerio.'
                        : 'No se encontraron ítems con esos criterios.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {filteredPrecario.length === 150 && (
              <p className="text-center text-xs text-muted-foreground py-2">Mostrando los primeros 150 resultados. Refiná la búsqueda.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}