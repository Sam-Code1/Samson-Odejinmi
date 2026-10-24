"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client bound to the signed-in user's session (the same cookies the server reads). Uses the anon key, so
 * Row Level Security and Storage policies decide what it can do. Used for direct uploads of large files, which can't
 * pass through a Vercel function (4.5 MB request limit).
 */
let client: ReturnType<typeof createBrowserClient> | null = null;
export function browserSupabase() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
