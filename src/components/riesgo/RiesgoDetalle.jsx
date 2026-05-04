import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getNivelConfig } from '@/pages/ControlRiesgo';

export default function RiesgoDetalle({ riesgo: r, onClose }) {
  const nc = getNivelConfig(r.nivel_riesgo || 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <Badge variant="outline" className={`border ${nc.color}`}>{nc.label}</Badge>
        <Badge variant="outline">{r.sector}</Badge>
      </div>

      <div>
        <h2 className="text-lg font-bold leading-tight">{r.evento_riesgo}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Nivel de riesgo: <strong>{r.nivel_riesgo}</strong></p>
      </div>

      {/* Matriz visual */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Probabilidad</p>
            <p className="text-lg font-bold">{r.probabilidad}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Consecuencia</p>
            <p className="text-lg font-bold">{r.consecuencia}</p>
          </CardContent>
        </Card>
      </div>

      {/* Método de control */}
      {r.metodo_control && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-primary" /> Método de Control
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm leading-relaxed">{r.metodo_control}</p>
          </CardContent>
        </Card>
      )}

      {/* Frecuencia */}
      {r.frecuencia && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Frecuencia Establecida</p>
              <p className="text-sm font-medium">{r.frecuencia}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alcance */}
      {r.en_alcance && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>Dentro del alcance del contrato: <strong>{r.en_alcance}</strong></span>
        </div>
      )}

      {/* Comentarios */}
      {r.comentarios && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Comentarios</p>
            <p className="text-sm leading-relaxed">{r.comentarios}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}