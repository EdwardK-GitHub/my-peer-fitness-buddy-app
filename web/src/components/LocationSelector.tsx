import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";

// Fix Leaflet's missing icon issue in modern React/Vite setups
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ 
    iconRetinaUrl: markerIcon2x, 
    iconUrl: markerIcon, 
    shadowUrl: markerShadow 
});

function MapUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();
  if (position) map.setView(position, 15);
  return null;
}

export function LocationSelector({ regionLimit, onSelect }: { regionLimit: string, onSelect: (label: string, lat: number, lng: number) => void }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<[number, number] | null>(null);

  const searchLocation = async () => {
    // FReq 4: Append the admin region limit to the search query to keep events bounded
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', ' + regionLimit)}`);
    const data = await response.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      setPosition([lat, lon]);
      onSelect(data[0].display_name, lat, lon);
    } else {
      alert(`Location not found within ${regionLimit}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input 
          type="text"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-900" 
          placeholder={`Search location in ${regionLimit}...`}
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && searchLocation()}
        />
        <button type="button" onClick={searchLocation} className="bg-slate-900 flex items-center gap-2 text-white px-4 py-2 rounded-xl font-medium hover:bg-slate-800 transition">
          <Search size={18}/> Search Map
        </button>
      </div>
      <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-300 relative z-0">
        <MapContainer center={position || [40.7128, -74.0060]} zoom={13} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {position && <Marker position={position} />}
          <MapUpdater position={position} />
        </MapContainer>
      </div>
    </div>
  );
}