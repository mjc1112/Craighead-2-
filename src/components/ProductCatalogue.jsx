// src/components/ProductCatalogue.jsx
import React, { useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";

export default function ProductCatalogue() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 24;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch products + categories in parallel
        const [{ data: productData, error: productError }, { data: categoryData, error: categoryError }] =
          await Promise.all([
            supabase
              .from("products")
              .select("id, name, description, sku, image_url, category_id, brand_id, is_active")
              .eq("is_active", true)
              .order("name", { ascending: true }),
            supabase
              .from("categories")
              .select("id, name")
              .order("name", { ascending: true }),
          ]);

        if (productError) throw productError;
        if (categoryError) throw categoryError;

        setProducts(productData ?? []);
        setCategories(categoryData ?? []);
      } catch (err) {
        console.error("Error loading catalogue:", err);
        setError("We couldn’t load the catalogue at this time.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Reset page if filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, search]);

  const categoryLookup = categories.reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  // Text search helper
  const matchesSearch = (p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  };

  // Apply filters
  const filtered = products.filter((p) => {
    const categoryOk = selectedCategory === "all" || p.category_id === selectedCategory;
    return categoryOk && matchesSearch(p);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  if (loading) {
    return (
      <section className="cb-section">
        <p>Loading products…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cb-section">
        <p>{error}</p>
      </section>
    );
  }

  if (!filtered.length) {
    return (
      <section className="cb-section">
        <h2 className="cb-mission_title">Product Catalogue</h2>
        <p>No products found for your filters.</p>
      </section>
    );
  }

  return (
    <section className="cb-section">
      <h2 className="cb-mission_title">Product Catalogue</h2>

      {/* Controls */}
      <div className="cb-catalogue-controls">
        <label>
          Category:
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Search:
          <input
            type="search"
            placeholder="Name, SKU or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="cb-catalogue-count">
          Showing {filtered.length} product{filtered.length !== 1 ? "s" : ""}{" "}
          {totalPages > 1 && `(page ${page} of ${totalPages})`}
        </div>
      </div>

      {/* Grid */}
      <div className="cb-category-grid cb-catalogue-grid">
        {pageItems.map((p) => (
          <article key={p.id} className="cb-card cb-card--product">
            <div className="cb-card_image">
              <img
                src={
                  p.image_url ||
                  "https://via.placeholder.com/400x300.png?text=Craighead+Product"
                }
                alt={p.name}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://via.placeholder.com/400x300.png?text=Craighead+Product";
                }}
              />
            </div>

            <div className="cb-card_body">
              <h3 className="cb-card_title">{p.name}</h3>
              {p.sku && (
                <p className="cb-card_sku">
                  <strong>SKU:</strong> {p.sku}
                </p>
              )}
              {p.description && (
                <p className="cb-card_description">{p.description}</p>
              )}
              <p className="cb-card_meta">
                {p.brand_id && <>Brand ID: {p.brand_id} · </>}
                {p.category_id && (
                  <>
                    Category:{" "}
                    {categoryLookup[p.category_id] || `ID ${p.category_id}`}
                  </>
                )}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="cb-pagination">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹ Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next ›
          </button>
        </div>
      )}
    </section>
  );
}
