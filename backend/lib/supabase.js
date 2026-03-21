require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseSecretKey || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables — check SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY');
}

// Admin client — uses secret key, bypasses RLS
// Use this for: creating users, verifying tokens, admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Creates a user-scoped client from their access token
// Use this for: any query that should respect RLS
const createUserClient = (accessToken) => createClient(supabaseUrl, supabasePublishableKey, {
  global: {
    headers: { Authorization: `Bearer ${accessToken}` }
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabaseAdmin, createUserClient };