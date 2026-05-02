import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";

import type { UsStateOption } from "../../lib/api";

export function StateMultiSelect({
  options,
  value,
  onChange,
}: {
  options: UsStateOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);

  const filteredOptions = useMemo(() => {
    const cleanedQuery = query.trim().toLowerCase();

    if (!cleanedQuery) {
      return options;
    }

    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(cleanedQuery) ||
        option.code.toLowerCase().includes(cleanedQuery),
    );
  }, [options, query]);

  function toggleState(code: string) {
    const next = new Set(selected);

    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }

    onChange(Array.from(next).sort());
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-black text-slate-900">Allowed states</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Outdoor-run locations must be selected from these states.
          </p>
        </div>

        <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
          {value.length} selected
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            className="w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-600"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search states..."
            type="text"
            value={query}
          />
        </div>

        <button
          className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
          onClick={() => onChange(options.map((option) => option.code).sort())}
          type="button"
        >
          Select all
        </button>

        <button
          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          onClick={() => onChange([])}
          type="button"
        >
          Clear all
        </button>
      </div>

      {value.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {value.map((code) => {
            const option = options.find((item) => item.code === code);
            return (
              <span
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                key={code}
              >
                {option?.name ?? code}
                <button
                  className="rounded-full hover:bg-slate-200"
                  onClick={() => toggleState(code)}
                  type="button"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Select at least one state before saving.
        </p>
      )}

      <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredOptions.map((option) => {
          const isSelected = selected.has(option.code);

          return (
            <button
              className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition ${
                isSelected
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              key={option.code}
              onClick={() => toggleState(option.code)}
              type="button"
            >
              <span>
                {option.name}
                <span className="ml-2 text-xs text-slate-400">{option.code}</span>
              </span>
              {isSelected ? <Check size={16} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
