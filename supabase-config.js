// Supabase client configuration
const SUPABASE_URL = "https://bosfhbglpanubtqrrjxt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc2ZoYmdscGFudWJ0cXJyanh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM4MTAsImV4cCI6MjEwMzU4OTgxMH0.leuihUcoRVG2Es0b9hcurTWPNzKEvgt-UOQ_ZUAgzmE";

// Initialize Supabase client (wait for library to load)
function initSupabase() {
  if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
