// Supabase database operations
// 1:1 mapping from LocalStorage calls to Supabase

import { getUserId } from "./auth.js";

// Current family ID (replaces data.familyId)
let currentFamilyId = null;

export function setCurrentFamily(familyId) {
  currentFamilyId = familyId;
}

export function getCurrentFamily() {
  return currentFamilyId;
}

// Save daily log (replaces localStorage.setItem)
export async function saveDailyLog(logData) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  if (!currentFamilyId) throw new Error("No family selected");
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const { error } = await supabase
    .from("daily_logs")
    .upsert(
      {
        family_id: currentFamilyId,
        user_id: userId,
        log_date: logDate,
        activity: logData.activities || [], // jsonb array [{type, value}]
        protein_g: logData.nutrition?.protein || 0,
        fibre_g: logData.nutrition?.fibre || 0,
        carbs_g: logData.nutrition?.carbs || 0,
        fats_g: logData.nutrition?.fats || 0,
        water_ml: logData.water || 0,
        sleep_hrs: logData.sleep || 0,
        meals: logData.meals || []
      },
      { onConflict: "family_id,user_id,log_date" }
    );
  
  if (error) throw error;
}

// Load today's log (replaces localStorage.getItem)
export async function loadTodayLog() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) return null;
  if (!currentFamilyId) return null;
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("family_id", currentFamilyId)
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .single();
  
  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  
  if (!data) return null;
  
  // Transform DB format back to app format
  return {
    water: data.water_ml,
    activities: data.activity || [],
    nutrition: {
      protein: data.protein_g,
      fibre: data.fibre_g,
      carbs: data.carbs_g,
      fats: data.fats_g
    },
    sleep: data.sleep_hrs,
    meals: data.meals || []
  };
}

// Load leaderboard (all family members' logs for today)
export async function loadFamilyLeaderboard() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  if (!currentFamilyId) return [];
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*, family_members(display_name)")
    .eq("family_id", currentFamilyId)
    .eq("log_date", logDate);
  
  if (error) throw error;
  
  // Transform to app format
  return data.map(log => ({
    userId: log.user_id,
    name: log.family_members?.display_name || log.user_id,
    initials: (log.family_members?.display_name || log.user_id)[0].toUpperCase(),
    activity: log.activity || [],
    nutrition: {
      protein: log.protein_g,
      fibre: log.fibre_g,
      carbs: log.carbs_g,
      fats: log.fats_g
    },
    water: log.water_ml,
    sleep: log.sleep_hrs,
    status: ""
  }));
}

// Create family
export async function createFamily(familyName) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  
  // Create family
  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: familyName, created_by: userId })
    .select()
    .single();
  
  if (familyError) throw familyError;
  
  // Add creator as family member
  const { error: memberError } = await supabase
    .from("family_members")
    .insert({
      family_id: family.id,
      user_id: userId,
      display_name: await getUserDisplayName()
    });
  
  if (memberError) throw memberError;
  
  setCurrentFamily(family.id);
  return family;
}

// Join family via invite token
export async function joinFamilyByToken(token) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  
  // Find family by invite token
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id,name")
    .eq("invite_token", token)
    .single();
  
  if (familyError) throw familyError;
  if (!family) throw new Error("Family not found");
  
  // Add user to family
  const { error: memberError } = await supabase
    .from("family_members")
    .insert({
      family_id: family.id,
      user_id: userId,
      display_name: await getUserDisplayName()
    });
  
  if (memberError) {
    // User might already be a member
    if (memberError.code !== "23505") throw memberError; // 23505 = unique violation
  }
  
  setCurrentFamily(family.id);
  return family;
}

// Load user's families
export async function loadUserFamilies() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id, families(id,name)")
    .eq("user_id", userId);
  
  if (error) throw error;
  
  return data.map(row => row.families).filter(f => f);
}

// Import helper (for auth.js)
export async function getUserDisplayName() {
  const supabase = window.supabaseClient;
  if (!supabase) return "Guest";
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.split("@")[0] || "Guest";
}
