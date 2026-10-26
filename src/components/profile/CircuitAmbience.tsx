import { useEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Trace = { points: Point[]; length: number; phase: number; speed: number };

/** A quiet, accent-colored adaptation of the admin circuit trace animation. */
export function CircuitAmbience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ctx = context;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let disposed = false;
    let traces: Trace[] = [];
    let accent = getComputedStyle(document.documentElement).getPropertyValue('--profile-accent').trim() || '#0f766e';

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(8, Math.min(18, Math.round((width * height) / 100000)));
      traces = Array.from({ length: count }, () => {
        let x = Math.round(Math.random() * width / 90) * 90;
        let y = Math.round(Math.random() * height / 90) * 90;
        const points: Point[] = [{ x, y }];
        for (let segment = 0; segment < 4; segment += 1) {
          const direction = Math.random() < 0.5 ? -1 : 1;
          const distance = 48 + Math.random() * 100;
          if (segment % 2 === 0) x = Math.max(0, Math.min(width, x + direction * distance));
          else y = Math.max(0, Math.min(height, y + direction * distance));
          points.push({ x, y });
        }
        const length = points.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
        return { points, length, phase: Math.random() * length, speed: 0.55 + Math.random() * 0.65 };
      });
      window.cancelAnimationFrame(frame);
      draw();
    };

    function draw() {
      if (disposed) return;
      ctx.clearRect(0, 0, width, height);
      for (const trace of traces) {
        ctx.beginPath();
        ctx.moveTo(trace.points[0].x, trace.points[0].y);
        for (const point of trace.points.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.24;
        ctx.lineWidth = 0.85;
        ctx.lineJoin = 'bevel';
        ctx.stroke();

        for (const point of trace.points.slice(1, -1)) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = accent;
          ctx.fill();
        }

        let remaining = trace.phase;
        for (let index = 1; index < trace.points.length; index += 1) {
          const start = trace.points[index - 1];
          const end = trace.points[index];
          const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
          if (remaining <= segmentLength) {
            const ratio = segmentLength ? remaining / segmentLength : 0;
            ctx.beginPath();
            ctx.arc(start.x + (end.x - start.x) * ratio, start.y + (end.y - start.y) * ratio, 2.2, 0, Math.PI * 2);
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = accent;
            ctx.shadowColor = accent;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
            break;
          }
          remaining -= segmentLength;
        }
        if (!reducedMotion) trace.phase = (trace.phase + trace.speed) % trace.length;
      }
      ctx.globalAlpha = 1;
      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    const accentObserver = new MutationObserver(() => {
      accent = getComputedStyle(document.documentElement).getPropertyValue('--profile-accent').trim() || '#0f766e';
      if (reducedMotion) draw();
    });
    accentObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-profile-accent'] });
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      accentObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
