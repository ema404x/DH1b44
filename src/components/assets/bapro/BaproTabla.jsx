import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import AssetRow from '@/components/assets/AssetRow';

export default function BaproTabla({ rows, sedes, isLoading, vacio, onEdit, onOpen, onQr, onDelete }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Activo</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Sede</th>
                <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Tipo</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Criticidad</th>
                <th className="hidden px-3 py-2.5 font-medium xl:table-cell">Mant.</th>
                <th className="px-3 py-2.5 font-medium">BAPRO</th>
                <th className="hidden px-3 py-2.5 text-right font-medium lg:table-cell">Valor</th>
                <th className="w-20 px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(asset => (
                <AssetRow key={asset.id} asset={asset} sedes={sedes} onEdit={onEdit} onOpen={onOpen} onQr={onQr} onDelete={onDelete} />
              ))}
            </tbody>
            {(isLoading || (rows.length === 0 && vacio)) && (
              <tfoot><tr><td colSpan={9} className="py-12 text-center text-muted-foreground">
                {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : vacio}
              </td></tr></tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}