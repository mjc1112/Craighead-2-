// src/components/ProductCatalogue.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const FALLBACK_IMG = "/images/product-placeholder-dark.jpg";
const PAGE_SIZE = 24;

function normaliseKey(v) {
  return String(v || "").trim().toLowerCase();
}

function resolveCategoryId(categories, preset) {
  const key = normaliseKey(preset);
  if (!key) return null;

  const bySlug = categories.find((c) => normaliseKey(c.slug) === key);
  if (bySlug) return bySlug.id;

  const byName = categories.find((c) => normaliseKey(c.name) === key);
  if (byName) return byName.id;

  return null;
}

const EMPTY_FIXINGS_FILTERS = {
  length_mm: "",
  diameter_mm: "",
  head_type: "",
  drive_type: "",
  material: "",
  finish: "",
  pack_size: "",
};

export default function ProductCatalogue({ presetCategoryName, onPresetConsumed }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState("all");
  const [query, setQuery] = useState("");

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);

  // Fixings facets
  const [fixingsFilters, setFixingsFilters] = useState(EMPTY_FIXINGS_FILTERS);
  const [facetOptions, setFacetOptions] = useState({
    length_mm: [],
    diameter_mm: [],
    head_type: [],
    drive_type: [],
    material: [],
    finish: [],
    pack_size: [],
  });

  // Consume preset exactly once
  const presetConsumedRef = useRef(false);

  // Load categories + brands once
  useEffect(() => {
    let isMounted = true;

    async function boot() {
      setLoading(true);
      setLoadError("");

      try {
        const [{ data: catData, error: catErr }, { data: brandData, error: brandErr }] =
          await Promise.all([
            supabase.from("categories").select("id, slug, name").order("id", { ascending: true }),
            supabase.from("brands").select("id, name").order("name", { ascending: true }),
          ]);

        if (catErr) throw catErr;
        if (brandErr) throw brandErr;

        if (!isMounted) return;

        setCategories(catData || []);
        setBrands(brandData || []);
      } catch (e) {
        if (!isMounted) return;
        setLoadError(e?.message || "Failed to load catalogue tables.");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    boot();
    return () => {
      isMounted = false;
    };
  }, []);

  // Decide initial category from presetCategoryName OR localStorage (backwards compatible)
  useEffect(() => {
    if (!categories.length) return;
    if (presetConsumedRef.current) return;

    const fromStorage = (() => {
      try {
        return localStorage.getItem("cb_category_name") || "";
      } catch {
        return "";
      }
    })();

    const preset = presetCategoryName || fromStorage;

    const resolvedId = resolveCategoryId(categories, preset);
    const fallbackId = categories[0]?.id ?? null;

    setSelectedCategoryId(resolvedId || fallbackId);

    // Clear sticky preset so other buttons don’t keep loading same category
    presetConsumedRef.current = true;
    try {
      if (fromStorage) localStorage.removeItem("cb_category_name");
    } catch {
      // ignore
    }

    if (typeof onPresetConsumed === "function") onPresetConsumed();
  }, [categories, presetCategoryName, onPresetConsumed]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => String(c.id) === String(selectedCategoryId)) || null;
  }, [categories, selectedCategoryId]);

  const isFixings = useMemo(() => {
    return normaliseKey(selectedCategory?.slug) === "fixings";
  }, [selectedCategory]);

  // Reset fixings facets when leaving Fixings category
  useEffect(() => {
    if (!isFixings) setFixingsFilters(EMPTY_FIXINGS_FILTERS);
  }, [isFixings]);

  // Load facet options for Fixings (distinct values from product_attributes joined to fixings products)
  useEffect(() => {
    if (!isFixings) return;

    let isMounted = true;

    async function loadFacetOptions() {
      try {
        // Pull the fixings category id
        const fixingsCatId = selectedCategoryId;

        const { data, error } = await supabase
          .from("product_attributes")
          .select(
            `
            length_mm, diameter_mm, head_type, drive_type, material, finish, pack_size,
            products!inner(id, category_id, is_active)
          `
          )
          .eq("products.category_id", fixingsCatId)
          .eq("products.is_active", true)
          .limit(5000);

        if (error) throw error;
        if (!isMounted) return;

        const rows = data || [];

        const uniqSorted = (arr, numeric = false) => {
          const set = new Set(arr.filter((v) => v !== null && v !== undefined && String(v).trim() !== ""));
          const out = Array.from(set);
          if (numeric) return out.map((v) => Number(v)).sort((a, b) => a - b);
          return out.map((v) => String(v)).sort((a, b) => a.localeCompare(b));
        };

        setFacetOptions({
          length_mm: uniqSorted(rows.map((r) => r.length_mm), true),
          diameter_mm: uniqSorted(rows.map((r) => r.diameter_mm), true),
          head_type: uniqSorted(rows.map((r) => r.head_type)),
          drive_type: uniqSorted(rows.map((r) => r.drive_type)),
          material: uniqSorted(rows.map((r) => r.material)),
          finish: uniqSorted(rows.map((r) => r.finish)),
          pack_size: uniqSorted(rows.map((r) => r.pack_size), true),
        });
      } catch (e) {
        // Facets should not break the catalogue; log silently
        if (!isMounted) return;
        setFacetOptions({
          length_mm: [],
          diameter_mm: [],
          head_type: [],
          drive_type: [],
          material: [],
          finish: [],
          pack_size: [],
        });
      }
    }

    loadFacetOptions();
    return () => {
      isMounted = false;
    };
  }, [isFixings, selectedCategoryId]);

  // Load products whenever selectedCategoryId, brand, or fixings facets change
  useEffect(() => {
    if (!selectedCategoryId) return;

    let isMounted = true;

    async function loadProducts() {
      setLoading(true);
      setLoadError("");
      setPage(1);

      try {
        // Base select with embedded attributes for Fixings
        let q = supabase
          .from("products")
          .select(
            `
            id, category_id, brand_id, name, sku, description, image_url, is_active,
            product_attributes(length_mm, diameter_mm, head_type, drive_type, material, finish, pack_size)
          `
          )
          .eq("category_id", selectedCategoryId)
          .eq("is_active", true)
          .order("name", { ascending: true })
          .limit(5000);

        if (selectedBrandId !== "all") {
          q = q.eq("brand_id", Number(selectedBrandId));
        }

        // Apply Fixings facet filters only when in Fixings
        if (isFixings) {
          const f = fixingsFilters;

          if (f.length_mm) q = q.eq("product_attributes.length_mm", Number(f.length_mm));
          if (f.diameter_mm) q = q.eq("product_attributes.diameter_mm", Number(f.diameter_mm));
          if (f.head_type) q = q.eq("product_attributes.head_type", f.head_type);
          if (f.drive_type) q = q.eq("product_attributes.drive_type", f.drive_type);
          if (f.material) q = q.eq("product_attributes.material", f.material);
          if (f.finish) q = q.eq("product_attributes.finish", f.finish);
          if (f.pack_size) q = q.eq("product_attributes.pack_size", Number(f.pack_size));
        }

        const { data, error } = await q;
        if (error) throw error;
        if (!isMounted) return;

        setProducts(data || []);
      } catch (e) {
        if (!isMounted) return;
        setLoadError(e?.message || "Failed to load products for this category.");
        setProducts([]);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [selectedCategoryId, selectedBrandId, isFixings, fixingsFilters]);

  // Client-side search (name/SKU/description)
  const filteredProducts = useMemo(() => {
    const q = normaliseKey(query);
    if (!q) return products;

    return products.filter((p) => {
      const hay = normaliseKey(`${p.name || ""} ${p.sku || ""} ${p.description || ""}`);
      return hay.includes(q);
    });
  }, [products, query]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)), [
    filteredProducts.length,
  ]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedProducts = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page, totalPages]);

  return (
    <section className="cb-section">
      <div className="cb-section__inner">
        <h2 className="cb-mission__title">Product Catalogue</h2>

        {selectedCategory ? (
          <p className="cb-mission__text">
            Browsing: <strong>{selectedCategory.name}</strong>
          </p>
        ) : null}

        {/* Core Filters */}
        <div
          className="cb-catalogue__filters"
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr 1fr 2fr",
            marginTop: 16,
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Category</label>
            <select
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
              value={selectedCategoryId ?? ""}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Brand</label>
            <select
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
            >
              <option value="all">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Search</label>
            <input
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU, description..."
            />
          </div>
        </div>

        {/* Fixings Facets */}
        {isFixings ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <strong style={{ opacity: 0.9 }}>Fixings filters</strong>
              <button
                type="button"
                className="cb-btn cb-btn--secondary"
                onClick={() => setFixingsFilters(EMPTY_FIXINGS_FILTERS)}
              >
                Reset fixings filters
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              {[
                ["length_mm", "Length (mm)", facetOptions.length_mm, true],
                ["diameter_mm", "Diameter (mm)", facetOptions.diameter_mm, true],
                ["head_type", "Head Type", facetOptions.head_type, false],
                ["drive_type", "Drive Type", facetOptions.drive_type, false],
                ["material", "Material", facetOptions.material, false],
                ["finish", "Finish", facetOptions.finish, false],
                ["pack_size", "Pack Size", facetOptions.pack_size, true],
              ].map(([key, label, options, numeric]) => (
                <div key={key}>
                  <label style={{ display: "block", marginBottom: 6 }}>{label}</label>
                  <select
                    style={{ width: "100%", padding: 10, borderRadius: 10 }}
                    value={fixingsFilters[key]}
                    onChange={(e) => setFixingsFilters((prev) => ({ ...prev, [key]: e.target.value }))}
                  >
                    <option value="">Any</option>
                    {(options || []).map((v) => (
                      <option key={String(v)} value={String(v)}>
                        {numeric ? String(v) : v}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Status */}
        {loadError ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
            <strong>Catalogue error:</strong> {loadError}
          </div>
        ) : null}

        {loading ? <p style={{ marginTop: 16 }}>Loading…</p> : null}

        {/* Grid */}
        {!loading && !loadError ? (
          <>
            <div
              className="cb-grid"
              style={{
                marginTop: 18,
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              {pagedProducts.map((p) => {
                const img = p.image_url ? String(p.image_url) : FALLBACK_IMG;

                return (
                  <article
                    key={p.id}
                    className="cb-card"
                    style={{
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ height: 170, width: "100%", background: "rgba(0,0,0,0.25)" }}>
                      <img
                        src={img}
                        alt={p.name || "Product"}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMG;
                        }}
                      />
                    </div>

                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
                      {p.sku ? <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>{p.sku}</div> : null}
                      {p.description ? (
                        <div style={{ opacity: 0.85, marginTop: 10, fontSize: 13, lineHeight: 1.35 }}>
                          {p.description}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 18 }}>
              <button
                className="cb-btn cb-btn--secondary"
                type="button"
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>

              <span style={{ opacity: 0.85 }}>
                Page {page} of {totalPages}
              </span>

              <button
                className="cb-btn cb-btn--secondary"
                type="button"
                onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
