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

  // Prefer slug match (best practice)
  const bySlug = categories.find((c) => normaliseKey(c.slug) === key);
  if (bySlug) return bySlug.id;

  // Backwards compatible: name match
  const byName = categories.find((c) => normaliseKey(c.name) === key);
  if (byName) return byName.id;

  return null;
}

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

  // Track the last preset we applied so button clicks work repeatedly
  const lastAppliedPresetKeyRef = useRef("");

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

  // Apply preset whenever it changes (from buttons) or from localStorage once
  useEffect(() => {
    if (!categories.length) return;

    const fromStorage = (() => {
      try {
        return localStorage.getItem("cb_category_name") || "";
      } catch {
        return "";
      }
    })();

    const preset = presetCategoryName || fromStorage;
    const presetKey = normaliseKey(preset);

    // If nothing to apply and no category selected yet, use first category
    if (!presetKey) {
      if (!selectedCategoryId) {
        setSelectedCategoryId(categories[0]?.id ?? null);
      }
      return;
    }

    // Only act if this preset is new
    if (lastAppliedPresetKeyRef.current === presetKey) return;

    const resolvedId = resolveCategoryId(categories, preset);
    const fallbackId = categories[0]?.id ?? null;

    const targetId = resolvedId || fallbackId;

    if (targetId && String(targetId) !== String(selectedCategoryId)) {
      setSelectedCategoryId(targetId);
      setSelectedBrandId("all");
      setQuery("");
      setPage(1);
    }

    lastAppliedPresetKeyRef.current = presetKey;

    // Clear sticky localStorage preset once consumed
    try {
      if (fromStorage) localStorage.removeItem("cb_category_name");
    } catch {
      // ignore
    }

    if (typeof onPresetConsumed === "function") onPresetConsumed();
  }, [categories, presetCategoryName, selectedCategoryId, onPresetConsumed]);

  // Load products whenever selectedCategoryId changes
  useEffect(() => {
    if (!selectedCategoryId) return;

    let isMounted = true;

    async function loadProducts() {
      setLoading(true);
      setLoadError("");
      setPage(1);

      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, category_id, brand_id, name, sku, description, image_url, is_active")
          .eq("category_id", selectedCategoryId)
          .eq("is_active", true)
          .order("name", { ascending: true })
          .limit(5000);

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
  }, [selectedCategoryId]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => String(c.id) === String(selectedCategoryId)) || null;
  }, [categories, selectedCategoryId]);

  const filteredProducts = useMemo(() => {
    const q = normaliseKey(query);

    return products.filter((p) => {
      if (selectedBrandId !== "all" && String(p.brand_id) !== String(selectedBrandId)) return false;

      if (!q) return true;
      const hay = normaliseKey(`${p.name || ""} ${p.sku || ""} ${p.description || ""}`);
      return hay.includes(q);
    });
  }, [products, query, selectedBrandId]);

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

        {/* Filters */}
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
              onChange={(e) => {
                const nextId = Number(e.target.value);
                setSelectedCategoryId(nextId);
                // Allow future button presets to apply even if same key was used previously
                lastAppliedPresetKeyRef.current = "";
              }}
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

        {/* Status */}
        {loadError ? (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
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
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMG;
                        }}
                      />
                    </div>

                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
                      {p.sku ? (
                        <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>{p.sku}</div>
                      ) : null}
                      {p.description ? (
                        <div
                          style={{
                            opacity: 0.85,
                            marginTop: 10,
                            fontSize: 13,
                            lineHeight: 1.35,
                          }}
                        >
                          {p.description}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 18,
              }}
            >
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
