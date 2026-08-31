// Supabase Auth module

let currentUser = null;

export async function getCurrentUser() {
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
  return currentUser?.id || null;
}
