'use client';
import React from 'react';

export default function MethodiekPanel() {
  const bronnen = [
    { naam: 'PDOK Locatieserver', url: 'https://api.pdok.nl/bzk/locatieserver/' },
    { naam: 'BAG WFS 2.0', url: 'https://service.pdok.nl/lv/bag/wfs/v2_0' },
    { naam: '3D BAG', url: 'https://docs.3dbag.nl/en/' },
    { naam: 'BGT WMTS', url: 'https://service.pdok.nl/lv/bgt/wmts/v2_0' },
    { naam: 'Luchtfoto WMTS', url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0' },
    { naam: 'OGC artikel', url: 'https://www.ogc.org/blog-article/public-services-on-the-map-a-decade-of-success/' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Methodiek & Bronnen</h2>
      <p className="text-gray-600 text-sm">
        DakStudio gebruikt open geodata via PDOK en 3D BAG. Berekeningen zijn indicatief en gebaseerd op open standaarden (OGC WFS, WMTS).
      </p>
      <ul className="list-disc ml-6 text-blue-700 text-sm">
        {bronnen.map(b => (
          <li key={b.url}><a href={b.url} target="_blank">{b.naam}</a></li>
        ))}
      </ul>
      <p className="text-gray-500 text-xs mt-3">
        Footprint = BAG-polygon; hoogte = 3D BAG; woningpotentie = oppervlak × lagen × efficiëntie.
      </p>
    </div>
  );
}
