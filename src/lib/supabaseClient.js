// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will show up in the browser console if env vars are missing
  console.error("Supabase URL or anon key is missing. Check Netlify env vars.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;

