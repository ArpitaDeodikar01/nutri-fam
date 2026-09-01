// Supabase database operations using SDK

import { getUserId, isDemoMode } from "./auth.js";

let currentFamilyId = null;

export function setCurrentFamily(familyId) {
  currentFamilyId = familyId;
}

export function getCurrentFamily() {
  return currentFamilyId;
}

// Save daily log - merges with existing data to avoid overwriting other fields
export async function saveDailyLog(logData) {
  const demoModeActive = isDemoMode();
  console.log('[SAVE_TARGET]', demoModeActive ? 'LOCALSTORAGE (demo)' : 'SUPABASE (real)', '| isDemoMode:', demoModeActive, '| userId:', getUserId());
  console.log('[SAVE_DEBUG] logData received in saveDailyLog:', JSON.stringify(logData));
  
  // Demo mode: store in localStorage
  if (demoModeActive) {
    const userId = getUserId();
    if (!userId) throw new Error("User not authenticated");
    if (!currentFamilyId) throw new Error("No family selected");
    
    const logDate = new Date().toISOString().slice(0, 10);
    const key = `demo_log_${currentFamilyId}_${userId}_${logDate}`;
    
    // Get existing data from localStorage
    const existingStr = localStorage.getItem(key);
    const existing = existingStr ? JSON.parse(existingStr) : null;
    
    // Calculate total protein: shake + meals
    const shakeProtein = logData.shake ? (logData.shakeProtein || 26) : 0;
    const mealsProtein = logData.meals?.reduce((sum, m) => sum + (m.protein || 0), 0) || 0;
    const totalProtein = shakeProtein + mealsProtein;
    
    const mergedLog = {
      family_id: currentFamilyId,
      user_id: userId,
      log_date: logDate,
      activity: existing?.activity || logData.activities || [],
      protein_g: existing?.protein_g ?? totalProtein ?? logData.nutrition?.protein ?? 0,
      fibre_g: existing?.fibre_g ?? logData.nutrition?.fibre ?? 0,
      carbs_g: existing?.carbs_g ?? logData.nutrition?.carbs ?? 0,
      fats_g: existing?.fats_g ?? logData.nutrition?.fats ?? 0,
      water_ml: existing?.water_ml ?? logData.water ?? 0,
      sleep_hrs: existing?.sleep_hrs ?? logData.sleep ?? 0
    };
    
    console.log('[SAVE_DEBUG] mergedLog for demo:', JSON.stringify(mergedLog));
    localStorage.setItem(key, JSON.stringify(mergedLog));
    console.log("[DEMO] Saved log to localStorage:", key, mergedLog);
    return;
  }
  
  // Real mode: use Supabase
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  if (!currentFamilyId) throw new Error("No family selected");
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  // Fetch existing row and merge
  const { data: existing, error: fetchError } = await supabase.from("daily_logs").select("*")
    .eq("family_id", currentFamilyId)
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();
  
  if (fetchError) {
    console.error('[SAVE_ERROR] Failed to fetch existing log:', fetchError);
    throw fetchError;
  }
  
  // Calculate total protein: shake + meals
  const shakeProtein = logData.shake ? (logData.shakeProtein || 26) : 0;
  const mealsProtein = logData.meals?.reduce((sum, m) => sum + (m.protein || 0), 0) || 0;
  const totalProtein = shakeProtein + mealsProtein;
  
  const mergedLog = {
    family_id: currentFamilyId,
    user_id: userId,
    log_date: logDate,
    activity: existing?.activity || logData.activities || [],
    protein_g: existing?.protein_g ?? totalProtein ?? logData.nutrition?.protein ?? 0,
    fibre_g: existing?.fibre_g ?? logData.nutrition?.fibre ?? 0,
    carbs_g: existing?.carbs_g ?? logData.nutrition?.carbs ?? 0,
    fats_g: existing?.fats_g ?? logData.nutrition?.fats ?? 0,
    water_ml: existing?.water_ml ?? logData.water ?? 0,
    sleep_hrs: existing?.sleep_hrs ?? logData.sleep ?? 0
  };
  
  console.log('[SAVE_DEBUG] mergedLog for Supabase:', JSON.stringify(mergedLog));
  // If row exists, update it; otherwise insert
  if (existing) {
    console.log('[SAVE] Updating existing row for', logDate);
    const { error } = await supabase.from("daily_logs")
      .update(mergedLog)
      .eq("family_id", currentFamilyId)
      .eq("user_id", userId)
      .eq("log_date", logDate);
    if (error) {
      console.error('[SAVE_ERROR] Update failed:', error);
      throw error;
    }
    console.log('[SAVE] Update successful:', mergedLog);
  } else {
    console.log('[SAVE] Inserting new row for', logDate);
    const { error } = await supabase.from("daily_logs").insert(mergedLog);
    if (error) {
      console.error('[SAVE_ERROR] Insert failed:', error);
      throw error;
    }
    console.log('[SAVE] Insert successful:', mergedLog);
  }
}

// Helper to update just one category (merge with existing)
export async function updateCategory(field, value) {
  const current = await loadTodayLog() || {};
  const updated = { ...current, [field]: value };
  await saveDailyLog(updated);
}

// Load today's log
export async function loadTodayLog() {
  // Demo mode: load from localStorage
  if (isDemoMode()) {
    const userId = getUserId();
    if (!userId) return null;
    if (!currentFamilyId) return null;
    
    const logDate = new Date().toISOString().slice(0, 10);
    const key = `demo_log_${currentFamilyId}_${userId}_${logDate}`;
    const dataStr = localStorage.getItem(key);
    
    if (!dataStr) return null;
    
    try {
      const data = JSON.parse(dataStr);
      return {
        water: data.water_ml || 0,
        activities: data.activity || [],
        nutrition: {
          protein: data.protein_g || 0,
          fibre: data.fibre_g || 0,
          carbs: data.carbs_g || 0,
          fats: data.fats_g || 0
        },
        sleep: data.sleep_hrs || 0,
        meals: [],
        shake: false,
        shakeProtein: 26
      };
    } catch (e) {
      console.error("[DEMO] Failed to parse localStorage log:", e);
      return null;
    }
  }
  
  // Real mode: use Supabase
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) {
    console.log('[LOAD_DEBUG] No userId, returning null');
    return null;
  }
  if (!currentFamilyId) {
    console.log('[LOAD_DEBUG] No currentFamilyId, returning null');
    return null;
  }
  
  const logDate = new Date().toISOString().slice(0, 10);
  console.log('[LOAD_DEBUG] fetching today log for userId:', userId, 'familyId:', currentFamilyId, 'date:', logDate);
  
  const { data, error } = await supabase.from("daily_logs").select("*")
    .eq("family_id", currentFamilyId)
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();
  
  if (error) {
    console.error('[LOAD_DEBUG] Query error:', error);
  }
  console.log('[LOAD_DEBUG] fetched log:', data);
  
  if (!data) {
    console.log('[LOAD_DEBUG] No data found, returning null');
    return null;
  }
  
  const result = {
    water: data.water_ml || 0,
    activities: data.activity || [],
    nutrition: {
      protein: data.protein_g || 0,
      fibre: data.fibre_g || 0,
      carbs: data.carbs_g || 0,
      fats: data.fats_g || 0
    },
    sleep: data.sleep_hrs || 0,
    meals: [],
    shake: false,
    shakeProtein: 26
  };
  
  console.log('[LOAD_DEBUG] returning transformed result:', result);
  return result;
}

// Load leaderboard (cycle-based cumulative scores)
export async function loadFamilyLeaderboard() {
  // Demo mode: return simple demo data
  if (isDemoMode()) {
    if (!currentFamilyId) return [];
    
    // Simple demo leaderboard
    return [
      {
        userId: getUserId(),
        name: "Demo User",
        initials: "DU",
        activity: 0,
        nutrition: 0,
        water: 0,
        sleep: 0,
        total: 65,
        daysLogged: 1,
        rank: 1,
        daysRemaining: 29
      },
      {
        userId: "demo-user-2",
        name: "Demo Family Member",
        initials: "DF",
        activity: 0,
        nutrition: 0,
        water: 0,
        sleep: 0,
        total: 42,
        daysLogged: 1,
        rank: 2,
        daysRemaining: 29
      }
    ];
  }
  
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
    
    // DEBUG: Log raw data
    console.log('[SCORE_DEBUG] raw log for user:', log.user_id, log);
    
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
    
    console.log('[SCORE_DEBUG] nutrition pts:', nutritionPct * 25, 'activity pts:', activityPct * 25, 'water pts:', waterPct * 25, 'sleep pts:', sleepPct * 25);
    
    const dailyTotal = Math.round(
      (nutritionPct * 25) +
      (activityPct * 25) +
      (waterPct * 25) +
      (sleepPct * 25)
    );
    
    console.log('[SCORE_DEBUG] dailyTotal:', dailyTotal);
    
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
export async function createFamily(familyName, cycleLength = 30) {
  // Demo mode: create fake family
  if (isDemoMode()) {
    const userId = getUserId();
    if (!userId) throw new Error("User not authenticated");
    
    const familyId = "demo-family-" + Math.random().toString(36).substring(2);
    const inviteToken = Math.random().toString(36).substring(2);
    
    // Store family info in localStorage
    const familyKey = `demo_family_${familyId}`;
    localStorage.setItem(familyKey, JSON.stringify({
      id: familyId,
      name: familyName,
      invite_token: inviteToken,
      created_by: userId,
      cycle_length_days: cycleLength
    }));
    
    // Store membership
    const memberKey = `demo_member_${familyId}_${userId}`;
    localStorage.setItem(memberKey, JSON.stringify({
      family_id: familyId,
      user_id: userId,
      display_name: "Demo User",
      status: "approved",
      is_admin: true
    }));
    
    setCurrentFamily(familyId);
    
    console.log("[DEMO] Created family:", familyId, "with token:", inviteToken, "cycle:", cycleLength);
    return {
      id: familyId,
      name: familyName,
      invite_token: inviteToken
    };
  }
  
  // Real mode: use Supabase
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  
  const { data, error } = await supabase.from("families").insert({
    name: familyName,
    created_by: userId,
    cycle_length_days: cycleLength
  }).select("id, name, invite_token").maybeSingle();
  
  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create family - no ID returned");
  }
  
  await supabase.from("family_members").insert({
    family_id: data.id,
    user_id: userId,
    display_name: await getUserDisplayName(),
    is_admin: true,
    status: "approved"
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
  
  // Check if user is already a member
  console.log("[JOIN] Checking for existing membership...");
  const { data: existingMember } = await supabase.from("family_members").select("id, status")
    .eq("family_id", families.id)
    .eq("user_id", userId)
    .maybeSingle();
  
  if (existingMember) {
    console.log("[JOIN] User already a member with status:", existingMember.status);
    setCurrentFamily(families.id);
    return families;
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
  // Demo mode: return empty array (no pending requests in demo)
  if (isDemoMode()) {
    return [];
  }
  
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { data, error } = await supabase.from("family_members").select("user_id, display_name, joined_at")
    .eq("family_id", familyId)
    .eq("status", "pending");
  
  if (error) throw error;
  return data || [];
}

// Approve a pending member
export async function approveMember(familyId, userId) {
  // Demo mode: update localStorage
  if (isDemoMode()) {
    const memberKey = `demo_member_${familyId}_${userId}`;
    const memberStr = localStorage.getItem(memberKey);
    if (memberStr) {
      try {
        const member = JSON.parse(memberStr);
        member.status = "approved";
        localStorage.setItem(memberKey, JSON.stringify(member));
        console.log("[DEMO] Approved member:", userId, "in family:", familyId);
      } catch (e) {
        console.error("[DEMO] Failed to approve member:", e);
      }
    }
    return;
  }
  
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
  // Demo mode: update localStorage
  if (isDemoMode()) {
    const memberKey = `demo_member_${familyId}_${userId}`;
    const memberStr = localStorage.getItem(memberKey);
    if (memberStr) {
      try {
        const member = JSON.parse(memberStr);
        member.status = "declined";
        localStorage.setItem(memberKey, JSON.stringify(member));
        console.log("[DEMO] Declined member:", userId, "in family:", familyId);
      } catch (e) {
        console.error("[DEMO] Failed to decline member:", e);
      }
    }
    return;
  }
  
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
  // Demo mode: check localStorage
  if (isDemoMode()) {
    const userId = getUserId();
    if (!userId || !familyId) return false;
    
    const memberKey = `demo_member_${familyId}_${userId}`;
    const memberStr = localStorage.getItem(memberKey);
    if (memberStr) {
      try {
        const member = JSON.parse(memberStr);
        return member.is_admin || false;
      } catch (e) {
        console.error("[DEMO] Failed to parse member:", e);
        return false;
      }
    }
    return false;
  }
  
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
  // Demo mode: check localStorage
  if (isDemoMode()) {
    const userId = getUserId();
    if (!userId || !familyId) return null;
    
    const memberKey = `demo_member_${familyId}_${userId}`;
    const memberStr = localStorage.getItem(memberKey);
    if (memberStr) {
      try {
        const member = JSON.parse(memberStr);
        return {
          status: member.status || "approved",
          is_admin: member.is_admin || false
        };
      } catch (e) {
        console.error("[DEMO] Failed to parse member:", e);
        return null;
      }
    }
    return null;
  }
  
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
  // Demo mode: load from localStorage
  if (isDemoMode()) {
    const userId = getUserId();
    if (!userId) return [];
    
    // Find all demo families for this user
    const families = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`demo_member_`) && key.includes(`_${userId}`)) {
        const memberStr = localStorage.getItem(key);
        if (memberStr) {
          try {
            const member = JSON.parse(memberStr);
            // Get family info
            const familyKey = `demo_family_${member.family_id}`;
            const familyStr = localStorage.getItem(familyKey);
            if (familyStr) {
              const family = JSON.parse(familyStr);
              families.push({
                id: family.id,
                name: family.name
              });
            }
          } catch (e) {
            console.error("[DEMO] Failed to parse family member:", e);
          }
        }
      }
    }
    
    return families;
  }
  
  // Real mode: use Supabase
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

// Leave family (any member)
export async function leaveFamily(familyId) {
  // Demo mode: delete from localStorage
  if (isDemoMode()) {
    const userId = getUserId();
    if (!userId || !familyId) return;
    
    const memberKey = `demo_member_${familyId}_${userId}`;
    localStorage.removeItem(memberKey);
    console.log("[DEMO] Left family:", familyId);
    return;
  }
  
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  
  const { error } = await supabase.from("family_members")
    .delete()
    .eq("family_id", familyId)
    .eq("user_id", userId);
  
  if (error) throw error;
  console.log("[FAMILY] Left family:", familyId);
}

// Delete family (admin only - cascades to family_members + daily_logs via FK)
export async function deleteFamily(familyId) {
  // Demo mode: delete from localStorage
  if (isDemoMode()) {
    const familyKey = `demo_family_${familyId}`;
    localStorage.removeItem(familyKey);
    
    // Delete all members for this family
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`demo_member_${familyId}_`)) {
        localStorage.removeItem(key);
      }
    }
    
    console.log("[DEMO] Deleted family:", familyId);
    return;
  }
  
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("Supabase not initialized");
  
  const { error } = await supabase.from("families")
    .delete()
    .eq("id", familyId);
  
  if (error) throw error;
  console.log("[FAMILY] Deleted family:", familyId);
}
