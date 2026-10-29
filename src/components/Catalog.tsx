"use client";

import { useState } from "react";
import { useObjectUrl } from "@/hooks/usePhotoTryOn";
import { CATEGORIES, PRODUCTS, type CategoryId, type Product } from "@/lib/catalog";

export type Selection = { kind: "product"; product: Product } | { kind: "custom"; category: CategoryId | ""; image: Blob };

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
    on ? "border-fg bg-fg text-white" : "border-line bg-surface text-fg hover:border-fg/40"
  }`;

export function Catalog({
  selection,
  liveOnly,
  onSelect,
  onUpload,
  onCustomCategory,
}: {
  selection: Selection | null;
  liveOnly: boolean;
  onSelect: (p: Product) => void;
  onUpload: (file: File) => void;
  onCustomCategory: (c: CategoryId) => void;
}) {
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const shown = PRODUCTS.filter((p) => filter === "all" || p.category === filter);
  const custom = selection?.kind === "custom" ? selection : null;
  const customUrl = useObjectUrl(custom?.image);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={chip(filter === "all")}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)} className={chip(filter === c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {shown.map((p) => {
          const on = selection?.kind === "product" && selection.product.id === p.id;
          const disabled = liveOnly && !p.live;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={disabled}
                title={disabled ? "Not available with the live camera" : undefined}
                onClick={() => onSelect(p)}
                className={`relative w-full overflow-hidden rounded-md border bg-surface text-left transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  on ? "border-fg ring-1 ring-fg" : "border-line hover:border-fg/40"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="aspect-square w-full bg-white object-contain p-2" draggable={false} />
                {p.live && <span className="absolute left-1.5 top-1.5 rounded-sm bg-bg px-1 text-[10px] text-muted">Live</span>}
                <span className="block truncate px-2 pb-2 text-[12px] leading-tight">{p.name}</span>
              </button>
            </li>
          );
        })}

        {!liveOnly && (
          <li>
            <label
              className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed bg-surface text-center text-[12px] text-muted focus-within:outline-2 focus-within:outline-fg ${
                custom ? "border-fg" : "border-line hover:border-fg/40"
              }`}
            >
              {custom && customUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={customUrl} alt="Your item" className="h-full w-full object-contain p-2" />
              ) : (
                <>
                  <span className="text-xl leading-none text-fg">+</span>
                  Upload your own item
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = ""; // allow picking the same file again
                  if (f) onUpload(f);
                }}
              />
            </label>
          </li>
        )}
      </ul>

      {custom && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
          What is it?
          <select
            value={custom.category}
            onChange={(e) => onCustomCategory(e.target.value as CategoryId)}
            className="min-h-10 rounded-md border border-line bg-surface px-2"
          >
            <option value="" disabled>
              Choose a category
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
