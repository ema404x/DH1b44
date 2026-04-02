import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckSquare } from 'lucide-react';

export default function WorkOrderChecklist({ checklist = [], onChange }) {
  const [newTask, setNewTask] = useState('');

  const addTask = () => {
    if (!newTask.trim()) return;
    const updated = [...checklist, { id: Date.now().toString(), task: newTask.trim(), completed: false, notes: '' }];
    onChange(updated);
    setNewTask('');
  };

  const toggleTask = (id) => {
    onChange(checklist.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = (id) => {
    onChange(checklist.filter(t => t.id !== id));
  };

  const completed = checklist.filter(t => t.completed).length;
  const pct = checklist.length > 0 ? Math.round((completed / checklist.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Checklist</span>
          {checklist.length > 0 && (
            <span className="text-xs text-muted-foreground">{completed}/{checklist.length} ({pct}%)</span>
          )}
        </div>
      </div>

      {checklist.length > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="space-y-1.5">
        {checklist.map(task => (
          <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 group">
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => toggleTask(task.id)}
              className="flex-shrink-0"
            />
            <span className={`flex-1 text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
              {task.task}
            </span>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
              onClick={() => removeTask(task.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Agregar tarea..."
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