// Import Supabase database functions
import {
  saveDailyLog,
  loadTodayLog,
  loadFamilyLeaderboard,
  createFamily,
  joinFamilyByToken,
  getCurrentFamily,
  setCurrentFamily,
  loadUserFamilies,
  getPendingRequests,
  approveMember,
  declineMember,
  isFamilyAdmin,
  getMyMembershipStatus,
  leaveFamily,
  deleteFamily
} from "./supabase-db.js";

import {
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  getUserId,
  getUserDisplayName,
  enableDemoMode,
  isDemoMode,
  setCurrentUser
} from "./auth.js";

// Import scoring functions and config
import { 
  totalScore, 
  scoreBreakdown, 
  statusColor, 
  statusEmoji, 
  categoryPct,
  motivationalMessage,
  weakestCategory,
  ACTIVITY_GOALS,
  NUTRITION_GOALS,
  WATER_GOAL_ML,
  SLEEP_GOAL_HRS
} from './scoring.js';

import {
  ACTIVITY_DISPLAY
} from './scoring.config.js';

const FOOD_DB = {
  "Paneer": {calories:265, protein:18.3, carbs:6.1, fat:20.8},
  "Rice (cooked)": {calories:130, protein:2.7, carbs:28.2, fat:0.3},
  "Roti": {calories:120, protein:3.5, carbs:18, fat:3},
  "Dal (cooked)": {calories:116, protein:9, carbs:20, fat:0.4},
  "Palak": {calories:23, protein:2.9, carbs:3.6, fat:0.4},
  "Curd": {calories:61, protein:3.5, carbs:4.7, fat:3.3},
  "Greek Yogurt": {calories:73, protein:10, carbs:4, fat:1.5},
  "Milk": {calories:61, protein:3.2, carbs:4.8, fat:3.3},
  "Besan Chilla": {calories:160, protein:7, carbs:18, fat:7},
  "Poha": {calories:180, protein:3.5, carbs:27, fat:6},
  "Upma": {calories:150, protein:4, carbs:24, fat:5},
  "Banana": {calories:89, protein:1.1, carbs:22.8, fat:0.3},
  "Apple": {calories:52, protein:0.3, carbs:13.8, fat:0.2},
  "Carrot": {calories:41, protein:0.9, carbs:9.6, fat:0.2},
  "Cucumber": {calories:15, protein:0.7, carbs:3.6, fat:0.1},
  "Peanuts": {calories:567, protein:25.8, carbs:16.1, fat:49.2},
  "Oats": {calories:389, protein:16.9, carbs:66.3, fat:6.9}
};

const MOTIVATIONS = [
  ["You don't need a perfect day. You need a day you can repeat.", "Consistency is your superpower."],
  ["One healthy choice makes the next one easier.", "Keep the momentum going."],
  ["Your future self is built by what you do today.", "Tiny actions count."],
  ["Progress is quiet. Keep showing up.", "You've got this."],
  ["Take care of yourself like someone you're responsible for.", "Today is a good day to start."]
];

const defaultData = {
  profile: {name:"User"},
  today: {water:0, activities:[], nutrition:{protein:0,fibre:0,carbs:0,fats:0}, sleep:0, shake:false, shakeProtein:26, meals:[]},
  history: {}
};

let data = structuredClone(defaultData);

async function save(){
  const userId = getUserId();
  const familyId = getCurrentFamily();
  console.log('[SAVE_CALL] save() invoked for date:', todayKey(), 'userId:', userId, 'familyId:', familyId);
  console.log('[PAYLOAD_DEBUG] local state before save:', JSON.stringify(data.today));
  
  if (!userId) {
    console.error('[SAVE_CALL] CRITICAL: userId is null! Cannot save data');
  }
  
  try {
    // Log what we're about to send
    const payloadToSend = {
      activities: data.today.activities,
      nutrition: {
        protein: (data.today.shake ? data.today.shakeProtein : 0) + (data.today.meals?.reduce((sum, m) => sum + m.protein, 0) || 0),
        fibre: data.today.nutrition?.fibre || 0,
        carbs: data.today.nutrition?.carbs || 0,
        fats: data.today.nutrition?.fats || 0
      },
      water: data.today.water,
      sleep: data.today.sleep,
      shake: data.today.shake,
      shakeProtein: data.today.shakeProtein,
      meals: data.today.meals
    };
    console.log('[PAYLOAD_DEBUG] transformed payload to send:', JSON.stringify(payloadToSend));
    console.log('[PAYLOAD_DEBUG] shake included:', payloadToSend.shake);
    
    await saveDailyLog(payloadToSend);
    console.log('[SAVE_CALL] save() completed successfully');
  } catch (error) {
    console.error("[SAVE_CALL] Failed to save daily log:", error);
    // Try refreshing data from Supabase and retry once
    try {
      const freshLog = await loadTodayLog();
      if (freshLog) {
        data.today = freshLog;
        await saveDailyLog(data.today);
      }
    } catch (retryError) {
      toast("Error saving data: " + retryError.message);
    }
  }
}

function todayKey(){ return new Date().toISOString().slice(0,10); }
function getToday(){ return data.today; }

// Generate cryptographically secure random token for invite links
function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function getColorStatus(value, max, type){
  const p = value / max;
  if(p >= 1) return {emoji:"🟢", label:"Done"};
  if(p >= 0.5) return {emoji:"🟠", label:"Halfway"};
  return {emoji:"🔴", label:"Low"};
}

function totals(){
  return getToday().meals.reduce((a,m)=>({
    calories:a.calories+m.calories, protein:a.protein+m.protein, carbs:a.carbs+m.carbs, fat:a.fat+m.fat
  }),{calories:0,protein:0,carbs:0,fat:0});
}

function goalCompletion(){
  const t=getToday(), n=totals();
  return {
    meals:t.meals.length>0,
    shake:t.shake,
    water:t.water>=2000,
    activity:t.activities.length>0,
    sleep:t.sleep>=7,
    calories:n.calories
  };
}

function completionPercent(){
  const g=goalCompletion();
  return Math.round(Object.values(g).slice(0,4).filter(Boolean).length/4*100);
}

function currentStreak(){
  let streak=0;
  const d=new Date();
  while(true){
    const key=d.toISOString().slice(0,10);
    const h=data.history[key];
    if(!h || h.percent<100) break;
    streak++; d.setDate(d.getDate()-1);
  }
  if(completionPercent()===100) streak++;
  return streak;
}

function syncHistory(){
  const key=todayKey();
  const breakdown = scoreBreakdown(data.today);
  data.history[key]={percent:completionPercent(),score:breakdown.total,activity:breakdown.activity,nutrition:breakdown.nutrition,water:breakdown.water,sleep:breakdown.sleep};
  save();
}

function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function pct(v,max){return Math.min(100,Math.round(v/max*100));}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove("show"),2300)}

function renderDashboard(){
  const t=getToday(), n=totals(), p=completionPercent(), g=goalCompletion();
  
  setText("caloriesValue",Math.round(n.calories)); setText("proteinValue",Math.round(n.protein));
  setText("mealStatus",g.meals?"Tracked":"Not tracked"); document.getElementById("mealStatus").classList.toggle("done",g.meals);
  setText("shakeProtein",t.shake?t.shakeProtein:0); setText("shakeStatus",t.shake?"Done":"Pending"); document.getElementById("shakeStatus").classList.toggle("done",t.shake);
  const sb=document.getElementById("shakeBtn"); sb.textContent=t.shake?"✓ Shake taken":"Mark as taken"; sb.classList.toggle("done",t.shake);
  
  setText("waterValue",(t.water/1000).toFixed(2).replace(/\.00$/,"")); setText("waterStatus",Math.round(categoryPct(t, 'water')*100)+"%");
  document.getElementById("waterBar").style.width=Math.round(categoryPct(t, 'water')*100)+"%";
  
  setText("sleepValue", t.sleep); setText("sleepStatus", Math.round(categoryPct(t, 'sleep')*100) + "%");
  document.getElementById("sleepBar").style.width=Math.round(categoryPct(t, 'sleep')*100)+"%";
  
  // Activity display
  let activityText = "No activity";
  if(t.activities.length > 0){
    activityText = t.activities.map(a => {
      const actType = a.type.toLowerCase();
      const unit = ACTIVITY_GOALS[actType]?.unit || 'min';
      const display = ACTIVITY_DISPLAY[actType] || ACTIVITY_DISPLAY['walking'];
      return `${display} — ${a.value} ${unit}`;
    }).join(", ");
  }
  setText("activityValue", activityText);
  
  setText("progressPercent",p+"%"); setText("ringValue",p+"%");
  document.getElementById("progressRing").style.background=`conic-gradient(var(--accent) ${p*3.6}deg,#d5ded5 ${p*3.6}deg)`;
  setText("progressMessage",p===100?"Perfect day! All four goals complete.":p>=50?"You're halfway there. Keep going!":"Let's get started — one goal at a time.");
  setText("streakCount",currentStreak());
  const [m,s]=MOTIVATIONS[(new Date().getDate()+p)%MOTIVATIONS.length]; setText("motivationText",m);setText("motivationSub",s);
  renderMiniFamily();
  syncHistory();
}

function renderMiniFamily(){
  if (!getCurrentFamily()) {
    document.getElementById("miniFamily").innerHTML = `<div class="family-mini"><p style="color:var(--muted);font-size:12px;text-align:center">Create or join a family to see the leaderboard</p></div>`;
    return;
  }
  
  (async () => {
    try {
      const logs = await loadFamilyLeaderboard();
      if (!logs || logs.length === 0) {
        document.getElementById("miniFamily").innerHTML = `<div class="family-mini"><p style="color:var(--muted);font-size:12px;text-align:center">No family members yet</p></div>`;
        return;
      }
      
      const sorted = logs.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 4);
      document.getElementById("miniFamily").innerHTML = `<div class="family-mini">${sorted.map((x, i) => `
        <div class="family-row"><div class="mini-avatar">${x.initials}</div><div class="family-info"><strong>${x.name}${i === 0 ? " 👑" : ""}</strong><small>${totalScore(x)} pts</small></div></div>`).join("")}</div>`;
    } catch (e) {
      console.error("Failed to load mini family:", e);
    }
  })();
}

function renderLeaderboard(){
  // Load leaderboard from Supabase
  (async () => {
    try {
      const logs = await loadFamilyLeaderboard();
      const userId = getUserId();
      
      if (!logs || logs.length === 0) {
        document.getElementById("leaderboardContainer").innerHTML = 
          '<div style="text-align:center;padding:40px;color:var(--muted)"><h3>No data yet</h3><p>Start logging to see the leaderboard.</p></div>';
        return;
      }
      
      // Store leaderboard data globally for detail view
      window.leaderboardData = logs;
      
      const html = logs.map((x, i) => {
        const isViewer = x.userId === userId;
        
        return `
    <div class="leaderboard-row" onclick="showMemberDetail(${i})" style="cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background=''">
      <span class="leaderboard-rank">${i===0?"👑":(i+1)}</span>
      <div class="leaderboard-member">
        <span class="leaderboard-member-name">${x.name}${x.isAdmin?" (Admin)":""}</span>
        <span class="leaderboard-member-stats">📅 ${x.daysLogged} days logged</span>
      </div>
      <span class="leaderboard-score">${x.total} pts</span>
    </div>
  `}).join("");
      
      // If there's a pending requests section, append leaderboard to it
      const existingPending = document.getElementById("leaderboardRows");
      if (existingPending) {
        existingPending.innerHTML = html;
      } else {
        document.getElementById("leaderboardContainer").innerHTML = html;
      }
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      document.getElementById("leaderboardContainer").innerHTML = `<div style="color: var(--muted); font-size: 12px;">Error loading leaderboard: ${error.message}</div>`;
    }
  })();
}

function renderMeals(){
  const n=totals();
  setText("mealCaloriesTotal",Math.round(n.calories));setText("mealProteinTotal",Math.round(n.protein)+"g");setText("mealCarbsTotal",Math.round(n.carbs)+"g");setText("mealFatTotal",Math.round(n.fat)+"g");
  const list=document.getElementById("mealList");
  list.innerHTML=getToday().meals.length?getToday().meals.map((m,i)=>`
    <div class="meal-item"><div><strong>${m.food}</strong><small>${m.type} · ${m.qty}g · ${Math.round(m.calories)} kcal · ${Math.round(m.protein)}g protein</small></div><button class="delete-meal" data-delete="${i}">Remove</button></div>`).join(""):`<div class="meal-item"><div><strong>No meals yet</strong><small>Add your first meal above.</small></div></div>`;
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{getToday().meals.splice(+b.dataset.delete,1);save();renderAll();toast("Meal removed")});
}

function updatePreview(){
  const food=document.getElementById("foodSelect").value, q=+document.getElementById("foodQty").value||0, f=FOOD_DB[food];
  setText("previewCalories",Math.round(f.calories*q/100)+" kcal");setText("previewProtein",(f.protein*q/100).toFixed(1)+" g");
  setText("previewCarbs",(f.carbs*q/100).toFixed(1)+" g");setText("previewFat",(f.fat*q/100).toFixed(1)+" g");
}

function renderFamily(){
  (async () => {
    try {
      const familyId = getCurrentFamily();
      if (!familyId) {
        document.getElementById("leaderboardContainer").innerHTML = 
          '<div style="text-align:center;padding:40px;color:var(--muted)"><h3>No family yet</h3><p>Create or join a family to get started.</p></div>';
        return;
      }
      
      // Check if current user is pending
      const membership = await getMyMembershipStatus(familyId);
      console.log("[RENDER_FAMILY] Current user membership:", membership);
      
      if (membership?.status === "pending") {
        // Load family name for the message
        const { data: family } = await window.supabaseClient.from("families").select("name").eq("id", familyId).maybeSingle();
        const familyName = family?.name || "the family";
        
        document.getElementById("leaderboardContainer").innerHTML = `
          <div style="text-align:center;padding:40px;background:#fff3cd;border-radius:10px">
            <h3 style="margin:0 0 12px 0">⏳ Waiting for Approval</h3>
            <p style="color:var(--muted);margin:0">You've requested to join <strong>${familyName}</strong>. Waiting for approval from the family admin.</p>
          </div>
        `;
        return;
      }
      
      // Get admin and family info for Leave/Delete buttons
      const admin = await isFamilyAdmin(familyId);
      const { data: family } = await window.supabaseClient.from("families").select("name").eq("id", familyId).maybeSingle();
      const familyName = family?.name || "Family";
      
      console.log("[RENDER_FAMILY] Is admin:", admin);
      
      // Add Leave/Delete buttons at the top
      const actionBtn = admin 
        ? `<button onclick="deleteCurrentFamily()" style="background:#d32f2f;color:white;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:14px">🗑️ Delete Family</button>`
        : `<button onclick="leaveCurrentFamily()" style="background:#ff9800;color:white;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:14px">👋 Leave Family</button>`;
      
      let headerHTML = `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
        <p class="eyebrow">LEADERBOARD</p>
        ${actionBtn}
      </div>`;
      
      if (admin) {
        const requests = await getPendingRequests(familyId);
        console.log("[RENDER_FAMILY] Pending requests:", requests);
        
        if (requests.length > 0) {
          const requestsHTML = requests.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f5f7f4;border-radius:8px;margin-bottom:8px">
              <div><strong>${r.display_name}</strong><br><small style="color:var(--muted)">${new Date(r.joined_at).toLocaleDateString()}</small></div>
              <div style="display:flex;gap:8px">
                <button onclick="approveRequest('${r.user_id}')" style="background:green;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer">✓</button>
                <button onclick="declineRequest('${r.user_id}')" style="background:red;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer">✗</button>
              </div>
            </div>
          `).join("");
          
          document.getElementById("leaderboardContainer").innerHTML = headerHTML + `
            <div style="margin-bottom:20px;padding:16px;background:#fff3cd;border-radius:10px">
              <h4 style="margin:0 0 12px 0">⏳ Pending Requests</h4>
              ${requestsHTML}
            </div>
            <div id="leaderboardRows"></div>
          `;
          
          // Make functions available globally
          window.approveRequest = async (userId) => {
            await approveMember(familyId, userId);
            renderFamily();
          };
          window.declineRequest = async (userId) => {
            await declineMember(familyId, userId);
            renderFamily();
          };
        } else {
          document.getElementById("leaderboardContainer").innerHTML = headerHTML + `<div id="leaderboardRows"></div>`;
        }
      } else {
        document.getElementById("leaderboardContainer").innerHTML = headerHTML + `<div id="leaderboardRows"></div>`;
      }
      
      // Make action functions available globally
      window.leaveCurrentFamily = async () => {
        if (confirm(`Leave "${familyName}"? You won't see this family's leaderboard anymore.`)) {
          try {
            await leaveFamily(familyId);
            toast("Left family!");
            // Reload families and switch to another or empty state
            const families = await loadUserFamilies();
            const familySelect = document.getElementById("familySelect");
            familySelect.innerHTML = families.length ? families.map(f => 
              `<option value="${f.id}">${f.name}</option>`
            ).join("") : '<option value="">No family</option>';
            
            if (families.length > 0) {
              setCurrentFamily(families[0].id);
              familySelect.value = families[0].id;
            } else {
              setCurrentFamily(null);
            }
            renderAll();
          } catch (error) {
            toast("Error leaving family: " + error.message);
          }
        }
      };
      
      window.deleteCurrentFamily = async () => {
        if (confirm(`Delete "${familyName}"? This cannot be undone. All members and data will be removed.`)) {
          try {
            await deleteFamily(familyId);
            toast("Family deleted!");
            // Reload families and switch to another or empty state
            const families = await loadUserFamilies();
            const familySelect = document.getElementById("familySelect");
            familySelect.innerHTML = families.length ? families.map(f => 
              `<option value="${f.id}">${f.name}</option>`
            ).join("") : '<option value="">No family</option>';
            
            if (families.length > 0) {
              setCurrentFamily(families[0].id);
              familySelect.value = families[0].id;
            } else {
              setCurrentFamily(null);
            }
            renderAll();
          } catch (error) {
            toast("Error deleting family: " + error.message);
          }
        }
      };
      
      // Load leaderboard below
      renderLeaderboard();
    } catch (error) {
      console.error("[RENDER_FAMILY] Error:", error);
      document.getElementById("leaderboardContainer").innerHTML = 
        `<div style="color:var(--muted);font-size:12px;padding:20px">Error loading family leaderboard: ${error.message}</div>`;
    }
  })();
}

function renderProgress(){
  const records=[]; 
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const k=d.toISOString().slice(0,10);
    records.push([k,data.history[k]||{percent:0,score:0,activity:0,nutrition:0,water:0,sleep:0}]);
  }
  setText("bestStreak",currentStreak()+" days");
  const scores=records.map(x=>x[1].score||0);setText("avgScore",Math.round(scores.reduce((a,b)=>a+b,0)/7).toLocaleString());
  setText("waterGoals",records.filter(x=>x[1].water>=25).length+"/7");setText("sleepGoals",records.filter(x=>x[1].sleep>=25).length+"/7");
  document.getElementById("weekChart").innerHTML=records.map(([k,r])=>{const d=new Date(k);return `<div class="day-bar"><strong>${r.score||0}</strong><div class="bar-track"><div class="bar-fill" style="height:${Math.max(4,(r.score||0))}%"></div></div><span>${d.toLocaleDateString("en-IN",{weekday:"short"}).slice(0,3)}</span></div>`}).join("");
}

function renderAll(){
  renderDashboard();
  renderMeals();
  renderFamily();
  renderProgress();
}

function showView(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(view+"View").classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll("[data-view-target]").forEach(b=>b.onclick=()=>showView(b.dataset.viewTarget));

const foodSelect=document.getElementById("foodSelect");
Object.keys(FOOD_DB).forEach(name=>{const o=document.createElement("option");o.value=name;o.textContent=name;foodSelect.appendChild(o)});
foodSelect.onchange=updatePreview;document.getElementById("foodQty").oninput=updatePreview;
document.getElementById("addMealBtn").onclick=()=>{
  const food=foodSelect.value,q=+document.getElementById("foodQty").value||0,f=FOOD_DB[food];
  if(q<=0)return toast("Enter a quantity first.");
  getToday().meals.push({food,type:document.getElementById("mealType").value,qty:q,calories:f.calories*q/100,protein:f.protein*q/100,carbs:f.carbs*q/100,fat:f.fat*q/100});
  save();renderAll();toast("Meal added 🍱");
};
document.getElementById("shakeBtn").onclick=async ()=>{
  console.log('[SHAKE_CLICK] Button clicked, current shake state:', getToday().shake);
  getToday().shake = !getToday().shake;
  console.log('[SHAKE_CLICK] Toggled shake to:', getToday().shake);
  await save();
  console.log('[SHAKE_CLICK] Save completed');
  renderAll();
  toast(getToday().shake ? "Protein shake logged 💪" : "Protein shake unchecked");
};
document.querySelectorAll("[data-water]").forEach(b=>b.onclick=()=>{getToday().water=Math.min(5000,getToday().water+ +b.dataset.water);save();renderAll();toast("Water added 💧")});
document.getElementById("saveSleep").onclick=()=>{const v=Math.max(0,+document.getElementById("sleepInput").value||0);getToday().sleep=v;save();renderAll();toast("Sleep saved 😴")};
document.getElementById("addActivityBtn").onclick=()=>{
  const selectEl=document.getElementById("activityType");
  const displayVal=selectEl.value;
  const type=displayVal.split(' ').pop().toLowerCase(); // Extract "walking" from "👟 Walking"
  const val=+document.getElementById("activityVal").value||0;
  if(val<=0)return toast("Enter a value first.");
  getToday().activities.push({type,value:val});
  save();renderAll();toast("Activity logged 🎉");document.getElementById("activityVal").value="";
};

// Family creation & invite link
const familyModal=document.getElementById("createFamilyModal");
document.getElementById("createFamilyBtn").onclick=()=>{familyModal.classList.remove("hidden")};
document.getElementById("closeFamilyModal").onclick=()=>familyModal.classList.add("hidden");
document.getElementById("createFamilySubmit").onclick=async ()=>{
  const familyName=document.getElementById("familyNameInput").value.trim();
  const cycleLength=+document.getElementById("cycleLengthInput").value || 30;
  if(!familyName)return toast("Enter a family name.");
  
  try {
    const family = await createFamily(familyName, cycleLength);
    console.log("[FAMILY] Created family:", family.id, "with token:", family.invite_token);
    toast("Family created!");
    familyModal.classList.add("hidden");
    document.getElementById("familyNameInput").value="";
    document.getElementById("cycleLengthInput").value="30";
    setCurrentFamily(family.id);
    console.log("[FAMILY] Set current family to:", family.id);
    generateInviteLink(family.invite_token);
    renderAll();
  } catch (error) {
    console.error("Failed to create family:", error);
    toast("Error creating family: " + error.message);
  }
};

function generateInviteLink(inviteToken){
  if(!inviteToken)return;
  const link=`${window.location.origin}${window.location.pathname}?join=${inviteToken}`;
  console.log("[INVITE] Generated link:", link);
  document.getElementById("familyLinkPanel").style.display="block";
  document.getElementById("inviteLinkDisplay").textContent=link;
  document.getElementById("whatsappBtn").onclick=()=>{
    const msg=`Join my NutriFam family! 💚 Track your health goals with us and compete on the leaderboard: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
  };
}

// Handle invite link — store token and join after auth
const params = new URLSearchParams(window.location.search);
const joinToken = params.get("join");

if (joinToken) {
  console.log("[INVITE] Token in URL:", joinToken);
  sessionStorage.setItem("pendingInviteToken", joinToken);
}

// Check if there's a pending invite token from a previous redirect
const pendingToken = sessionStorage.getItem("pendingInviteToken");
if (pendingToken) {
  console.log("[INVITE] Found pending token in sessionStorage:", pendingToken);
}

document.getElementById("profileBtn").onclick=async ()=>{
  const user = await getCurrentUser();
  if (user) {
    document.getElementById("profileEmail").textContent = user.email;
    document.getElementById("profileAvatar").textContent = user.email[0].toUpperCase();
    document.getElementById("profileName").textContent = user.email.split("@")[0];
    document.getElementById("profileModal").classList.remove("hidden");
  }
};

document.getElementById("closeProfileModal").onclick=()=>{
  document.getElementById("profileModal").classList.add("hidden");
};

document.getElementById("logoutBtn").onclick=async ()=>{
  try {
    await signOut();
    toast("Logged out successfully!");
    document.getElementById("profileModal").classList.add("hidden");
    window.location.reload();
  } catch (error) {
    toast("Logout failed: " + error.message);
  }
};

// Auth modal handlers
let isSignupMode = false;

function showAuthModal() {
  document.getElementById("authModal").classList.remove("hidden");
  isSignupMode = false;
  document.getElementById("authTitle").textContent = "Sign In";
  document.getElementById("authSubmit").textContent = "Sign In";
}

function hideAuthModal() {
  document.getElementById("authModal").classList.add("hidden");
}

document.getElementById("toggleSignup").onclick = (e) => {
  e.preventDefault();
  isSignupMode = !isSignupMode;
  document.getElementById("authTitle").textContent = isSignupMode ? "Create Account" : "Sign In";
  document.getElementById("authSubmit").textContent = isSignupMode ? "Sign Up" : "Sign In";
};

document.getElementById("authSubmit").onclick = async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value.trim();
  
  if (!email || !password) {
    toast("Please enter email and password");
    return;
  }
  
  try {
    if (isSignupMode) {
      await signUp(email, password);
      toast("Account created! Logging you in...");
      isSignupMode = false;
      document.getElementById("authTitle").textContent = "Sign In";
      document.getElementById("authSubmit").textContent = "Sign In";
    } else {
      await signIn(email, password);
      toast("Logged in successfully!");
      hideAuthModal();
      document.getElementById("authEmail").value = "";
      document.getElementById("authPassword").value = "";
      window.location.reload();
    }
  } catch (error) {
    toast("Auth error: " + error.message);
  }
};

// Demo mode button handler
document.getElementById("demoModeBtn").onclick = async () => {
  try {
    enableDemoMode();
    toast("Demo mode activated! Welcome!");
    hideAuthModal();
    window.location.reload();
  } catch (error) {
    toast("Failed to start demo mode: " + error.message);
  }
};

// Wait for Supabase to be initialized, then start app
async function waitForSupabase(maxRetries = 50) {
  for (let i = 0; i < maxRetries; i++) {
    if (window.supabaseClient) {
      console.log("✓ Supabase ready, starting app...");
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.warn("⚠ Supabase took too long to initialize, continuing anyway...");
  return false;
}

// Initialize app with user and family data
(async () => {
  try {
    // Diagnostic check for demo mode
    console.log('[STARTUP] Checking demo mode state...');
    console.log('[STARTUP] isDemoMode():', isDemoMode());
    console.log('[STARTUP] localStorage.demoMode:', localStorage.getItem('demoMode'));
    console.log('[STARTUP] localStorage keys with "demo":', Object.keys(localStorage).filter(k => k.includes('demo')));
    
    // Wait for Supabase client to be initialized
    await waitForSupabase();
    
    // CHECK AUTH STATE FIRST - directly from Supabase, don't rely on currentUser variable
    console.log('[AUTH_CHECK] Starting direct Supabase auth check...');
    const supabase = window.supabaseClient;
    if (!supabase) {
      console.error('[AUTH_CHECK] Supabase not initialized!');
      throw new Error("Supabase not initialized");
    }
    
    const { data: { user: sbUser }, error: authError } = await supabase.auth.getUser();
    console.log('[AUTH_CHECK] supabase.auth.getUser() returned:', { user: sbUser ? { id: sbUser.id, email: sbUser.email } : null, authError });
    if (authError) {
      console.error('[AUTH_CHECK] Auth error:', authError);
    }
    
    const user = sbUser || await getCurrentUser();
    console.log('[AUTH_CHECK] Final user object:', user ? { id: user.id, email: user.email } : null);
    
    // CRITICAL: Explicitly set currentUser so getUserId() can access it
    if (user) {
      setCurrentUser(user);
      console.log('[AUTH_CHECK] Called setCurrentUser(), getUserId() should now return:', getUserId());
    }
    
    // If no user, show auth modal
    if (!user) {
      console.log("No user logged in - showing auth modal");
      showAuthModal();
      
      // Still load basic UI
      const now = new Date();
      setText("dateLabel", now.toLocaleDateString("en-IN", {weekday:"long", day:"numeric", month:"long", year:"numeric"}).toUpperCase());
      setText("greeting", `Good ${now.getHours()<12?"morning":now.getHours()<18?"afternoon":"evening"}, Guest 👋`);
      setText("sidebarTip", MOTIVATIONS[now.getDate()%MOTIVATIONS.length][0]);
      updatePreview();
      renderAll();
      return;
    }
    
    const displayName = await getUserDisplayName();
    const now = new Date();
    
    setText("dateLabel", now.toLocaleDateString("en-IN", {weekday:"long", day:"numeric", month:"long", year:"numeric"}).toUpperCase());
    const userName = displayName || user.email?.split("@")[0] || "User";
    setText("greeting", `Good ${now.getHours()<12?"morning":now.getHours()<18?"afternoon":"evening"}, ${userName} 👋`);
    setText("profileAvatar", userName[0].toUpperCase());
    setText("profileName", userName);
    setText("sidebarTip", MOTIVATIONS[now.getDate()%MOTIVATIONS.length][0]);
    
    // Load user's families from DB (source of truth)
    console.log('[INIT] Starting family load');
    console.log('[INIT] data.today at module load:', JSON.stringify(data.today));
    try {
      const families = await loadUserFamilies();
      console.log('[INIT] loadUserFamilies returned:', families);
      
      // Populate family switcher
      const familySelect = document.getElementById("familySelect");
      familySelect.innerHTML = families.length ? families.map(f => 
        `<option value="${f.id}">${f.name}</option>`
      ).join("") : '<option value="">No family</option>';
      
      // Check for pending invite FIRST - before loading families
      const pendingToken = sessionStorage.getItem("pendingInviteToken");
      if (pendingToken) {
        console.log("[FAMILY] Processing pending invite token first");
        try {
          const family = await joinFamilyByToken(pendingToken);
          sessionStorage.removeItem("pendingInviteToken");
          setCurrentFamily(family.id);
          document.getElementById("familySelect").innerHTML += `<option value="${family.id}">${family.name}</option>`;
          document.getElementById("familySelect").value = family.id;
          toast("Joined family! Waiting for approval.");
          renderAll();
          return;
        } catch (joinError) {
          console.error("[FAMILY] Error joining via invite:", joinError.message);
          toast("Error joining family: " + joinError.message);
        }
      }
      
      if (families.length > 0) {
        const familyId = families[0].id;
        setCurrentFamily(familyId);
        console.log('[INIT] Set currentFamilyId to:', familyId);
        
        // Check if user is pending
        const membership = await getMyMembershipStatus(familyId);
        console.log('[INIT] membership status:', membership);
        if (membership?.status === "pending") {
          console.log("[FAMILY] User is pending approval");
          const { data: family } = await window.supabaseClient.from("families").select("name").eq("id", familyId).maybeSingle();
          const familyName = family?.name || "the family";
          document.getElementById("leaderboardContainer").innerHTML = 
            `<div style="text-align:center;padding:40px;background:#fff3cd;border-radius:10px"><h3 style="margin:0 0 12px 0">⏳ Waiting for Approval</h3><p style="color:var(--muted);margin:0">You've requested to join <strong>${familyName}</strong>. Waiting for approval from the family admin.</p></div>`;
          renderAll();
          return;
        }
        
        console.log('[INIT] User is approved, calling loadTodayLog...');
        const todayLog = await loadTodayLog();
        console.log('[INIT] loadTodayLog returned:', JSON.stringify(todayLog));
        console.log('[INIT] data.today BEFORE assignment:', JSON.stringify(data.today));
        if (todayLog) {
          data.today = todayLog;
          console.log('[INIT] data.today AFTER assignment:', JSON.stringify(data.today));
        } else {
          console.log('[INIT] loadTodayLog returned null/undefined - keeping default values');
        }
      } else {
        console.log("[FAMILY] No families found for user");
      }
    } catch (familyError) {
      console.warn("Could not load families:", familyError.message);
    }
    
    updatePreview();
    renderAll();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    const now = new Date();
    setText("dateLabel", now.toLocaleDateString("en-IN", {weekday:"long", day:"numeric", month:"long", year:"numeric"}).toUpperCase());
    setText("greeting", `Good ${now.getHours()<12?"morning":now.getHours()<18?"afternoon":"evening"}, Guest 👋`);
    setText("sidebarTip", MOTIVATIONS[now.getDate()%MOTIVATIONS.length][0]);
    updatePreview();
    renderAll();
  }
})();

// Family switcher
document.getElementById("familySelect").onchange = async (e) => {
  const familyId = e.target.value;
  console.log('[FAMILY_SWITCH] Selected family:', familyId);
  if (!familyId) {
    setCurrentFamily(null);
    renderAll();
    return;
  }
  setCurrentFamily(familyId);
  // Check membership status
  const membership = await getMyMembershipStatus(familyId);
  console.log('[FAMILY_SWITCH] Membership status:', membership);
  if (membership?.status === "pending") {
    const { data: family } = await window.supabaseClient.from("families").select("name").eq("id", familyId).maybeSingle();
    const familyName = family?.name || "the family";
    document.getElementById("leaderboardContainer").innerHTML = 
      `<div style="text-align:center;padding:40px;background:#fff3cd;border-radius:10px"><h3 style="margin:0 0 12px 0">⏳ Waiting for Approval</h3><p style="color:var(--muted);margin:0">You've requested to join <strong>${familyName}</strong>. Waiting for approval from the family admin.</p></div>`;
  } else {
    console.log('[FAMILY_SWITCH] Loading today log for new family...');
    const todayLog = await loadTodayLog();
    console.log('[FAMILY_SWITCH] todayLog:', todayLog);
    if (todayLog) {
      data.today = todayLog;
      console.log('[FAMILY_SWITCH] Updated data.today');
    }
    renderAll();
  }
};

// Show member score detail
function showMemberDetail(index) {
  if (!window.leaderboardData || !window.leaderboardData[index]) return;
  
  const member = window.leaderboardData[index];
  
  // Calculate percentages for display
  const activityPct = Math.min(100, Math.round((member.activity / 25) * 100));
  const nutritionPct = Math.min(100, Math.round((member.nutrition / 25) * 100));
  const waterPct = Math.min(100, Math.round((member.water / 25) * 100));
  const sleepPct = Math.min(100, Math.round((member.sleep / 25) * 100));
  
  // Update modal content
  document.getElementById("detailMemberName").textContent = member.name;
  document.getElementById("detailActivity").textContent = `🏃 ${activityPct}% of goal`;
  document.getElementById("detailActivityPts").textContent = `${Math.round(member.activity)} / 25 pts`;
  document.getElementById("detailNutrition").textContent = `🥗 ${nutritionPct}% of goal`;
  document.getElementById("detailNutritionPts").textContent = `${Math.round(member.nutrition)} / 25 pts`;
  document.getElementById("detailWater").textContent = `💧 ${waterPct}% of goal`;
  document.getElementById("detailWaterPts").textContent = `${Math.round(member.water)} / 25 pts`;
  document.getElementById("detailSleep").textContent = `😴 ${sleepPct}% of goal`;
  document.getElementById("detailSleepPts").textContent = `${Math.round(member.sleep)} / 25 pts`;
  document.getElementById("detailTotalScore").textContent = member.total;
  
  // Show modal
  document.getElementById("memberDetailModal").classList.remove("hidden");
}
