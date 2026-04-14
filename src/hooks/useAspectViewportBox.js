/**
 * Sizes a box to a fixed aspect ratio (width / height) inside a flex parent.
 * contain (Fit): scale down/up so the full rect fits inside the observer — like object-fit: contain.
 * cover (Fill): scale so the rect covers the observer — shortest side of the viewport is filled; like object-fit: cover.
 */
import { useRef, useState, useLayoutEffect } from 'react';

/** When enabled is false, skips observation (e.g. embedded/offscreen layout uses parent size only). */
export function useAspectViewportBox(mode, aspectRatio, enabled = true) {
  const outerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const el = outerRef.current;
    if (!el) return undefined;
    const ar = aspectRatio > 0 && Number.isFinite(aspectRatio) ? aspectRatio : 1;

    const update = () => {
      const r = el.getBoundingClientRect();
      const W = Math.max(0, r.width);
      const H = Math.max(0, r.height);
      const iw = ar;
      const ih = 1;
      const scale =
        mode === 'cover'
          ? Math.max(W / iw, H / ih)
          : Math.min(W / iw, H / ih);
      const width = iw * scale;
      const height = ih * scale;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [mode, aspectRatio, enabled]);

  return { outerRef, width: size.width, height: size.height };
}
