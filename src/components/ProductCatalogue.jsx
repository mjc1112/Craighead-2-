// src/components/ProductCatalogue.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../lib/supabaseClient.js";

const PAGE_SIZE = 16;

export default function ProductCatalogue({ presetCategoryName, onPresetConsumed }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Prevent repeatedly re-applying the same preset on re-renders
  const lastAppliedPresetRef = useRef("");

  // ---------------------------
  // Load categories + products
  // ---------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadCatalogue() {
      setLoading(true);
      setError("");

      try {
        // 1) Categories
        const { data: catData, error: catErr } = await supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true });

        if (catErr) throw catErr;

        // 2) Products
        // Keep the select flexible (if some fields don't exist, Supabase will error),
        // so we choose the most likely fields used in this repo.
        const { data: prodData, error: prodErr } = await supabase
          .from("products")
          .select("id, name, description, image_url, sku, price, category_id, brand_id, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (prodErr) throw prodErr;

        if (!isMounted) return;

        setCategories(Array.isArray(catData) ? catData : []);
        setProducts(Array.isArray(prodData) ? prodData : []);
      } catch (e) {
        if (!isMounted) return;
        console.error("Error loading catalogue:", e);
        setError("Could not load the catalogue at this time.");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    loadCatalogue();
    return () => {
      isMounted = false;
    };
  }, []);

  // -----------------------------------------
  // Apply preset category name (Option C hook)
  // -----------------------------------------
  useEffect(() => {
    if (!presetCategoryName) return;
    if (!categories || categories.length === 0) return;

    // Avoid repeating the same preset
    if (lastAppliedPresetRef.current === presetCategoryName) return;
    lastAppliedPresetRef.current = presetCategoryName;

    const needle = String(presetCategoryName).trim().toLowerCase();

    // Prefer exact match first, then "includes"
    let match =
      categories.find((c) => String(c.name || "").trim().toLowerCase() === needle) ||
      categories.find((c) => String(c.name || "").toLowerCase().includes(needle));

    if (match?.id != null) {
      setSelectedCategory(String(match.id));
      setPage(1);
    }

    // Tell App.jsx we've consumed it so it can clear presetCategoryName
    if (typeof onPresetConsumed === "function") {
      onPresetConsumed();
    }
  }, [presetCategoryName, categories, onPresetConsumed]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchTerm]);

  // ---------------------------
  // Filtering + pagination
  // ---------------------------
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return (products || []).filter((p) => {
      const inCategory =
        selectedCategory === "all" || String(p.category_id) === String(selectedCategory);

      if (!inCategory) return false;

      if (!q) return true;

      const name = String(p.name || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      const desc = String(p.description || "").toLowerCase();

      return name.includes(q) || sku.includes(q) || desc.includes(q);
    });
  }, [products, selectedCategory, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, safePage]);

  // ---------------------------
  // Helpers
  // ---------------------------
  function formatPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    return `£${num.toFixed(2)}`;
  }

  function getImageSrc(p) {
    const url = (p?.image_url || "").trim();
    if (url) return url;

    // Your repo includes: public/images/product-placeholder-dark.jpg
    return "/images/product-placeholder-dark.jpg";
  }

  // ---------------------------
  // Render states
  // ---------------------------
  if (loading) {
    return (
      <section className="cb-section" id="catalogue">
        <div className="cb-section__inner">
          <h2 className="cb-section__title">Product Catalogue</h2>
          <p className="cb-muted">Loading products…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cb-section" id="catalogue">
        <div className="cb-section__inner">
          <h2 className="cb-section__title">Product Catalogue</h2>
          <p className="cb-error">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cb-section" id="catalogue">
      <div className="cb-section__inner">
        <h2 className="cb-section__title">Product Catalogue</h2>

        {/* Filters */}
        <div className="cb-catalogue-filters">
          <div className="cb-filter-group">
            <label className="cb-filter-label" htmlFor="cbCategory">
              Category
            </label>
            <select
              id="cbCategory"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="cb-filter-group cb-filter-group--search">
            <label className="cb-filter-label" htmlFor="cbSearch">
              Search
            </label>
            <input
              id="cbSearch"
              type="search"
              value={searchTerm}
              placeholder="Search by name, SKU or description…"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Results count */}
        <div className="cb-filter-meta">
          <span>
            Showing {pageItems.length} of {filteredProducts.length} products
          </span>
        </div>

        {/* Grid */}
        {filteredProducts.length === 0 ? (
          <div className="cb-empty">
            <p>No products match your filters.</p>
          </div>
        ) : (
          <div className="cb-catalogue-grid">
            {pageItems.map((p) => {
              const imgSrc = getImageSrc(p);
              const price = formatPrice(p.price);

              return (
                <article className="cb-card" key={p.id}>
                  <div className="cb-card__image">
                    <img
                      src={imgSrc}
                      alt={p?.name || "Product"}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/images/product-placeholder-dark.jpg";
                      }}
                    />
                  </div>

                  <div className="cb-card__body">
                    <h3 className="cb-card-title">{p?.name}</h3>

                    {p?.sku ? <div className="cb-card-sku">SKU: {p.sku}</div> : null}

                    {price ? <div className="cb-card-price">{price}</div> : null}

                    {p?.description ? (
                      <p className="cb-card-description">{p.description}</p>
                    ) : null}

                    <div className="cb-card-meta">
                      Category ID: {String(p?.category_id ?? "-")}
                      {p?.brand_id != null ? ` · Brand ID: ${String(p.brand_id)}` : ""}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredProducts.length > PAGE_SIZE ? (
          <div className="cb-pagination">
            <button
              type="button"
              className="cb-pagination-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showDots = prev && p - prev > 1;

                return (
                  <React.Fragment key={p}>
                    {showDots ? <span className="cb-pagination-dots">…</span> : null}
                    <button
                      type="button"
                      className={`cb-pagination-btn ${p === safePage ? "active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              type="button"
              className="cb-pagination-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
