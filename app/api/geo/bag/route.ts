// app/api/geo/bag/route.ts
import { NextResponse } from 'next/server';

/**
 * Server-side proxy voor PDOK BAG (WFS).
 * Input: ?lat=...&lng=...
 * Output: { bouwjaar?: number, gebruiksdoel?: string }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const base = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
    const url =
      `${base}?service=WFS&request=GetFeature` +
      `&typeName=bag:pand` +
      `&srsName=EPSG:4326` +
      `&outputFormat=application/json` +
      `&cql_filter=DWITHIN(geom,POINT(${lng} ${lat}),5,meters)`;

    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('BAG WFS error');
    const geojson = await res.json();

    const f = geojson?.features?.[0];
    const props = f?.properties || {};

    const bouwjaar =
      props.bouwjaar ??
      props.BOUWJAAR ??
      props.bouwjaarPand ??
      undefined;

    const gebruiksdoel =
      props.gebruiksdoel ??
      props.GEBRUIKSDOEL ??
      props.gebruiksdoelPand ??
      undefined;

    return NextResponse.json({ bouwjaar, gebruiksdoel });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'BAG endpoint failed' }, { status: 500 });
  }
}
