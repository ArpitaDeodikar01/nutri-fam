// Supabase database operations using SDK

import { getUserId } from "./auth.js";

let currentFamilyId = null;

export function setCurrentFamily(familyId) {
  currentFamilyId = familyId;
}

export function getCurrentFamily() {
  return currentFamilyId;
}

// Save daily log - merges with existing data to avoid overwriting other fields
export async function saveDailyLog(logData) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  if (!currentFamilyId) throw new Error("No family selected");
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  // Fetch existing row and merge
  const { data: existing } = await supabase.from("daily_logs").select("*")
    .eq("family_id", currentFamilyId)
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();
  
  const mergedLog = {
    family_id: currentFamilyId,
    user_id: userId,
    log_date: logDate,
    activity: existing?.activity || logData.activities || [],
    protein_g: existing?.protein_g ?? logData.nutrition?.protein ?? 0,
    fibre_g: existing?.fibre_g ?? logData.nutrition?.fibre ?? 0,
    carbs_g: existing?.carbs_g ?? logData.nutrition?.carbs ?? 0,
    fats_g: existing?.fats_g ?? logData.nutrition?.fats ?? 0,
    water_ml: existing?.water_ml ?? logData.water ?? 0,
    sleep_hrs: existing?.sleep_hrs ?? logData.sleep ?? 0
  };
  
  const { error } = await supabase.from("daily_logs").upsert(mergedLog, { onConflict: "family_id,user_id,log_date" });
  if (error) throw error;
}

// Helper to update just one category (merge with existing)
export async function updateCategory(field, value) {
  const current = await loadTodayLog() || {};
  const updated = { ...current, [field]: value };
  await saveDailyLog(updated);
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

// Load leaderboard (cycle-based cumulative scores)
export async function loadFamilyLeaderboard() {
  const supabase = window.supabaseClient;
  if (!currentFamilyId) return [];
  
  // Get family's cycle settings
  const { data: family } = await supabase.from("families").select("cycle_start_date, cycle_length_days")
    .eq("id", currentFamilyId)
    .maybeSingle();
  
  const cycleLength = family?.cycle_length_days || 30;
  const cycleStartDate = family?.cycle_start_date ? new Date(family.cycle_start_date) : new Date();
  
  // Calculate current cycle window
  const today = new Date();
  const daysSince = Math.floor((today - cycleStartDate) / 86400000);
  const cycleNum = Math.floor(daysSince / cycleLength);
  const windowStart = new Date(cycleStartDate);
  windowStart.setDate(windowStart.getDate() + cycleNum * cycleLength);
  
  const todayStr = today.toISOString().slice(0, 10);
  const windowStartStr = windowStart.toISOString().slice(0, 10);
  
  // Get approved members with their display names
  const { data: members } = await supabase.from("family_members").select("user_id, display_name, is_admin")
    .eq("family_id", currentFamilyId)
    .eq("status", "approved");
  
  if (!members || members.length === 0) return [];
  
  // Get all daily logs for cycle window
  const { data: logs } = await supabase.from("daily_logs").select("*")
    .eq("family_id", currentFamilyId)
    .gte("log_date", windowStartStr)
    .lte("log_date", todayStr);
  
  // Build user lookup
  const userMap = {};
  (members || []).forEach(m => {
    userMap[m.user_id] = { name: m.display_name, isAdmin: m.is_admin };
  });
  
  // Aggregate scores per user
  const scores = {};
  (logs || []).forEach(log => {
    const userId = log.user_id;
    if (!userMap[userId]) return; // Skip non-approved
    
    if (!scores[userId]) {
      scores[userId] = {
        userId,
        name: userMap[userId].name,
        initials: userMap[userId].name[0].toUpperCase(),
        activity: 0,
        nutrition: 0,
        water: 0,
        sleep: 0,
        total: 0,
        daysLogged: 0
      };
    }
    
    // Calculate daily score using nutrition averaging
    const nutritionPct = (
      (log.protein_g || 0) / 25 +
      (log.fibre_g || 0) / 20 +
      (log.carbs_g || 0) / 180 +
      (log.fats_g || 0) / 45
    ) / 4;
    
    const activityPct = Math.min(1, ((log.activity?.[0]?.value || 0) / 45));
    const waterPct = Math.min(1, (log.water_ml || 0) / 2000);
    const sleepPct = Math.min(1, (log.sleep_hrs || 0) / 8);
    
    const dailyTotal = Math.round(
      (nutritionPct * 25) +
      (activityPct * 25) +
      (waterPct * 25) +
      (sleepPct * 25)
    );
    
    scores[userId].total += dailyTotal;
    scores[userId].daysLogged++;
  });
  
  // Calculate days remaining in cycle
  const cycleEnd = new Date(windowStart);
  cycleEnd.setDate(cycleEnd.getDate() + cycleLength);
  const daysRemaining = cycleLength - Math.floor((today - windowStart) / 86400000);
  
  // Sort by total score and format result
  const result = Object.values(scores)
    .sort((a, b) => b.total - a.total)
    .map((s, i) => ({
      ...s,
      rank: i + 1,
      daysRemaining
    }));
  
  return result;
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
  }).select("id, name, invite_token").single();
  
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
  
  console.log("[JOIN] Found family:", families.id, "- inserting user as pending...");
  const { error: memberError } = await supabase.from("family_members").insert({
    family_id: families.id,
    user_id: userId,
    display_name: await getUserDisplayName(),
    status: 'pending'
  });
  
  if (memberError) {
    console.error("[JOIN] Insert error:", memberError);
    throw memberError;
  }
  
  console.log("[JOIN] Successfully inserted user as pending");
  setCurrentFamily(families.id);
  console.log("[JOIN] Set currentFamilyId to:", families.id);
  return families;
}

// Get pending requests for family (admin only)
export async function getPendingRequests(familyId) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { data, error } = await supabase.from("family_members").select("user_id, display_name, created_at")
    .eq("family_id", familyId)
    .eq("status", "pending");
  
  if (error) throw error;
  return data || [];
}

// Approve a pending member
export async function approveMember(familyId, userId) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { error } = await supabase.from("family_members").update({ status: "approved" })
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("status", "pending");
  
  if (error) throw error;
}

// Decline a pending member
export async function declineMember(familyId, userId) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { error } = await supabase.from("family_members").update({ status: "declined" })
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("status", "pending");
  
  if (error) throw error;
}

// Check if current user is admin of family
export async function isFamilyAdmin(familyId) {
  const supabase = window.supabaseClient;
  if (!supabase) return false;
  
  const userId = getUserId();
  if (!userId) return false;
  
  const { data, error } = await supabase.from("family_members").select("is_admin")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) return false;
  return data?.is_admin || false;
}

// Get current user's membership status for family
export async function getMyMembershipStatus(familyId) {
  const supabase = window.supabaseClient;
  if (!supabase) return null;
  
  const userId = getUserId();
  if (!userId) return null;
  
  const { data, error } = await supabase.from("family_members").select("status, is_admin")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) return null;
  return data;
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
