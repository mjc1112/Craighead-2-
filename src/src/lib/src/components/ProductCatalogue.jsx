// src/components/ProductCatalogue.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function ProductCatalogue() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [productsRes, brandsRes, categoriesRes] = await Promise.all([
          supabase
            .from('products')
            .select('id, name, description, sku, brand_id, category_id, is_active')
            .eq('is_active', true)
            .limit(5000),
          supabase
            .from('brands')
            .select('id, name')
            .order('name'),
          supabase
            .from('categories')
            .select('id, name')
            .order('name'),
        ]);

        if (productsRes.error) throw productsRes.error;
        if (brandsRes.error) throw brandsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;

        setProducts(productsRes.data ?? []);
        setBrands(brandsRes.data ?? []);
        setCategories(categoriesRes.data ?? []);
      } catch (err) {
        console.error(err);
        setError('There was a problem loading the catalogue.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const indexedBrands = useMemo(
    () => Object.fromEntries(brands.map(b => [b.id, b.name])),
    [brands]
  );
  const indexedCategories = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c.name])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    return products
      .filter(p =>
        search
          ? (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.sku || '').toLowerCase().includes(search.toLowerCase())
          : true
      )
      .filter(p => (brandFilter === 'all' ? true : String(p.brand_id) === brandFilter))
      .filter(p =>
        categoryFilter === 'all' ? true : String(p.category_id) === categoryFilter
      );
  }, [products, search, brandFilter, categoryFilter]);

  return (
    <div className="cb-catalogue">
      <div className="cb-catalogue__controls">
        <input
          type="text"
          className="cb-search"
          placeholder="Search by product name or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="cb-filters">
          <select
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
          >
            <option value="all">All brands</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="cb-catalogue__status">Loading catalogue…</p>}
      {error && <p className="cb-catalogue__status cb-catalogue__status--error">{error}</p>}
      {!loading && !error && filteredProducts.length === 0 && (
        <p className="cb-catalogue__status">No products match your filters.</p>
      )}

      <div className="cb-product-grid">
        {filteredProducts.map(product => (
          <article key={product.id} className="cb-product-card">
            <h3 className="cb-product-card__title">{product.name}</h3>
            <p className="cb-product-card__meta">
              <span>{indexedBrands[product.brand_id] || 'Unknown brand'}</span>
              {' · '}
              <span>{indexedCategories[product.category_id] || 'Uncategorised'}</span>
            </p>
            {product.description && (
              <p className="cb-product-card__description">{product.description}</p>
            )}
            {product.sku && (
              <p className="cb-product-card__sku">
                <strong>SKU:</strong> {product.sku}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export default ProductCatalogue;
