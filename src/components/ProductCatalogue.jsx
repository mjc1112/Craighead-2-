// src/components/ProductCatalogue.jsx
import React, { useEffect, useState, useMemo } from "react";
import supabase from "../lib/supabaseClient";

const PAGE_SIZE = 24; // products per page

export default function ProductCatalogue() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // --- LOAD DATA FROM SUPABASE ---
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // 1) Categories
        const { data: categoryData, error: categoryError } = await supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true });

        if (categoryError) throw categoryError;
        setCategories(categoryData || []);

        // 2) Products
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select(
            "id, name, description, sku, image_url, category_id, brand_id, is_active"
          )
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (productError) throw productError;
        setProducts(productData || []);
      } catch (err) {
        console.error("Error loading catalogue:", err);
        setError("We couldn’t load the catalogue at this time.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchTerm]);

  // --- FILTER + SEARCH ---
  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (selectedCategory !== "all") {
      const categoryId = Number(selectedCategory);
      list = list.filter((p) => p.category_id === categoryId);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((p) => {
        return (
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [products, selectedCategory, searchTerm]);

  // --- PAGINATION ---
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSliceStart = (safePage - 1) * PAGE_SIZE;
  const pageSliceEnd = pageSliceStart + PAGE_SIZE;
  const pageProducts = filteredProducts.slice(pageSliceStart, pageSliceEnd);

  // --- RENDER STATES ---
  if (loading) {
    return (
      <section className="cb-section" aria-busy="true">
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

  if (!filteredProducts.length) {
    return (
      <section className="cb-section">
        <h2 className="cb-mission_title">Product Catalogue</h2>
        <p>No products matched your filters.</p>
      </section>
    );
  }

  // --- UI ---
  return (
    <section className="cb-section" id="catalogue">
      <div className="cb-section_inner">
        <h2 className="cb-mission_title">Product Catalogue</h2>

        {/* Filter + search bar */}
        <div className="cb-catalogue-filters">
          {/* Category selector */}
          <label className="cb-filter">
            <span>Category</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All product types</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Search */}
          <label className="cb-filter cb-filter--grow">
            <span>Search</span>
            <input
              type="search"
              placeholder="Search by name, SKU or description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>

          {/* Results count */}
          <div className="cb-filter cb-filter--meta">
            <span>
              Showing {pageProducts.length} of {filteredProducts.length}{" "}
              products
            </span>
          </div>
        </div>

        {/* Product grid */}
        <div className="cb-category-grid cb-catalogue-grid">
          {pageProducts.map((p) => {
            // Image handling: use DB image if present, otherwise a placeholder
            const imageSrc =
              p.image_url && p.image_url.trim().length > 0
                ? p.image_url
                : "/images/product-placeholder.jpg"; // <- add this file under /public/images

            return (
              <article
                key={p.id}
                className="cb-card cb-card--product"
                aria-label={p.name}
              >
                <div className="cb-card_image">
                  <img src={imageSrc} alt={p.name} loading="lazy" />
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
                    Category ID: {p.category_id} • Brand ID: {p.brand_id}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="cb-pagination">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                type="button"
                className={pNum === safePage ? "is-active" : ""}
                onClick={() => setPage(pNum)}
              >
                {pNum}
              </button>
            ))}

            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
