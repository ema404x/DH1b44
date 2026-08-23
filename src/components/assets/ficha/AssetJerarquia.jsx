import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpCircle, GitBranch, CornerDownRight } from 'lucide-react';

// Jerarquía UpKeep-style: navegar al padre y a los sub-activos.
// Las queries corren como app-user → RLS ya aísla por sector (sin fuga).
export default function AssetJerarquia({ asset }) {
  const { data: children = [] } = useQuery({
    queryKey: ['asset-children', asset.id],
    queryFn: () => base44.entities.Asset.filter({ parent_asset_id: asset.id }, '-updated_date', 200),
  });
  const { data: parent } = useQuery({
    queryKey: ['asset', asset.parent_asset_id],
    queryFn: () => base44.entities.Asset.get(asset.parent_asset_id),
    enabled: !!asset.parent_asset_id,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><GitBranch className="h-4 w-4" /> Jerarquía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {asset.parent_asset_id ? (
          <Link to={`/activos/${asset.parent_asset_id}`} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors">
            <ArrowUpCircle className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground">Activo padre</div>
              <div className="text-sm font-medium truncate">{parent?.name || '…'}</div>
            </div>
          </Link>
        ) : (
          <div className="text-xs text-muted-foreground">Activo raíz (sin padre).</div>
        )}
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">Sub-activos ({children.length})</div>
          {children.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sin sub-activos.</div>
          ) : (
            <div className="space-y-1.5">
              {children.map((c) => (
                <Link key={c.id} to={`/activos/${c.id}`} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/40 transition-colors">
                  <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.code || '—'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}