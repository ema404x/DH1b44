import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuroraEffect() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 pointer-events-none z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.5, ease: 'easeInOut' } }}
          transition={{ duration: 0.8 }}
        >
          {/* Capa base oscura con gradiente */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-transparent" />

          {/* Banda aurora principal — verde/cian */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[55vh]"
            style={{
              background: 'radial-gradient(ellipse 120% 60% at 50% -10%, rgba(52,211,153,0.55) 0%, rgba(6,182,212,0.35) 40%, transparent 70%)',
              filter: 'blur(18px)',
            }}
            animate={{
              scaleX: [1, 1.08, 0.95, 1.05, 1],
              scaleY: [1, 1.05, 0.98, 1.03, 1],
              x: [0, 20, -15, 10, 0],
            }}
            transition={{ duration: 4, ease: 'easeInOut', repeat: 0 }}
          />

          {/* Banda aurora secundaria — violeta/azul */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[45vh]"
            style={{
              background: 'radial-gradient(ellipse 100% 50% at 30% -5%, rgba(139,92,246,0.5) 0%, rgba(59,130,246,0.3) 50%, transparent 75%)',
              filter: 'blur(22px)',
            }}
            animate={{
              scaleX: [1, 0.95, 1.1, 0.97, 1],
              x: [0, -25, 18, -10, 0],
              opacity: [0.8, 1, 0.7, 0.95, 0.8],
            }}
            transition={{ duration: 4, ease: 'easeInOut', repeat: 0, delay: 0.2 }}
          />

          {/* Acento rosa/magenta en el borde derecho */}
          <motion.div
            className="absolute top-0 right-0 h-[40vh] w-[60vw]"
            style={{
              background: 'radial-gradient(ellipse 80% 50% at 80% -10%, rgba(236,72,153,0.35) 0%, rgba(168,85,247,0.2) 45%, transparent 70%)',
              filter: 'blur(25px)',
            }}
            animate={{
              x: [0, 15, -10, 5, 0],
              opacity: [0.7, 1, 0.6, 0.9, 0.7],
            }}
            transition={{ duration: 3.5, ease: 'easeInOut', repeat: 0, delay: 0.4 }}
          />

          {/* Filamentos verticales de luz */}
          {[15, 35, 55, 72, 88].map((left, i) => (
            <motion.div
              key={i}
              className="absolute top-0"
              style={{
                left: `${left}%`,
                width: '2px',
                height: `${30 + i * 7}vh`,
                background: `linear-gradient(to bottom, ${
                  ['rgba(52,211,153,0.6)', 'rgba(139,92,246,0.5)', 'rgba(6,182,212,0.55)', 'rgba(236,72,153,0.45)', 'rgba(52,211,153,0.5)'][i]
                } 0%, transparent 100%)`,
                filter: 'blur(4px)',
              }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: [0, 0.9, 0.6, 0] }}
              transition={{ duration: 3.5, ease: 'easeOut', delay: 0.3 + i * 0.15 }}
              style={{ transformOrigin: 'top', left: `${left}%`, width: '3px', height: `${28 + i * 6}vh`,
                background: `linear-gradient(to bottom, ${['rgba(52,211,153,0.7)','rgba(139,92,246,0.6)','rgba(6,182,212,0.65)','rgba(236,72,153,0.55)','rgba(52,211,153,0.6)'][i]} 0%, transparent 100%)`,
                filter: 'blur(5px)',
              }}
            />
          ))}

          {/* Brillo superior difuso */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-32"
            style={{
              background: 'linear-gradient(to bottom, rgba(52,211,153,0.25) 0%, rgba(139,92,246,0.15) 50%, transparent 100%)',
              filter: 'blur(8px)',
            }}
            animate={{ opacity: [0.6, 1, 0.7, 0] }}
            transition={{ duration: 4, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}