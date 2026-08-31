// Supabase database operations using SDK

import { getUserId } from "./auth.js";

let currentFamilyId = null;

export function setCurrentFamily(familyId) {
  currentFamilyId = familyId;
}

export function getCurrentFamily() {
  return currentFamilyId;
}

// Save daily log
export async function saveDailyLog(logData) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  if (!currentFamilyId) throw new Error("No family selected");
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const { error } = await supabase.from("daily_logs").upsert({
    family_id: currentFamilyId,
    user_id: userId,
    log_date: logDate,
    activity: logData.activities || [],
    protein_g: logData.nutrition?.protein || 0,
    fibre_g: logData.nutrition?.fibre || 0,
    carbs_g: logData.nutrition?.carbs || 0,
    fats_g: logData.nutrition?.fats || 0,
    water_ml: logData.water || 0,
    sleep_hrs: logData.sleep || 0
  }, { onConflict: "family_id,user_id,log_date" });
  
  if (error) throw error;
}

// Load today's log
export async function loadTodayLog() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) return null;
  if (!currentFamilyId) return null;
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const { data } = await supabase.from("daily_logs").select("*")
    .eq("family_id", currentFamilyId)
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();
  
  if (!data) return null;
  
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
    meals: []
  };
}

// Load leaderboard
export async function loadFamilyLeaderboard() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  if (!currentFamilyId) return [];
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const { data: logs } = await supabase.from("daily_logs").select("*")
    .eq("family_id", currentFamilyId)
    .eq("log_date", logDate);
  
  const { data: members } = await supabase.from("family_members").select("user_id, display_name")
    .eq("family_id", currentFamilyId);
  
  const nameMap = Object.fromEntries((members || []).map(m => [m.user_id, m.display_name]));
  
  return (logs || []).map(log => ({
    userId: log.user_id,
    name: nameMap[log.user_id] || log.user_id,
    initials: (nameMap[log.user_id] || log.user_id)[0].toUpperCase(),
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
  
  const { data, error } = await supabase.from("families").insert({
    name: familyName,
    created_by: userId
  }).select().single();
  
  if (error) throw error;
  
  await supabase.from("family_members").insert({
    family_id: data.id,
    user_id: userId,
    display_name: await getUserDisplayName()
  });
  
  setCurrentFamily(data.id);
  return data;
}

// Join family via invite token
export async function joinFamilyByToken(token) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  
  console.log("[JOIN] Looking up family with token:", token);
  const { data: families, error: familyError } = await supabase.from("families").select("id,name")
    .eq("invite_token", token)
    .maybeSingle();
  
  if (familyError) {
    console.error("[JOIN] Family lookup error:", familyError);
    throw familyError;
  }
  if (!families) {
    console.error("[JOIN] Family not found for token:", token);
    throw new Error("Family not found");
  }
  
  console.log("[JOIN] Found family:", families.id, "- inserting user...");
  const { error: memberError } = await supabase.from("family_members").insert({
    family_id: families.id,
    user_id: userId,
    display_name: await getUserDisplayName()
  });
  
  if (memberError) {
    if (memberError.code !== "23505") {
      console.error("[JOIN] Insert error:", memberError);
      throw memberError;
    }
    console.log("[JOIN] User already member (duplicate key ignored)");
  } else {
    console.log("[JOIN] Successfully inserted user into family_members");
  }
  
  setCurrentFamily(families.id);
  console.log("[JOIN] Set currentFamilyId to:", families.id);
  return families;
}

// Load user's families
export async function loadUserFamilies() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase.from("family_members").select("family_id, families(id,name)")
    .eq("user_id", userId);
  
  if (error) throw error;
  
  return (data || []).map(row => row.families).filter(f => f);
}

// Get display name
export async function getUserDisplayName() {
  const supabase = window.supabaseClient;
  if (!supabase) return "Guest";
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.split("@")[0] || "Guest";
}
