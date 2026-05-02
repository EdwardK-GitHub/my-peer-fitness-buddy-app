import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { Search } from "lucide-react";
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();
  if (position) map.setView(position, 15);
  return null;
}

export function LocationSelector({
  regionLimit,
  onSelect,
}: {
  regionLimit: string;
  onSelect: (label: string, lat: number, lng: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);

  async function searchLocation() {
    const cleanedQuery = query.trim();

    if (!cleanedQuery) {
      setMessage("Enter a location before searching.");
      return;
    }

    setSearching(true);
    setMessage("");

    try {
      // FReq 1.4 and FReq 4: running locations use a detailed location bounded by the
      // admin-managed region setting.
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          `${cleanedQuery}, ${regionLimit}`,
        )}`,
      );

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        setMessage(`No matching location was found within ${regionLimit}.`);
        return;
      }

      const lat = Number.parseFloat(data[0].lat);
      const lng = Number.parseFloat(data[0].lon);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setMessage("The selected location did not include valid map coordinates.");
        return;
      }

      setPosition([lat, lng]);
      onSelect(data[0].display_name, lat, lng);
      setMessage("Location selected.");
    } catch {
      setMessage("Location search is currently unavailable. Try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              searchLocation();
            }
          }}
          placeholder={`Search location in ${regionLimit}...`}
          type="text"
          value={query}
        />
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          disabled={searching}
          onClick={searchLocation}
          type="button"
        >
          <Search size={18} />
          {searching ? "Searching..." : "Search map"}
        </button>
      </div>

      {message ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          {message}
        </p>
      ) : null}

      <div className="relative z-0 h-64 w-full overflow-hidden rounded-xl border border-slate-300">
        <MapContainer center={position || [40.7128, -74.006]} zoom={13} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {position ? <Marker position={position} /> : null}
          <MapUpdater position={position} />
        </MapContainer>
      </div>
    </div>
  );
}
