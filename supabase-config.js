// Supabase client configuration
const SUPABASE_URL = "https://bosfhbglpanubtqrrjxt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc2ZoYmdscGFudWJ0cXJyanh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM4MTAsImV4cCI6MjEwMzU4OTgxMH0.leuihUcoRVG2Es0b9hcurTWPNzKEvgt-UOQ_ZUAgzmE";

console.log("supabase-config.js loading...");

// Initialize Supabase client - retry until library is ready
function initSupabase() {
  // Check if supabase library is loaded
  if (!window.supabase) {
    console.log("Waiting for Supabase library to load...");
    setTimeout(initSupabase, 100); // Retry after 100ms
    return;
  }
  
  try {
    console.log("Creating Supabase client...");
    const { createClient } = window.supabase;
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✓ Supabase client initialized");
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
  }
}

// Start initialization immediately (library should be loaded by now)
initSupabase();

