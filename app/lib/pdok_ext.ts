// app/lib/pdok_ext.ts
export type LatLng = { lat:number; lng:number };

async function robustWait(ms:number){ return new Promise(r=>setTimeout(r, ms)); }

async function robustFetch(url:string, retries=3, delay=800): Promise<Response> {
  let last: any;
  for (let i=0; i<retries; i++) {
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) { last = e; }
    await robustWait(delay * (i+1));
  }
  throw last ?? new Error('Fetch failed');
}

// ✅ EXPORT: geocodeAddress
export async function geocodeAddress(address:string): Promise<LatLng|null> {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(address)}&rows=1`;
  const res = await robustFetch(url);
  const data = await res.json();
  const doc = data.response?.docs?.[0];
  if (!doc || !doc.centroide_ll) return null;
  const m = /POINT\(([-0-9.]+) ([-0-9.]+)\)/.exec(doc.centroide_ll);
  if (!m) return null;
  const lng = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  return { lat, lng };
}

// ✅ EXPORT: getBagPolygonByPoint
export async function getBagPolygonByPoint(lat:number, lng:number): Promise<Array<[number,number]>|null> {
  const bbox = `${lng-0.0005},${lat-0.0005},${lng+0.0005},${lat+0.0005}`;
  const url = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&request=GetFeature&version=2.0.0&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:4326&bbox=${bbox},EPSG:4326`;
  const res = await robustFetch(url);
  const gj = await res.json();
  const feat = gj.features?.[0];
  if (!feat) return null;
  const coords =
    feat.geometry.type === 'Polygon'
      ? feat.geometry.coordinates[0]
      : feat.geometry.coordinates?.[0]?.[0];
  if (!coords) return null;
  const poly: Array<[number,number]> = coords.map((c:[number,number]) => [c[1], c[0]]);
  return poly;
}

// ✅ EXPORT: polygonAreaSqm
export function polygonAreaSqm(polygon:Array<[number,number]>): number {
  const R = 6378137;
  const toXY = (lat:number,lng:number) => {
    const x = (lng * Math.PI/180) * R;
    const y = Math.log(Math.tan(Math.PI/4 + (lat*Math.PI/180)/2)) * R;
    return [x,y] as const;
  };
  let area = 0;
  for (let i=0;i<polygon.length;i++){
    const [lat1,lng1]=polygon[i];
    const [lat2,lng2]=polygon[(i+1)%polygon.length];
    const [x1,y1] = toXY(lat1,lng1);
    const [x2,y2] = toXY(lat2,lng2);
    area += x1*y2 - x2*y1;
  }
  return Math.abs(area/2);
}

// ✅ EXPORT: getBuildingHeight
export async function getBuildingHeight(lat:number, lng:number): Promise<number|null> {
  try {
    const url = `https://api.3dbag.nl/v3/tiles?lat=${lat}&lon=${lng}`;
    const res = await robustFetch(url);
    const data = await res.json();
    const feat = data.features?.[0];
    const h = feat?.properties?.maxBuildingHeight ?? feat?.properties?.height;
    return h ? parseFloat(h) : null;
  } catch {
    return null;
  }
}

// (optioneel) WMTS URL’s
export const PDOK_LAYERS = {
  luchtfoto: {
    name: 'Luchtfoto PDOK',
    url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/2023_ortho25/EPSG:3857/{z}/{x}/{y}.jpeg'
  },
  bgt: {
    name: 'BGT PDOK',
    url: 'https://service.pdok.nl/lv/bgt/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png'
  }
};
