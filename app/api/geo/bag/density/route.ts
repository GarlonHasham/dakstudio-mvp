// app/api/geo/bag/density/route.ts
import { NextResponse } from "next/server";

/**
 * Woningdichtheid (woningen/km²) op basis van BAG Verblijfsobjecten met woonfunctie
 * binnen een kleine envelope rond een lat/lng (volledig open data, geen API keys).
 *
 * Input:  ?lat=...&lng=...
 * Output: { dwellings, areaKm2, densityPerKm2, envelope, note }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));

    if (!isFinite(lat) || !isFinite(lng)) {
      return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
    }

    // Envelope ~ ±500 m N-Z en ±(afhankelijk van breedtegraad) O-W
    const dLat = 0.005; // ~555 m
    const dLng = 0.008 * Math.cos((lat * Math.PI) / 180); // corrigeer lengtegraad

    const minx = lng - dLng;
    const miny = lat - dLat;
    const maxx = lng + dLng;
    const maxy = lat + dLat;

    const base = "https://geodata.nationaalgeoregister.nl/bag/wfs";
    const typeNames = ["bag:verblijfsobject", "bag:verblijfsobjecten"];

    const makeUrl = (t: string) =>
      `${base}?service=WFS&request=GetFeature&typename=${encodeURIComponent(
        t
      )}&srsName=EPSG:4326&bbox=${minx},${miny},${maxx},${maxy},EPSG:4326&count=5000&outputFormat=application/json`;

    let features: any[] = [];
    for (const t of typeNames) {
      const res = await fetch(makeUrl(t), { next: { revalidate: 600 } }).catch(
        () => null
      );
      if (!res?.ok) continue;
      const gj = await res.json().catch(() => null);
      if (gj?.features?.length) {
        features = gj.features;
        break;
      }
    }

    // Filter: gebruiksdoel bevat "woon" (kan array of string zijn)
    const dwellings = features.filter((f) => {
      const gd = f?.properties?.gebruiksdoel ?? f?.properties?.gebruiksdoelen;
      if (!gd) return false;
      if (Array.isArray(gd)) return gd.some((s) => String(s).toLowerCase().includes("woon"));
      return String(gd).toLowerCase().includes("woon");
    }).length;

    // Ruwe omrekening naar m²/km²
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
    const widthM  = (maxx - minx) * mPerDegLng;
    const heightM = (maxy - miny) * mPerDegLat;
    const areaKm2 = (widthM * heightM) / 1_000_000;

    const densityPerKm2 = areaKm2 > 0 ? Math.round(dwellings / areaKm2) : 0;

    return NextResponse.json({
      dwellings,
      areaKm2: Number(areaKm2.toFixed(4)),
      densityPerKm2,
      envelope: { minx, miny, maxx, maxy },
      note: "BAG-benadering (verblijfsobjecten met woonfunctie in lokale envelope).",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "BAG density failed" }, { status: 500 });
  }
}
