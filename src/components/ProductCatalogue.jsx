// src/components/ProductCatalogue.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const FALLBACK_IMG = "/images/product-placeholder-dark.jpg";
const PAGE_SIZE = 24;

// ---- Helpers ---------------------------------------------------------------

function safeLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function uniqSortedNumeric(values) {
  const set = new Set();
  for (const v of values) {
    const n = toNumberOrNull(v);
    if (n !== null) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function uniqSortedText(values) {
  const set = new Set();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function resolveCategoryBySlugOrName(categories, preset) {
  const key = safeLower(preset);
  if (!key) return null;

  // Prefer slug match
  const bySlug = categories.find((c) => safeLower(c.slug) === key);
  if (bySlug) return bySlug;

  // Fallback to name match
  const byName = categories.find((c) => safeLower(c.name) === key);
  if (byName) return byName;

  return null;
}

// ---- Component -------------------------------------------------------------

/**
 * Props supported (for compatibility + slug standardisation):
 * - presetCategorySlug: preferred (Stage 5.1)
 * - presetCategoryName: legacy (older clicks)
 * - onPresetConsumed: callback when preset applied
 *
 * localStorage keys supported:
 * - cb_category_slug (preferred)
 * - cb_category_name (legacy)
 */
export default function ProductCatalogue({
  presetCategorySlug,
  presetCategoryName,
  onPresetConsumed,
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Standard: select category by slug
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("all");
  const [query, setQuery] = useState("");

  // Fixings facets
  const [fixingsFacets, setFixingsFacets] = useState({
    length_mm: "",
    diameter_mm: "",
    head_type: "",
    drive_type: "",
    material: "",
    finish: "",
    pack_size: "",
  });

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);

  // Consume preset exactly once
  const presetConsumedRef = useRef(false);

  // -------------------------------------------------------------------------
  // 1) Load categories + brands once
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 2) Decide initial category slug from:
  //    presetCategorySlug -> localStorage cb_category_slug -> presetCategoryName -> cb_category_name -> fallback
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!categories.length) return;
    if (presetConsumedRef.current) return;

    const fromStorageSlug = (() => {
      try {
        return localStorage.getItem("cb_category_slug") || "";
      } catch {
        return "";
      }
    })();

    const fromStorageName = (() => {
      try {
        return localStorage.getItem("cb_category_name") || "";
      } catch {
        return "";
      }
    })();

    const preset =
      presetCategorySlug ||
      fromStorageSlug ||
      presetCategoryName ||
      fromStorageName ||
      "";

    const resolved = resolveCategoryBySlugOrName(categories, preset);
    const fallback = categories[0] || null;

    setSelectedCategorySlug((resolved?.slug || fallback?.slug || ""));

    // Clear sticky presets so other buttons don’t keep loading same category
    presetConsumedRef.current = true;
    try {
      if (fromStorageSlug) localStorage.removeItem("cb_category_slug");
      if (fromStorageName) localStorage.removeItem("cb_category_name");
    } catch {
      // ignore
    }

    if (typeof onPresetConsumed === "function") onPresetConsumed();
  }, [categories, presetCategorySlug, presetCategoryName, onPresetConsumed]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => safeLower(c.slug) === safeLower(selectedCategorySlug)) || null;
  }, [categories, selectedCategorySlug]);

  const isFixings = safeLower(selectedCategory?.slug) === "fixings";

  // -------------------------------------------------------------------------
  // 3) Load products whenever category slug changes
  //    Includes left-join style relationship to product_attributes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedCategorySlug) return;

    let isMounted = true;

    async function loadProducts() {
      setLoading(true);
      setLoadError("");
      setPage(1);

      // Reset facets when category changes (prevents “carry-over” confusion)
      setFixingsFacets({
        length_mm: "",
        diameter_mm: "",
        head_type: "",
        drive_type: "",
        material: "",
        finish: "",
        pack_size: "",
      });

      try {
        const { data, error } = await supabase
          .from("products")
          .select(
            `
            id,
            category_id,
            brand_id,
            name,
            sku,
            description,
            image_url,
            is_active,
            product_attributes (
              length_mm,
              diameter_mm,
              head_type,
              drive_type,
              material,
              finish,
              pack_size
            )
          `
          )
          .eq("is_active", true)
          // Filter by category via FK lookup by slug using a subquery approach:
          // We do this safely in two steps to avoid brittle client-side id matching.
          // Step A: fetch category id by slug
          .limit(5000);

        if (error) throw error;

        // We cannot filter by category slug directly in the same query without a view/RPC.
        // So we filter client-side by matching selectedCategoryId below.
        // (This is stable and avoids SQL/RPC changes mid-build.)

        const cat = categories.find((c) => safeLower(c.slug) === safeLower(selectedCategorySlug));
        const selectedCategoryId = cat?.id ?? null;

        const filtered = (data || []).filter((p) => String(p.category_id) === String(selectedCategoryId));

        if (!isMounted) return;

        // Normalise joined attributes: Supabase may return object or array
        const normalised = filtered.map((p) => {
          const attrs = Array.isArray(p.product_attributes)
            ? p.product_attributes[0] || null
            : p.product_attributes || null;

          return { ...p, _attrs: attrs };
        });

        // Sort products by name for consistent UI
        normalised.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

        setProducts(normalised);
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
    // categories included because we use it for id mapping
  }, [selectedCategorySlug, categories]);

  // -------------------------------------------------------------------------
  // 4) Build facet option lists from loaded fixings products
  // -------------------------------------------------------------------------
  const fixingsFacetOptions = useMemo(() => {
    if (!isFixings) {
      return {
        length_mm: [],
        diameter_mm: [],
        head_type: [],
        drive_type: [],
        material: [],
        finish: [],
        pack_size: [],
      };
    }

    const attrs = products.map((p) => p._attrs).filter(Boolean);

    return {
      length_mm: uniqSortedNumeric(attrs.map((a) => a.length_mm)),
      diameter_mm: uniqSortedNumeric(attrs.map((a) => a.diameter_mm)),
      head_type: uniqSortedText(attrs.map((a) => a.head_type)),
      drive_type: uniqSortedText(attrs.map((a) => a.drive_type)),
      material: uniqSortedText(attrs.map((a) => a.material)),
      finish: uniqSortedText(attrs.map((a) => a.finish)),
      pack_size: uniqSortedNumeric(attrs.map((a) => a.pack_size)),
    };
  }, [products, isFixings]);

  // -------------------------------------------------------------------------
  // 5) Apply filters (brand + search + fixings facets)
  // -------------------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    const q = safeLower(query);

    return products.filter((p) => {
      if (selectedBrandId !== "all" && String(p.brand_id) !== String(selectedBrandId)) return false;

      // Search
      if (q) {
        const hay = safeLower(`${p.name || ""} ${p.sku || ""} ${p.description || ""}`);
        if (!hay.includes(q)) return false;
      }

      // Fixings facets (only apply if category is fixings)
      if (isFixings) {
        const a = p._attrs || null;

        // If user has selected any facet, we require attributes row to exist
        const anyFacetSelected = Object.values(fixingsFacets).some((v) => String(v || "").trim() !== "");
        if (anyFacetSelected && !a) return false;

        // Numeric facets are compared as numbers (exact match)
        if (fixingsFacets.length_mm !== "") {
          if (toNumberOrNull(a?.length_mm) !== toNumberOrNull(fixingsFacets.length_mm)) return false;
        }
        if (fixingsFacets.diameter_mm !== "") {
          if (toNumberOrNull(a?.diameter_mm) !== toNumberOrNull(fixingsFacets.diameter_mm)) return false;
        }
        if (fixingsFacets.pack_size !== "") {
          if (toNumberOrNull(a?.pack_size) !== toNumberOrNull(fixingsFacets.pack_size)) return false;
        }

        // Text facets (case-insensitive)
        if (fixingsFacets.head_type !== "") {
          if (safeLower(a?.head_type) !== safeLower(fixingsFacets.head_type)) return false;
        }
        if (fixingsFacets.drive_type !== "") {
          if (safeLower(a?.drive_type) !== safeLower(fixingsFacets.drive_type)) return false;
        }
        if (fixingsFacets.material !== "") {
          if (safeLower(a?.material) !== safeLower(fixingsFacets.material)) return false;
        }
        if (fixingsFacets.finish !== "") {
          if (safeLower(a?.finish) !== safeLower(fixingsFacets.finish)) return false;
        }
      }

      return true;
    });
  }, [products, query, selectedBrandId, isFixings, fixingsFacets]);

  // -------------------------------------------------------------------------
  // 6) Pagination
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------------
  function setFacet(key, value) {
    setFixingsFacets((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFixingsFacets() {
    setFixingsFacets({
      length_mm: "",
      diameter_mm: "",
      head_type: "",
      drive_type: "",
      material: "",
      finish: "",
      pack_size: "",
    });
    setPage(1);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <section className="cb-section">
      <div className="cb-section__inner">
        <h2 className="cb-mission__title">Product Catalogue</h2>

        {selectedCategory ? (
          <p className="cb-mission__text">
            Browsing: <strong>{selectedCategory.name}</strong>
          </p>
        ) : null}

        {/* Primary Filters */}
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
              value={selectedCategorySlug || ""}
              onChange={(e) => {
                setSelectedCategorySlug(e.target.value);
                setSelectedBrandId("all");
                setQuery("");
                setPage(1);
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
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
              onChange={(e) => {
                setSelectedBrandId(e.target.value);
                setPage(1);
              }}
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
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, SKU, description..."
            />
          </div>
        </div>

        {/* Fixings Facets (only when Fixings selected) */}
        {isFixings ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <strong>Fixings filters</strong>
              <button type="button" className="cb-btn cb-btn--secondary" onClick={clearFixingsFacets}>
                Clear fixings filters
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              {/* Length */}
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Length (mm)</label>
                <select
                  style={{ width: "100%", padding: 10, borderRadius: 10 }}
                  value={fixingsFacets.length_mm}
                  onChange={(e) => setFacet("length_mm", e.target.value)}
                >
                  <option value="">Any</option>
                  {fixingsFacetOptions.length_mm.map((v) => (
                    <option key={v} value={String(v)}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Diameter */}
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Diameter (mm)</label>
                <select
                  style={{ width: "100%", padding: 10, borderRadius: 10 }}
                  value={fixingsFacets.diameter_mm}
                  onChange={(e) => setFacet("diameter_mm", e.target.value)}
                >
                  <option value="">Any</option>
                  {fixingsFacetOptions.diameter_mm.map((v) => (
                    <option key={v} value={String(v)}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Head Type */}
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Head Type</label>
                <select
                  style={{ width: "100%", padding: 10, borderRadius: 10 }}
                  value={fixingsFacets.head_type}
                  onChange={(e) => setFacet("head_type", e.target.value)}
                >
                  <option value="">Any</option>
                  {fixingsFacetOptions.head_type.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drive Type */}
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Drive Type</label>
                <select
                  style={{ width: "100%", padding: 10, borderRadius: 10 }}
                  value={fixingsFacets.drive_type}
                  onChange={(e) => setFacet("drive_type", e.target.value)}
                >
                  <option value="">Any</option>
                  {fixingsFacetOptions.drive_type.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material */}
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Material</label>
                <select
                  style={{ width: "100%", padding: 10, borderRadius: 10 }}
                  value={fixingsFacets.material}
                  onChange={(e) => setFacet("material", e.target.value)}
                >
                  <option value="">Any</option>
                  {fixingsFacetOptions.material.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Finish */}
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Finish</label>
                <select
                  style={{ width: "100%", padding: 10, borderRadius: 10 }}
                  value={fixingsFacets.finish}
                  onChange={(e) => setFacet("finish", e.target.value)}
                >
                  <option value="">Any</option>
                  {fixingsFacetOptions.finish.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pack Size */}
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Pack Size</label>
                <select
                  style={{ width: "100%", padding: 10, borderRadius: 10 }}
                  value={fixingsFacets.pack_size}
                  onChange={(e) => setFacet("pack_size", e.target.value)}
                >
                  <option value="">Any</option>
                  {fixingsFacetOptions.pack_size.map((v) => (
                    <option key={v} value={String(v)}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
              Tip: If you apply a Fixings filter and some products disappear, it usually means those items do not yet have attributes populated in Supabase.
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
                Page {page} of {totalPages} · {filteredProducts.length} results
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
