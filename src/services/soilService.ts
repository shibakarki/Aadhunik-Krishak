import type { AgroZone, SoilData } from '../types';

function classifySoilTexture(clay: number, sand: number, silt: number): string {
  if (clay >= 35) return 'Clay / Clay Loam';
  if (sand >= 55 && clay < 20) return 'Sandy Loam';
  if (silt >= 50 && clay < 27) return 'Silt Loam';
  if (clay >= 27 && clay < 35) return 'Clay Loam';
  return 'Loam';
}

export function getRegionalSoilFallback(zone: AgroZone = 'Hill'): SoilData {
  if (zone === 'Terai') {
    return {
      ph: 6.5,
      organicCarbonGKg: 14.2,
      nitrogenGKg: 1.4,
      clayPercent: 24,
      sandPercent: 38,
      siltPercent: 38,
      textureClass: 'Alluvial Loam',
      source: 'Regional Fallback',
    };
  }

  if (zone === 'Mountain') {
    return {
      ph: 5.7,
      organicCarbonGKg: 19.5,
      nitrogenGKg: 1.7,
      clayPercent: 16,
      sandPercent: 54,
      siltPercent: 30,
      textureClass: 'Mountain Sandy Loam',
      source: 'Regional Fallback',
    };
  }

  // Default: Hill
  return {
    ph: 5.9,
    organicCarbonGKg: 17.8,
    nitrogenGKg: 1.6,
    clayPercent: 22,
    sandPercent: 42,
    siltPercent: 36,
    textureClass: 'Hill Loam',
    source: 'Regional Fallback',
  };
}

interface SoilGridsLayer {
  name: string;
  depths?: Array<{
    label: string;
    values?: { mean?: number | null };
  }>;
}

export async function fetchFarmSoil(
  latitude: number,
  longitude: number,
  fallbackZone: AgroZone = 'Hill'
): Promise<SoilData> {
  const params = new URLSearchParams({
    lon: longitude.toString(),
    lat: latitude.toString(),
    depth: '0-5cm',
    value: 'mean',
  });

  ['phh2o', 'soc', 'nitrogen', 'clay', 'sand', 'silt'].forEach((prop) =>
    params.append('property', prop)
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://rest.isric.org/soilgrids/v2.0/properties/query?${params.toString()}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      return getRegionalSoilFallback(fallbackZone);
    }

    const raw = await response.json();
    const layers: SoilGridsLayer[] = raw?.properties?.layers ?? [];

    const getMean = (layerName: string): number | null => {
      const layer = layers.find((l) => l.name === layerName);
      const val = layer?.depths?.[0]?.values?.mean;
      return typeof val === 'number' ? val : null;
    };

    const phRaw = getMean('phh2o');
    const socRaw = getMean('soc');
    const nitrogenRaw = getMean('nitrogen');
    const clayRaw = getMean('clay');
    const sandRaw = getMean('sand');
    const siltRaw = getMean('silt');

    // If SoilGrids returned nulls (common in urban/high-slope tiles), use fallback
    if (phRaw === null || clayRaw === null || sandRaw === null || siltRaw === null) {
      return getRegionalSoilFallback(fallbackZone);
    }

    const fallback = getRegionalSoilFallback(fallbackZone);
    const ph = Math.round((phRaw / 10) * 10) / 10;
    const organicCarbonGKg =
      socRaw !== null ? Math.round((socRaw / 10) * 10) / 10 : fallback.organicCarbonGKg;
    const nitrogenGKg =
      nitrogenRaw !== null ? Math.round((nitrogenRaw / 100) * 100) / 100 : fallback.nitrogenGKg;

    const clayPercent = Math.round(clayRaw / 10);
    const sandPercent = Math.round(sandRaw / 10);
    const siltPercent = Math.round(siltRaw / 10);

    return {
      ph,
      organicCarbonGKg,
      nitrogenGKg,
      clayPercent,
      sandPercent,
      siltPercent,
      textureClass: classifySoilTexture(clayPercent, sandPercent, siltPercent),
      source: 'SoilGrids',
    };
  } catch {
    return getRegionalSoilFallback(fallbackZone);
  } finally {
    clearTimeout(timeout);
  }
}