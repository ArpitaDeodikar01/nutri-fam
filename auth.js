// Supabase Auth module
// Minimal auth helpers to replace hardcoded profile

let currentUser = null;

// Demo user for testing (bypass email confirmation)
const DEMO_USER = {
  id: "demo-user-123",
  email: "demo@nutrifam.test",
  user_metadata: { display_name: "Demo User" }
};

let useDemoMode = false;

export function enableDemoMode() {
  useDemoMode = true;
  currentUser = DEMO_USER;
  console.log("✓ Demo mode enabled - using demo user");
}

export function isDemoMode() {
  return useDemoMode;
}

// Get current authenticated user
export async function getCurrentUser() {
  if (useDemoMode) {
    return DEMO_USER;
  }
  
  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error("Supabase not initialized");
    return null;
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  return user;
}

// Sign up new user
export async function signUp(email, password, displayName) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (error) throw error;
  
  // User created, now create family_member entry (optional at signup)
  // This will be done when user joins/creates family
  
  return data.user;
}

// Sign in
export async function signIn(email, password) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  
  currentUser = data.user;
  return data.user;
}

// Sign out
export async function signOut() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  
  currentUser = null;
}

// Get display name for current user
export async function getUserDisplayName() {
  if (!currentUser) return "Guest";
  
  // Try to get from family_members table (where display_name is stored)
  const supabase = window.supabaseClient;
  if (!supabase) return currentUser.email.split("@")[0];
  
  // For now, return email prefix as display name
  // In production, fetch from family_members table
  return currentUser.email.split("@")[0];
}

// Get user ID
export function getUserId() {
  return currentUser?.id || null;
}
