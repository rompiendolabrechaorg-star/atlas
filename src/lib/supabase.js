import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Generate a random 6-char alphanumeric session code
export function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Get or create anonymous user token (stored in localStorage)
export function getOrCreateUserToken() {
  let token = localStorage.getItem('atlas_user_token')
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem('atlas_user_token', token)
  }
  return token
}
