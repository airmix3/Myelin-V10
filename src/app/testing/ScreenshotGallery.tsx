'use client';

import { useState, useEffect, useCallback } from 'react';

interface ScreenshotEntry {
  step: number;
  name: string;
  filename: string;
}

export default function ScreenshotGallery({
  screenshots,
  runId,
}: {
  screenshots: ScreenshotEntry[];
  runId: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev !== null && prev < screenshots.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev !== null && prev > 0 ? prev - 1 : prev
        );
      }
    },
    [lightboxIndex, screenshots.length]
  );

  useEffect(() => {
    if (lightboxIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [lightboxIndex, handleKeyDown]);

  function imageUrl(filename: string): string {
    return `/api/testing/runs/${runId}/file?path=screenshots/${filename}`;
  }

  return (
    <>
      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
        {screenshots.map((s, i) => (
          <button
            key={s.filename}
            onClick={() => setLightboxIndex(i)}
            className="flex-shrink-0 group cursor-pointer"
          >
            <div className="w-[200px] glass-deep rounded-lg overflow-hidden border border-white/5 hover:border-sky-500/30 transition-colors">
              <img
                src={imageUrl(s.filename)}
                alt={s.name}
                className="w-full h-auto object-contain"
                loading="lazy"
              />
              <div className="px-2 py-1.5">
                <span className="text-[9px] text-slate-500">Step {s.step}</span>
                <p className="text-[10px] text-slate-400 truncate">{s.name}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Content container */}
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step name header */}
            <div className="mb-3 text-center">
              <span className="text-xs text-slate-400">
                Step {screenshots[lightboxIndex].step}
              </span>
              <p className="text-sm text-white">
                {screenshots[lightboxIndex].name}
              </p>
              <span className="text-[10px] text-slate-500">
                {lightboxIndex + 1} / {screenshots.length}
              </span>
            </div>

            {/* Image */}
            <img
              src={imageUrl(screenshots[lightboxIndex].filename)}
              alt={screenshots[lightboxIndex].name}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />

            {/* Navigation arrows */}
            {lightboxIndex > 0 && (
              <button
                className="glass-pill absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 px-3 py-2 text-white text-lg hover:bg-white/10 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
                }}
              >
                &lt;
              </button>
            )}
            {lightboxIndex < screenshots.length - 1 && (
              <button
                className="glass-pill absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 px-3 py-2 text-white text-lg hover:bg-white/10 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev !== null && prev < screenshots.length - 1 ? prev + 1 : prev
                  );
                }}
              >
                &gt;
              </button>
            )}
          </div>

          {/* Close button */}
          <button
            className="absolute top-4 right-4 glass-pill px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
            onClick={() => setLightboxIndex(null)}
          >
            ESC
          </button>
        </div>
      )}
    </>
  );
}
