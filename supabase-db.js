// Supabase database operations using REST API directly
// Avoids header issues with JS library

import { getUserId } from "./auth.js";

const SUPABASE_URL = "https://bosfhbglpanubtqrrjxt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc2ZoYmdscGFudWJ0cXJyanh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM4MTAsImV4cCI6MjEwMzU4OTgxMH0.leuihUcoRVG2Es0b9hcurTWPNzKEvgt-UOQ_ZUAgzmE";

let currentFamilyId = null;

export function setCurrentFamily(familyId) {
  currentFamilyId = familyId;
}

export function getCurrentFamily() {
  return currentFamilyId;
}

// Helper to make REST API calls
async function restCall(method, endpoint, body = null) {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, options);
  
  if (!res.ok) {
    const text = await res.text();
    let error;
    try {
      error = JSON.parse(text);
    } catch {
      error = { message: text || res.statusText };
    }
    throw new Error(error.message || `HTTP ${res.status}`);
  }
  
  const text = await res.text();
  if (!text || text.length === 0) return null;
  return JSON.parse(text);
}

// Save daily log
export async function saveDailyLog(logData) {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  if (!currentFamilyId) throw new Error("No family selected");
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const body = {
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
  };
  
  // Try INSERT, if conflict update
  try {
    await restCall("POST", "/daily_logs", body);
  } catch (e) {
    if (e.message.includes("duplicate")) {
      // Update existing record
      await restCall("PATCH", `/daily_logs?family_id=eq.${currentFamilyId}&user_id=eq.${userId}&log_date=eq.${logDate}`, body);
    } else {
      throw e;
    }
  }
}

// Load today's log
export async function loadTodayLog() {
  const userId = getUserId();
  if (!userId) return null;
  if (!currentFamilyId) return null;
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  try {
    const endpoint = `/daily_logs?family_id=eq.${currentFamilyId}&user_id=eq.${userId}&log_date=eq.${logDate}`;
    const data = await restCall("GET", endpoint);
    if (!data || data.length === 0) return null;
    
    const log = data[0];
    return {
      water: log.water_ml,
      activities: log.activity || [],
      nutrition: {
        protein: log.protein_g,
        fibre: log.fibre_g,
        carbs: log.carbs_g,
        fats: log.fats_g
      },
      sleep: log.sleep_hrs,
      meals: []
    };
  } catch (e) {
    if (e.message.includes("400")) return null;
    throw e;
  }
}

// Load leaderboard
export async function loadFamilyLeaderboard() {
  if (!currentFamilyId) return [];
  
  const logDate = new Date().toISOString().slice(0, 10);
  
  const logs = await restCall("GET", `/daily_logs?family_id=eq.${currentFamilyId}&log_date=eq.${logDate}`);
  
  // Fetch family members
  const members = await restCall("GET", `/family_members?family_id=eq.${currentFamilyId}`);
  
  // Create lookup map
  const memberMap = {};
  (members || []).forEach(m => {
    memberMap[m.user_id] = m.display_name;
  });
  
  return (logs || []).map(log => ({
    userId: log.user_id,
    name: memberMap[log.user_id] || log.user_id,
    initials: (memberMap[log.user_id] || log.user_id)[0].toUpperCase(),
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
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  
  const family = await restCall("POST", "/families", {
    name: familyName,
    created_by: userId
  });
  
  // Add creator as member
  await restCall("POST", "/family_members", {
    family_id: family.id,
    user_id: userId,
    display_name: await getUserDisplayName()
  });
  
  setCurrentFamily(family.id);
  return family;
}

// Join family via invite token
export async function joinFamilyByToken(token) {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  
  // Find family by token
  const encoded = encodeURIComponent(`invite_token=eq.${token}`);
  const families = await restCall("GET", `/families?${encoded}`);
  
  if (!families || families.length === 0) throw new Error("Family not found");
  
  const family = families[0];
  
  // Add user to family
  try {
    await restCall("POST", "/family_members", {
      family_id: family.id,
      user_id: userId,
      display_name: await getUserDisplayName()
    });
  } catch (e) {
    if (!e.message.includes("duplicate")) throw e; // Already a member
  }
  
  setCurrentFamily(family.id);
  return family;
}

// Load user's families
export async function loadUserFamilies() {
  const userId = getUserId();
  if (!userId) return [];
  
  const members = await restCall("GET", `/family_members?user_id=eq.${userId}`);
  
  if (!members || members.length === 0) return [];
  
  // Fetch families
  const familyIds = members.map(m => m.family_id).join(",");
  const families = await restCall("GET", `/families?id=in.(${familyIds})`);
  
  return families || [];
}

// Get display name
export async function getUserDisplayName() {
  const supabase = window.supabaseClient;
  if (!supabase) return "Guest";
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.split("@")[0] || "Guest";
}
