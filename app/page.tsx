'use client';

import React, { useState } from 'react';
import { ArrowLeft, Loader2, Share2, Download } from 'lucide-react';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('./components/MapView'), { ssr: false });
import StreetView from './components/StreetView';
import MethodiekPanel from './components/MethodiekPanel';
import {
  geocodeAddress,
  getBagPolygonByPoint,
  polygonAreaSqm,
  getBuildingHeight,
} from './lib/pdok_ext';

// ---------------- TYPES ----------------
interface Building {
  id: string;
  address: string;
  coordinates: { lat: number; lng: number };
  footprint: Array<{ lat: number; lng: number }>;
  height: number;
  buildingType: 'residential' | 'mixed' | 'commercial';
  roofType: 'flat' | 'pitched' | 'complex';
  footprintArea?: number;
}

interface RooftopConfig {
  typology: 'setback' | 'aligned' | 'penthouse';
  floors: number;
  features: { solarPanels: boolean; greenRoof: boolean; waterStorage: boolean };
  style: 'modern' | 'classic' | 'industrial';
}

interface Benefits {
  housing: { units: number; totalArea: number; averageSize: number };
  solar?: { panels: number; capacity: number; yearlyProduction: number };
  green?: { area: number; co2Reduction: number };
  water?: { capacity: number; retentionArea: number };
  estimation: { investmentRange: string };
}

interface DensityInfo {
  wijkNaam?: string;
  gemeenteNaam?: string;
  woningdichtheid?: number;
  note?: string;
}

// ---------------- CALCULATIONS ----------------
function calculateBenefits(building: Building, config: RooftopConfig): Benefits {
  const footprintArea = building.footprintArea ?? 400;
  const bvo = footprintArea * config.floors;
  const bgo = bvo * 0.8;

  const avgSize =
    config.typology === 'penthouse' ? 120 : config.typology === 'aligned' ? 65 : 75;

  const units = Math.floor(bgo / avgSize);

  const result: Benefits = {
    housing: {
      units: Math.max(1, units),
      totalArea: Math.round(bgo),
      averageSize: Math.round(avgSize),
    },
    estimation: {
      investmentRange: `€${Math.round(bvo * 1.8)}k - €${Math.round(bvo * 2.2)}k`,
    },
  };

  if (config.features.solarPanels) {
    const panels = Math.floor((footprintArea * 0.7) / 1.7);
    result.solar = {
      panels,
      capacity: Math.round(panels * 0.4 * 10) / 10,
      yearlyProduction: Math.round(panels * 0.4 * 950),
    };
  }

  if (config.features.greenRoof) {
    const area = footprintArea * (config.features.solarPanels ? 0.3 : 0.4);
    result.green = { area: Math.round(area), co2Reduction: Math.round(area * 2) };
  }

  if (config.features.waterStorage) {
    result.water = {
      capacity: Math.round(footprintArea * (config.features.greenRoof ? 0.03 : 0.08) * 10) / 10,
      retentionArea: Math.round(footprintArea),
    };
  }

  return result;
}

// Helper om polygon om te zetten naar tuples
function toTuples(poly?: Array<{ lat: number; lng: number }>): [number, number][] | undefined {
  if (!poly || !poly.length) return undefined;
  return poly.map(p => [p.lat, p.lng] as [number, number]);
}

// ---------------- MAIN PAGE ----------------
export default function DakStudioApp() {
  const [phase, setPhase] = useState<'search' | 'configure' | 'visualize'>('search');
  const [visTab, setVisTab] = useState<'street' | 'map'>('street');
  const [building, setBuilding] = useState<Building | null>(null);
  const [config, setConfig] = useState<RooftopConfig>({
    typology: 'setback',
    floors: 2,
    features: { solarPanels: true, greenRoof: false, waterStorage: false },
    style: 'modern',
  });
  const [benefits, setBenefits] = useState<Benefits | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'before' | 'after'>('before');
  const [density, setDensity] = useState<DensityInfo | null>(null);

  // ---------------- LOAD DATA ----------------
  const loadBuilding = async (address: string) => {
    setLoading(true);
    try {
      const geo = await geocodeAddress(address);
      if (!geo) throw new Error('Adres niet gevonden');

      const poly = await getBagPolygonByPoint(geo.lat, geo.lng);
      const area = poly ? Math.round(polygonAreaSqm(poly)) : 400;

      const h = await getBuildingHeight(geo.lat, geo.lng);

      const newBuilding: Building = {
        id: 'bag-auto',
        address,
        coordinates: { lat: geo.lat, lng: geo.lng },
        footprint: poly
          ? poly.map(([lat, lng]) => ({ lat, lng }))
          : [{ lat: geo.lat, lng: geo.lng }],
        height: h ?? 12,
        buildingType: 'residential',
        roofType: 'flat',
        footprintArea: area,
      };

      setBuilding(newBuilding);

      // Fetch woningdichtheid in de buurt (optioneel)
      try {
        const r = await fetch(
          `/api/geo/density?lat=${encodeURIComponent(geo.lat)}&lng=${encodeURIComponent(geo.lng)}`
        );
        const d = (await r.json()) as DensityInfo;
        setDensity(d);
      } catch {
        setDensity({ note: 'Kon woningdichtheid niet ophalen' });
      }

      setVisTab('street');
      setPhase('configure');
    } catch (err: any) {
      alert(err?.message || 'Kon adres niet laden');
    } finally {
      setLoading(false);
    }
  };

  const generateVis = () => {
    if (!building) return;
    setLoading(true);
    setTimeout(() => {
      setBenefits(calculateBenefits(building, config));
      setPhase('visualize');
      setLoading(false);
    }, 500);
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* SEARCH PHASE */}
      {phase === 'search' && (
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-5xl font-bold text-center mb-3">DakStudio</h1>
            <p className="text-xl text-center text-gray-600 mb-8">
              Van dakidee naar deelbaar beeld in 3 minuten
            </p>

            <div className="bg-gray-50 rounded-xl p-6">
              <p className="text-sm font-semibold mb-3">Probeer bijvoorbeeld:</p>
              {['Koninginnegracht 2, Den Haag', 'Lange Voorhout 34, Den Haag'].map((addr) => (
                <button
                  key={addr}
                  onClick={() => loadBuilding(addr)}
                  className="mr-2 mb-2 px-4 py-2 bg-white border rounded-lg hover:border-blue-500"
                >
                  {addr}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <MethodiekPanel />
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURE PHASE */}
      {phase === 'configure' && building && (
        <div className="container mx-auto px-4 py-8">
          <button onClick={() => setPhase('search')} className="mb-6 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Terug
          </button>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* LEFT: Street/Map preview */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-blue-600 text-white p-6 rounded-lg mb-4">
                <h2 className="text-xl font-bold">Configureer optopping</h2>
                <p className="text-sm">{building.address}</p>
              </div>

              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setVisTab('street')}
                  className={`px-3 py-2 rounded-lg border ${
                    visTab === 'street'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black border-gray-300'
                  }`}
                >
                  Street View
                </button>
                <button
                  onClick={() => setVisTab('map')}
                  className={`px-3 py-2 rounded-lg border ${
                    visTab === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black border-gray-300'
                  }`}
                >
                  Kaart
                </button>
              </div>

              {visTab === 'street' ? (
                <StreetView
                  lat={building.coordinates.lat}
                  lng={building.coordinates.lng}
                  label="street"
                />
              ) : (
                <div className="aspect-video rounded-lg overflow-hidden border">
                  <MapView
                    center={[building.coordinates.lat, building.coordinates.lng]}
                    polygon={toTuples(building.footprint)}
                    label={building.address}
                  />
                </div>
              )}
            </div>

            {/* RIGHT: configuration controls */}
            <div className="bg-white rounded-xl shadow-lg">
              <div className="p-6 space-y-6">
                <div>
                  <label className="block font-semibold mb-3">Type</label>
                  {[
                    { v: 'setback', l: 'Terugliggend', e: '📐' },
                    { v: 'aligned', l: 'Gelijk', e: '🏢' },
                    { v: 'penthouse', l: 'Penthouse', e: '✨' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setConfig({ ...config, typology: o.v as any })}
                      className={`w-full p-4 mb-2 rounded-lg border-2 ${
                        config.typology === o.v ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-2xl mr-3">{o.e}</span>
                      {o.l}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block font-semibold mb-3">Lagen: {config.floors}</label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    value={config.floors}
                    onChange={(e) =>
                      setConfig({ ...config, floors: parseInt(e.target.value, 10) })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-3">Features</label>
                  {[
                    { k: 'solarPanels', l: 'Zonnepanelen', i: '☀️' },
                    { k: 'greenRoof', l: 'Groen', i: '🌱' },
                    { k: 'waterStorage', l: 'Water', i: '💧' },
                  ].map((f) => (
                    <button
                      key={f.k}
                      onClick={() =>
                        setConfig({
                          ...config,
                          features: {
                            ...config.features,
                            [f.k]: !config.features[f.k as keyof typeof config.features],
                          },
                        })
                      }
                      className={`w-full p-3 mb-2 rounded-lg border-2 flex justify-between ${
                        config.features[f.k as keyof typeof config.features]
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <span>
                        {f.i} {f.l}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={generateVis}
                  className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold"
                >
                  Visualiseer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISUALIZE PHASE */}
      {phase === 'visualize' && building && benefits && (
        <div className="container mx-auto px-4 py-8">
          <button onClick={() => setPhase('configure')} className="mb-6 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Terug
          </button>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* LEFT: street/map preview */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setVisTab('street')}
                  className={`px-3 py-2 rounded-lg border ${
                    visTab === 'street'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black border-gray-300'
                  }`}
                >
                  Street View
                </button>
                <button
                  onClick={() => setVisTab('map')}
                  className={`px-3 py-2 rounded-lg border ${
                    visTab === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black border-gray-300'
                  }`}
                >
                  Kaart
                </button>
                <div className="ml-auto">
                  <button
                    onClick={() => setViewMode(viewMode === 'before' ? 'after' : 'before')}
                    className="px-3 py-2 rounded-lg border bg-white border-gray-300"
                    title="Wissel Voor/Na"
                  >
                    {viewMode === 'before' ? 'Voor' : 'Na'}
                  </button>
                </div>
              </div>

              {visTab === 'street' ? (
                <StreetView
                  lat={building.coordinates.lat}
                  lng={building.coordinates.lng}
                  label="street"
                />
              ) : (
                <div className="aspect-video rounded-lg overflow-hidden border">
                  <MapView
                    center={[building.coordinates.lat, building.coordinates.lng]}
                    polygon={toTuples(building.footprint)}
                    label={building.address}
                  />
                </div>
              )}
            </div>

            {/* RIGHT: KPIs */}
            <div className="bg-white rounded-xl shadow-xl">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
                <h2 className="text-2xl font-bold">Potentie</h2>
                <p className="text-sm">{building.address}</p>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-blue-50 rounded-xl">
                    <div className="text-sm font-semibold text-blue-700">Woningen</div>
                    <div className="text-4xl font-bold text-blue-900">
                      +{benefits.housing.units}
                    </div>
                  </div>
                  <div className="p-6 bg-purple-50 rounded-xl">
                    <div className="text-sm font-semibold text-purple-700">Oppervlak</div>
                    <div className="text-4xl font-bold text-purple-900">
                      {benefits.housing.totalArea} m²
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold mb-1">Woningdichtheid (BAG)</div>
                  <div className="text-2xl font-bold">
                    {typeof density?.woningdichtheid === 'number'
                      ? `${density.woningdichtheid} / km²`
                      : '—'}
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    Benadering o.b.v. verblijfsobjecten met woonfunctie in lokale omgeving.
                    {density?.wijkNaam ? ` • ${density.wijkNaam}` : ''}{' '}
                    {density?.gemeenteNaam ? `(${density.gemeenteNaam})` : ''}
                  </div>
                </div>

                {benefits.solar && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="font-semibold mb-2">☀️ Zonnepanelen</div>
                    <div className="text-2xl font-bold">{benefits.solar.capacity} kWp</div>
                  </div>
                )}

                <div className="p-5 bg-gray-50 rounded-xl">
                  <div className="text-sm font-semibold mb-2">Investering</div>
                  <div className="text-3xl font-bold">{benefits.estimation.investmentRange}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => alert('Delen!')}
                    className="px-4 py-3 border-2 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Delen
                  </button>
                  <button
                    onClick={() => alert('PDF!')}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
}
