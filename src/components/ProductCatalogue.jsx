import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/Product-card.css";

// Adjust this import path to your project.
// Common patterns: "../lib/supabaseClient" or "../supabaseClient"
import { supabase } from "../lib/supabaseClient";

const PLACEHOLDER_SRC = "/images/product-placeholder-dark.jpg";

// Defensive helpers
const safeTrim = (v) => (typeof v === "string" ? v.trim() : "");
const isNonEmptyUrl = (v) => safeTrim(v).length > 0;
const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));

// Optional: if you want to “phone home” telemetry to your own endpoint later.
// Leave disabled by default to avoid noise.
const ENABLE_TELEMETRY_POST = false;
const TELEMETRY_ENDPOINT = "/api/image-telemetry";

/**
 * ProductCatalogue
 *
 * Props:
 * - initialCategory (string)
 * - initialBrand (string)
 * - pageSize (number) default 24
 * - isAdmin (boolean) if true, shows Image Health panel button
 */
export default function ProductCatalogue({
  initialCategory = "",
  initialBrand = "",
  pageSize = 24,
  isAdmin = false,
}) {
  // Filters
  const [category, setCategory] = useState(initialCategory);
  const [brand, setBrand] = useState(initialBrand);
  const [search, setSearch] = useState("");

  // Data lists (you may already have these elsewhere; keeping self-contained)
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Products
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Paging
  const [page, setPage] = useState(1);
  const perPage = clampInt(pageSize, 8, 60);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Image telemetry (per render session)
  const [imgLoaded, setImgLoaded] = useState(0);
  const [imgErrored, setImgErrored] = useState(0);
  const [imgPending, setImgPending] = useState(0);

  // Keeps detailed error list for admin review
  const [imgErrorList, setImgErrorList] = useState([]); // { sku, name, image_url, reason }
  const imgErrorSetRef = useRef(new Set()); // de-dupe by sku

  // Admin health check modal/panel
  const [showHealth, setShowHealth] = useState(false);
  const [healthRunning, setHealthRunning] = useState(false);
  const [healthResults, setHealthResults] = useState([]); // { sku, name, image_url, ok, reason }

  // Reset paging when filters change
  useEffect(() => {
    setPage(1);
  }, [category, brand, search]);

  // Load dropdown lists (categories/brands)
  useEffect(() => {
    let cancelled = false;

    async function loadLists() {
      try {
        // Categories
        const { data: catData, error: catErr } = await supabase
          .from("categories")
          .select("id,name,slug,parent_id")
          .order("name", { ascending: true });

        if (catErr) throw catErr;

        // Brands
        const { data: brandData, error: brandErr } = await supabase
          .from("brands")
          .select("id,name")
          .order("name", { ascending: true });

        if (brandErr) throw brandErr;

        if (!cancelled) {
          setCategories(catData || []);
          setBrands(brandData || []);
        }
      } catch (e) {
        // Non-blocking; catalogue can still render if lists fail
        console.warn("Catalogue: failed to load lists", e);
      }
    }

    loadLists();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build query constraints
  const queryConstraints = useMemo(() => {
    return {
      category,
      brand,
      search: safeTrim(search),
      page,
      perPage,
    };
  }, [category, brand, search, page, perPage]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    // Reset image telemetry per fetch
    setImgLoaded(0);
    setImgErrored(0);
    setImgPending(0);
    setImgErrorList([]);
    imgErrorSetRef.current = new Set();

    try {
      const from = (queryConstraints.page - 1) * queryConstraints.perPage;
      const to = from + queryConstraints.perPage - 1;

      // Note: adapt field names if yours differ
      // Expected columns: id, sku, name, image_url, brand_id, category_id, price, description, etc.
      let q = supabase
        .from("products")
        .select(
          "id,sku,name,image_url,price,short_description,description,brand_id,category_id,is_active",
          { count: "exact" }
        )
        .eq("is_active", true);

      // If your UI uses names rather than IDs, you likely already map them.
      // Here we assume you store selected filters as *names* (like “Makita”, “Power Tools”).
      // If you store IDs in state instead, change these filters accordingly.

      if (isNonEmptyUrl(queryConstraints.brand)) {
        // brand stored as name -> lookup brand id locally
        const match = brands.find(
          (b) => b.name.toLowerCase() === queryConstraints.brand.toLowerCase()
        );
        if (match?.id) q = q.eq("brand_id", match.id);
      }

      if (isNonEmptyUrl(queryConstraints.category)) {
        // category stored as name -> lookup category id locally
        const match = categories.find(
          (c) => c.name.toLowerCase() === queryConstraints.category.toLowerCase()
        );
        if (match?.id) q = q.eq("category_id", match.id);
      }

      if (queryConstraints.search) {
        // Lightweight search. Adjust to your DB/search strategy.
        // Common: ilike on sku/name/description.
        q = q.or(
          [
            `sku.ilike.%${queryConstraints.search}%`,
            `name.ilike.%${queryConstraints.search}%`,
            `description.ilike.%${queryConstraints.search}%`,
          ].join(",")
        );
      }

      q = q.order("name", { ascending: true }).range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;

      setProducts(data || []);
      setTotalCount(count || 0);

      // Set pending images count based on products that have an image_url (attempt load) or will show placeholder (still loads placeholder image).
      // We treat every card image as pending until it fires onLoad/onError.
      setImgPending((data || []).length);
    } catch (e) {
      console.error("Catalogue: fetchProducts failed", e);
      setLoadError(
        e?.message ||
          "Unable to load products at this time. Please try again shortly."
      );
      setProducts([]);
      setTotalCount(0);
      setImgPending(0);
    } finally {
      setLoading(false);
    }
  }, [queryConstraints, brands, categories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Pagination helpers
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((totalCount || 0) / perPage));
  }, [totalCount, perPage]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  // Image telemetry handlers
  const onImgLoad = useCallback(() => {
    setImgLoaded((n) => n + 1);
    setImgPending((n) => Math.max(0, n - 1));
  }, []);

  const onImgError = useCallback((product, e) => {
    setImgErrored((n) => n + 1);
    setImgPending((n) => Math.max(0, n - 1));

    // Apply fallback only once
    const img = e?.currentTarget;
    if (img && !img.dataset.fallbackApplied) {
      img.dataset.fallbackApplied = "1";
      img.src = PLACEHOLDER_SRC;
    }

    // Record error (de-dupe by SKU)
    const sku = product?.sku || "";
    if (sku && !imgErrorSetRef.current.has(sku)) {
      imgErrorSetRef.current.add(sku);

      setImgErrorList((list) => [
        ...list,
        {
          sku,
          name: product?.name || "",
          image_url: product?.image_url || "",
          reason: "Image failed to load (onError fired)",
        },
      ]);
    }
  }, []);

  // Optional telemetry post (kept OFF by default)
  useEffect(() => {
    if (!ENABLE_TELEMETRY_POST) return;
    if (!products.length) return;

    // Post only when all images are done (pending is 0)
    if (imgPending !== 0) return;

    const payload = {
      ts: new Date().toISOString(),
      filters: { category, brand, search, page, perPage },
      totals: {
        products: products.length,
        loaded: imgLoaded,
        errored: imgErrored,
      },
      errors: imgErrorList,
    };

    fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [
    imgPending,
    products.length,
    imgLoaded,
    imgErrored,
    imgErrorList,
    category,
    brand,
    search,
    page,
    perPage,
  ]);

  // Admin image health check:
  // This actively attempts to load each image URL (without touching DOM cards),
  // reports ok/fail. Uses Image() which respects CORS in practice for load events.
  const runImageHealthCheck = useCallback(async () => {
    setHealthRunning(true);
    setHealthResults([]);

    const list = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      image_url: p.image_url,
    }));

    const checkOne = (item) =>
      new Promise((resolve) => {
        // If no URL stored, treat as fail
        if (!isNonEmptyUrl(item.image_url)) {
          resolve({ ...item, ok: false, reason: "Missing image_url in DB" });
          return;
        }

        const img = new Image();
        const timeoutMs = 8000;

        const t = setTimeout(() => {
          cleanup();
          resolve({ ...item, ok: false, reason: "Timeout loading image" });
        }, timeoutMs);

        const cleanup = () => {
          clearTimeout(t);
          img.onload = null;
          img.onerror = null;
        };

        img.onload = () => {
          cleanup();
          resolve({ ...item, ok: true, reason: "" });
        };

        img.onerror = () => {
          cleanup();
          resolve({ ...item, ok: false, reason: "Failed to load image URL" });
        };

        // Cache-bust to avoid stale / broken cached response during testing
        const u = new URL(item.image_url, window.location.origin);
        u.searchParams.set("_cb", String(Date.now()));
        img.src = u.toString();
      });

    // Run with limited concurrency (avoid flooding)
    const concurrency = 6;
    const results = [];
    let idx = 0;

    async function worker() {
      while (idx < list.length) {
        const i = idx++;
        const r = await checkOne(list[i]);
        results[i] = r;
        // stream partial results to UI
        setHealthResults((prev) => {
          const next = prev.slice();
          next[i] = r;
          return next;
        });
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));

    setHealthRunning(false);
  }, [products]);

  return (
    <section className="product-catalogue">
      <div className="product-catalogue-header">
        <div className="product-catalogue-controls">
          <div className="control">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control">
            <label>Brand</label>
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">All</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control control-search">
            <label>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, description…"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="product-catalogue-meta">
          <div className="meta-row">
            <span>
              Browsing{" "}
              <strong>
                {category || "All"} / {brand || "All"}
              </strong>{" "}
              ({totalCount} products found)
            </span>

            {isAdmin && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowHealth(true)}
              >
                Image Health
              </button>
            )}
          </div>

          {/* Telemetry readout (helpful while you validate) */}
          <div className="meta-row telemetry">
            <span>Images: </span>
            <span className="telemetry-pill">Loaded {imgLoaded}</span>
            <span className="telemetry-pill">Errored {imgErrored}</span>
            <span className="telemetry-pill">Pending {imgPending}</span>
          </div>

          {loadError && <div className="error-banner">{loadError}</div>}
        </div>
      </div>

      {/* Grid */}
      <div className="product-grid">
        {loading
          ? Array.from({ length: perPage }).map((_, i) => (
              <SkeletonCard key={`sk-${i}`} />
            ))
          : products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onImgLoad={onImgLoad}
                onImgError={onImgError}
              />
            ))}
      </div>

      {/* Pagination */}
      <div className="product-pagination">
        <button className="btn" disabled={!canPrev || loading} onClick={handlePrev}>
          PREV
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="btn" disabled={!canNext || loading} onClick={handleNext}>
          NEXT
        </button>
      </div>

      {/* Admin: Image Health panel */}
      {showHealth && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Image Health Check (current page)</h3>
              <button className="btn btn-ghost" onClick={() => setShowHealth(false)}>
                Close
              </button>
            </div>

            <div className="modal-body">
              <div className="health-actions">
                <button
                  className="btn btn-secondary"
                  disabled={healthRunning || !products.length}
                  onClick={runImageHealthCheck}
                >
                  {healthRunning ? "Running…" : "Run health check"}
                </button>

                <button
                  className="btn"
                  disabled={!healthResults.length}
                  onClick={() => downloadJson(healthResults, "image-health.json")}
                >
                  Export JSON
                </button>

                <button
                  className="btn"
                  disabled={!imgErrorList.length}
                  onClick={() => downloadJson(imgErrorList, "image-onerror-list.json")}
                >
                  Export onError list
                </button>
              </div>

              <div className="health-summary">
                <strong>Summary:</strong>{" "}
                {healthResults.length
                  ? `${healthResults.filter((r) => r?.ok).length} OK, ${
                      healthResults.filter((r) => r && !r.ok).length
                    } FAIL`
                  : "No results yet."}
              </div>

              <div className="health-table">
                <div className="health-row health-head">
                  <div>SKU</div>
                  <div>Status</div>
                  <div>Reason</div>
                </div>

                {(healthResults.length ? healthResults : products).map((r, idx) => {
                  const item = healthResults[idx] || null;
                  const sku = item?.sku || r?.sku || "";
                  const ok = item?.ok;
                  const reason = item?.reason || "";

                  return (
                    <div key={sku || idx} className="health-row">
                      <div className="mono">{sku}</div>
                      <div>
                        {ok === undefined ? (
                          <span className="pill pill-muted">Not checked</span>
                        ) : ok ? (
                          <span className="pill pill-ok">OK</span>
                        ) : (
                          <span className="pill pill-bad">FAIL</span>
                        )}
                      </div>
                      <div className="muted">{reason}</div>
                    </div>
                  );
                })}
              </div>

              {!!imgErrorList.length && (
                <div className="health-errors">
                  <h4>Runtime onError events (from cards)</h4>
                  <ul>
                    {imgErrorList.map((e) => (
                      <li key={e.sku}>
                        <span className="mono">{e.sku}</span> — {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ProductCard({ product, onImgLoad, onImgError }) {
  const [imgLoading, setImgLoading] = useState(true);

  // IMPORTANT:
  // We do NOT default to placeholder. We always try DB value first.
  // Placeholder is applied only if image truly fails to load (onError).
  const src = isNonEmptyUrl(product?.image_url) ? product.image_url : PLACEHOLDER_SRC;

  return (
    <div className="product-card">
      <div className="product-card-image">
        {/* skeleton overlay */}
        {imgLoading && <div className="image-skeleton" aria-hidden="true" />}

        <img
          src={src}
          alt={product?.name || "Product image"}
          loading="lazy"
          onLoad={() => {
            setImgLoading(false);
            onImgLoad();
          }}
          onError={(e) => {
            setImgLoading(false);
            onImgError(product, e);
          }}
        />
      </div>

      <div className="product-card-body">
        <h4 className="product-title">{product?.name}</h4>
        <div className="product-meta">
          <span className="mono">{product?.sku}</span>
          {typeof product?.price === "number" && (
            <span className="price">£{product.price.toFixed(2)}</span>
          )}
        </div>

        {product?.short_description ? (
          <p className="product-desc">{product.short_description}</p>
        ) : null}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="product-card">
      <div className="product-card-image">
        <div className="image-skeleton" />
      </div>
      <div className="product-card-body">
        <div className="skeleton-line w80" />
        <div className="skeleton-line w50" />
        <div className="skeleton-line w90" />
      </div>
    </div>
  );
}

function downloadJson(obj, filename) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}
