// Import Supabase database functions
import {
  saveDailyLog,
  loadTodayLog,
  loadFamilyLeaderboard,
  createFamily,
  joinFamilyByToken,
  getCurrentFamily,
  setCurrentFamily,
  loadUserFamilies
} from "./supabase-db.js";

import {
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  getUserId,
  getUserDisplayName
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
  profile: {name:"Arpita"},
  familyId: "",
  families: {}, // {token: {name, members: [], createdBy}}
  today: {water:0, activities:[], nutrition:{protein:0,fibre:0,carbs:0,fats:0}, sleep:0, shake:false, shakeProtein:26, meals:[]},
  history: {},
  family: [
    {name:"Arpita", initials:"A", activity:[], nutrition:{protein:0,fibre:0,carbs:0,fats:0}, water:0, sleep:0, status:"You"},
    {name:"Mom", initials:"M", activity:[{type:"walking",value:8450}], nutrition:{protein:55,fibre:20,carbs:180,fats:45}, water:2000, sleep:7.5, status:"Great day"},
    {name:"Dad", initials:"D", activity:[{type:"running",value:4}], nutrition:{protein:70,fibre:28,carbs:260,fats:65}, water:2000, sleep:8, status:"Strong"},
    {name:"Brother", initials:"B", activity:[{type:"walking",value:6210}], nutrition:{protein:45,fibre:18,carbs:150,fats:40}, water:1200, sleep:6, status:"Keep going"}
  ]
};

let data = structuredClone(defaultData);

async function save(){
  try {
    await saveDailyLog(data.today);
  } catch (error) {
    console.error("Failed to save daily log:", error);
    toast("Error saving data: " + error.message);
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

// Recalculate scores for all family members from their data
function recalculateAllScores() {
  data.family.forEach(member => {
    member.score = totalScore(member);
  });
  // Sort by score descending
  data.family.sort((a, b) => b.score - a.score);
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
  recalculateAllScores();
  const sorted=[...data.family].sort((a,b)=>b.score-a.score);
  document.getElementById("miniFamily").innerHTML=`<div class="family-mini">${sorted.slice(0,4).map((x,i)=>`
    <div class="family-row"><div class="mini-avatar">${x.initials}</div><div class="family-info"><strong>${x.name}${i===0?" 👑":""}</strong><small>${x.status}</small></div><span class="score">${x.score} pts</span></div>`).join("")}</div>`;
}

function renderLeaderboard(){
  // Load leaderboard from Supabase
  (async () => {
    try {
      const logs = await loadFamilyLeaderboard();
      const userId = getUserId();
      const viewerName = userId;
      
      // Calculate scores for each member
      const members = logs.map(log => ({
        ...log,
        score: totalScore(log)
      }));
      
      // Sort by score descending
      const sorted = members.sort((a, b) => b.score - a.score);
      const leaderScore = sorted[0]?.score || 0;
      
      const html = sorted.map((x, i) => {
        const breakdown = scoreBreakdown(x);
        const isViewer = x.userId === userId;
        const motivational = isViewer ? motivationalMessage(x, leaderScore, true) : '';
        
        return `
    <div class="leaderboard-row">
      <span class="leaderboard-rank">${i===0?"👑":["🥈","🥉",...Array(sorted.length-2).fill(i+1)][i]}</span>
      <div class="leaderboard-member">
        <span class="leaderboard-member-name">${x.name}</span>
        <span class="leaderboard-member-stats">🔥${breakdown.activity}|🍱${breakdown.nutrition}|💧${breakdown.water}|😴${breakdown.sleep}</span>
        ${motivational ? `<span class="leaderboard-motivational">${motivational}</span>` : ''}
      </div>
      <span class="leaderboard-score">${x.score}</span>
    </div>
  `}).join("");
      
      document.getElementById("leaderboardContainer").innerHTML = html;
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
  recalculateAllScores();
  renderLeaderboard();
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
  // Update current user's entry in family list with today's data
  const userIdx = data.family.findIndex(m => m.name === data.profile.name);
  if(userIdx >= 0) {
    data.family[userIdx] = { ...data.family[userIdx], ...data.today };
    data.family[userIdx].score = totalScore(data.family[userIdx]);
  }
  
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
document.getElementById("shakeBtn").onclick=()=>{getToday().shake=!getToday().shake;save();renderAll();toast(getToday().shake?"Protein shake logged 💪":"Protein shake unchecked")};
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
  if(!familyName)return toast("Enter a family name.");
  
  try {
    const family = await createFamily(familyName);
    toast("Family created!");
    familyModal.classList.add("hidden");
    document.getElementById("familyNameInput").value="";
    setCurrentFamily(family.id);
    generateInviteLink();
    renderAll();
  } catch (error) {
    console.error("Failed to create family:", error);
    toast("Error creating family: " + error.message);
  }
};

function generateInviteLink(){
  const familyId = getCurrentFamily();
  if(!familyId)return;
  const link=`${window.location.origin}${window.location.pathname}?join=${familyId}`;
  document.getElementById("familyLinkPanel").style.display="block";
  document.getElementById("inviteLinkDisplay").textContent=link;
  document.getElementById("whatsappBtn").onclick=()=>{
    const msg=`Join my NutriFam family! 💚 Track your health goals with us and compete on the leaderboard: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
  };
}

// Handle invite link — auto-join family if logged in
const params=new URLSearchParams(window.location.search);
const joinToken=params.get("join");

if(joinToken) {
  (async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.log("User needs to log in first");
        // In production, redirect to login, then redirect back with token
        return;
      }
      
      const family = await joinFamilyByToken(joinToken);
      toast("Joined family!");
      setCurrentFamily(family.id);
      showView("family");
      renderAll();
    } catch (error) {
      console.error("Failed to join family:", error);
      toast("Error joining family: " + error.message);
    }
  })();
}

document.getElementById("profileBtn").onclick=()=>toast("Profile settings coming in the next version.");

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
    // Wait for Supabase client to be initialized
    await waitForSupabase();
    
    const user = await getCurrentUser();
    const displayName = user ? await getUserDisplayName() : "Guest";
    const now = new Date();
    
    setText("dateLabel", now.toLocaleDateString("en-IN", {weekday:"long", day:"numeric", month:"long", year:"numeric"}).toUpperCase());
    setText("greeting", `Good ${now.getHours()<12?"morning":now.getHours()<18?"afternoon":"evening"}, ${displayName} 👋`);
    setText("sidebarTip", MOTIVATIONS[now.getDate()%MOTIVATIONS.length][0]);
    
    // Load user's families and set first one as current
    if (user) {
      try {
        const families = await loadUserFamilies();
        if (families.length > 0) {
          setCurrentFamily(families[0].id);
          const todayLog = await loadTodayLog();
          if (todayLog) {
            data.today = todayLog;
          }
        }
      } catch (familyError) {
        console.warn("Could not load families:", familyError.message);
      }
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
