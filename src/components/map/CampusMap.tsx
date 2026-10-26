import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fuzzCoordinate } from '../../lib/geoPrivacy';

export interface MapMarkerItem {
  id: string;
  reportType: 'LOST' | 'FOUND';
  category: string;
  title: string;
  locationName: string | null;
  createdAt: string;
}

export interface MapMarkerItemWithCoords extends MapMarkerItem {
  latitude: number;
  longitude: number;
}

export interface ProximityZone {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface CampusMapProps {
  items: MapMarkerItemWithCoords[];
  userPosition: { latitude: number; longitude: number } | null;
  proximityZones?: ProximityZone[];
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
  heightPx?: number;
}

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

const COLORS = {
  LOST: '#1F8A82', // signal (teal)
  FOUND: '#F2A93B', // beacon (amber)
  USER: '#3B82F6',
  ZONE: '#E2574C', // coral
};

function createDotIcon(color: string, selected: boolean): L.DivIcon {
  const size = selected ? 22 : 16;
  return L.divIcon({
    className: 'refound-map-marker',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(16,24,38,0.5);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createUserIcon(): L.DivIcon {
  return L.divIcon({
    className: 'refound-map-marker',
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${COLORS.USER};border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.25);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/**
 * Reusable campus map. Displays approximate (privacy-fuzzed) lost/found
 * item locations, the user's current position when granted, and active
 * proximity zones. Never renders exact reported coordinates — every item
 * marker is offset deterministically before it ever reaches Leaflet.
 */
export function CampusMap({
  items,
  userPosition,
  proximityZones = [],
  selectedItemId,
  onSelectItem,
  heightPx = 420,
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectItemRef = useRef(onSelectItem);
  onSelectItemRef.current = onSelectItem;

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 15,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    zonesLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Item markers (fuzzed for privacy) + proximity zone circles.
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const zonesLayer = zonesLayerRef.current;
    if (!map || !markersLayer || !zonesLayer) return;

    markersLayer.clearLayers();
    zonesLayer.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    for (const item of items) {
      const fuzzed = fuzzCoordinate(item.latitude, item.longitude, item.id);
      const isSelected = item.id === selectedItemId;
      const marker = L.marker([fuzzed.lat, fuzzed.lng], {
        icon: createDotIcon(COLORS[item.reportType], isSelected),
        keyboard: true,
        alt: `${item.reportType === 'LOST' ? 'Lost' : 'Found'} ${item.category}`,
      });
      marker.on('click', () => onSelectItemRef.current?.(item.id));
      marker.addTo(markersLayer);
      bounds.push([fuzzed.lat, fuzzed.lng]);
    }

    for (const zone of proximityZones) {
      const fuzzed = fuzzCoordinate(zone.latitude, zone.longitude, zone.id);
      L.circle([fuzzed.lat, fuzzed.lng], {
        radius: zone.radiusMeters,
        color: COLORS.ZONE,
        weight: 1.5,
        fillColor: COLORS.ZONE,
        fillOpacity: 0.08,
      }).addTo(zonesLayer);
    }

    if (userPosition) {
      bounds.push([userPosition.latitude, userPosition.longitude]);
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 17 });
    } else if (userPosition) {
      map.setView([userPosition.latitude, userPosition.longitude], 16);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, proximityZones, selectedItemId]);

  // User position marker (kept in its own layer so it doesn't get wiped by item redraws).
  useEffect(() => {
    const map = mapRef.current;
    const userLayer = userLayerRef.current;
    if (!map || !userLayer) return;

    userLayer.clearLayers();
    if (userPosition) {
      L.marker([userPosition.latitude, userPosition.longitude], {
        icon: createUserIcon(),
        alt: 'Your approximate location',
        zIndexOffset: 1000,
      })
        .bindTooltip('You are here', { direction: 'top', offset: [0, -8] })
        .addTo(userLayer);
    }
  }, [userPosition]);

  return (
    <div
      ref={containerRef}
      style={{ height: heightPx }}
      className="w-full overflow-hidden rounded-card border border-border"
      role="application"
      aria-label="Campus map of lost and found items"
    />
  );
}
