// Supabase client configuration
const SUPABASE_URL = "https://YOUR_PROJECT_URL.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

let supabase = null;

// Initialize Supabase client (wait for library to load)
function initSupabase() {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client initialized");
  } else {
    console.error("Supabase library not loaded");
  }
}

// Call on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSupabase);
} else {
  initSupabase();
}
