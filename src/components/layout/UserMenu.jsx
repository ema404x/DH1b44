import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { LogOut, ChevronDown, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <span className="hidden md:block text-sm font-medium max-w-[120px] truncate text-slate-300">{user?.full_name || 'Usuario'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500 hidden md:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <div className="text-sm font-semibold truncate text-foreground">{user?.full_name || 'Usuario'}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide">{user?.role || 'user'}</span>
            </div>
            <button
              onClick={() => { navigate('/empleados'); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left text-foreground"
            >
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              Mi perfil
            </button>
            <div className="mx-2 my-1 border-t border-slate-100 dark:border-slate-800" />
            <button
              onClick={() => { base44.auth.logout(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-destructive transition-colors text-left text-foreground"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}