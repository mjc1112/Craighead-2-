import { supabase } from './supabaseClient';

// Fetch all categories for navigation
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (error) {
    console.error('[Craighead] Failed to load categories', error);
    throw error;
  }

  return data ?? [];
}

// Fetch products, optionally filtered by category slug
export async function getProducts({ categorySlug, limit = 48, page = 1 } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select(`
      id,
      name,
      sku,
      description,
      is_active,
      categories!inner (slug, name),
      brands (name)
    `)
    .eq('is_active', true)
    .range(from, to);

  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Craighead] Failed to load products', error);
    throw error;
  }

  return data ?? [];
}

// Fetch a single product by id
export async function getProductById(id) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      sku,
      description,
      is_active,
      categories (id, slug, name),
      brands (id, name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[Craighead] Failed to load product', error);
    throw error;
  }

  return data;
}
