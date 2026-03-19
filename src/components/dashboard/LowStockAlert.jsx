import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function LowStockAlert({ materials }) {
  const lowStock = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);

  if (lowStock.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base font-semibold text-amber-800">Stock Bajo</CardTitle>
          </div>
          <Link to="/inventario" className="text-xs text-amber-700 font-medium flex items-center gap-1 hover:underline">
            Ver inventario <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lowStock.slice(0, 4).map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span className="text-amber-900">{m.name}</span>
              <span className="text-amber-700 font-medium">{m.stock} / {m.min_stock} mín.</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}