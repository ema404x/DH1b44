import React from 'react';
import { motion } from 'framer-motion';

export default function AuroraEffect() {
  return (
    <div className="fixed inset-x-0 top-0 h-72 pointer-events-none overflow-hidden hidden md:block" style={{ zIndex: 0, maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}>

      {/* Banda verde principal — ondulación amplia */}
      <motion.div
        className="absolute inset-x-0 top-0 h-56"
        style={{
          background: 'radial-gradient(ellipse 150% 85% at 50% -15%, rgba(0,220,110,0.28) 0%, rgba(0,200,130,0.12) 55%, transparent 80%)',
          filter: 'blur(22px)',
        }}
        animate={{
          x: ['-18%', '18%', '-12%', '15%', '-18%'],
          scaleY: [1, 1.22, 0.82, 1.18, 1],
          skewX: ['-2deg', '2deg', '-1deg', '1.5deg', '-2deg'],
        }}
        transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Segunda ola verde — desfasada y más estrecha */}
      <motion.div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background: 'radial-gradient(ellipse 130% 60% at 60% -10%, rgba(0,240,140,0.22) 0%, transparent 70%)',
          filter: 'blur(18px)',
        }}
        animate={{
          x: ['14%', '-16%', '10%', '-13%', '14%'],
          scaleY: [0.85, 1.2, 0.9, 1.15, 0.85],
        }}
        transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 2 }}
      />

      {/* Banda cian/azul — ondula en dirección opuesta */}
      <motion.div
        className="absolute inset-x-0 top-0 h-44"
        style={{
          background: 'radial-gradient(ellipse 130% 65% at 30% -18%, rgba(0,190,230,0.22) 0%, rgba(0,160,210,0.08) 55%, transparent 80%)',
          filter: 'blur(26px)',
        }}
        animate={{
          x: ['10%', '-14%', '8%', '-10%', '10%'],
          scaleY: [0.9, 1.18, 0.88, 1.14, 0.9],
        }}
        transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 4 }}
      />

      {/* Violeta — flota desde la derecha */}
      <motion.div
        className="absolute top-0 right-0 h-36 w-2/3"
        style={{
          background: 'radial-gradient(ellipse 90% 60% at 80% -12%, rgba(140,60,230,0.18) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }}
        animate={{
          x: ['0%', '-14%', '6%', '-10%', '0%'],
          scaleY: [1, 1.2, 0.85, 1.15, 1],
          opacity: [0.7, 1, 0.5, 0.95, 0.7],
        }}
        transition={{ duration: 20, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 6 }}
      />

      {/* Línea de brillo superior pulsante */}
      <motion.div
        className="absolute top-0 inset-x-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(0,220,110,0.5) 28%, rgba(0,190,230,0.42) 58%, rgba(140,60,230,0.28) 80%, transparent 95%)',
        }}
        animate={{ opacity: [0.3, 1, 0.3, 0.9, 0.3], scaleX: [0.95, 1.02, 0.97, 1, 0.95] }}
        transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />


    </div>
  );
}