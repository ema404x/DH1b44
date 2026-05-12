import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckSquare, Camera, Image, X, Loader2 } from 'lucide-react';

export default function WorkOrderChecklist({ checklist = [], onChange }) {
  const [newTask, setNewTask] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const fileRefs = useRef({});

  const addTask = () => {
    if (!newTask.trim()) return;
    onChange([...checklist, { id: Date.now().toString(), task: newTask.trim(), completed: false, notes: '', photo_url: null }]);
    setNewTask('');
  };

  const toggleTask = (id) => {
    onChange(checklist.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = (id) => {
    onChange(checklist.filter(t => t.id !== id));
  };

  const updateNotes = (id, notes) => {
    onChange(checklist.map(t => t.id === id ? { ...t, notes } : t));
  };

  const uploadPhoto = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(checklist.map(t => t.id === id ? { ...t, photo_url: file_url } : t));
    setUploadingId(null);
  };

  const removePhoto = (id) => {
    onChange(checklist.map(t => t.id === id ? { ...t, photo_url: null } : t));
  };

  const completed = checklist.filter(t => t.completed).length;
  const pct = checklist.length > 0 ? Math.round((completed / checklist.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Lista de Tareas</span>
          {checklist.length > 0 && (
            <span className="text-xs text-muted-foreground">{completed}/{checklist.length} ({pct}%)</span>
          )}
        </div>
      </div>

      {checklist.length > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="space-y-2">
        {checklist.map(task => (
          <div key={task.id} className={`rounded-xl border p-3 space-y-2 transition-colors ${task.completed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-border'}`}>
            {/* Fila principal */}
            <div className="flex items-center gap-3">
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => toggleTask(task.id)}
                className="flex-shrink-0 h-5 w-5"
              />
              <span className={`flex-1 text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                {task.task}
              </span>
              {/* Botón adjuntar foto */}
              <button
                className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                title="Adjuntar foto de ejemplo"
                onClick={() => fileRefs.current[task.id]?.click()}
                disabled={uploadingId === task.id}
              >
                {uploadingId === task.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : task.photo_url
                    ? <Image className="h-4 w-4 text-primary" />
                    : <Camera className="h-4 w-4" />
                }
              </button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={el => fileRefs.current[task.id] = el}
                onChange={e => uploadPhoto(task.id, e.target.files[0])}
              />
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6 text-destructive flex-shrink-0 opacity-60 hover:opacity-100"
                onClick={() => removeTask(task.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Foto adjunta */}
            {task.photo_url && (
              <div className="relative inline-block">
                <img
                  src={task.photo_url}
                  alt="foto tarea"
                  className="h-24 w-auto rounded-lg border border-border object-cover"
                />
                <button
                  onClick={() => removePhoto(task.id)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full h-4 w-4 flex items-center justify-center"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {/* Nota opcional */}
            <Input
              placeholder="Nota o comentario de esta tarea (opcional)..."
              value={task.notes || ''}
              onChange={e => updateNotes(task.id, e.target.value)}
              className="text-xs h-7 bg-transparent border-border/50 placeholder:text-muted-foreground/50"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Agregar tarea al checklist..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          className="text-sm"
        />
        <Button size="sm" onClick={addTask} disabled={!newTask.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}