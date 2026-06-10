import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Camera, Image, X, Loader2, CheckCircle2, Circle } from 'lucide-react';

export default function WorkOrderChecklist({ checklist = [], onChange }) {
  const [newTask, setNewTask] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
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
    if (expandedId === id) setExpandedId(null);
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

  const done = checklist.filter(t => t.completed).length;
  const pct = checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0;

  return (
    <div className="space-y-3">

      {/* Progress bar */}
      {checklist.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>{done} de {checklist.length} completadas</span>
            <span className={pct === 100 ? 'text-emerald-400 font-bold' : ''}>{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Task cards */}
      <div className="space-y-2">
        {checklist.map(task => {
          const expanded = expandedId === task.id;
          return (
            <div
              key={task.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                task.completed
                  ? 'border-emerald-700/40 bg-emerald-950/30'
                  : 'border-slate-700/50 bg-slate-800/40'
              }`}
            >
              {/* Main row — tall touch target */}
              <div className="flex items-center gap-3 px-3 py-3 min-h-[52px]">
                {/* Big tap checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
                >
                  {task.completed
                    ? <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    : <Circle className="h-6 w-6 text-slate-500" />
                  }
                </button>

                {/* Task text */}
                <span
                  className={`flex-1 text-sm leading-tight cursor-pointer select-none ${
                    task.completed ? 'line-through text-slate-500' : 'text-slate-100 font-medium'
                  }`}
                  onClick={() => setExpandedId(expanded ? null : task.id)}
                >
                  {task.task}
                </span>

                {/* Photo indicator */}
                {task.photo_url && (
                  <div className="w-7 h-7 rounded-md overflow-hidden border border-slate-600 flex-shrink-0">
                    <img src={task.photo_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedId(expanded ? null : task.id)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Expanded area */}
              {expanded && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-slate-700/40 pt-3">
                  {/* Notes */}
                  <Input
                    placeholder="Nota de esta tarea (opcional)..."
                    value={task.notes || ''}
                    onChange={e => updateNotes(task.id, e.target.value)}
                    className="h-9 text-xs bg-slate-900/60 border-slate-700/50 text-slate-200 placeholder:text-slate-600"
                  />

                  {/* Photo row */}
                  <div className="flex items-center gap-2">
                    {task.photo_url ? (
                      <div className="relative">
                        <img src={task.photo_url} alt="" className="h-20 w-28 rounded-lg object-cover border border-slate-600" />
                        <button
                          onClick={() => removePhoto(task.id)}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center shadow-lg"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="h-20 w-28 rounded-lg border-2 border-dashed border-slate-600 hover:border-indigo-500/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300 transition-colors active:scale-95"
                        onClick={() => fileRefs.current[task.id]?.click()}
                        disabled={uploadingId === task.id}
                      >
                        {uploadingId === task.id
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : <>
                            <Camera className="h-5 w-5" />
                            <span className="text-[10px]">Foto</span>
                          </>
                        }
                      </button>
                    )}

                    <input type="file" accept="image/*" className="hidden"
                      ref={el => fileRefs.current[task.id] = el}
                      onChange={e => uploadPhoto(task.id, e.target.files[0])} />

                    {/* Delete */}
                    <button
                      onClick={() => removeTask(task.id)}
                      className="ml-auto h-9 w-9 flex items-center justify-center rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 hover:bg-red-900/50 transition-colors active:scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add task */}
      <div className="flex gap-2 pt-1">
        <Input
          placeholder="Nueva tarea..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          className="h-10 text-sm bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-600"
        />
        <button
          onClick={addTask}
          disabled={!newTask.trim()}
          className="h-10 w-10 flex items-center justify-center flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors active:scale-90"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}