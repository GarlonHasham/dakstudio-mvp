// app/api/geo/cbs/route.ts
import { NextResponse } from 'next/server';

/**
 * Zeer robuuste proxy voor CBS Wijken/Buurten:
 * - Probeert veel PDOK WFS-lagen + BBOX + CQL INTERSECTS
 * - Probeert meerdere CBS ArcGIS FeatureServices (2023 + 2022)
 * - Probeert zowel POINT-INTERSECTS als een kleine envelope (bbox)
 *
 * Input:  ?lat=...&lng=...
 * Output: { wijkNaam?, gemeenteNaam?, woningdichtheid?, buCode?, source?: 'pdok'|'arcgis' }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    // ========== 1) PDOK/NGR WFS ==========
    const pdokBase = 'https://geodata.nationaalgeoregister.nl/wijkenbuurten/wfs';

    // uitgebreide set mogelijke typeNames
    const pdokTypeNames = [
      // vaak gebruikte varianten:
      'cbs:buurten2023', 'cbs:buurt_2023', 'cbs:buurten_2023',
      'cbs:buurten2022', 'cbs:buurt_2022', 'cbs:buurten_2022',
      'cbs:buurten',
      // soms zonder prefix gepubliceerd:
      'buurten2023', 'buurt_2023', 'buurten_2023',
      'buurten2022', 'buurt_2022', 'buurten_2022', 'buurten',
    ];

    // iets ruimere bbox
    const d = 0.004;
    const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;

    const pdokStrategies = [
      (t: string) =>
        `${pdokBase}?service=WFS&request=GetFeature&typeName=${encodeURIComponent(t)}&srsName=EPSG:4326&bbox=${bbox},EPSG:4326&count=5&outputFormat=application/json`,
      (t: string) =>
        `${pdokBase}?service=WFS&request=GetFeature&typeName=${encodeURIComponent(t)}&srsName=EPSG:4326&cql_filter=INTERSECTS(geom,POINT(${lng} ${lat}))&count=5&outputFormat=application/json`,
    ];

    let props: any | null = null;

    outerPdok: for (const t of pdokTypeNames) {
      for (const makeUrl of pdokStrategies) {
        const url = makeUrl(t);
        const res = await fetch(url, { next: { revalidate: 3600 } }).catch(() => null);
        if (!res || !res.ok) continue;
        const gj = await res.json().catch(() => null);
        const f = gj?.features?.[0];
        if (f?.properties) {
          props = f.properties;
          break outerPdok;
        }
      }
    }

    if (props) {
      const normalized = normalizeProps(props);
      return NextResponse.json({ ...normalized, source: 'pdok' });
    }

    // ========== 2) Fallback: CBS ArcGIS FeatureServices ==========
    // we proberen meerdere lagen + twee strategieën (POINT & envelope)
    const arcServices = [
      // 2023
      'https://services.arcgis.com/nSZVuSZjHpEZZbRo/arcgis/rest/services/CBS_Buurten_2023/FeatureServer/0',
      // 2022
      'https://services.arcgis.com/nSZVuSZjHpEZZbRo/arcgis/rest/services/CBS_Buurten_2022/FeatureServer/0',
    ];

    const pointQuery = (base: string) => {
      const geometry = encodeURIComponent(JSON.stringify({
        x: lng, y: lat, spatialReference: { wkid: 4326 },
      }));
      return `${base}/query?f=json&where=1%3D1&returnGeometry=false&outFields=*&geometry=${geometry}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects`;
    };

    const env = {
      xmin: lng - d, ymin: lat - d, xmax: lng + d, ymax: lat + d, spatialReference: { wkid: 4326 },
    };
    const envQuery = (base: string) => {
      const geometry = encodeURIComponent(JSON.stringify(env));
      return `${base}/query?f=json&where=1%3D1&returnGeometry=false&outFields=*&geometry=${geometry}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`;
    };

    for (const base of arcServices) {
      // eerst point
      let url = pointQuery(base);
      let res = await fetch(url, { next: { revalidate: 3600 } }).catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => null);
        const a = data?.features?.[0]?.attributes;
        if (a) {
          const normalized = normalizeProps(a);
          return NextResponse.json({ ...normalized, source: 'arcgis' });
        }
      }
      // dan envelope
      url = envQuery(base);
      res = await fetch(url, { next: { revalidate: 3600 } }).catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => null);
        const a = data?.features?.[0]?.attributes;
        if (a) {
          const normalized = normalizeProps(a);
          return NextResponse.json({ ...normalized, source: 'arcgis' });
        }
      }
    }

    // ========== niets gevonden ==========
    return NextResponse.json({
      note: 'Geen CBS-buurt gevonden (PDOK + meerdere ArcGIS services probeerden beide)',
      wijkNaam: undefined,
      gemeenteNaam: undefined,
      woningdichtheid: undefined,
      buCode: undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'CBS endpoint failed' }, { status: 500 });
  }
}

function normalizeProps(p: any) {
  const wijkNaam =
    p.WK_NAAM || p.wk_naam || p.BU_NAAM || p.Buurtnaam || p.BUURTNAAM || p.BUURT_NAAM || undefined;

  const gemeenteNaam =
    p.GM_NAAM || p.gm_naam || p.Gemeentenaam || p.GM_NAAM2023 || undefined;

  const buCode =
    p.BU_CODE || p.BUURTCODE || p.BU_CODE_2023 || p.bu_code || undefined;

  const woningen =
    p.AANTAL_WONINGEN ?? p.WONINGEN ?? p.aantal_woningen ?? undefined;

  // oppervlak naar m2 normaliseren indien nodig
  const oppM2 =
    p.OPP_TOT ??
    p.OPP_TOTAAL ??
    p.OPP_TOT_M2 ??
    (typeof p.OPP_TOT_KM2 === 'number' ? p.OPP_TOT_KM2 * 1_000_000 : undefined);

  let woningdichtheid: number | undefined;
  if (woningen != null && oppM2 && Number(oppM2) > 0) {
    const oppKm2 = Number(oppM2) / 1_000_000;
    woningdichtheid = Math.round(Number(woningen) / oppKm2);
  }

  return { wijkNaam, gemeenteNaam, woningdichtheid, buCode };
}
