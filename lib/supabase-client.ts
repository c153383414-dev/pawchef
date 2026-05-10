import { createBrowserClient } from '@supabase/ssr'

let clientInstance: any = null

export function createClient() {
  if (clientInstance) return clientInstance
  clientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
  )
  return clientInstance
}