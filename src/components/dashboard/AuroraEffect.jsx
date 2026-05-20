import React from 'react';
import { motion } from 'framer-motion';

export default function AuroraEffect() {
  return (
    <div className="fixed inset-x-0 top-0 h-[40vh] pointer-events-none z-0 overflow-hidden">
      {/* Verde/cian */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-full"
        style={{
          background: 'radial-gradient(ellipse 110% 55% at 50% -15%, rgba(52,211,153,0.12) 0%, rgba(6,182,212,0.08) 50%, transparent 75%)',
          filter: 'blur(12px)',
        }}
        animate={{ scaleX: [1, 1.06, 0.97, 1.04, 1], x: [0, 15, -10, 8, 0] }}
        transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Violeta/azul */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-full"
        style={{
          background: 'radial-gradient(ellipse 90% 45% at 30% -10%, rgba(139,92,246,0.10) 0%, rgba(59,130,246,0.07) 55%, transparent 75%)',
          filter: 'blur(16px)',
        }}
        animate={{ scaleX: [1, 0.96, 1.08, 0.98, 1], x: [0, -18, 12, -8, 0] }}
        transition={{ duration: 15, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 2 }}
      />

      {/* Rosa/magenta derecha */}
      <motion.div
        className="absolute top-0 right-0 h-full w-[60vw]"
        style={{
          background: 'radial-gradient(ellipse 70% 40% at 85% -10%, rgba(236,72,153,0.08) 0%, rgba(168,85,247,0.06) 50%, transparent 70%)',
          filter: 'blur(18px)',
        }}
        animate={{ x: [0, 12, -8, 5, 0], opacity: [0.7, 1, 0.6, 0.9, 0.7] }}
        transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 1 }}
      />

      {/* Línea de brillo superior muy fina */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(52,211,153,0.3) 30%, rgba(139,92,246,0.3) 60%, transparent 100%)',
        }}
      />
    </div>
  );
}