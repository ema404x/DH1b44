import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExportarMenu({ onExcel, onPdf }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(v => !v)}>
        <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar</span>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover shadow-lg">
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { onExcel(); setOpen(false); }}>
              <FileText className="h-4 w-4" /> Excel
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { onPdf(); setOpen(false); }}>
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}