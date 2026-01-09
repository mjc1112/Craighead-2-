import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/Product-card.css";

const PLACEHOLDER_IMG = "/images/product-placeholder-dark.jpg";

// Small helper: safe string
const s = (v) => (typeof v === "string" ? v : "");

// Debounce hook (minimises input error + reduces API spam)
function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function SkeletonCard() {
  return (
    <div className="product-card" aria-busy="true">
      <div className="product-card-image" style={{ opacity: 0.35 }}>
        <div style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="product-card-body" style={{ padding: 12 }}>
        <div style={{ height: 14, marginBottom: 10, opacity: 0.35 }} />
        <div style={{ height: 10, width: "70%", opacity: 0.25 }} />
      </div>
    </div>
  );
}

export default function ProductCatalogue() {
  // Filters
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [search, setSearch] = useState("");

  // Data
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);

  // UI state
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Telemetry (image loading)
  const [imgAttempted, setImgAttempted] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(0);
  const [imgErrors, setImgErrors] = useState(0);
  const [imgFallback, setImgFallback] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Prevent out-of-order fetch overwrites
  const fetchSeq = useRef(0);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [categoryId, brandId, debouncedSearch]);

  // Load categories + brands (once)
  useEffect(() => {
    let cancelled = false;

    async function loadFilters() {
      setLoadingFilters(true);
      setError("");

      const [catRes, brandRes] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true }),
        supabase
          .from("brands")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;

      if (catRes.error) {
        setError(`Error loading categories: ${catRes.error.message}`);
      } else {
        setCategories(catRes.data || []);
      }

      if (brandRes.error) {
        setError((prev) => prev || `Error loading brands: ${brandRes.error.message}`);
      } else {
        setBrands(brandRes.data || []);
      }

      setLoadingFilters(false);
    }

    loadFilters();

    return () => {
      cancelled = true;
    };
  }, []);

  // Build “human label” for current browsing state
  const browsingLabel = useMemo(() => {
    const catName =
      categoryId === "all"
        ? "All"
        : (categories.find((c) => String(c.id) === String(categoryId))?.name || "Selected");
    const brandName =
      brandId === "all"
        ? "All"
        : (brands.find((b) => String(b.id) === String(brandId))?.name || "Selected");
    return `${catName} / ${brandName}`;
  }, [categoryId, brandId, categories, brands]);

  // Load products (on filters + page)
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      const seq = ++fetchSeq.current;

      setLoadingProducts(true);
      setError("");

      // Reset image telemetry per fetch
      setImgAttempted(0);
      setImgLoaded(0);
      setImgErrors(0);
      setImgFallback(0);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // IMPORTANT: schema-aligned select (NO price)
      let query = supabase
        .from("products")
        .select("id, category_id, brand_id, name, sku, description, image_url, is_active", {
          count: "exact",
        })
        .eq("is_active", true)
        .order("name", { ascending: true })
        .range(from, to);

      if (categoryId !== "all") query = query.eq("category_id", Number(categoryId));
      if (brandId !== "all") query = query.eq("brand_id", Number(brandId));

      const term = s(debouncedSearch).trim();
      if (term) {
        // Supabase OR syntax. Search across name, sku, description
        const safe = term.replace(/[,]/g, " "); // minimise input errors with commas
        query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,description.ilike.%${safe}%`);
      }

      const res = await query;

      // Ignore stale responses
      if (cancelled || seq !== fetchSeq.current) return;

      if (res.error) {
        setProducts([]);
        setTotalCount(0);
        setError(`Error loading products: ${res.error.message}`);
        setLoadingProducts(false);
        return;
      }

      const rows = res.data || [];
      setProducts(rows);
      setTotalCount(res.count || 0);

      // Telemetry: how many have image_url present
      const present = rows.filter((p) => s(p.image_url).trim().length > 0).length;
      // Helpful console proof (what you were trying to get to)
      console.log(
        `[ProductCatalogue] fetched=${rows.length}, image_url present=${present}, sample=${
          rows.find((p) => s(p.image_url).trim())?.image_url || null
        }`
      );

      setLoadingProducts(false);
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [categoryId, brandId, debouncedSearch, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  function handleImgLoad() {
    setImgLoaded((v) => v + 1);
  }

  function handleImgError(e) {
    setImgErrors((v) => v + 1);
    const img = e?.currentTarget;
    if (!img) return;

    // Prevent infinite loop
    if (img.dataset.fallbackApplied === "1") return;

    img.dataset.fallbackApplied = "1";
    img.src = PLACEHOLDER_IMG;
    setImgFallback((v) => v + 1);
  }

  return (
    <section className="cb-section" id="catalogue">
      <h2 className="cb-title">Product Catalogue</h2>

      {/* Filters */}
      <div className="cb-filters" style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 2fr" }}>
        <label className="cb-filter">
          <div>Category</div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={loadingFilters}
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="cb-filter">
          <div>Brand</div>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={loadingFilters}>
            <option value="all">All</option>
            {brands.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="cb-filter cb-filter-search">
          <div>Search</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, description..."
            inputMode="search"
            autoComplete="off"
          />
        </label>
      </div>

      {/* Meta */}
      <div className="cb-meta" style={{ marginTop: 10, opacity: 0.9 }}>
        <div>Browsing {browsingLabel} ({totalCount} products found)</div>
        {s(debouncedSearch).trim() ? (
          <div style={{ opacity: 0.8 }}>Search term: “{s(debouncedSearch).trim()}”</div>
        ) : null}
      </div>

      {/* Errors */}
      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #333", borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      {/* Grid */}
      <div className="cb-grid" style={{ marginTop: 14 }}>
        {loadingProducts ? (
          <>
            {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </>
        ) : products.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>
            No products matched your filters/search.
          </div>
        ) : (
          products.map((p) => {
            const url = s(p.image_url).trim();
            const src = url || PLACEHOLDER_IMG;

            return (
              <div className="product-card" key={p.id}>
                <div className="product-card-image">
                  <img
                    src={src}
                    alt={s(p.name) || s(p.sku) || "Product image"}
                    loading="lazy"
                    onLoad={() => {
                      setImgAttempted((v) => v + 1);
                      handleImgLoad();
                    }}
                    onError={(e) => {
                      setImgAttempted((v) => v + 1);
                      handleImgError(e);
                    }}
                  />
                </div>

                <div className="product-card-body" style={{ padding: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {s(p.name) || "Unnamed product"}
                  </div>

                  <div style={{ opacity: 0.85, fontSize: 12, marginBottom: 6 }}>
                    <strong>SKU:</strong> {s(p.sku) || "—"}
                  </div>

                  {s(p.description).trim() ? (
                    <div style={{ opacity: 0.8, fontSize: 12, lineHeight: 1.35 }}>
                      {s(p.description).trim()}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="cb-pagination" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev || loadingProducts}>
          Prev
        </button>
        <div style={{ opacity: 0.9 }}>
          Page {page} of {totalPages}
        </div>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!canNext || loadingProducts}>
          Next
        </button>
      </div>

      {/* Telemetry */}
      <div className="cb-telemetry" style={{ marginTop: 10, opacity: 0.85, fontSize: 12 }}>
        Images: Attempted {imgAttempted} / Loaded {imgLoaded} / Errors {imgErrors} / Fallback {imgFallback}
      </div>
    </section>
  );
}
