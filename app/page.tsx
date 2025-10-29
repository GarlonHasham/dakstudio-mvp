'use client';
import React, { useState } from 'react';
import { ArrowLeft, Eye, Loader2, Share2, Download } from 'lucide-react';

interface Building { id: string; address: string; coordinates: { lat: number; lng: number }; footprint: Array<{ lat: number; lng: number }>; height: number; buildingType: 'residential' | 'mixed' | 'commercial'; roofType: 'flat' | 'pitched' | 'complex'; }
interface RooftopConfig { typology: 'setback' | 'aligned' | 'penthouse'; floors: number; features: { solarPanels: boolean; greenRoof: boolean; waterStorage: boolean }; style: 'modern' | 'classic' | 'industrial'; }
interface Benefits { housing: { units: number; totalArea: number; averageSize: number }; solar?: { panels: number; capacity: number; yearlyProduction: number }; green?: { area: number; co2Reduction: number }; water?: { capacity: number; retentionArea: number }; estimation: { investmentRange: string }; }

function calculateBenefits(building: Building, config: RooftopConfig): Benefits {
  const footprintArea = 400; const bvo = footprintArea * config.floors; const bgo = bvo * 0.8;
  let avgSize = config.typology === 'penthouse' ? 120 : config.typology === 'aligned' ? 65 : 75;
  const units = Math.floor(bgo / avgSize);
  const benefits: Benefits = { housing: { units: Math.max(1, units), totalArea: Math.round(bgo), averageSize: Math.round(avgSize) }, estimation: { investmentRange: `€${Math.round(bvo * 1.8)}k - €${Math.round(bvo * 2.2)}k` } };
  if (config.features.solarPanels) { const panels = Math.floor((footprintArea * 0.7) / 1.7); benefits.solar = { panels, capacity: Math.round(panels * 0.4 * 10) / 10, yearlyProduction: Math.round(panels * 0.4 * 950) }; }
  if (config.features.greenRoof) { const area = footprintArea * (config.features.solarPanels ? 0.3 : 0.4); benefits.green = { area: Math.round(area), co2Reduction: Math.round(area * 2) }; }
  if (config.features.waterStorage) { benefits.water = { capacity: Math.round(footprintArea * (config.features.greenRoof ? 0.03 : 0.08) * 10) / 10, retentionArea: Math.round(footprintArea) }; }
  return benefits;
}

export default function DakStudioApp() {
  const [phase, setPhase] = useState<'search' | 'configure' | 'visualize'>('search');
  const [building, setBuilding] = useState<Building | null>(null);
  const [config, setConfig] = useState<RooftopConfig>({ typology: 'setback', floors: 2, features: { solarPanels: true, greenRoof: false, waterStorage: false }, style: 'modern' });
  const [benefits, setBenefits] = useState<Benefits | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'before' | 'after'>('before');

  const loadBuilding = async (address: string) => {
    setLoading(true); await new Promise(r => setTimeout(r, 1000));
    setBuilding({ id: 'bag-001', address, coordinates: { lat: 52.08, lng: 4.31 }, footprint: [{ lat: 52.08, lng: 4.31 }, { lat: 52.081, lng: 4.31 }, { lat: 52.081, lng: 4.312 }, { lat: 52.08, lng: 4.312 }], height: 12, buildingType: 'residential', roofType: 'flat' });
    setPhase('configure'); setLoading(false);
  };

  const generateVis = () => { if (!building) return; setLoading(true); setTimeout(() => { setBenefits(calculateBenefits(building, config)); setPhase('visualize'); setLoading(false); }, 1500); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {phase === 'search' && (<div className="container mx-auto px-4 py-12"><div className="max-w-2xl mx-auto"><h1 className="text-5xl font-bold text-center mb-3">DakStudio</h1><p className="text-xl text-center text-gray-600 mb-8">Van dakidee naar deelbaar beeld in 3 minuten</p><div className="bg-gray-50 rounded-xl p-6"><p className="text-sm font-semibold mb-3">Probeer bijvoorbeeld:</p>{['Koninginnegracht 2, Den Haag', 'Lange Voorhout 34, Den Haag'].map(addr => (<button key={addr} onClick={() => loadBuilding(addr)} className="mr-2 mb-2 px-4 py-2 bg-white border rounded-lg hover:border-blue-500">{addr}</button>))}</div></div></div>)}
      {phase === 'configure' && building && (<div className="container mx-auto px-4 py-8"><button onClick={() => setPhase('search')} className="mb-6 flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Terug</button><div className="grid lg:grid-cols-2 gap-8"><div className="bg-white rounded-xl shadow-lg"><div className="bg-blue-600 text-white p-6"><h2 className="text-xl font-bold">Configureer optopping</h2><p className="text-sm">{building.address}</p></div><div className="p-6 space-y-6"><div><label className="block font-semibold mb-3">Type</label>{[{ v: 'setback', l: 'Terugliggend', e: '📐' }, { v: 'aligned', l: 'Gelijk', e: '🏢' }, { v: 'penthouse', l: 'Penthouse', e: '✨' }].map(o => (<button key={o.v} onClick={() => setConfig({ ...config, typology: o.v as any })} className={`w-full p-4 mb-2 rounded-lg border-2 ${config.typology === o.v ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}><span className="text-2xl mr-3">{o.e}</span>{o.l}</button>))}</div><div><label className="block font-semibold mb-3">Lagen: {config.floors}</label><input type="range" min="1" max="3" value={config.floors} onChange={e => setConfig({ ...config, floors: parseInt(e.target.value) })} className="w-full" /></div><div><label className="block font-semibold mb-3">Features</label>{[{ k: 'solarPanels', l: 'Zonnepanelen', i: '☀️' }, { k: 'greenRoof', l: 'Groen', i: '🌱' }, { k: 'waterStorage', l: 'Water', i: '💧' }].map(f => (<button key={f.k} onClick={() => setConfig({ ...config, features: { ...config.features, [f.k]: !config.features[f.k as keyof typeof config.features] } })} className={`w-full p-3 mb-2 rounded-lg border-2 flex justify-between ${config.features[f.k as keyof typeof config.features] ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}><span>{f.i} {f.l}</span></button>))}</div><button onClick={generateVis} className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold">Visualiseer</button></div></div><div className="bg-white rounded-xl shadow-lg p-8"><h3 className="text-xl font-bold mb-4">Preview</h3><div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center"><Eye className="w-12 h-12 text-gray-400" /></div></div></div></div>)}
      {phase === 'visualize' && building && benefits && (<div className="container mx-auto px-4 py-8"><button onClick={() => setPhase('configure')} className="mb-6 flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Terug</button><div className="grid lg:grid-cols-2 gap-8"><div className="bg-white rounded-xl shadow-lg p-6"><div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center"><div className="text-6xl">{viewMode === 'before' ? '🏢' : '🏗️'}</div></div></div><div className="bg-white rounded-xl shadow-xl"><div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6"><h2 className="text-2xl font-bold">Potentie</h2><p className="text-sm">{building.address}</p></div><div className="p-6 space-y-6"><div className="grid grid-cols-2 gap-4"><div className="p-6 bg-blue-50 rounded-xl"><div className="text-sm font-semibold text-blue-700">Woningen</div><div className="text-4xl font-bold text-blue-900">+{benefits.housing.units}</div></div><div className="p-6 bg-purple-50 rounded-xl"><div className="text-sm font-semibold text-purple-700">Oppervlak</div><div className="text-4xl font-bold text-purple-900">{benefits.housing.totalArea}</div></div></div>{benefits.solar && (<div className="p-4 bg-yellow-50 rounded-lg"><div className="font-semibold mb-2">☀️ Zonnepanelen</div><div className="text-2xl font-bold">{benefits.solar.capacity} kWp</div></div>)}<div className="p-5 bg-gray-50 rounded-xl"><div className="text-sm font-semibold mb-2">Investering</div><div className="text-3xl font-bold">{benefits.estimation.investmentRange}</div></div><div className="grid grid-cols-2 gap-3"><button onClick={() => alert('Delen!')} className="px-4 py-3 border-2 rounded-lg flex items-center justify-center gap-2"><Share2 className="w-4 h-4" />Delen</button><button onClick={() => alert('PDF!')} className="px-4 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"><Download className="w-4 h-4" />PDF</button></div></div></div></div></div>)}
      {loading && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-8"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /></div></div>)}
    </div>
  );
}
