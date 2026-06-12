import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

let client: any;

export function getSupabaseAdmin(): any {
  if (!client) {
    const env = getEnv();
    client = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return client;
}
