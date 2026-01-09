import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust path if different

const PLACEHOLDER = "/images/product-placeholder-dark.jpg";

function ProductImage({ src, alt, onLoadOk, onLoadFail }) {
  // If src is empty/null, go straight to placeholder
  const finalSrc = src && String(src).trim().length > 0 ? src : PLACEHOLDER;

  return (
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      decoding="async"
      onLoad={onLoadOk}
      onError={onLoadFail}
      style={{ opacity: 1, transition: "opacity 180ms" }}
    />
  );
}

export default function ProductCatalogue() {
  const PAGE_SIZE = 20;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  // imageState: { [productId]: "ok" | "error" }
  const [imageState, setImageState] = useState({});

  // Telemetry
  const telemetry = useMemo(() => {
    const attempted = products.length;
    const errors = Object.values(imageState).filter((v) => v === "error").length;
    const loaded = Object.values(imageState).filter((v) => v === "ok").length;
    const fallback = errors; // each error becomes placeholder
    return { attempted, loaded, errors, fallback };
  }, [products, imageState]);

  const resetImagesForNewData = useCallback((incoming) => {
    // Reset image states only for new dataset so we don’t “stick” placeholders between pages/filters
    const next = {};
    for (const p of incoming) next[p.id] = undefined;
    setImageState(next);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("products")
        .select("id,name,sku,description,image_url,is_active,category_id,brand_id", { count: "exact" })
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (categoryId !== "all") query = query.eq("category_id", Number(categoryId));
      if (brandId !== "all") query = query.eq("brand_id", Number(brandId));

      if (search.trim()) {
        // Adjust fields to match your schema; ilike works for text columns
        const s = `%${search.trim()}%`;
        query = query.or(`name.ilike.${s},sku.ilike.${s},description.ilike.${s}`);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query.range(from, to);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      setProducts(rows);
      resetImagesForNewData(rows);

      // Optional console proof
      const present = rows.filter((p) => p.image_url && String(p.image_url).trim().length > 0).length;
      const sample = rows.find((p) => p.image_url)?.image_url ?? null;
      console.log(`[ProductCatalogue] fetched=${rows.length}, image_url present=${present}, sample=${sample}`);
    } catch (err) {
      console.error("Error loading products:", err);
      setProducts([]);
      setImageState({});
    } finally {
      setLoading(false);
    }
  }, [categoryId, brandId, search, page, resetImagesForNewData]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleImgOk = (id) => {
    setImageState((prev) => ({ ...prev, [id]: "ok" }));
  };

  const handleImgFail = (id) => {
    setImageState((prev) => ({ ...prev, [id]: "error" }));
  };

  return (
    <section className="cb-section" id="catalogue">
      <h2>Product Catalogue</h2>

      {/* Keep your existing filters UI; below is illustrative only */}
      <div className="cb-filters">
        <label>
          Category{" "}
          <select value={categoryId} onChange={(e) => { setPage(1); setCategoryId(e.target.value); }}>
            <option value="all">All</option>
            {/* populate options */}
          </select>
        </label>

        <label>
          Brand{" "}
          <select value={brandId} onChange={(e) => { setPage(1); setBrandId(e.target.value); }}>
            <option value="all">All</option>
            {/* populate options */}
          </select>
        </label>

        <label>
          Search{" "}
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search by name, SKU, desc" />
        </label>
      </div>

      <div className="cb-pagination">
        <button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span>Page {page}</span>
        <button disabled={loading || products.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      <div className="cb-telemetry">
        Images: Attempted {telemetry.attempted} / Loaded {telemetry.loaded} / Errors {telemetry.errors} / Fallback {telemetry.fallback}
      </div>

      {loading && <p>Loading products…</p>}

      <div className="cb-grid">
        {products.map((p) => {
          // If error recorded, show placeholder; otherwise try the remote URL
          const hasFailed = imageState[p.id] === "error";
          const imgSrc = hasFailed ? PLACEHOLDER : p.image_url;

          return (
            <div className="product-card" key={p.id}>
              <div className="product-card-image">
                <ProductImage
                  src={imgSrc}
                  alt={p.name}
                  onLoadOk={() => handleImgOk(p.id)}
                  onLoadFail={() => handleImgFail(p.id)}
                />
              </div>

              <h3 className="product-card-title">{p.name}</h3>
              <div className="product-card-sku"><strong>SKU:</strong> {p.sku}</div>
              {p.description ? <p className="product-card-desc">{p.description}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
