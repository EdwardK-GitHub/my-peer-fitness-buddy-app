import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MapPin, Search } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { api, type LocationSuggestion, type UsStateOption } from "../lib/api";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, 15);
    }
  }, [map, position]);

  return null;
}

export function LocationSelector({
  allowedStates,
  stateOptions,
  onSelect,
  onClear,
}: {
  allowedStates: string[];
  stateOptions: UsStateOption[];
  onSelect: (label: string, lat: number, lng: number, stateCode: string, stateName: string) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<LocationSuggestion | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);

  const allowedStateLabels = useMemo(() => {
    const selected = new Set(allowedStates);
    return stateOptions
      .filter((state) => selected.has(state.code))
      .map((state) => state.name)
      .join(", ");
  }, [allowedStates, stateOptions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const suggestionsQuery = useQuery({
    queryKey: ["location-autocomplete", debouncedQuery],
    queryFn: () => api.autocompleteLocations(debouncedQuery),
    enabled: debouncedQuery.length >= 3,
    staleTime: 1000 * 60 * 5,
  });

  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const shouldShowSuggestions = query.trim().length >= 3 && !selectedSuggestion;

  function handleQueryChange(value: string) {
    setQuery(value);

    if (selectedSuggestion) {
      setSelectedSuggestion(null);
      setPosition(null);
      onClear?.();
    }
  }

  function chooseSuggestion(suggestion: LocationSuggestion) {
    setSelectedSuggestion(suggestion);
    setQuery(suggestion.label);
    setPosition([suggestion.lat, suggestion.lng]);
    onSelect(
      suggestion.label,
      suggestion.lat,
      suggestion.lng,
      suggestion.stateCode,
      suggestion.stateName,
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">Search outdoor run location</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Start typing and choose one of the suggested locations.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {allowedStates.length} state{allowedStates.length === 1 ? "" : "s"} allowed
          </span>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none focus:border-blue-600"
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Try a park, campus landmark, or street address..."
            type="text"
            value={query}
          />
        </div>

        {allowedStateLabels ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Suggestions are restricted to: {allowedStateLabels}
          </p>
        ) : null}

        {query.trim().length > 0 && query.trim().length < 3 ? (
          <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Type at least 3 characters to see suggestions.
          </p>
        ) : null}

        {shouldShowSuggestions ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {suggestionsQuery.isFetching ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600">
                <Loader2 className="animate-spin" size={16} />
                Searching allowed locations...
              </div>
            ) : suggestions.length > 0 ? (
              <ul className="max-h-64 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}>
                    <button
                      className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 hover:bg-blue-50"
                      onClick={() => chooseSuggestion(suggestion)}
                      type="button"
                    >
                      <MapPin className="mt-0.5 text-blue-600" size={18} />
                      <span>
                        <span className="block text-sm font-bold text-slate-900">
                          {suggestion.label}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-slate-500">
                          {suggestion.stateName}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : suggestionsQuery.isError ? (
              <p className="px-4 py-3 text-sm font-medium text-rose-700">
                Location suggestions are unavailable right now. Try again in a moment.
              </p>
            ) : (
              <p className="px-4 py-3 text-sm font-medium text-slate-600">
                No matching locations found in the allowed states.
              </p>
            )}
          </div>
        ) : null}

        {selectedSuggestion ? (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5" size={18} />
            <div>
              <p className="font-bold">Selected location</p>
              <p className="mt-1 leading-5">{selectedSuggestion.label}</p>
            </div>
          </div>
        ) : null}
      </div>

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
