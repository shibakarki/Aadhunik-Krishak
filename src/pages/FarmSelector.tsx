import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LocateFixed,
  MapPin,
  Mountain,
  Ruler,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { supabase } from '../lib/supabase';
import { determineAgroZone } from '../services/cropEngine';
import { fetchFarmWeather } from '../services/weatherService';

type AreaUnit = 'hectares' | 'ropani' | 'bigha';

const NEPAL_CENTER: [number, number] = [28.3949, 84.124];

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#059669;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);transform:rotate(-45deg);"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

function convertToHectares(value: number, unit: AreaUnit): number {
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
  const markerRef = useRef<L.Marker | null>(null);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [farmName, setFarmName] = useState('');
  const [district, setDistrict] = useState('');
  const [areaInput, setAreaInput] = useState('1');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('ropani');

  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeMarker = (lat: number, lng: number, zoomToLocation = false) => {
    setLatitude(Number(lat.toFixed(6)));
    setLongitude(Number(lng.toFixed(6)));

    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    }

    if (zoomToLocation) {
      map.setView([lat, lng], 13);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current).setView(NEPAL_CENTER, 7);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      placeMarker(event.latlng.lat, event.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

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

  const parsedArea = Number.parseFloat(areaInput);
  const areaInHectares =
    Number.isFinite(parsedArea) && parsedArea > 0
      ? Number(convertToHectares(parsedArea, areaUnit).toFixed(4))
      : 0;

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
    if (!trimmedName) {
      setError('Please enter a name for your farm.');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Add &amp; Pin Your Farmland
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Click anywhere on the Nepal map or use GPS to automatically detect
            elevation and agro-ecological zone.
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
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
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
          <div ref={mapContainerRef} className="w-full h-[380px] sm:h-[440px] z-0" />
        </div>

        {/* Farm Details Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 h-fit"
        >
          <h2 className="text-lg font-bold text-slate-900">Farm Details</h2>

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
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="e.g. Pokhara Valley Plot"
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
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Kaski, Chitwan"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
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
                min="0.01"
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
                <option value="ropani">Ropani</option>
                <option value="bigha">Bigha</option>
                <option value="hectares">Hectares</option>
              </select>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Converted area: <strong>{areaInHectares} ha</strong>
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