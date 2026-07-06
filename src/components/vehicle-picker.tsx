"use client";
import * as React from "react";
import { ALL_MAKES, POPULAR_MAKES, logoUrl, type CarMake } from "@/lib/car-data";
import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui";

/**
 * Cascading vehicle selection: brand logo grid → model autocomplete (NHTSA,
 * free-text fallback) → optional trim. Emits hidden inputs `make`, `model`,
 * `trim` usable inside any <form>, plus a controlled callback.
 */
export function VehiclePicker({
  namePrefix = "vehicle_",
  defaultMake = "",
  defaultModel = "",
  defaultTrim = "",
  onChange,
}: {
  namePrefix?: string;
  defaultMake?: string;
  defaultModel?: string;
  defaultTrim?: string;
  onChange?: (v: { make: string; model: string; trim: string }) => void;
}) {
  const [make, setMake] = React.useState(defaultMake);
  const [model, setModel] = React.useState(defaultModel);
  const [trim, setTrim] = React.useState(defaultTrim);
  const [search, setSearch] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [models, setModels] = React.useState<string[]>([]);
  const [loadingModels, setLoadingModels] = React.useState(false);
  const [modelOpen, setModelOpen] = React.useState(false);

  const emit = (m: string, mo: string, t: string) => onChange?.({ make: m, model: mo, trim: t });

  const selectedMake = ALL_MAKES.find((x) => x.name === make);

  async function pickMake(m: CarMake) {
    setMake(m.name); setModel(""); setModels([]); setSearch(""); setShowAll(false);
    emit(m.name, "", trim);
    setLoadingModels(true);
    try {
      const res = await fetch(`/api/car-models?make=${encodeURIComponent(m.name)}`);
      const data = await res.json();
      setModels(data.models ?? []);
    } catch { setModels([]); }
    setLoadingModels(false);
  }

  const q = search.trim().toLowerCase();
  const visibleMakes = q
    ? ALL_MAKES.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 24)
    : showAll ? ALL_MAKES : POPULAR_MAKES;

  const modelQ = model.trim().toLowerCase();
  const suggestions = modelQ
    ? models.filter((m) => m.toLowerCase().includes(modelQ)).slice(0, 8)
    : models.slice(0, 8);

  return (
    <div className="space-y-3">
      <input type="hidden" name={`${namePrefix}make`} value={make} />
      <input type="hidden" name={`${namePrefix}model`} value={model} />
      <input type="hidden" name={`${namePrefix}trim`} value={trim} />

      {/* Step 1: brand */}
      {!selectedMake ? (
        <div className="space-y-2">
          <Label>Marque du véhicule</Label>
          <Input placeholder="Rechercher une marque…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {visibleMakes.map((m) => (
              <button key={m.slug} type="button" onClick={() => pickMake(m)}
                className="flex flex-col items-center gap-1 rounded-md border p-2 hover:border-primary hover:bg-accent"
                title={m.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl(m.slug)} alt={m.name} className="h-10 w-10 object-contain" loading="lazy" />
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">{m.name}</span>
              </button>
            ))}
          </div>
          {!q && !showAll && (
            <button type="button" onClick={() => setShowAll(true)}
              className="text-xs text-muted-foreground underline">
              Voir toutes les marques ({ALL_MAKES.length})
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl(selectedMake.slug)} alt={make} className="h-8 w-8 object-contain" />
          <span className="flex-1 text-sm font-medium">{make}</span>
          <button type="button" className="text-xs text-muted-foreground underline"
            onClick={() => { setMake(""); setModel(""); emit("", "", trim); }}>
            Changer
          </button>
        </div>
      )}

      {/* Step 2: model */}
      {selectedMake && (
        <div className="relative space-y-1.5">
          <Label>Modèle</Label>
          <Input
            value={model} required placeholder={loadingModels ? "Chargement des modèles…" : "Classe C, 208, Golf…"}
            onChange={(e) => { setModel(e.target.value); emit(make, e.target.value, trim); setModelOpen(true); }}
            onFocus={() => setModelOpen(true)}
            onBlur={() => setTimeout(() => setModelOpen(false), 150)}
          />
          {modelOpen && suggestions.length > 0 && (
            <div className="absolute z-10 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
              {suggestions.map((m) => (
                <button key={m} type="button"
                  className={cn("block w-full px-3 py-2 text-left text-sm hover:bg-accent",
                    m === model && "bg-accent font-medium")}
                  onMouseDown={(e) => { e.preventDefault(); setModel(m); emit(make, m, trim); setModelOpen(false); }}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: trim (optional) */}
      {selectedMake && model && (
        <div className="space-y-1.5">
          <Label>Finition (optionnel)</Label>
          <Input value={trim} placeholder="AMG Line, GT Line, Sport…"
            onChange={(e) => { setTrim(e.target.value); emit(make, model, e.target.value); }} />
        </div>
      )}
    </div>
  );
}

/** Small brand logo used on vehicle cards; falls back to nothing if unknown. */
export function MakeLogo({ make, className }: { make: string; className?: string }) {
  const m = ALL_MAKES.find((x) => x.name.toLowerCase() === make.trim().toLowerCase());
  if (!m) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logoUrl(m.slug)} alt={make} className={cn("h-8 w-8 object-contain", className)} />;
}
