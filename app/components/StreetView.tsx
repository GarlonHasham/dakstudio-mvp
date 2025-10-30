'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  lat: number;
  lng: number;
  className?: string;
};

/**
 * Mapillary embed + graceful fallback:
 * - Tries to show Mapillary at lat/lng (no API key needed)
 * - If no imagery (black panel) or iframe fails, shows a friendly message
 * - Always offers a button to open Google Street View in a new tab
 */
export default function StreetView({ lat, lng, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const loadTimer = useRef<number | null>(null);

  // A small timer: if the iframe mounts but never “visually loads”,
  // we show the fallback message. (Mapillary doesn’t expose a “no coverage”
  // event, so we handle it heuristically.)
  useEffect(() => {
    setFailed(false);
    setLoadedOnce(false);
    if (loadTimer.current) window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => {
      if (!loadedOnce) setFailed(true);
    }, 2500);
    return () => {
      if (loadTimer.current) window.clearTimeout(loadTimer.current);
    };
  }, [lat, lng]);

  const googlePanoUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  // Mapillary embed (no token) – centers the viewer at the requested point.
  // If there is imagery nearby, you’ll see it; otherwise it stays dark.
  const mapillaryEmbedUrl = `https://www.mapillary.com/embed?lat=${lat}&lng=${lng}&z=18&street=true&image=false&attribution=false`;

  return (
    <div className={`w-full ${className}`}>
      <div className="aspect-video rounded-lg overflow-hidden border relative bg-black">
        {/* Mapillary iframe */}
        <iframe
          title="Street View (Mapillary)"
          src={mapillaryEmbedUrl}
          className="w-full h-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoadedOnce(true)}
          onError={() => setFailed(true)}
        />

        {/* Soft gradient overlay while loading to avoid a harsh black flash */}
        {!loadedOnce && !failed && (
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-neutral-900/40 to-neutral-800/10" />
        )}
      </div>

      {/* Helper row below the viewer */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={googlePanoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Open in Google Street View
        </a>

        {failed && (
          <span className="text-sm text-gray-600">
            Geen Mapillary-beelden op deze locatie. Probeer de kaart, of open Google Street View.
          </span>
        )}
      </div>
    </div>
  );
}
