import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Globe,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Mountain,
  RectangleHorizontal,
  Ruler,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { NEPAL_DISTRICTS } from '../data/nepalDistricts';
import { supabase } from '../lib/supabase';
import { determineAgroZone } from '../services/cropEngine';
import { fetchFarmWeather } from '../services/weatherService';

type AreaUnit = 'sqm' | 'ropani' | 'bigha' | 'hectares';
type MapType = 'street' | 'satellite';
type PlotShape = 'circle' | 'rectangle';

const NEPAL_CENTER: [number, number] = [28.3949, 84.124];

const TILE_LAYERS: Record<
  MapType,
  { url: string; attribution: string; maxZoom: number }
> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
};

const SATELLITE_ROADS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#059669;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);transform:rotate(-45deg);"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const DISTRICT_ALIASES: Record<string, string> = {
  dhanusa: 'Dhanusha',
  kavrepalanchowk: 'Kavrepalanchok',
  makawanpur: 'Makwanpur',
  'rukum east': 'Eastern Rukum',
  'east rukum': 'Eastern Rukum',
  'rukum west': 'Western Rukum',
  'west rukum': 'Western Rukum',
  'nawalparasi east': 'Nawalpur',
  'nawalparasi west': 'Parasi',
  tanahu: 'Tanahun',
  kapilbastu: 'Kapilvastu',
  terathum: 'Terhathum',
  chitawan: 'Chitwan',
  illam: 'Ilam',
  panchathar: 'Panchthar',
  sindhupalchowk: 'Sindhupalchok',
};

function normalizeNepalDistrict(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\bDistrict\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = cleaned.toLowerCase();
  if (DISTRICT_ALIASES[lower]) {
    return DISTRICT_ALIASES[lower];
  }

  const exactMatch = NEPAL_DISTRICTS.find(
    (d) => d.toLowerCase() === lower
  );
  return exactMatch ?? cleaned;
}

interface NominatimAddress {
  hamlet?: string;
  village?: string;
  neighbourhood?: string;
  suburb?: string;
  town?: string;
  city_district?: string;
  municipality?: string;
  city?: string;
  county?: string;
  state_district?: string;
  district?: string;
}

interface NominatimResponse {
  name?: string;
  address?: NominatimAddress;
}

function convertToHectares(value: number, unit: AreaUnit): number {
  if (unit === 'sqm') return value / 10000;
  if (unit === 'ropani') return value * 0.050874;
  if (unit === 'bigha') return value * 0.677263;
  return value;
}

export function FarmSelector() {
  const { user } = useAuth();
  const { refreshFarms } = useFarm();
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const roadsLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const shapeLayerRef = useRef<L.Circle | L.Rectangle | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  const farmNameEditedRef = useRef(false);
  const districtEditedRef = useRef(false);

  const [mapType, setMapType] = useState<MapType>('street');
  const [plotShape, setPlotShape] = useState<PlotShape>('circle');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [farmName, setFarmName] = useState('');
  const [district, setDistrict] = useState('');
  const [areaInput, setAreaInput] = useState('500');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('sqm');

  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reverseGeocodePoint = async (lat: number, lng: number) => {
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;

    setResolvingAddress(true);

    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: lat.toString(),
        lon: lng.toString(),
        zoom: '16',
        addressdetails: '1',
        'accept-language': 'en',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) return;

      const data = (await response.json()) as NominatimResponse;
      const addr = data.address;
      if (!addr) return;

      const rawDistrict =
        addr.county ?? addr.state_district ?? addr.district ?? '';
      const resolvedDistrict = normalizeNepalDistrict(rawDistrict);

      if (resolvedDistrict && !districtEditedRef.current) {
        setDistrict(resolvedDistrict);
      }

      const placeName =
        addr.hamlet ??
        addr.village ??
        addr.neighbourhood ??
        addr.suburb ??
        addr.town ??
        addr.municipality ??
        addr.city_district ??
        addr.city ??
        (data.name && data.name !== rawDistrict ? data.name : '');

      if (placeName && !farmNameEditedRef.current) {
        const cleanPlace = placeName.trim();
        const suggestedName = /farm/i.test(cleanPlace)
          ? cleanPlace
          : `${cleanPlace} Farm`;
        setFarmName(suggestedName);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Silently ignore reverse-geocoding network issues; user can type manually
      }
    } finally {
      if (geocodeAbortRef.current === controller) {
        setResolvingAddress(false);
      }
    }
  };

  const placeMarker = (lat: number, lng: number, zoomToLocation = false) => {
    setLatitude(Number(lat.toFixed(6)));
    setLongitude(Number(lng.toFixed(6)));

    const map = mapRef.current;
    if (map) {
      const isFirstPin = !markerRef.current;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      }

      if (zoomToLocation) {
        map.setView([lat, lng], 16);
      } else if (isFirstPin && map.getZoom() < 14) {
        map.setView([lat, lng], 16);
      }
    }

    void reverseGeocodePoint(lat, lng);
  };

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current).setView(NEPAL_CENTER, 7);
    mapRef.current = map;

    map.on('click', (event: L.LeafletMouseEvent) => {
      placeMarker(event.latlng.lat, event.latlng.lng);
    });

    return () => {
      geocodeAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      roadsLayerRef.current = null;
      labelsLayerRef.current = null;
      markerRef.current = null;
      shapeLayerRef.current = null;
    };
  }, []);

  // Swap Street <-> Satellite tile layer (with place & road labels on Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (roadsLayerRef.current) {
      map.removeLayer(roadsLayerRef.current);
      roadsLayerRef.current = null;
    }
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    const config = TILE_LAYERS[mapType];
    tileLayerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);

    if (mapType === 'satellite') {
      roadsLayerRef.current = L.tileLayer(SATELLITE_ROADS_URL, {
        maxZoom: 19,
        zIndex: 250,
        opacity: 0.75,
      }).addTo(map);

      labelsLayerRef.current = L.tileLayer(SATELLITE_LABELS_URL, {
        maxZoom: 19,
        zIndex: 251,
      }).addTo(map);
    }
  }, [mapType]);

  const parsedArea = Number.parseFloat(areaInput);
  const areaInHectares =
    Number.isFinite(parsedArea) && parsedArea > 0
      ? Number(convertToHectares(parsedArea, areaUnit).toFixed(4))
      : 0;
  const areaSqMeters = Math.max(areaInHectares * 10000, 1);

  // Draw dashed Circle or Rectangle boundary around the selected point
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (shapeLayerRef.current) {
      map.removeLayer(shapeLayerRef.current);
      shapeLayerRef.current = null;
    }

    if (latitude === null || longitude === null || areaInHectares <= 0) {
      return;
    }

    const strokeColor = mapType === 'satellite' ? '#facc15' : '#059669';
    const shapeStyle: L.PathOptions = {
      color: strokeColor,
      weight: 2.5,
      dashArray: '8, 6',
      fillColor: strokeColor,
      fillOpacity: 0.16,
      interactive: false,
    };

    if (plotShape === 'circle') {
      const radiusMeters = Math.sqrt(areaSqMeters / Math.PI);
      shapeLayerRef.current = L.circle([latitude, longitude], {
        ...shapeStyle,
        radius: radiusMeters,
      }).addTo(map);
    } else {
      const aspectRatio = 1.4;
      const widthMeters = Math.sqrt(areaSqMeters * aspectRatio);
      const heightMeters = areaSqMeters / widthMeters;

      const metersPerDegLat = 111320;
      const metersPerDegLng =
        111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1);

      const halfLat = heightMeters / 2 / metersPerDegLat;
      const halfLng = widthMeters / 2 / metersPerDegLng;

      shapeLayerRef.current = L.rectangle(
        [
          [latitude - halfLat, longitude - halfLng],
          [latitude + halfLat, longitude + halfLng],
        ],
        shapeStyle
      ).addTo(map);
    }
  }, [latitude, longitude, areaInHectares, areaSqMeters, plotShape, mapType]);

  const handleUseMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        placeMarker(
          position.coords.latitude,
          position.coords.longitude,
          true
        );
      },
      (geoError) => {
        setLocating(false);
        setError(
          `Could not detect your location (${geoError.message}). Please click your farm on the map.`
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be signed in to add a farm.');
      return;
    }

    if (latitude === null || longitude === null) {
      setError(
        'Please click on the map (or use GPS) to pin your farmland location.'
      );
      return;
    }

    const trimmedName = farmName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter a valid farm name (at least 2 characters).');
      return;
    }

    if (areaInHectares <= 0) {
      setError('Please enter a valid farm area greater than 0.');
      return;
    }

    setSubmitting(true);

    try {
      const weather = await fetchFarmWeather(latitude, longitude);
      const elevationM = Math.round(weather.elevationM);
      const agroZone = determineAgroZone(elevationM);

      const { data: insertedFarm, error: insertError } = await supabase
        .from('farms')
        .insert({
          user_id: user.id,
          name: trimmedName,
          district: district.trim() || null,
          latitude,
          longitude,
          area_hectares: areaInHectares,
          elevation_m: elevationM,
          agro_zone: agroZone,
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      await refreshFarms(insertedFarm.id);
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to save farmland. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const shapeDimensionLabel =
    plotShape === 'circle'
      ? `~${Math.round(Math.sqrt(areaSqMeters / Math.PI) * 2)} m diameter`
      : `~${Math.round(Math.sqrt(areaSqMeters * 1.4))} m × ${Math.round(
          areaSqMeters / Math.sqrt(areaSqMeters * 1.4)
        )} m`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Add &amp; Pin Your Farmland
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Click anywhere on the Nepal map or use GPS to automatically detect
            location name, district, elevation, and agro-ecological zone.
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
          Use My Current Location
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaflet Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-slate-800 inline-flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Interactive Farm Map
              </span>

              {latitude !== null && longitude !== null ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pinned: {latitude}, {longitude}
                </span>
              ) : (
                <span className="text-xs text-slate-500">
                  Click on the map to drop a pin
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Circle / Rectangle Plot Boundary Toggle */}
              <div
                role="group"
                aria-label="Plot boundary shape"
                className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200"
              >
                <button
                  type="button"
                  onClick={() => setPlotShape('circle')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    plotShape === 'circle'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Circle className="w-3.5 h-3.5" />
                  Circle
                </button>
                <button
                  type="button"
                  onClick={() => setPlotShape('rectangle')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    plotShape === 'rectangle'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RectangleHorizontal className="w-3.5 h-3.5" />
                  Rectangle
                </button>
              </div>

              {/* Street / Satellite Switcher */}
              <div
                role="group"
                aria-label="Map layer switcher"
                className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200"
              >
                <button
                  type="button"
                  onClick={() => setMapType('street')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    mapType === 'street'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  Street
                </button>
                <button
                  type="button"
                  onClick={() => setMapType('satellite')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    mapType === 'satellite'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Satellite
                </button>
              </div>
            </div>
          </div>

          <div
            ref={mapContainerRef}
            className="w-full h-[380px] sm:h-[440px] z-0"
          />
        </div>

        {/* Farm Details Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">Farm Details</h2>
            {resolvingAddress && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Detecting place...
              </span>
            )}
          </div>

          <div>
            <label
              htmlFor="farmName"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Farm Name *
            </label>
            <input
              id="farmName"
              type="text"
              required
              maxLength={100}
              value={farmName}
              onChange={(e) => {
                const nextValue = e.target.value;
                farmNameEditedRef.current = nextValue.trim().length > 0;
                setFarmName(nextValue);
              }}
              placeholder="Auto-filled from map or type a name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="district"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              District
            </label>
            <input
              id="district"
              type="text"
              list="nepal-districts-list"
              value={district}
              onChange={(e) => {
                const nextValue = e.target.value;
                districtEditedRef.current = nextValue.trim().length > 0;
                setDistrict(nextValue);
              }}
              placeholder="Auto-filled from map (e.g. Kaski)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <datalist id="nepal-districts-list">
              {NEPAL_DISTRICTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          <div>
            <label
              htmlFor="areaInput"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-slate-400" />
                Farm Area *
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="areaInput"
                type="number"
                step="any"
                min={areaUnit === 'sqm' ? '1' : '0.01'}
                required
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                aria-label="Area unit"
                value={areaUnit}
                onChange={(e) => setAreaUnit(e.target.value as AreaUnit)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="sqm">Sq. Meters (m²)</option>
                <option value="ropani">Ropani</option>
                <option value="bigha">Bigha</option>
                <option value="hectares">Hectares</option>
              </select>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Converted: <strong>{areaInHectares} ha</strong> ({shapeDimensionLabel})
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
            <Mountain className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              When you save, we automatically fetch your farm&apos;s elevation
              and classify its Nepal agro-zone (Terai, Hill, or Mountain).
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 text-sm transition-colors cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Detecting elevation &amp; saving...
              </>
            ) : (
              'Save Farmland'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}