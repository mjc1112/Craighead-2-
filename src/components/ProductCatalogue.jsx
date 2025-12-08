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

      const { data, error } = await supabase
  .from("products")
  .select("id, name, description, sku, image_url, category_id, brand_id, is_active")
  .eq("is_active", true)
  .order("name", { ascending: true });


        if (error) throw error;

        setProducts(data || []);
      } catch (err) {
        console.error("Error loading products:", err);
        setError("We couldn’t load the catalogue.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  if (loading) return <p>Loading products…</p>;
  if (error) return <p>{error}</p>;

  return (
    <section className="cb-section">
      <h2>Product Catalogue</h2>
      <div className="catalogue-grid">
        {products.map((p) => (
          <div key={p.id} className="catalogue-card">
            <img src={p.image_url} alt={p.name} />
            <h3>{p.name}</h3>
            <p>{p.brand}</p>
            <p>{p.category}</p>
            <p>£{p.price}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
