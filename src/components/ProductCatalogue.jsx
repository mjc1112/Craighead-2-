import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/Product-card.css";

/**
 * ProductCatalogue.jsx (clean, defensive, no price fields)
 * - Robust Supabase fetch (no missing columns)
 * - Skeleton loaders
 * - Image telemetry + admin-side health diagnostics
 */

const PAGE_SIZE = 20;

const PLACEHOLDER_SRC = "/images/product-placeholder-dark.jpg";

function safeTrim(v) {
  return typeof v === "string" ? v.trim() : "";
}

function hasRealImage(url) {
  const u = safeTrim(url);
  return u.length > 0 && u !== PLACEHOLDER_SRC;
}

export default function ProductCatalogue() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedBrandId, setSelectedBrandId] = useState("all");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Telemetry
  const [imgLoaded, setImgLoaded] = useState(0);
  const [imgErrored, setImgErrored] = useState(0);
  const [imgPlaceholder, setImgPlaceholder] = useState(0);

  // Admin diagnostics
  const [showHealth, setShowHealth] = useState(false);
  const [brokenImages, setBrokenImages] = useState([]); // { id, sku, name, image_url, reason }

  const lastFetchKeyRef = useRef("");

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  }, [totalCount]);

  // Reset paging when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, selectedBrandId, search]);

  // Load filter lists
  useEffect(() => {
    let mounted = true;

    async function loadFilters() {
      setLoadError("");
      try {
        // categories
        const { data: catData, error: catErr } = await supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true });

        if (catErr) throw catErr;

        // brands
        const { data: brandData, error: brandErr } = await supabase
          .from("brands")
          .select("id, name")
          .order("name", { ascending: true });

        if (brandErr) throw brandErr;

        if (!mounted) return;
        setCategories(Array.isArray(catData) ? catData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
      } catch (e) {
        console.error("Failed loading filters:", e);
        if (!mounted) return;
        setLoadError(e?.message || "Failed to load filters.");
      }
    }

    loadFilters();
    return () => {
      mounted = false;
    };
  }, []);

  // Load products
  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      setLoading(true);
      setLoadError("");

      // reset telemetry per fetch
      setImgLoaded(0);
      setImgErrored(0);
      setImgPlaceholder(0);
      setBrokenImages([]);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Create a fetch key so we don’t apply stale results
      const fetchKey = JSON.stringify({
        selectedCategoryId,
        selectedBrandId,
        search,
        page,
      });
      lastFetchKeyRef.current = fetchKey;

      try {
        let query = supabase
          .from("products")
          .select(
            "id, category_id, brand_id, name, sku, description, image_url",
            { count: "exact" }
          )
          .eq("is_active", true);

        // Filters
        if (selectedCategoryId !== "all") {
          query = query.eq("category_id", Number(selectedCategoryId));
        }
        if (selectedBrandId !== "all") {
          query = query.eq("brand_id", Number(selectedBrandId));
        }

        const s = safeTrim(search);
        if (s.length > 0) {
          // Search across sku + name + description
          // Note: ilike with OR syntax
          const escaped = s.replace(/%/g, "\\%").replace(/_/g, "\\_");
          query = query.or(
            `sku.ilike.%${escaped}%,name.ilike.%${escaped}%,description.ilike.%${escaped}%`
          );
        }

        query = query.order("name", { ascending: true }).range(from, to);

        const { data, error, count } = await query;

        // If another fetch started after this one, ignore this result
        if (lastFetchKeyRef.current !== fetchKey) return;

        if (error) throw error;

        if (!mounted) return;

        const rows = Array.isArray(data) ? data : [];
        setProducts(rows);
        setTotalCount(typeof count === "number" ? count : 0);

        // Debug (remove later if you want)
        const withImage = rows.filter((p) => hasRealImage(p.image_url)).length;
        const sample = rows.find((p) => hasRealImage(p.image_url))?.image_url || null;
        console.log(
          `[ProductCatalogue] fetched=${rows.length}, image_url present=${withImage}, sample=${sample}`
        );
      } catch (e) {
        console.error("Failed loading products:", e);
        if (!mounted) return;
        setProducts([]);
        setTotalCount(0);
        setLoadError(e?.message || "Failed to load products.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      mounted = false;
    };
  }, [selectedCategoryId, selectedBrandId, search, page]);

  function onImgLoad(e) {
    setImgLoaded((v) => v + 1);
  }

  function onImgError(product, e) {
    setImgErrored((v) => v + 1);

    // If the image fails, switch to placeholder
    if (e?.currentTarget && e.currentTarget.src !== window.location.origin + PLACEHOLDER_SRC) {
      e.currentTarget.src = PLACEHOLDER_SRC;
      e.currentTarget.setAttribute("data-fallback-applied", "1");
    }

    // Record as broken for admin health view
    setBrokenImages((prev) => {
      // Avoid duplicates
      if (prev.some((x) => x.id === product.id)) return prev;
      return [
        ...prev,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          image_url: product.image_url,
          reason: "Image request failed (check 403/404 in Network tab).",
        },
      ];
    });
  }

  // After products render, count placeholders (rough)
  useEffect(() => {
    const placeholders = products.filter((p) => !hasRealImage(p.image_url)).length;
    setImgPlaceholder(placeholders);
  }, [products]);

  const browsingLabel = useMemo(() => {
    const catName =
      selectedCategoryId === "all"
        ? "All"
        : categories.find((c) => String(c.id) === String(selectedCategoryId))?.name || "Category";
    const brandName =
      selectedBrandId === "all"
        ? "All"
        : brands.find((b) => String(b.id) === String(selectedBrandId))?.name || "Brand";
    return `${catName} / ${brandName}`;
  }, [selectedCategoryId, selectedBrandId, categories, brands]);

  return (
    <section className="product-catalogue">
      <div className="product-catalogue-header">
        <h2>PRODUCT CATALOGUE</h2>

        <div className="catalogue-controls">
          <div className="control">
            <label>Category</label>
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
          </div>

          <div className="control">
            <label>Brand</label>
            <select value={selectedBrandId} onChange={(e) => setSelectedBrandId(e.target.value)}>
              <option value="all">All</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control search">
            <label>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, description..."
            />
          </div>
        </div>

        <div className="catalogue-meta">
          <div>
            Browsing <strong>{browsingLabel}</strong> ({totalCount} products found)
          </div>

          <div className="catalogue-telemetry">
            Images: Loaded <strong>{imgLoaded}</strong> | Errored{" "}
            <strong>{imgErrored}</strong> | Placeholder <strong>{imgPlaceholder}</strong>
          </div>

          <button
            type="button"
            className="catalogue-admin-toggle"
            onClick={() => setShowHealth((v) => !v)}
          >
            {showHealth ? "Hide" : "Show"} Image Health
          </button>
        </div>

        {loadError ? <div className="catalogue-error">Error: {loadError}</div> : null}
      </div>

      {showHealth ? (
        <div className="catalogue-health">
          <h3>Image Health Checks (Client-side)</h3>
          <p>
            If these URLs fail (403/404), the site will show placeholders. If you see lots of 403s,
            you must host images in your own storage (Supabase Storage/CDN) rather than the vendor
            domain.
          </p>

          <div className="health-summary">
            <div>Total products on page: {products.length}</div>
            <div>Broken images detected: {brokenImages.length}</div>
          </div>

          {brokenImages.length === 0 ? (
            <div className="health-ok">No broken images detected on this page load.</div>
          ) : (
            <div className="health-table">
              <div className="health-row head">
                <div>SKU</div>
                <div>Name</div>
                <div>Image URL</div>
                <div>Reason</div>
              </div>
              {brokenImages.map((x) => (
                <div className="health-row" key={x.id}>
                  <div>{x.sku}</div>
                  <div>{x.name}</div>
                  <div className="url">{x.image_url || "(empty)"}</div>
                  <div>{x.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Grid */}
      <div className="product-grid">
        {loading ? (
          Array.from({ length: PAGE_SIZE }).map((_, idx) => (
            <div className="product-card skeleton" key={idx}>
              <div className="product-card-image skeleton-box" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
            </div>
          ))
        ) : products.length === 0 ? (
          <div className="catalogue-empty">No products match your filters.</div>
        ) : (
          products.map((p) => {
            const imgSrc = hasRealImage(p.image_url) ? p.image_url : PLACEHOLDER_SRC;

            return (
              <div className="product-card" key={p.id}>
                <div className="product-card-image">
                  <img
                    src={imgSrc}
                    alt={p.name || p.sku || "Product image"}
                    loading="lazy"
                    onLoad={onImgLoad}
                    onError={(e) => onImgError(p, e)}
                  />
                </div>

                <div className="product-card-body">
                  <div className="product-title">{p.name}</div>
                  <div className="product-sku">{p.sku}</div>
                  <div className="product-desc">{p.description || ""}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="catalogue-pagination">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          Prev
        </button>

        <div>
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </div>

        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </section>
  );
}
