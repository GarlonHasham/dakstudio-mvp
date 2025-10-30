'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { PDOK_LAYERS } from '../lib/pdok_ext';

export type MapViewProps = {
  center: [number, number];              // bijv. [52.0907, 5.1214]
  polygon?: [number, number][];          // bijv. [[lat, lng], [lat, lng], ...]
  label?: string;
};

// Leaflet + react-leaflet dynamisch laden (geen SSR)
const LeafletMap = dynamic(async () => {
  const L = await import('leaflet');
  const {
    MapContainer,
    TileLayer,
    Polygon,
    Marker,
    Popup,
    LayersControl,
  } = await import('react-leaflet');
  const { BaseLayer, Overlay } = LayersControl;

  // Fix standaard marker-iconen (CDN)
  // (type-cast naar any i.v.m. private _getIconUrl)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L as any).Icon.Default.prototype._getIconUrl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (L as any).Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });

  const Component: React.FC<MapViewProps> = ({ center, polygon, label }) => {
    return (
      <MapContainer
        center={center}
        zoom={18}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <LayersControl position="topright">
          <BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
          </BaseLayer>

          {PDOK_LAYERS?.luchtfoto?.url && (
            <BaseLayer name="Luchtfoto (PDOK)">
              <TileLayer url={PDOK_LAYERS.luchtfoto.url} />
            </BaseLayer>
          )}

          {PDOK_LAYERS?.bgt?.url && (
            <BaseLayer name="BGT (PDOK)">
              <TileLayer url={PDOK_LAYERS.bgt.url} />
            </BaseLayer>
          )}

          {polygon && polygon.length > 0 && (
            <Overlay checked name="Polygon">
              {/* React-Leaflet verwacht LatLng-tuples */}
              <Polygon positions={polygon as unknown as [number, number][]} />
            </Overlay>
          )}
        </LayersControl>

        <Marker position={center}>
          {label ? <Popup>{label}</Popup> : null}
        </Marker>
      </MapContainer>
    );
  };

  return Component;
}, { ssr: false });

const MapView: React.FC<MapViewProps> = (props) => (
  <div className="aspect-video rounded-lg overflow-hidden border">
    <LeafletMap {...props} />
  </div>
);

export default MapView;
