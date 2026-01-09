// src/components/ProductCatalogue.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/Product-card.css";

// Uses a small, consistent placeholder (adjust path if yours differs)
const FALLBACK_IMAGE = "/images/product-placeholder-dark.jpg";

// Pagination
const PAGE_SIZE = 24;

// Simple debounce hook
function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// Safe string normalisation
function norm(s) {
  return (s ?? "").toString().trim();
}

// Decide if URL looks usable
function isLikelyUrl(url) {
  const u = norm(url);
  if (!u) return false;
  if (u.includes("your-url-here")) return false;
  // allow absolute or site-relative
  return u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/");
}

// Lightweight skeleton card
function ProductCardSkeleton() {
  return (
    <div className="product-card" style={{ opacity: 0.9 }}>
      <div className="product-card-image" style={{ position: "relative" }}>
        <div
          className="cb-skel"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 10,
          }}
        />
      </div>
      <div style={{ paddingTop: 10 }}>
        <div className="cb-skel" style={{ height: 14, width: "75%", borderRadius: 6 }} />
        <div style={{ height: 8 }} />
        <div className="cb-skel" style={{ height: 12, width: "55%", borderRadius: 6 }} />
        <div style={{ height: 10 }} />
        <div className="cb-skel" style={{ height: 10, width: "90%", borderRadius: 6 }} />
        <div style={{ height: 6 }} />
        <div className="cb-skel" style={{ height: 10, width: "80%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

export default function ProductCatalogue() {
  // Filters
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 300);

  // Data lists
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Products
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Load state
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  // Image telemetry (per render/page)
  const [imgAttempted, setImgAttempted] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(0);
  const [imgErrored, setImgErrored] = useState(0);
  const [imgFallback, setImgFallback] = useState(0);

  // Per-product image loading state (for per-card shimmer)
  const [imgStateById, setImgStateById] = useState({}); // { [id]: "loading"|"loaded"|"error"|"fallback" }

  // Optional debug panel (toggle with ?debug=1)
  const debugEnabled = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get("debug") === "1";
    } catch {
      return false;
    }
  }, []);
  const [healthRunning, setHealthRunning] = useState(false);
  const [healthReport, setHealthReport] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Inject minimal skeleton shimmer CSS once
  useEffect(() => {
    const id = "cb-skeleton-css";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      .cb-skel {
        background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06));
        background-size: 200% 100%;
        animation: cb-skel 1.2s ease-in-out infinite;
      }
      @keyframes cb-skel {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .cb-telemetry {
        margin-top: 10px;
        font-size: 12px;
        opacity: 0.85;
        user-select: text;
      }
      .cb-error {
        margin-top: 10px;
        color: #ffb3b3;
        font-size: 13px;
      }
      .cb-meta {
        margin-top: 6px;
        font-size: 12px;
        opacity: 0.85;
      }
      .cb-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
        margin-top: 14px;
      }
      .cb-filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-top: 8px;
      }
      .cb-filter-row label {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        font-size: 13px;
      }
      .cb-filter-row select, .cb-filter-row input {
        height: 28px;
      }
      .cb-pagination {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 10px;
        font-size: 13px;
      }
      .cb-pagination button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .cb-debug {
        margin-top: 12px;
        padding: 10px;
        border-radius: 10px;
        background: rgba(255,255,255,0.04);
        font-size: 12px;
        white-space: pre-wrap;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Load categories + brands
  useEffect(() => {
    (async () => {
      setLoadingFilters(true);
      setError("");

      try {
        // Categories: adapt select fields to your schema safely
        const catRes = await supabase
          .from("categories")
          .select("id,name,slug,parent_id")
          .order("name", { ascending: true });

        // Brands: typical schema
        const brandRes = await supabase
          .from("brands")
          .select("id,name")
          .order("name", { ascending: true });

        if (catRes.error) throw catRes.error;
        if (brandRes.error) throw brandRes.error;

        if (!isMounted.current) return;
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        setBrands(Array.isArray(brandRes.data) ? brandRes.data : []);
      } catch (e) {
        if (!isMounted.current) return;
        setError(`Error loading filters: ${e?.message ?? String(e)}`);
      } finally {
        if (!isMounted.current) return;
        setLoadingFilters(false);
      }
    })();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [categoryId, brandId, debouncedSearch]);

  // Load products (NO price references)
  useEffect(() => {
    (async () => {
      setLoadingProducts(true);
      setError("");

      // reset telemetry for this page load
      setImgAttempted(0);
      setImgLoaded(0);
      setImgErrored(0);
      setImgFallback(0);
      setImgStateById({});

      try {
        let q = supabase
          .from("products")
          .select("id,sku,name,description,image_url,brand_id,category_id", { count: "exact" })
          .eq("is_active", true);

        if (categoryId !== "all") q = q.eq("category_id", Number(categoryId));
        if (brandId !== "all") q = q.eq("brand_id", Number(brandId));

        const s = norm(debouncedSearch);
        if (s) {
          // Search across name/sku/description. Supabase uses PostgREST "or" syntax.
          // Note: escape commas minimally; if you later need robust escaping, we can add it.
          const like = `%${s.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
          q = q.or(`name.ilike.${like},sku.ilike.${like},description.ilike.${like}`);
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const res = await q.order("name", { ascending: true }).range(from, to);

        if (res.error) throw res.error;

        const rows = Array.isArray(res.data) ? res.data : [];
        const count = typeof res.count === "number" ? res.count : 0;

        if (!isMounted.current) return;

        setProducts(rows);
        setTotalCount(count);

        // Initialise per-product image state + attempted count
        const initial = {};
        let attempted = 0;
        let fallback = 0;

        for (const p of rows) {
          const url = p?.image_url;
          if (isLikelyUrl(url)) {
            initial[p.id] = "loading";
            attempted += 1;
          } else {
            // We will render fallback placeholder, but no network attempt for the product URL
            initial[p.id] = "fallback";
            fallback += 1;
          }
        }

        setImgAttempted(attempted);
        setImgFallback(fallback);
        setImgStateById(initial);

        // Basic log for sanity
        if (debugEnabled) {
          const present = rows.filter((r) => isLikelyUrl(r.image_url)).length;
          // eslint-disable-next-line no-console
          console.log(`[ProductCatalogue] fetched=${rows.length}, image_url usable=${present}`);
        }
      } catch (e) {
        if (!isMounted.current) return;
        setError(`Error loading products: ${e?.message ?? String(e)}`);
        setProducts([]);
        setTotalCount(0);
      } finally {
        if (!isMounted.current) return;
        setLoadingProducts(false);
      }
    })();
  }, [categoryId, brandId, debouncedSearch, page, debugEnabled]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  }, [totalCount]);

  const browsingLabel = useMemo(() => {
    const catName =
      categoryId === "all"
        ? "All"
        : categories.find((c) => String(c.id) === String(categoryId))?.name ?? "Category";
    const brandName =
      brandId === "all" ? "All" : brands.find((b) => String(b.id) === String(brandId))?.name ?? "Brand";
    return `Browsing ${catName} / ${brandName} (${totalCount} products)`;
  }, [categoryId, brandId, categories, brands, totalCount]);

  function onImgLoad(productId) {
    setImgLoaded((v) => v + 1);
    setImgStateById((prev) => ({ ...prev, [productId]: "loaded" }));
  }

  function onImgError(productId) {
    setImgErrored((v) => v + 1);
    setImgStateById((prev) => ({ ...prev, [productId]: "error" }));
  }

  // Admin/debug image health check (tests first N products visible)
  async function runHealthCheck() {
    if (healthRunning) return;
    setHealthRunning(true);
    setHealthReport(null);

    try {
      const sample = products.slice(0, Math.min(24, products.length));
      const checks = await Promise.all(
        sample.map(
          (p) =>
            new Promise((resolve) => {
              const url = isLikelyUrl(p.image_url) ? p.image_url : FALLBACK_IMAGE;

              const img = new Image();
              const started = performance.now();

              img.onload = () => {
                const ms = Math.round(performance.now() - started);
                resolve({ id: p.id, sku: p.sku, ok: true, ms, url });
              };
              img.onerror = () => {
                const ms = Math.round(performance.now() - started);
                resolve({ id: p.id, sku: p.sku, ok: false, ms, url });
              };

              // Avoid hanging forever
              const timeout = setTimeout(() => {
                resolve({ id: p.id, sku: p.sku, ok: false, ms: 5000, url, timeout: true });
              }, 5000);

              img.onload = () => {
                clearTimeout(timeout);
                const ms = Math.round(performance.now() - started);
                resolve({ id: p.id, sku: p.sku, ok: true, ms, url });
              };
              img.onerror = () => {
                clearTimeout(timeout);
                const ms = Math.round(performance.now() - started);
                resolve({ id: p.id, sku: p.sku, ok: false, ms, url });
              };

              img.src = url;
            })
        )
      );

      const ok = checks.filter((c) => c.ok).length;
      const bad = checks.length - ok;

      setHealthReport({
        tested: checks.length,
        ok,
        bad,
        slowest: checks.slice().sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, 5),
        failures: checks.filter((c) => !c.ok).slice(0, 10),
      });
    } catch (e) {
      setHealthReport({ error: e?.message ?? String(e) });
    } finally {
      setHealthRunning(false);
    }
  }

  return (
    <section className="cb-section" id="catalogue">
      <h2>Product Catalogue</h2>

      <div className="cb-filter-row">
        <label>
          Category
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={loadingFilters}
            className="cb-filter cb-filter-category"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Brand
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={loadingFilters}
            className="cb-filter cb-filter-brand"
          >
            <option value="all">All</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="cb-filter cb-filter-search">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, description"
          />
        </label>
      </div>

      <div className="cb-meta">{browsingLabel}</div>

      {error ? <div className="cb-error">{error}</div> : null}

      <div className="cb-pagination">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loadingProducts}>
          Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loadingProducts}
        >
          Next
        </button>
      </div>

      {/* Telemetry: only counts actual <img> network attempts, not fallbacks */}
      <div className="cb-telemetry">
        Images: Attempted {imgAttempted} / Loaded {imgLoaded} / Errors {imgErrored} / Fallback {imgFallback}
      </div>

      {debugEnabled ? (
        <div className="cb-debug">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <strong>Image Health Checks (Debug)</strong>
            <button onClick={runHealthCheck} disabled={healthRunning || loadingProducts}>
              {healthRunning ? "Running..." : "Run check (first 24)"}
            </button>
          </div>

          {healthReport ? (
            healthReport.error ? (
              <div style={{ marginTop: 8 }}>Error: {healthReport.error}</div>
            ) : (
              <div style={{ marginTop: 8 }}>
                Tested: {healthReport.tested} | OK: {healthReport.ok} | Bad: {healthReport.bad}
                {"\n\n"}
                Slowest (top 5):{"\n"}
                {healthReport.slowest.map((s) => `- ${s.sku} (${s.ms}ms)`).join("\n")}
                {"\n\n"}
                Failures (top 10):{"\n"}
                {healthReport.failures.map((f) => `- ${f.sku} (${f.timeout ? "timeout" : "error"})`).join("\n")}
              </div>
            )
          ) : (
            <div style={{ marginTop: 8, opacity: 0.85 }}>
              Tip: add <code>?debug=1</code> to the URL to keep this panel visible.
            </div>
          )}
        </div>
      ) : null}

      {/* Grid */}
      <div className="cb-grid">
        {loadingProducts
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => <ProductCardSkeleton key={`sk-${i}`} />)
          : products.length === 0
          ? null
          : products.map((p) => {
              const usable = isLikelyUrl(p.image_url);
              const src = usable ? p.image_url : FALLBACK_IMAGE;
              const state = imgStateById[p.id] || (usable ? "loading" : "fallback");

              return (
                <div className="product-card" key={p.id}>
                  <div className="product-card-image" style={{ position: "relative" }}>
                    {/* Per-image skeleton overlay while loading */}
                    {state === "loading" ? (
                      <div
                        className="cb-skel"
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 10,
                        }}
                      />
                    ) : null}

                    <img
                      src={src}
                      alt={norm(p.name) || norm(p.sku) || "Product"}
                      loading="lazy"
                      onLoad={() => {
                        // Only count load if it was a real product URL attempt
                        if (usable) onImgLoad(p.id);
                      }}
                      onError={(e) => {
                        // If a real URL fails, swap to fallback and record error + fallback
                        if (usable) {
                          onImgError(p.id);
                          setImgFallback((v) => v + 1);
                          setImgStateById((prev) => ({ ...prev, [p.id]: "fallback" }));
                        }
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                      style={{
                        opacity: state === "loading" ? 0 : 1,
                        transition: "opacity 180ms ease",
                      }}
                    />
                  </div>

                  <div className="product-card-details">
                    <h3>{norm(p.name) || "Unnamed product"}</h3>
                    <p>
                      <strong>SKU:</strong> {norm(p.sku) || "N/A"}
                    </p>
                    {norm(p.description) ? <p className="product-card-description">{p.description}</p> : null}
                  </div>
                </div>
              );
            })}
      </div>

      {!loadingProducts && products.length === 0 ? (
        <div className="cb-meta" style={{ marginTop: 10 }}>
          No products matched your filters/search.
        </div>
      ) : null}
    </section>
  );
}
