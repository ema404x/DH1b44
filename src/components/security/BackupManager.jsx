import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, HardDrive, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  verified: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
};

export default function BackupManager() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState('manual');

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => base44.entities.EncryptedBackup.filter({}, '-created_date', 50)
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('backupEncrypted', {
        backup_type: selectedType
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      alert('Backup completado exitosamente');
    },
    onError: (err) => {
      alert('Error en backup: ' + err.message);
    }
  });

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold flex items-center gap-2"><HardDrive className="h-5 w-5" />Backup Encriptado</h3>
            <p className="text-sm text-muted-foreground mt-1">Backups automáticos con encriptación AES-256</p>
          </div>
          <Button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="gap-2"
          >
            {backupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Hacer Backup Ahora
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando backups...</div>
        ) : backups.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">No hay backups aún</Card>
        ) : (
          backups.map((backup) => (
            <Card key={backup.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{backup.backup_name}</span>
                    <Badge className={`text-xs border ${statusColors[backup.status]}`}>
                      {backup.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {backup.backup_type}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Fecha: {format(new Date(backup.backup_date), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</div>
                    <div>Tamaño: {formatBytes(backup.size_bytes)}</div>
                    <div>Entidades: {backup.entities_backed_up?.length || 0}</div>
                    <div className="font-mono text-xs">Hash: {backup.backup_hash?.slice(0, 16)}...</div>
                  </div>
                </div>
                {backup.status === 'completed' && (
                  <Button variant="outline" size="icon" disabled>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="p-4 bg-blue-500/10 border-blue-500/30">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200/90">
            <strong>Política de Retención:</strong> Los backups se eliminan automáticamente después de 90 días.
            Los backups diarios se hacen automáticamente cada medianoche (Argentina).
          </div>
        </div>
      </Card>
    </div>
  );
}