import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-accent transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">{user?.full_name || 'Usuario'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-52 bg-card border border-border rounded-xl shadow-2xl py-2 overflow-hidden">
            <div className="px-3 py-2 border-b border-border mb-1">
              <div className="text-sm font-semibold truncate">{user?.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              <div className="text-[10px] text-primary font-medium mt-0.5 uppercase tracking-wide">{user?.role}</div>
            </div>
            <button
              onClick={() => { base44.auth.logout(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}