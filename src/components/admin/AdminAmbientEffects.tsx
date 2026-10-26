import { useEffect, useRef } from 'react';

interface NodePoint { x: number; y: number; vx: number; vy: number; phase: number; }
interface Crystal { x: number; y: number; vx: number; vy: number; size: number; rotation: number; slotAngle: number; slotRadius: number; tone: number; }
interface CircuitPoint { x: number; y: number; }
interface CircuitTrace { points: CircuitPoint[]; phase: number; speed: number; totalLength: number; tone: number; }

/** Decorative, client-only motion mounted by the app shell only for a verified admin. */
export function AdminAmbientEffects() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorLayerRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cursorLayer = cursorLayerRef.current;
    const context = canvas?.getContext('2d');
    const cursorContext = cursorLayer?.getContext('2d');
    if (!canvas || !cursorLayer || !context || !cursorContext) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes: NodePoint[] = [];
    const crystals: Crystal[] = [];
    const circuits: CircuitTrace[] = [];
    const pointer = { x: -1000, y: -1000, active: false };
    let width = 0;
    let height = 0;
    let frame = 0;
    let disposed = false;
    let magicRotation = 0;
    let magicSpeed = 0.016;
    let magicSpeedTarget = 0.016;
    let singularityRotation = 0;
    let singularityPhase = 0;
    let contraction = 0;
    let contractionTarget = 0;

    if (finePointer) document.body.classList.add('refound-admin-cursor-active');

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      cursorLayer.width = Math.floor(width * dpr);
      cursorLayer.height = Math.floor(height * dpr);
      cursorLayer.style.width = `${width}px`;
      cursorLayer.style.height = `${height}px`;
      cursorContext.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(38, Math.min(112, Math.round((width * height) / 12500)));
      nodes.length = 0;
      crystals.length = 0;
      circuits.length = 0;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = reducedMotion ? 0 : 0.12 + Math.random() * 0.26;
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          phase: Math.random() * Math.PI * 2,
        });
      }
      const crystalSlots = Array.from({ length: 12 }, (_, index) => index);
      const crystalPairs = new Map<number, { size: number; radius: number; tone: number }>();
      for (let i = 0; i < crystalSlots.length; i += 1) {
        const slot = crystalSlots[i];
        const angle = slot * Math.PI / 6;
        const oppositePair = Math.min(slot, (slot + 6) % 12);
        if (!crystalPairs.has(oppositePair)) {
          crystalPairs.set(oppositePair, { size: 9.5 + Math.random() * 2, radius: 31 + Math.random() * 2, tone: oppositePair % 2 });
        }
        const pair = crystalPairs.get(oppositePair)!;
        const driftAngle = Math.random() * Math.PI * 2;
        const driftSpeed = reducedMotion ? 0 : 0.12 + Math.random() * 0.12;
        crystals.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(driftAngle) * driftSpeed,
          vy: Math.sin(driftAngle) * driftSpeed,
          size: pair.size,
          rotation: angle - Math.PI / 2,
          slotAngle: angle,
          slotRadius: pair.radius,
          tone: pair.tone,
        });
      }

      const circuitCount = Math.max(14, Math.min(28, Math.round((width * height) / 80000)));
      for (let i = 0; i < circuitCount; i += 1) {
        let x = Math.round(Math.random() * width / 80) * 80;
        let y = Math.round(Math.random() * height / 80) * 80;
        const points: CircuitPoint[] = [{ x, y }];
        for (let segment = 0; segment < 4; segment += 1) {
          const direction = Math.random() < 0.5 ? -1 : 1;
          const length = 34 + Math.random() * 88;
          if (segment % 2 === 0) x = Math.max(0, Math.min(width, x + direction * length));
          else y = Math.max(0, Math.min(height, y + direction * length));
          points.push({ x, y });
        }
        const totalLength = points.slice(1).reduce((sum, point, index) =>
          sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
        if (totalLength > 20) circuits.push({ points, totalLength, phase: Math.random() * totalLength, speed: 0.45 + Math.random() * 0.8, tone: i % 2 });
      }
    };

    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || document.hidden) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const onPointerMove = (event: PointerEvent) => trackPointer(event);
    const onPointerEnter = (event: PointerEvent) => trackPointer(event);
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      trackPointer(event);
      if (reducedMotion) return;
      contractionTarget = 1;
      magicSpeedTarget = 0.075;
    };
    const releaseClick = () => {
      contractionTarget = 0;
      magicSpeedTarget = 0.016;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    const onWindowBlur = () => { onPointerLeave(); releaseClick(); };
    const onVisibilityChange = () => { if (document.hidden) onWindowBlur(); };
    const pointSegmentDistance = (px: number, py: number, a: CircuitPoint, b: CircuitPoint) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSquared));
      return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    };

    const draw = () => {
      if (disposed) return;
      context.clearRect(0, 0, width, height);
      cursorContext.clearRect(0, 0, width, height);
      if (!reducedMotion) {
        magicSpeed += (magicSpeedTarget - magicSpeed) * 0.16;
        magicRotation = (magicRotation + magicSpeed) % (Math.PI * 2);
        singularityRotation = (singularityRotation + (contractionTarget ? 0.075 : 0.038)) % (Math.PI * 2);
        singularityPhase += 0.055;
      }
      contraction += (contractionTarget - contraction) * 0.22;
      if (Math.abs(contractionTarget - contraction) < 0.001) contraction = contractionTarget;

      for (const point of nodes) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < -8 || point.x > width + 8) point.vx *= -1;
        if (point.y < -8 || point.y > height + 8) point.vy *= -1;
        point.phase += 0.008;
      }

      // Dim orthogonal circuit traces sit behind the network; flowing lights and cursor proximity activate them.
      for (const circuit of circuits) {
        if (!reducedMotion) circuit.phase = (circuit.phase + circuit.speed) % circuit.totalLength;
        let pointerDistance = Number.POSITIVE_INFINITY;
        context.beginPath();
        context.moveTo(circuit.points[0].x, circuit.points[0].y);
        for (let index = 1; index < circuit.points.length; index += 1) {
          const previous = circuit.points[index - 1];
          const point = circuit.points[index];
          context.lineTo(point.x, point.y);
          if (pointer.active) pointerDistance = Math.min(pointerDistance, pointSegmentDistance(pointer.x, pointer.y, previous, point));
        }
        const circuitActive = pointer.active && pointerDistance < 190;
        const color = circuit.tone === 0 ? '168, 85, 247' : '239, 35, 72';
        context.strokeStyle = `rgba(${color}, ${circuitActive ? 0.4 : 0.11})`;
        context.lineWidth = circuitActive ? 1.2 : 0.75;
        context.lineJoin = 'bevel';
        context.stroke();

        for (let index = 1; index < circuit.points.length - 1; index += 1) {
          const point = circuit.points[index];
          context.beginPath();
          context.arc(point.x, point.y, circuitActive ? 2.2 : 1.4, 0, Math.PI * 2);
          context.fillStyle = `rgba(${color}, ${circuitActive ? 0.75 : 0.3})`;
          context.fill();
        }

        let pulseDistance = circuit.phase;
        for (let index = 1; index < circuit.points.length; index += 1) {
          const start = circuit.points[index - 1];
          const end = circuit.points[index];
          const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
          if (pulseDistance <= segmentLength) {
            const ratio = segmentLength === 0 ? 0 : pulseDistance / segmentLength;
            context.beginPath();
            context.arc(start.x + (end.x - start.x) * ratio, start.y + (end.y - start.y) * ratio, circuitActive ? 2.5 : 1.8, 0, Math.PI * 2);
            context.fillStyle = `rgba(${color}, ${circuitActive ? 1 : 0.68})`;
            context.shadowBlur = circuitActive ? 12 : 6;
            context.shadowColor = `rgb(${color})`;
            context.fill();
            context.shadowBlur = 0;
            break;
          }
          pulseDistance -= segmentLength;
        }
      }

      for (const crystal of crystals) {
        if (pointer.active) {
          const radius = crystal.slotRadius * (1 - contraction * 0.2);
          const targetX = pointer.x + Math.cos(crystal.slotAngle) * radius;
          const targetY = pointer.y + Math.sin(crystal.slotAngle) * radius;
          const dx = targetX - crystal.x;
          const dy = targetY - crystal.y;
          const distance = Math.hypot(dx, dy);
          const step = Math.min(9, distance * 0.12);
          if (distance > 0) {
            crystal.x += dx / distance * step;
            crystal.y += dy / distance * step;
          }
        } else {
          crystal.x += crystal.vx;
          crystal.y += crystal.vy;
          if (crystal.x < 0 || crystal.x > width) crystal.vx *= -1;
          if (crystal.y < 0 || crystal.y > height) crystal.vy *= -1;
        }

        const cursorDistance = pointer.active ? Math.hypot(crystal.x - pointer.x, crystal.y - pointer.y) : Number.POSITIVE_INFINITY;
        const proximity = Math.max(0, 1 - cursorDistance / 210);
        const size = crystal.size * (pointer.active ? 1 : 0.78) * (1 + proximity * 0.14);
        const shardContext = pointer.active && cursorDistance < 210 ? cursorContext : context;
        shardContext.save();
        shardContext.translate(crystal.x, crystal.y);
        shardContext.rotate(crystal.rotation);
        // Signed projection preserves the full front-to-back 3D flip.
        const faceTurn = Math.cos(magicRotation);
        const edgeTurn = Math.sin(magicRotation);
        shardContext.scale(1, faceTurn);
        shardContext.transform(1, edgeTurn * 0.12, 0, 1, 0, 0);
        shardContext.beginPath();
        shardContext.moveTo(0, -size * 1.72);
        shardContext.lineTo(size * 0.25, -size * 0.86);
        shardContext.lineTo(size * 0.53, -size * 0.08);
        shardContext.lineTo(size * 0.88, size * 0.02);
        shardContext.lineTo(size * 0.39, size * 0.24);
        shardContext.lineTo(size * 0.2, size * 0.78);
        shardContext.lineTo(0, size * 1.02);
        shardContext.lineTo(-size * 0.2, size * 0.78);
        shardContext.lineTo(-size * 0.39, size * 0.24);
        shardContext.lineTo(-size * 0.88, size * 0.02);
        shardContext.lineTo(-size * 0.53, -size * 0.08);
        shardContext.lineTo(-size * 0.25, -size * 0.86);
        shardContext.closePath();
        const metal = shardContext.createLinearGradient(-size * 0.56, -size * 0.32, size * 0.52, size * 0.24);
        if (crystal.tone === 0) {
          metal.addColorStop(0, '#581c87');
          metal.addColorStop(0.22, '#f5d0fe');
          metal.addColorStop(0.42, '#7e22ce');
          metal.addColorStop(0.62, '#ede9fe');
          metal.addColorStop(0.82, '#a21caf');
          metal.addColorStop(1, '#3b0764');
        } else {
          metal.addColorStop(0, '#881337');
          metal.addColorStop(0.22, '#ffe4e6');
          metal.addColorStop(0.42, '#be123c');
          metal.addColorStop(0.62, '#fda4af');
          metal.addColorStop(0.82, '#9f1239');
          metal.addColorStop(1, '#4c0519');
        }
        shardContext.fillStyle = metal;
        shardContext.strokeStyle = crystal.tone === 0 ? '#e9d5ff' : '#fecdd3';
        shardContext.lineWidth = 1.25;
        shardContext.shadowColor = crystal.tone === 0 ? '#c084fc' : '#fb7185';
        shardContext.shadowBlur = proximity * 15;
        shardContext.fill();
        shardContext.stroke();
        shardContext.shadowBlur = 0;
        shardContext.beginPath();
        shardContext.moveTo(0, -size * 1.48);
        shardContext.lineTo(size * 0.25, -size * 0.84);
        shardContext.lineTo(0, size * 0.76);
        shardContext.lineTo(-size * 0.25, -size * 0.84);
        shardContext.closePath();
        const facet = shardContext.createLinearGradient(0, -size * 1.48, 0, size * 0.76);
        facet.addColorStop(0, '#ffffff');
        facet.addColorStop(0.28, crystal.tone === 0 ? '#f5d0fe' : '#ffe4e6');
        facet.addColorStop(0.58, crystal.tone === 0 ? '#c084fc' : '#fb7185');
        facet.addColorStop(1, crystal.tone === 0 ? '#6b21a8' : '#9f1239');
        shardContext.fillStyle = facet;
        shardContext.fill();
        shardContext.strokeStyle = '#fff7ff';
        shardContext.lineWidth = 0.85;
        shardContext.stroke();
        shardContext.restore();
      }
      if (pointer.active) {
        for (let index = 0; index < 8; index += 1) {
          const angle = (index / 8) * Math.PI * 2;
          const radius = 13.5 * (1 - contraction * 0.2);
          const x = pointer.x + Math.cos(angle) * radius;
          const y = pointer.y + Math.sin(angle) * radius;
          const tone = index % 2;
          const size = 5.2;
          cursorContext.save();
          cursorContext.translate(x, y);
          cursorContext.rotate(angle - Math.PI / 2);
          const faceTurn = Math.cos(magicRotation);
          const edgeTurn = Math.sin(magicRotation);
          cursorContext.scale(1, faceTurn);
          cursorContext.transform(1, edgeTurn * 0.12, 0, 1, 0, 0);
          cursorContext.beginPath();
          cursorContext.moveTo(0, -size * 1.72);
          cursorContext.lineTo(size * 0.25, -size * 0.86);
          cursorContext.lineTo(size * 0.53, -size * 0.08);
          cursorContext.lineTo(size * 0.88, size * 0.02);
          cursorContext.lineTo(size * 0.39, size * 0.24);
          cursorContext.lineTo(size * 0.2, size * 0.78);
          cursorContext.lineTo(0, size * 1.02);
          cursorContext.lineTo(-size * 0.2, size * 0.78);
          cursorContext.lineTo(-size * 0.39, size * 0.24);
          cursorContext.lineTo(-size * 0.88, size * 0.02);
          cursorContext.lineTo(-size * 0.53, -size * 0.08);
          cursorContext.lineTo(-size * 0.25, -size * 0.86);
          cursorContext.closePath();
          const metal = cursorContext.createLinearGradient(-size * 0.56, -size * 0.32, size * 0.52, size * 0.24);
          metal.addColorStop(0, tone === 0 ? '#581c87' : '#881337');
          metal.addColorStop(0.28, tone === 0 ? '#f5d0fe' : '#ffe4e6');
          metal.addColorStop(0.55, tone === 0 ? '#7e22ce' : '#be123c');
          metal.addColorStop(0.78, tone === 0 ? '#ede9fe' : '#fda4af');
          metal.addColorStop(1, tone === 0 ? '#3b0764' : '#4c0519');
          cursorContext.fillStyle = metal;
          cursorContext.strokeStyle = tone === 0 ? '#f5d0fe' : '#ffe4e6';
          cursorContext.lineWidth = 0.8;
          cursorContext.fill();
          cursorContext.stroke();
          cursorContext.beginPath();
          cursorContext.moveTo(0, -size * 1.48);
          cursorContext.lineTo(size * 0.25, -size * 0.84);
          cursorContext.lineTo(0, size * 0.76);
          cursorContext.lineTo(-size * 0.25, -size * 0.84);
          cursorContext.closePath();
          const facet = cursorContext.createLinearGradient(0, -size * 1.48, 0, size * 0.76);
          facet.addColorStop(0, '#ffffff');
          facet.addColorStop(0.35, tone === 0 ? '#f5d0fe' : '#ffe4e6');
          facet.addColorStop(0.7, tone === 0 ? '#c084fc' : '#fb7185');
          facet.addColorStop(1, tone === 0 ? '#6b21a8' : '#9f1239');
          cursorContext.fillStyle = facet;
          cursorContext.fill();
          cursorContext.strokeStyle = '#fff7ff';
          cursorContext.lineWidth = 0.55;
          cursorContext.stroke();
          cursorContext.restore();
        }

        // A compact singularity sits at the center of the shard halo. The
        // luminous tilted ring and deep event horizon make it read as a black
        // hole without obscuring the dagger silhouette.
        cursorContext.save();
        cursorContext.translate(pointer.x, pointer.y);
        const pulse = reducedMotion ? 1 : 0.9 + Math.sin(singularityPhase) * 0.1;
        const glow = cursorContext.createRadialGradient(0, 0, 2, 0, 0, 17 * pulse);
        glow.addColorStop(0, 'rgba(0, 0, 0, 1)');
        glow.addColorStop(0.44, 'rgba(3, 1, 8, 0.98)');
        glow.addColorStop(0.68, 'rgba(126, 34, 206, 0.45)');
        glow.addColorStop(1, 'rgba(239, 35, 72, 0)');
        cursorContext.fillStyle = glow;
        cursorContext.beginPath();
        cursorContext.arc(0, 0, 17 * pulse, 0, Math.PI * 2);
        cursorContext.fill();

        // Pitch the lensing ring through depth instead of turning it like a
        // compass. The signed projection carries it through a full 3D flip.
        cursorContext.save();
        const singularityFace = Math.cos(singularityRotation);
        const singularityEdge = Math.sin(singularityRotation);
        cursorContext.transform(1, singularityEdge * 0.3, 0, singularityFace, 0, 0);
        cursorContext.beginPath();
        cursorContext.ellipse(0, 0, 13.5, 7.2, 0, 0.12, Math.PI * 1.82);
        cursorContext.strokeStyle = 'rgba(192, 132, 252, 0.52)';
        cursorContext.lineWidth = 0.75;
        cursorContext.shadowColor = '#a855f7';
        cursorContext.shadowBlur = 7;
        cursorContext.stroke();
        cursorContext.restore();

        cursorContext.save();
        cursorContext.transform(1, singularityEdge * 0.42, 0, singularityFace, 0, 0);
        cursorContext.beginPath();
        cursorContext.ellipse(0, 0, 11.5, 4.8 * pulse, -0.16, 0, Math.PI * 2);
        const disk = cursorContext.createLinearGradient(-10, 0, 10, 0);
        disk.addColorStop(0, 'rgba(192, 132, 252, 0.18)');
        disk.addColorStop(0.36, 'rgba(245, 208, 254, 0.98)');
        disk.addColorStop(0.64, 'rgba(251, 113, 133, 0.96)');
        disk.addColorStop(1, 'rgba(225, 29, 72, 0.18)');
        cursorContext.strokeStyle = disk;
        cursorContext.lineWidth = 2.1;
        cursorContext.shadowColor = '#c084fc';
        cursorContext.shadowBlur = 11 * pulse;
        cursorContext.stroke();
        cursorContext.restore();

        cursorContext.shadowBlur = 0;
        cursorContext.fillStyle = '#020106';
        cursorContext.strokeStyle = '#e9d5ff';
        cursorContext.lineWidth = 0.8;
        cursorContext.beginPath();
        cursorContext.arc(0, 0, 4.8, 0, Math.PI * 2);
        cursorContext.fill();
        cursorContext.stroke();
        cursorContext.restore();
      }
      for (let i = 0; i < nodes.length; i += 1) {
        const point = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const other = nodes[j];
          const dx = point.x - other.x;
          const dy = point.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 166) continue;
          const nearPointer = pointer.active && (Math.hypot(point.x - pointer.x, point.y - pointer.y) < 210 || Math.hypot(other.x - pointer.x, other.y - pointer.y) < 210);
          const alpha = (1 - distance / 166) * (nearPointer ? 0.64 : 0.24);
          context.strokeStyle = nearPointer ? `rgba(225, 29, 72, ${alpha})` : `rgba(139, 92, 246, ${alpha})`;
          context.lineWidth = nearPointer ? 1.25 : 0.95;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }

        const cursorDistance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
        if (pointer.active && cursorDistance < 210) {
          context.strokeStyle = `rgba(225, 29, 72, ${(1 - cursorDistance / 210) * 0.72})`;
          context.lineWidth = 1.15;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(pointer.x, pointer.y);
          context.stroke();
        }

        const pulse = 1.65 + Math.sin(point.phase) * 0.65;
        context.fillStyle = pointer.active && cursorDistance < 210 ? 'rgba(225, 29, 72, 0.95)' : 'rgba(139, 92, 246, 0.72)';
        context.beginPath();
        context.arc(point.x, point.y, pulse, 0, Math.PI * 2);
        context.fill();
      }

      frame = window.requestAnimationFrame(draw);
    };

    resize();
    frame = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', releaseClick, { passive: true });
    window.addEventListener('pointercancel', releaseClick, { passive: true });
    document.documentElement.addEventListener('pointerenter', onPointerEnter);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', releaseClick);
      window.removeEventListener('pointercancel', releaseClick);
      document.documentElement.removeEventListener('pointerenter', onPointerEnter);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.body.classList.remove('refound-admin-cursor-active');
    };
  }, []);

  return <>
    <canvas ref={canvasRef} className="refound-admin-network" aria-hidden="true" />
    <canvas ref={cursorLayerRef} className="refound-admin-cursor-layer" aria-hidden="true" />
  </>;
}
