// src/components/ProductCatalogue.jsx
import React, { useEffect, useMemo, useState } from "react";
import supabase from "../lib/supabaseClient";

const PAGE_SIZE = 36; // products per page

export default function ProductCatalogue() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // --------------------------------------------------
  // Load products + categories from Supabase
  // --------------------------------------------------
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [
          { data: productData, error: productError },
          { data: categoryData, error: categoryError },
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id, name, description, sku, image_url, category_id, brand_id, is_active"
            )
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, searchTerm]);

  // --------------------------------------------------
  // Filtering + search
  // --------------------------------------------------
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Filter by category
    if (selectedCategoryId !== "all") {
      const idNum = Number(selectedCategoryId);
      list = list.filter((p) => p.category_id === idNum);
    }

    // Text search (name, SKU, description)
    const term = searchTerm.trim().toLowerCase();
    if (term.length > 0) {
      list = list.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const desc = (p.description || "").toLowerCase();
        return (
          name.includes(term) || sku.includes(term) || desc.includes(term)
        );
      });
    }

    return list;
  }, [products, selectedCategoryId, searchTerm]);

  // --------------------------------------------------
  // Pagination
  // --------------------------------------------------
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageProducts = filteredProducts.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const handlePrevPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  // --------------------------------------------------
  // Render states
  // --------------------------------------------------
  if (loading) {
    return (
      <section className="cb-section" aria-label="Product catalogue loading">
        <div className="cb-section_inner">
          <p>Loading products…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cb-section" aria-label="Product catalogue error">
        <div className="cb-section_inner">
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!products.length) {
    return (
      <section className="cb-section" aria-label="Empty product catalogue">
        <div className="cb-section_inner">
          <h2 className="cb-mission_title">Product Catalogue</h2>
          <p>No products are available in the catalogue yet.</p>
        </div>
      </section>
    );
  }

  // --------------------------------------------------
  // Main render
  // --------------------------------------------------
  return (
    <section className="cb-section" aria-label="Product catalogue">
      <div className="cb-section_inner">
        <h2 className="cb-mission_title">Product Catalogue</h2>

        {/* Filters */}
        <div className="cb-catalogue-filters">
          {/* Category filter */}
          <label className="cb-filter cb-filter--select">
            <span className="cb-filter_label">Category</span>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>

          {/* Search */}
          <label className="cb-filter cb-filter--search">
            <span className="cb-filter_label">Search</span>
            <input
              type="search"
              placeholder="Search by name, SKU or description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>

          {/* Count */}
          <div className="cb-filter cb-filter--count">
            {filteredProducts.length} product
            {filteredProducts.length === 1 ? "" : "s"} found
          </div>
        </div>

        {/* Results grid */}
        {filteredProducts.length === 0 ? (
          <div className="cb-catalogue-empty">
            <p>No products match your filters.</p>
          </div>
        ) : (
          <>
            <div className="cb-category-grid cb-catalogue-grid">
              {pageProducts.map((p) => {
                const hasImage =
                  p.image_url && p.image_url.trim().length > 0;

                const imgSrc = hasImage
                  ? p.image_url
                  : "/images/product-placeholder-dark.jpg";

                return (
                  <article
                    key={p.id}
                    className="cb-card cb-card--product cb-card--catalogue"
                  >
                    <div className="cb-card_image">
                      <img
                        src={imgSrc}
                        alt={p.name || "Craighead product"}
                        loading="lazy"
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
                        <p className="cb-card_description">
                          {p.description}
                        </p>
                      )}

                      <p className="cb-card_meta">
                        Category ID: {p.category_id}
                        {p.brand_id && <> · Brand ID: {p.brand_id}</>}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="cb-pagination">
                <button
                  type="button"
                  className="cb-pagination_btn"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                <span className="cb-pagination_status">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  className="cb-pagination_btn"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
