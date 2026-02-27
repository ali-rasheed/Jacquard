/**
 * AppV2 — Image to colored rects. Pick an image; shader draws a grid of rounded rects
 * colored by the image (one sample per cell). Separate from main App; no pattern/palette.
 */
import { useState, useCallback, useEffect } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Label from '@radix-ui/react-label';
import { ImageRectsCanvas } from './components/ImageRectsCanvas';

const btnGhost =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2.5 py-1 text-[13px] font-medium text-text-secondary outline-none transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:border-accent focus:outline-none';
const pill = 'inline-flex items-center rounded-full bg-surface-elevated border border-border-subtle px-2.5 py-0.5 text-[12px] font-medium text-text-secondary';

export default function AppV2() {
  const [imageSource, setImageSource] = useState('');
  const [gridSize, setGridSize] = useState(32);
  const [fps, setFps] = useState(0);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageSource((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (imageSource) URL.revokeObjectURL(imageSource);
    };
  }, [imageSource]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden bg-surface" style={{ height: '100dvh' }}>
      <header className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface px-3 py-2">
        <h1 className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-text">
          Image to Colored Rects
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className={btnGhost + ' cursor-pointer'}>
            <span>Pick image</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Pick an image file"
            />
          </label>
          <div className="flex items-center gap-2">
            <Label.Root className="text-[13px] text-text-secondary shrink-0" htmlFor="grid-slider-v2">
              Grid size
            </Label.Root>
            <Slider.Root
              id="grid-slider-v2"
              className="relative flex w-24 shrink-0 touch-none select-none items-center"
              value={[gridSize]}
              onValueChange={([v]) => setGridSize(v)}
              min={8}
              max={96}
              step={2}
              aria-label={`Grid: ${gridSize} cells`}
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </Slider.Root>
            <span className="w-8 tabular-nums text-[13px] text-text">{gridSize}</span>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <ImageRectsCanvas imageSource={imageSource} gridSize={gridSize} onFpsChange={setFps} />
      </main>

      <footer className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle bg-surface-elevated px-3 py-2">
        <span className={pill}>{imageSource ? 'Image loaded' : 'Pick an image'}</span>
        <span className={pill}>Grid: {gridSize}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={pill}>{fps || '--'} fps</span>
          <span className={pill}>WebGL 1</span>
        </div>
      </footer>
    </div>
  );
}
