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

  // Prevent re-applying the same preset repeatedly
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
        // Categories: id, name
        const { data: catData, error: catErr } = await supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true });

        if (catErr) throw catErr;

        // Products: ONLY the columns we can see exist in your screenshot
        const { data: prodData, error: prodErr } = await supabase
          .from("products")
          .select("id, category_id, brand_id, name, sku")
          .order("name", { ascending: true });

        if (prodErr) throw prodErr;

        if (!isMounted) return;

        setCategories(Array.isArray(catData) ? catData : []);
        setProducts(Array.isArray(prodData) ? prodData : []);
      } catch (e) {
        console.error("Error loading catalogue:", e);
        if (!isMounted) return;
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

    if (lastAppliedPresetRef.current === presetCategoryName) return;
    lastAppliedPresetRef.current = presetCategoryName;

    const needle = String(presetCategoryName).trim().toLowerCase();

    // Exact match, then includes
    const match =
      categories.find((c) => String(c.name || "").trim().toLowerCase() === needle) ||
      categories.find((c) => String(c.name || "").toLowerCase().includes(needle));

    if (match?.id != null) {
      setSelectedCategory(String(match.id));
      setPage(1);
    }

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

      return name.includes(q) || sku.includes(q);
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
              placeholder="Search by name or SKU…"
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
            {pageItems.map((p) => (
              <article className="cb-card" key={p.id}>
                {/* Placeholder image only (until you add image_url support via products or variants) */}
                <div className="cb-card__image">
                  <img
                    src="/images/product-placeholder-dark.jpg"
                    alt={p?.name || "Product"}
                    loading="lazy"
                  />
                </div>

                <div className="cb-card__body">
                  <h3 className="cb-card-title">{p?.name}</h3>

                  {p?.sku ? <div className="cb-card-sku">SKU: {p.sku}</div> : null}

                  <div className="cb-card-meta">
                    Category ID: {String(p?.category_id ?? "-")}
                    {p?.brand_id != null ? ` · Brand ID: ${String(p.brand_id)}` : ""}
                  </div>
                </div>
              </article>
            ))}
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
