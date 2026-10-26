import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';

const CROP_SIZE = 300;
const OUTPUT_SIZE = 512;

interface ProfilePhotoCropperProps {
  src: string;
  fileName: string;
  saving: boolean;
  onSave: (file: File) => void;
  onCancel: () => void;
}

export function ProfilePhotoCropper({ src, fileName, saving, onSave, onCancel }: ProfilePhotoCropperProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [cropSize, setCropSize] = useState(CROP_SIZE);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setCropSize(stage.clientWidth));
    observer.observe(stage);
    setCropSize(stage.clientWidth);
    return () => observer.disconnect();
  }, []);

  const baseScale = dimensions ? Math.max(cropSize / dimensions.width, cropSize / dimensions.height) : 1;
  const imageWidth = (dimensions?.width ?? CROP_SIZE) * baseScale * zoom;
  const imageHeight = (dimensions?.height ?? CROP_SIZE) * baseScale * zoom;

  const constrainOffset = (next: { x: number; y: number }, nextZoom = zoom) => {
    if (!dimensions) return next;
    const width = dimensions.width * baseScale * nextZoom;
    const height = dimensions.height * baseScale * nextZoom;
    return {
      x: Math.max(-(width - cropSize) / 2, Math.min((width - cropSize) / 2, next.x)),
      y: Math.max(-(height - cropSize) / 2, Math.min((height - cropSize) / 2, next.y)),
    };
  };

  const saveCrop = () => {
    const image = imageRef.current;
    if (!image || !dimensions) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return;

    const outputScale = OUTPUT_SIZE / cropSize;
    context.drawImage(
      image,
      (cropSize / 2 + offset.x - imageWidth / 2) * outputScale,
      (cropSize / 2 + offset.y - imageHeight / 2) * outputScale,
      imageWidth * outputScale,
      imageHeight * outputScale
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      const stem = fileName.replace(/\.[^.]+$/, '') || 'profile-photo';
      onSave(new File([blob], `${stem}-cropped.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-slate">Drag the photo to position it. Use the slider to zoom.</p>
      <div
        ref={stageRef}
        className="relative aspect-square w-[300px] max-w-full touch-none overflow-hidden rounded-full bg-ink/10"
        onPointerDown={(event) => {
          if (!dimensions || saving) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          const drag = dragRef.current;
          setOffset(constrainOffset({
            x: drag.offsetX + event.clientX - drag.x,
            y: drag.offsetY + event.clientY - drag.y,
          }));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        aria-label="Drag photo to adjust the circular crop"
      >
        <img
          ref={imageRef}
          src={src}
          alt="Crop preview"
          draggable={false}
          onLoad={(event) => setDimensions({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            width: imageWidth,
            height: imageHeight,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>
      <label className="flex w-full max-w-xs flex-col gap-1 text-xs text-slate">
        Zoom
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          disabled={!dimensions || saving}
          onChange={(event) => {
            const nextZoom = Number(event.target.value);
            setZoom(nextZoom);
            setOffset((current) => constrainOffset(current, nextZoom));
          }}
          aria-label="Photo zoom"
        />
      </label>
      <div className="flex justify-end gap-2 self-stretch">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="button" onClick={saveCrop} loading={saving} disabled={!dimensions}>Crop & save</Button>
      </div>
    </div>
  );
}
