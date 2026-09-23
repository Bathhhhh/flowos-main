import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// ถ้ายังไม่ได้ใส่คีย์จริง ระบบจะทำงานในโหมด offline (Local Storage เท่านั้น)
export const hasSupabase = Boolean(
  url &&
  key &&
  !url.includes("your-project") &&
  !url.includes("placeholder")
);

export function createClient() {
  if (!hasSupabase) {
    return createSupabaseClient("https://placeholder.supabase.co", "placeholder-key");
  }
  return createSupabaseClient(url, key);
}
