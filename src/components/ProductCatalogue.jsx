// src/components/ProductCatalogue.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../lib/supabaseClient.js";

const FALLBACK_IMG = "/images/product-placeholder-dark.jpg";
const PAGE_SIZE = 20;

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export default function ProductCatalogue({ presetCategoryName, onPresetConsumed }) {
  // Master data
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Product list
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState("all"); // "all" | number
  const [selectedBrandId, setSelectedBrandId] = useState("all"); // "all" | number
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name_asc"); // name_asc | name_desc | newest

  // Pagination
  const [page, setPage] = useState(1);

  const appliedPresetRef = useRef(false);

  // Build quick lookup maps
  const categoryById = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const brandById = useMemo(() => {
    const m = new Map();
    brands.forEach((b) => m.set(b.id, b));
    return m;
  }, [brands]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  }, [totalCount]);

  // Fetch categories + brands once
  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      setError("");
      try {
        const [{ data: catData, error: catErr }, { data: brandData, error: brandErr }] =
          await Promise.all([
            supabase.from("categories").select("id, name, slug").order("id", { ascending: true }),
            supabase.from("brands").select("id, name").order("name", { ascending: true }),
          ]);

        if (catErr) throw catErr;
        if (brandErr) throw brandErr;

        if (!cancelled) {
          setCategories(catData || []);
          setBrands(brandData || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to load catalogue lookups.");
        }
      }
    }

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply preset category (prop first, then localStorage fallback)
  useEffect(() => {
    if (!categories.length) return;
    if (appliedPresetRef.current) return;

    const propPreset = presetCategoryName && String(presetCategoryName).trim();
    const storedPreset = (() => {
      try {
        return localStorage.getItem("cb_category_name") || "";
      } catch {
        return "";
      }
    })();

    const incoming = propPreset || storedPreset;
    if (!incoming) return;

    const incomingKey = normalizeKey(incoming);

    const match = categories.find((c) => normalizeKey(c.name) === incomingKey);
    if (match) {
      appliedPresetRef.current = true;
      setSelectedCategoryId(match.id);
      setPage(1);

      // If this came from localStorage, clear it so it doesn't keep forcing filters
      if (!propPreset) {
        try {
          localStorage.removeItem("cb_category_name");
        } catch {
          // ignore
        }
      }

      // Notify parent (optional) that we consumed the preset
      if (typeof onPresetConsumed === "function") {
        onPresetConsumed();
      }
    }
  }, [categories, presetCategoryName, onPresetConsumed]);

  // Fetch products whenever filters/sort/page changes
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      setError("");

      try {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let q = supabase
          .from("products")
          .select(
            "id, category_id, brand_id, name, sku, description, image_url, is_active",
            { count: "exact" }
          )
          .eq("is_active", true);

        // Category filter
        if (selectedCategoryId !== "all") {
          q = q.eq("category_id", Number(selectedCategoryId));
        }

        // Brand filter
        if (selectedBrandId !== "all") {
          q = q.eq("brand_id", Number(selectedBrandId));
        }

        // Search (name or sku)
        const trimmed = query.trim();
        if (trimmed) {
          // Supabase OR syntax: or("col.ilike.%x%,other.ilike.%x%")
          const safe = trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
          q = q.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`);
        }

        // Sorting
        if (sort === "name_desc") q = q.order("name", { ascending: false });
        else if (sort === "newest") q = q.order("id", { ascending: false });
        else q = q.order("name", { ascending: true });

        // Pagination
        q = q.range(from, to);

        const { data, error: dbErr, count } = await q;
        if (dbErr) throw dbErr;

        if (!cancelled) {
          setProducts(data || []);
          setTotalCount(count || 0);
        }
      } catch (e) {
        if (!cancelled) {
          setProducts([]);
          setTotalCount(0);
          setError(e?.message || "Failed to load products.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [page, query, selectedCategoryId, selectedBrandId, sort]);

  // Keep page within bounds if filters reduce results
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const activeCategory = selectedCategoryId === "all" ? null : categoryById.get(Number(selectedCategoryId));
  const activeBrand = selectedBrandId === "all" ? null : brandById.get(Number(selectedBrandId));

  return (
    <div className="cb-catalogue">
      <div className="cb-section__inner">
        <div className="cb-catalogue__header">
          <h2 className="cb-catalogue__title">Product Catalogue</h2>

          <div className="cb-catalogue__meta">
            {loading ? (
              <span>Loading…</span>
            ) : (
              <span>
                {totalCount.toLocaleString()} product{totalCount === 1 ? "" : "s"} found
                {activeCategory ? ` • ${activeCategory.name}` : ""}
                {activeBrand ? ` • ${activeBrand.name}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="cb-catalogue__filters">
          <div className="cb-field">
            <label className="cb-label" htmlFor="categoryFilter">
              Category
            </label>
            <select
              id="categoryFilter"
              className="cb-select"
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="cb-field">
            <label className="cb-label" htmlFor="brandFilter">
              Brand
            </label>
            <select
              id="brandFilter"
              className="cb-select"
              value={selectedBrandId}
              onChange={(e) => {
                setSelectedBrandId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="cb-field cb-field--grow">
            <label className="cb-label" htmlFor="searchFilter">
              Search
            </label>
            <input
              id="searchFilter"
              className="cb-input"
              type="search"
              placeholder="Search by name or SKU…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="cb-field">
            <label className="cb-label" htmlFor="sortFilter">
              Sort
            </label>
            <select
              id="sortFilter"
              className="cb-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* ERROR */}
        {error ? (
          <div className="cb-alert cb-alert--error">
            <strong>Catalogue error:</strong> {error}
          </div>
        ) : null}

        {/* GRID */}
        <div className="cb-product-grid">
          {loading ? (
            <div className="cb-catalogue__loading">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="cb-catalogue__empty">
              No products match your current filters.
            </div>
          ) : (
            products.map((p) => {
              const category = p.category_id ? categoryById.get(p.category_id) : null;
              const brand = p.brand_id ? brandById.get(p.brand_id) : null;

              const imgSrc = p.image_url ? p.image_url : FALLBACK_IMG;

              return (
                <article key={p.id} className="cb-product-card">
                  <div className="cb-product-card__imgWrap">
                    <img
                      className="cb-product-card__img"
                      src={imgSrc}
                      alt={p.name || "Product image"}
                      loading="lazy"
                      onError={(e) => {
                        // hard fallback if remote link breaks
                        e.currentTarget.src = FALLBACK_IMG;
                      }}
                    />
                  </div>

                  <div className="cb-product-card__body">
                    <h3 className="cb-product-card__title">{p.name}</h3>

                    <div className="cb-product-card__meta">
                      {p.sku ? <div className="cb-product-card__sku">SKU: {p.sku}</div> : null}
                      {brand?.name ? <div className="cb-product-card__brand">Brand: {brand.name}</div> : null}
                      {category?.name ? <div className="cb-product-card__cat">Category: {category.name}</div> : null}
                    </div>

                    {p.description ? (
                      <p className="cb-product-card__desc">{p.description}</p>
                    ) : null}

                    {/* Optional CTA hook – keep lightweight for now */}
                    <div className="cb-product-card__actions">
                      <button
                        type="button"
                        className="cb-btn cb-btn--secondary"
                        onClick={() => {
                          // You already have EnquiryPanel in the layout.
                          // This is a safe placeholder action until Stage 5 (commerce) is implemented.
                          const evt = new CustomEvent("cb:enquiry:add", {
                            detail: { productId: p.id, name: p.name, sku: p.sku },
                          });
                          window.dispatchEvent(evt);
                        }}
                      >
                        Add to Enquiry
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        <div className="cb-pagination">
          <button
            type="button"
            className="cb-btn cb-btn--secondary"
            disabled={loading || page <= 1}
            onClick={() => setPage((v) => Math.max(1, v - 1))}
          >
            Prev
          </button>

          <div className="cb-pagination__info">
            Page {page} of {totalPages}
          </div>

          <button
            type="button"
            className="cb-btn cb-btn--secondary"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
