import React, { useEffect, useRef } from 'react';

export default function AuroraEffect() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.55;
    };
    resize();
    window.addEventListener('resize', resize);

    // Bandas de aurora — cada una es una onda ondulante
    const bands = [
      { color: [0, 255, 120],   baseY: 0.08, amp: 0.07, freq: 0.6,  speed: 0.18, phase: 0,    width: 0.32, opacity: 0.55 },
      { color: [0, 220, 200],   baseY: 0.05, amp: 0.09, freq: 0.45, speed: 0.14, phase: 1.2,  width: 0.28, opacity: 0.45 },
      { color: [80, 180, 255],  baseY: 0.03, amp: 0.06, freq: 0.75, speed: 0.22, phase: 2.5,  width: 0.25, opacity: 0.40 },
      { color: [160, 60, 255],  baseY: 0.06, amp: 0.10, freq: 0.35, speed: 0.11, phase: 0.8,  width: 0.22, opacity: 0.35 },
      { color: [255, 80, 200],  baseY: 0.04, amp: 0.07, freq: 0.55, speed: 0.16, phase: 3.8,  width: 0.18, opacity: 0.28 },
      { color: [0, 255, 160],   baseY: 0.10, amp: 0.05, freq: 0.90, speed: 0.25, phase: 1.6,  width: 0.20, opacity: 0.38 },
    ];

    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      bands.forEach(band => {
        const [r, g, b] = band.color;

        // Dibujamos la banda como una serie de columnas verticales
        const steps = Math.ceil(W / 4);
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * W;
          const nx = x / W; // normalizado 0..1

          // Posición Y oscilante + movimiento horizontal de la onda
          const wave1 = Math.sin(nx * Math.PI * 2 * band.freq + t * band.speed + band.phase);
          const wave2 = Math.sin(nx * Math.PI * 3.3 * band.freq + t * band.speed * 0.7 + band.phase + 1);
          const wave3 = Math.sin(nx * Math.PI * 1.5 * band.freq + t * band.speed * 1.3 + band.phase + 2.5);
          const yOffset = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * band.amp * H;

          const centerY = band.baseY * H + yOffset;
          const bandH = band.width * H;

          // Brillo pulsante
          const pulse = 0.75 + 0.25 * Math.sin(t * 0.8 + nx * 4 + band.phase);
          const alpha = band.opacity * pulse;

          // Gradiente vertical para cada columna
          const grad = ctx.createLinearGradient(x, centerY - bandH * 0.5, x, centerY + bandH * 1.5);
          grad.addColorStop(0,   `rgba(${r},${g},${b},0)`);
          grad.addColorStop(0.2, `rgba(${r},${g},${b},${alpha * 0.6})`);
          grad.addColorStop(0.45,`rgba(${r},${g},${b},${alpha})`);
          grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha * 0.4})`);
          grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);

          ctx.fillStyle = grad;
          ctx.fillRect(x - 2, centerY - bandH * 0.5, 6, bandH * 2);
        }
      });

      // Fade-out suave hacia abajo
      const fadeGrad = ctx.createLinearGradient(0, H * 0.5, 0, H);
      fadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
      fadeGrad.addColorStop(1, `hsla(215,30%,10%,1)`);
      ctx.fillStyle = fadeGrad;
      ctx.fillRect(0, H * 0.5, W, H * 0.5);

      t += 0.012;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-x-0 top-0 pointer-events-none"
      style={{ zIndex: 0, display: 'block' }}
    />
  );
}