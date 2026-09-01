// Supabase Auth module

let currentUser = null;

export async function getCurrentUser() {
  // If in demo mode, return demo user
  if (demoMode && demoUserId) {
    return currentUser;
  }
  
  const supabase = window.supabaseClient;
  if (!supabase) return null;
  
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  return user;
}

export async function signUp(email, password) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signIn(email, password) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user;
  return data.user;
}

export async function signOut() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentUser = null;
}

export function getUserDisplayName() {
  return currentUser?.email?.split("@")[0] || "Guest";
}

export function getUserId() {
  if (demoMode && demoUserId) {
    return demoUserId;
  }
  return currentUser?.id || null;
}

// Demo mode functions
let demoMode = false;
let demoUserId = null;

export function enableDemoMode() {
  demoMode = true;
  demoUserId = "demo-user-" + Math.random().toString(36).substring(2);
  currentUser = {
    id: demoUserId,
    email: "demo@nutrifam.app",
    user_metadata: {}
  };
  console.log("[DEMO] Demo mode enabled, user ID:", demoUserId);
}

export function disableDemoMode() {
  demoMode = false;
  demoUserId = null;
  currentUser = null;
  console.log("[DEMO] Demo mode disabled");
}

export function isDemoMode() {
  return demoMode;
}

export function getDemoUserId() {
  return demoUserId;
}
