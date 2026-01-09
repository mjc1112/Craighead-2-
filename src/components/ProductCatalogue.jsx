import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust if your path differs

const PLACEHOLDER_IMG = "/images/product-placeholder-dark.jpg";

const PAGE_SIZE = 20;

function safeTrim(v) {
  return (v ?? "").toString().trim();
}

function isBlank(v) {
  return safeTrim(v).length === 0;
}

/**
 * Normalises the record into a stable shape for rendering.
 */
function normaliseProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category_id: row.category_id,
    brand_id: row.brand_id,
    image_url: row.image_url,
  };
}

export default function ProductCatalogue() {
  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState("all"); // category_id or "all"
  const [selectedBrandId, setSelectedBrandId] = useState("all"); // brand_id or "all"
  const [searchTerm, setSearchTerm] = useState("");

  // Data sources for dropdowns
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Products
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Image telemetry
  const [imgAttempted, setImgAttempted] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(0);
  const [imgErrors, setImgErrors] = useState(0);
  const [imgFallback, setImgFallback] = useState(0);

  // Prevent stale fetches from overwriting newer results
  const fetchSeq = useRef(0);

  // Reset paging when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, selectedBrandId, searchTerm]);

  // Load categories/brands once
  useEffect(() => {
    (async () => {
      try {
        const [{ data: catData, error: catErr }, { data: brandData, error: brandErr }] =
          await Promise.all([
            supabase
              .from("categories")
              .select("id,name,slug,parent_id")
              .order("name", { ascending: true }),
            supabase
              .from("brands")
              .select("id,name")
              .order("name", { ascending: true }),
          ]);

        if (catErr) throw catErr;
        if (brandErr) throw brandErr;

        setCategories(Array.isArray(catData) ? catData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
      } catch (e) {
        console.error(e);
        // Keep the catalogue functional even if dropdown data fails
      }
    })();
  }, []);

  // Fetch products whenever filters/page change
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg("");

      // reset telemetry each fetch cycle
      setImgAttempted(0);
      setImgLoaded(0);
      setImgErrors(0);
      setImgFallback(0);

      const seq = ++fetchSeq.current;

      try {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let q = supabase
          .from("products")
          .select("id,sku,name,description,category_id,brand_id,image_url", { count: "exact" })
          .eq("is_active", true);

        // Category filter (assumes products.category_id is the direct category)
        if (selectedCategoryId !== "all") {
          q = q.eq("category_id", Number(selectedCategoryId));
        }

        // Brand filter (assumes products.brand_id exists)
        if (selectedBrandId !== "all") {
          q = q.eq("brand_id", Number(selectedBrandId));
        }

        // Search filter: name OR sku OR description (simple and robust)
        const s = safeTrim(searchTerm);
        if (s.length > 0) {
          // Escape % and _ which are wildcards in ilike
          const esc = s.replaceAll("%", "\\%").replaceAll("_", "\\_");
          q = q.or(
            `name.ilike.%${esc}%,sku.ilike.%${esc}%,description.ilike.%${esc}%`
          );
        }

        // Stable ordering for pagination
        q = q.order("name", { ascending: true }).range(from, to);

        const { data, error, count } = await q;
        if (error) throw error;

        // ignore stale responses
        if (fetchSeq.current !== seq) return;

        const normalised = (Array.isArray(data) ? data : []).map(normaliseProduct);
        setProducts(normalised);
        setTotalCount(Number.isFinite(count) ? count : 0);

        // Helpful debug line (matches what you were checking)
        const imageUrlPresent = normalised.filter((p) => !isBlank(p.image_url)).length;
        console.log(
          "[ProductCatalogue] fetched=%d, image_url present=%d, sample=%o",
          normalised.length,
          imageUrlPresent,
          normalised[0] ?? null
        );
      } catch (e) {
        console.error(e);
        if (fetchSeq.current !== seq) return;
        setProducts([]);
        setTotalCount(0);
        setErrorMsg("Unable to load products at this time.");
      } finally {
        if (fetchSeq.current === seq) setLoading(false);
      }
    })();
  }, [page, selectedCategoryId, selectedBrandId, searchTerm]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  }, [totalCount]);

  const browsingText = useMemo(() => {
    const catName =
      selectedCategoryId === "all"
        ? "All"
        : categories.find((c) => String(c.id) === String(selectedCategoryId))?.name || "Category";
    const brandName =
      selectedBrandId === "all"
        ? "All"
        : brands.find((b) => String(b.id) === String(selectedBrandId))?.name || "Brand";

    return `Browsing ${catName} / ${brandName} (${totalCount} products)`;
  }, [selectedCategoryId, selectedBrandId, categories, brands, totalCount]);

  function handlePrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function handleNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  return (
    <section className="cb-section" id="catalogue">
      <div className="cb-section__inner">
        <h2 className="cb-title">Product Catalogue</h2>

        <div className="cb-filters">
          <label className="cb-filter">
            <span>Category</span>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="all">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="cb-filter">
            <span>Brand</span>
            <select value={selectedBrandId} onChange={(e) => setSelectedBrandId(e.target.value)}>
              <option value="all">All</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="cb-filter cb-filter--search">
            <span>Search</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, SKU, description"
            />
          </label>
        </div>

        <div className="cb-browsing">{browsingText}</div>

        <div className="cb-pagination">
          <button type="button" onClick={handlePrev} disabled={page <= 1 || loading}>
            Prev
          </button>
          <div>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </div>
          <button type="button" onClick={handleNext} disabled={page >= totalPages || loading}>
            Next
          </button>
        </div>

        <div className="cb-telemetry">
          Images: Attempted {imgAttempted} / Loaded {imgLoaded} / Errors {imgErrors} / Fallback{" "}
          {imgFallback}
        </div>

        {errorMsg && <div className="cb-error">{errorMsg}</div>}
        {loading && <div className="cb-loading">Loading…</div>}

        {!loading && !errorMsg && products.length === 0 && (
          <div className="cb-empty">No products matched your filters/search.</div>
        )}

        <div className="cb-product-grid">
          {products.map((p) => (
            <article key={p.id} className="product-card">
              <div className="product-card-image">
                <ProductImage
                  src={isBlank(p.image_url) ? "" : p.image_url}
                  alt={p.name}
                  onAttempt={() => setImgAttempted((x) => x + 1)}
                  onLoad={() => setImgLoaded((x) => x + 1)}
                  onError={() => setImgErrors((x) => x + 1)}
                  onFallback={() => setImgFallback((x) => x + 1)}
                />
              </div>

              <div className="product-card-body">
                <h3 className="product-card-title">{p.name}</h3>
                <div className="product-card-sku">
                  <strong>SKU:</strong> {p.sku}
                </div>
                {p.description && <p className="product-card-desc">{p.description}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Inline CSS ensures placeholder sizing is fixed even if global CSS is lagging behind */}
      <style>{`
        .cb-product-grid{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:18px;
          margin-top:14px;
        }
        @media (max-width: 1200px){
          .cb-product-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); }
        }
        @media (max-width: 900px){
          .cb-product-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
        @media (max-width: 560px){
          .cb-product-grid{ grid-template-columns:repeat(1,minmax(0,1fr)); }
        }

        .product-card{
          border-radius:14px;
          overflow:hidden;
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.06);
        }

        /* KEY FIX: consistent image box prevents giant placeholders */
        .product-card-image{
          width:100%;
          aspect-ratio: 4 / 3;
          background:rgba(0,0,0,0.35);
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .product-card-image img{
          width:100%;
          height:100%;
          display:block;
          object-fit:contain; /* keeps logos/placeholder tidy */
        }

        .product-card-body{ padding:14px; }
        .product-card-title{
          margin:0 0 8px 0;
          font-size:16px;
          line-height:1.2;
        }
        .product-card-sku{
          font-size:13px;
          opacity:0.9;
          margin-bottom:10px;
        }
        .product-card-desc{
          margin:0;
          font-size:13px;
          opacity:0.85;
        }
      `}</style>
    </section>
  );
}

function ProductImage({ src, alt, onAttempt, onLoad, onError, onFallback }) {
  const [currentSrc, setCurrentSrc] = useState(src || PLACEHOLDER_IMG);
  const [didFallback, setDidFallback] = useState(false);

  useEffect(() => {
    // Reset when a new product renders
    const next = src && src.trim().length > 0 ? src : PLACEHOLDER_IMG;
    setCurrentSrc(next);
    setDidFallback(next === PLACEHOLDER_IMG);
  }, [src]);

  useEffect(() => {
    onAttempt?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      style={{ opacity: 1, transition: "opacity 180ms" }}
      onLoad={() => {
        onLoad?.();
        if (didFallback) onFallback?.();
      }}
      onError={() => {
        onError?.();
        if (!didFallback) {
          setDidFallback(true);
          setCurrentSrc(PLACEHOLDER_IMG);
        }
      }}
    />
  );
}
