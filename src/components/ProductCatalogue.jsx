// src/components/ProductCatalogue.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProductCatalogue() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("products")
          .select(
            "id, name, description, sku, image_url, category_id, brand_id, is_active"
          )
          .eq("is_active", true)
          .order("name", { ascending: true });

        console.log("SUPABASE PRODUCTS RESPONSE:", { data, error });

        if (error) throw error;

        setProducts(data ?? []);
      } catch (err) {
        console.error("Error loading products:", err);
        setError("We couldn’t load the catalogue at this time.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

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

  if (!products.length) {
    return (
      <section className="cb-section">
        <p>No products found.</p>
      </section>
    );
  }

  return (
    <section className="cb-section">
      <h2 className="cb-mission_title">Product Catalogue</h2>
      <div className="cb-category-grid cb-catalogue-grid">
        {products.map((p) => (
          <article key={p.id} className="cb-card cb-card--product">
            {p.image_url && (
              <div className="cb-card_image">
                <img src={p.image_url} alt={p.name} loading="lazy" />
              </div>
            )}

            <div className="cb-card_body">
              <h3 className="cb-card_title">{p.name}</h3>

              {p.sku && <p className="cb-card_sku">SKU: {p.sku}</p>}

              {p.description && (
                <p className="cb-card_description">{p.description}</p>
              )}

              <p className="cb-card_meta">
                Brand ID: {p.brand_id} · Category ID: {p.category_id}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

