// src/components/ProductCatalogue.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProductCatalogue() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);

        // 🔧 Adjust the table/columns here if your Supabase schema differs
        const { data, error } = await supabase
          .from("products") // e.g. "products" / "catalogue_products" – use your real table name
          .select("id, name, description, brand, category, price, image_url")
          .order("name", { ascending: true });

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error("Error loading products from Supabase", err);
        setError("We couldn’t load the catalogue just now. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  if (loading) {
    return (
      <section className="cb-section cb-section--catalogue">
        <div className="cb-section__inner">
          <p>Loading catalogue…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cb-section cb-section--catalogue">
        <div className="cb-section__inner">
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!products.length) {
    return (
      <section className="cb-section cb-section--catalogue">
        <div className="cb-section__inner">
          <p>No products found in the catalogue yet.</p>
        </div>
      </section>
    );
  }

  // Build category list from the data
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  );

  const filteredProducts =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <section className="cb-section cb-section--catalogue">
      <div className="cb-section__inner">
        <h2 className="cb-mission__title">Online Catalogue</h2>
        <p className="cb-mission__text">
          Browse a selection of Craighead’s stocked products. Use the filters to
          narrow down by category.
        </p>

        <div className="cb-category-filter">
          <button
            type="button"
            className={
              activeCategory === "all"
                ? "cb-pill cb-pill--active"
                : "cb-pill"
            }
            onClick={() => setActiveCategory("all")}
          >
            All products
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={
                activeCategory === cat ? "cb-pill cb-pill--active" : "cb-pill"
              }
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="cb-product-grid">
          {filteredProducts.map((product) => (
            <article key={product.id} className="cb-product-card">
              {product.image_url && (
                <div className="cb-product-card__image">
                  <img src={product.image_url} alt={product.name} />
                </div>
              )}

              <div className="cb-product-card__body">
                <h3 className="cb-product-card__title">
                  {product.name || "Unnamed product"}
                </h3>
                {product.brand && (
                  <p className="cb-product-card__brand">{product.brand}</p>
                )}
                {product.description && (
                  <p className="cb-product-card__description">
                    {product.description}
                  </p>
                )}
                <div className="cb-product-card__footer">
                  {product.price != null && (
                    <span className="cb-product-card__price">
                      £{Number(product.price).toFixed(2)}
                    </span>
                  )}
                  {product.category && (
                    <span className="cb-product-card__category">
                      {product.category}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
