// src/components/ProductCatalogue.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust if your path differs
import "../styles/Product-card.css"; // your existing product-card image CSS (safe to keep)

/**
 * ProductCatalogue (NO PRICING)
 * - Queries: public.products (id, sku, name, description, image_url, brand_id, category_id, is_active)
 * - Filters: Category, Brand, Search
 * - Pagination: safe range() usage + exact count
 * - Robust: handles schema mismatches, empty results, network failures, stale requests
 */

const PAGE_SIZE = 24;
const PLACEHOLDER_IMG = "/images/product-placeholder-dark.jpg";

function safeTrim(v) {
  return (v ?? "").toString().trim();
}

function buildOrFilter(search) {
  const q = safeTrim(search);
  if (!q) return null;

  // Escape commas for Supabase "or" filter (defensive)
  const esc = q.replaceAll(",", "\\,");
  const like = `%${esc}%`;

  // Search name / sku / description
  return `name.ilike.${like},sku.ilike.${like},description.ilike.${like}`;
}

export default function ProductCatalogue() {
  // Filters
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [search, setSearch] = useState("");

  // Data lists
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Products
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // UI state
  const [page, setPage] = useState(1);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState(null);

  // Telemetry (optional, but harmless)
  const [imageTelemetry, setImageTelemetry] = useState({
    attempted: 0,
    loaded: 0,
    errored: 0,
    fallbackApplied: 0,
  });

  // Prevent stale responses overwriting state
  const requestSeq = useRef(0);

  const totalPages = useMemo(() => {
    const pages = Math.ceil((totalCount || 0) / PAGE_SIZE);
    return pages > 0 ? pages : 1;
  }, [totalCount]);

  // If filters/search change, reset page to 1
  useEffect(() => {
    setPage(1);
  }, [categoryId, brandId, search]);

  // Load Categories + Brands
  useEffect(() => {
    let alive = true;

    async function loadLists() {
      setLoadingLists(true);
      setError(null);

      try {
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

        if (!alive) return;

        if (catRes.error) throw catRes.error;
        if (brandRes.error) throw brandRes.error;

        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        setBrands(Array.isArray(brandRes.data) ? brandRes.data : []);
      } catch (e) {
        if (!alive) return;
        setError({
          title: "Failed to load catalogue lists",
          detail: e?.message || String(e),
        });
      } finally {
        if (alive) setLoadingLists(false);
      }
    }

    loadLists();
    return () => {
      alive = false;
    };
  }, []);

  // Load Products (NO PRICE FIELDS)
  useEffect(() => {
    let alive = true;
    const seq = ++requestSeq.current;

    async function loadProducts() {
      setLoadingProducts(true);
      setError(null);

      try {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // Base select: ONLY columns that exist per your confirmed schema
        let q = supabase
          .from("products")
          .select(
            "id, sku, name, description, image_url, brand_id, category_id, is_active",
            { count: "exact" }
          )
          .eq("is_active", true)
          .order("name", { ascending: true })
          .range(from, to);

        if (categoryId !== "all") q = q.eq("category_id", Number(categoryId));
        if (brandId !== "all") q = q.eq("brand_id", Number(brandId));

        const orFilter = buildOrFilter(search);
        if (orFilter) q = q.or(orFilter);

        const res = await q;

        // Ignore stale responses
        if (!alive || seq !== requestSeq.current) return;

        if (res.error) throw res.error;

        const rows = Array.isArray(res.data) ? res.data : [];
        setProducts(rows);
        setTotalCount(typeof res.count === "number" ? res.count : rows.length);
      } catch (e) {
        if (!alive || seq !== requestSeq.current) return;

        setProducts([]);
        setTotalCount(0);

        setError({
          title: "Failed to load products",
          detail: e?.message || String(e),
        });
      } finally {
        if (alive && seq === requestSeq.current) setLoadingProducts(false);
      }
    }

    loadProducts();
    return () => {
      alive = false;
    };
  }, [page, categoryId, brandId, search]);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function resolveImageUrl(product) {
    const url = safeTrim(product?.image_url);
    return url || PLACEHOLDER_IMG;
  }

  function handleImgLoad() {
    setImageTelemetry((t) => ({
      ...t,
      loaded: t.loaded + 1,
    }));
  }

  function handleImgError(e) {
    const img = e?.currentTarget;
    if (!img) return;

    // Apply fallback once only
    const already = img.dataset.fallbackApplied === "1";
    setImageTelemetry((t) => ({
      ...t,
      errored: t.errored + 1,
      fallbackApplied: t.fallbackApplied + (already ? 0 : 1),
    }));

    if (!already) {
      img.dataset.fallbackApplied = "1";
      img.src = PLACEHOLDER_IMG;
    }
  }

  // Track "attempted" image loads per render (best-effort)
  useEffect(() => {
    if (!loadingProducts) {
      setImageTelemetry((t) => ({
        ...t,
        attempted: products.length,
      }));
    }
  }, [loadingProducts, products.length]);

  return (
    <section className="cb-section">
      <div className="cb-catalogue-header">
        <h2 className="cb-title">Product Catalogue</h2>

        <div className="cb-filters">
          <label className="cb-filter">
            <span>Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={loadingLists}
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
            <span>Brand</span>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              disabled={loadingLists}
            >
              <option value="all">All</option>
              {brands.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="cb-filter cb-filter-search">
            <span>Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, description…"
            />
          </label>
        </div>

        <div className="cb-meta">
          <span>
            Browsing{" "}
            <strong>
              {categoryId === "all"
                ? "All"
                : categories.find((c) => String(c.id) === String(categoryId))
                    ?.name || "Category"}{" "}
              /{" "}
              {brandId === "all"
                ? "All"
                : brands.find((b) => String(b.id) === String(brandId))?.name ||
                  "Brand"}
            </strong>{" "}
            ({totalCount} products)
          </span>
        </div>

        {error && (
          <div className="cb-error">
            <strong>{error.title}</strong>
            <div>{error.detail}</div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="cb-grid">
        {loadingProducts
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="product-card cb-skeleton-card">
                <div className="product-card-image cb-skeleton" />
                <div className="cb-skeleton-lines">
                  <div className="cb-skeleton line" />
                  <div className="cb-skeleton line short" />
                </div>
              </div>
            ))
          : products.map((p) => (
              <article key={p.id} className="product-card">
                <div className="product-card-image">
                  <img
                    src={resolveImageUrl(p)}
                    alt={p?.name || "Product image"}
                    loading="lazy"
                    onLoad={handleImgLoad}
                    onError={handleImgError}
                  />
                </div>

                <div className="product-card-body">
                  <h3 className="product-card-title">{p?.name}</h3>

                  <div className="product-card-sku">
                    <strong>SKU:</strong> {p?.sku || "-"}
                  </div>

                  {safeTrim(p?.description) ? (
                    <p className="product-card-desc">{p.description}</p>
                  ) : null}
                </div>
              </article>
            ))}

        {!loadingProducts && !error && products.length === 0 && (
          <div className="cb-empty">
            No products matched your filters/search.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="cb-pagination">
        <button onClick={goPrev} disabled={page <= 1 || loadingProducts}>
          Prev
        </button>

        <span>
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </span>

        <button
          onClick={goNext}
          disabled={page >= totalPages || loadingProducts}
        >
          Next
        </button>
      </div>

      {/* Optional telemetry block (safe, can remove later) */}
      <div className="cb-telemetry">
        Images: Attempted {imageTelemetry.attempted} / Loaded{" "}
        {imageTelemetry.loaded} / Errors {imageTelemetry.errored} / Fallback{" "}
        {imageTelemetry.fallbackApplied}
      </div>
    </section>
  );
}

/**
 * Minimal CSS expectations:
 * - You already have .product-card-image and .product-card-image img in Product-card.css
 * - If you do not have the cb-* classes, add them to your main stylesheet,
 *   or remove the cb-* wrappers and keep only product-card classes.
 */
