// ---------- helpers ----------
const byId = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0,10);
const dayKey = (offset)=>{ const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); };
const dowIndex = ()=> (new Date().getDay()+6)%7; // Mon=0..Sun=6

function saveUser(u){ localStorage.setItem('wp_user', JSON.stringify(u)); }
function getUser(){ try{ return JSON.parse(localStorage.getItem('wp_user')||'null'); }catch{ return null; } }

function saveAnswers(a){ localStorage.setItem('wp_answers', JSON.stringify(a)); }
function getAnswers(){ try{ return JSON.parse(localStorage.getItem('wp_answers')||'null'); }catch{ return null; } }
function defaultAnswers(){ return {age:25,height:170,weight:65,gender:'female',activity:'moderate',ideal:60,goal:'auto',build:'toned',location:'home',sleep:7,vegan:false,allergies:[]}; }

function getProgress(){ try{ return JSON.parse(localStorage.getItem('wp_progress')||'{"doneDays":[],"streak":0,"weekDone":[]}'); }catch{ return {doneDays:[],streak:0,weekDone:[]}; } }
function saveProgress(p){ localStorage.setItem('wp_progress', JSON.stringify(p)); }

function resetAll(){ localStorage.removeItem('wp_user'); localStorage.removeItem('wp_answers'); localStorage.removeItem('wp_progress'); location.href='index.html'; }

// ---------- calculations ----------
function bmr(w,h,age,gender){ const base=10*w+6.25*h-5*age; return gender==='male'?base+5:gender==='female'?base-161:base-78; }
function computeMetrics(ans){
  const act = {sedentary:1.2, light:1.375, moderate:1.55, active:1.725, athlete:1.9};
  const bmi = ans.weight/((ans.height/100)**2);
  const bmiCat = bmi<18.5?'Under':bmi<25?'Normal':bmi<30?'Over':'Obese';
  const BMR = Math.round(bmr(ans.weight,ans.height,ans.age,ans.gender));
  const TDEE = Math.round(BMR*(act[ans.activity]||1.55));
  const goal = ans.goal!=='auto'?ans.goal:(ans.ideal? (ans.ideal<ans.weight-0.5?'lose':ans.ideal>ans.weight+0.5?'gain':'maintain') : 'maintain');
  const target = goal==='lose'?Math.max(1200,TDEE-500):goal==='gain'?TDEE+300:TDEE;
  const protein = Math.round((goal==='lose'?1.8:1.6)*ans.weight);
  const fatKcal = Math.round(target*(goal==='lose'?0.25:0.30));
  const fat = Math.round(fatKcal/9);
  const carbs = Math.max(0, Math.round((target - protein*4 - fatKcal)/4));
  const waterMl = Math.round(ans.weight*32);
  return {bmi,bmiCat,BMR,TDEE,goal,target,protein,carbs,fat,waterMl};
}

function kpi(label,val){ return `<div class="kpi"><div class="label">${label}</div><div class="val">${val}</div></div>`; }

// ---------- foods ----------
const FOODS = {
  omni:{
    breakfast:[
      {n:'Greek yogurt + berries + chia',t:['dairy']},
      {n:'Veggie omelette + toast',t:['eggs','gluten']},
      {n:'Oats + milk + banana',t:['gluten','dairy']},
      {n:'Besan chilla + curd',t:['dairy']},
      {n:'Protein smoothie (whey) + fruit',t:['dairy']},
      {n:'Poha + peanuts',t:['nuts']}
    ],
    lunch:[
      {n:'Grilled chicken salad + olive oil',t:[]},
      {n:'Paneer + quinoa + salad',t:['dairy']},
      {n:'Dal + brown rice + veg',t:[]},
      {n:'Fish + potatoes + greens',t:[]},
      {n:'Turkey/soy mince + rice',t:['soy']},
      {n:'Buddha bowl (chicken/tofu)',t:['soy']}
    ],
    snack:[
      {n:'Apple + peanut butter',t:['nuts']},
      {n:'Greek yogurt',t:['dairy']},
      {n:'Roasted chana',t:[]},
      {n:'Cheese + crackers',t:['dairy','gluten']},
      {n:'Protein shake',t:[]},
      {n:'Mixed nuts (small)',t:['nuts']}
    ],
    dinner:[
      {n:'Chicken + rice + veg',t:[]},
      {n:'Paneer tikka + roti',t:['dairy','gluten']},
      {n:'Tofu stir-fry + rice',t:['soy']},
      {n:'Egg curry + potatoes',t:['eggs']},
      {n:'Baked fish + vegetables',t:[]},
      {n:'Dal + quinoa + salad',t:[]}
    ]
  },
  vegan:{
    breakfast:[
      {n:'Overnight oats + plant milk + berries',t:['gluten']},
      {n:'Tofu scramble + hash',t:['soy']},
      {n:'Chickpea pancakes + salsa',t:[]},
      {n:'Smoothie (plant protein) + banana',t:[]},
      {n:'Dosa + sambar',t:[]},
      {n:'Poha + peas',t:[]}
    ],
    lunch:[
      {n:'Chana salad + olive oil',t:[]},
      {n:'Tofu rice bowl + veg',t:['soy']},
      {n:'Dal + brown rice + salad',t:[]},
      {n:'Veg biryani',t:[]},
      {n:'Buddha bowl (beans, quinoa)',t:[]},
      {n:'Veg stir-fry + rice',t:[]}
    ],
    snack:[
      {n:'Roasted chana',t:[]},
      {n:'Fruit + seed mix',t:[]},
      {n:'Hummus + veggie sticks',t:[]},
      {n:'Plant protein shake',t:[]},
      {n:'Dates + peanuts',t:['nuts']},
      {n:'Popcorn (air-popped)',t:[]}
    ],
    dinner:[
      {n:'Rajma + rice + salad',t:[]},
      {n:'Tofu/tempeh + potatoes + greens',t:['soy']},
      {n:'Khichdi + veg',t:[]},
      {n:'Soya chaap + roti',t:['soy','gluten']},
      {n:'Veg curry + quinoa',t:[]},
      {n:'Lentil pasta + sauce',t:[]}
    ]
  }
};

function safeList(list, allergies){
  const out = list.filter(x=>!x.t.some(t=>allergies.includes(t)));
  return out.length? out : [{n:'Rice + lentils + vegetables',t:[]}];
}
function safeDaily(bank, allergies, i){
  const B=safeList(bank.breakfast, allergies), L=safeList(bank.lunch, allergies),
        S=safeList(bank.snack, allergies), D=safeList(bank.dinner, allergies);
  const pick = (arr,i)=> arr[i % arr.length].n;
  return {breakfast:pick(B,i), lunch:pick(L,i), snack:pick(S,i), dinner:pick(D,i)};
}

// ---------- workouts ----------
function baseHome(){
  return [
    'Full-body: squats 3×12, push-ups 3×AMRAP, band rows 3×12 · Walk 20–30 min',
    'Mobility + core: dead bug 3×10/side, side plank 3×30s/side · Zone-2 30–40 min',
    'Lower: split squats 3×10/side, glute bridge 4×12, calf raises 3×15',
    'Active recovery: 8–10k steps + stretch 10–15 min',
    'Upper: pike push-up 3×8–12, band row 4×12, curls 3×12, triceps 3×12',
    'Intervals: 8×1 min hard / 1 min easy (run/bike/rope)',
    'Rest or gentle yoga 20–30 min'
  ].map(x=>x);
}
function baseGym(){
  return [
    'Push: bench 4×6–8, incline DB 3×8–10, OHP 3×8, triceps 3×12 · Walk 10–15 min',
    'Pull: deadlift 3×3–5, pulldown 4×8–10, row 3×8–10, curls 3×12',
    'Legs: squat 4×5–8, RDL 3×8–10, leg press 3×12, calf 3×15',
    'Cardio + core: Zone-2 35–45 min, plank 3×45s, leg raise 3×12',
    'Upper volume: incline 4×10, row 4×10, lateral raise 3×15',
    'Conditioning: 10×1 min intervals',
    'Rest / long walk'
  ];
}
function tweakGoal(arr, goal){
  return arr.map(x=>{
    if(goal==='lose') return x + ' · Finish: Zone-2 15–20 min';
    if(goal==='gain') return x + ' · Add 1–2 clean sets if form is solid';
    return x;
  });
}
function baseHomeFull(){ return [
  ['Squats 3×12','Push-ups 3×AMRAP','Band rows 3×12','Walk 20–30 min'],
  ['Dead bug 3×10/side','Side plank 3×30s/side','Zone-2 30–40 min'],
  ['Split squats 3×10/side','Glute bridge 4×12','Calf raises 3×15'],
  ['Walk 8–10k','Stretch 10–15 min'],
  ['Pike push-up 3×8–12','Band row 4×12','Biceps 3×12','Triceps 3×12'],
  ['Intervals 8×1 min hard / 1 min easy'],
  ['Yoga 20–30 min or rest']
];}
function baseGymFull(){ return [
  ['Bench 4×6–8','Incline DB 3×8–10','OHP 3×8','Triceps 3×12','Walk 10–15'],
  ['Deadlift 3×3–5','Lat pulldown 4×8–10','Row 3×8–10','Curls 3×12'],
  ['Squat 4×5–8','RDL 3×8–10','Leg press 3×12','Calf 3×15'],
  ['Zone-2 35–45 min','Plank 3×45s','Leg raise 3×12'],
  ['Incline 4×10','Row 4×10','Lateral raise 3×15'],
  ['Intervals 10×1 min'],
  ['Rest / long walk']
];}

// ---------- tips ----------
function tipsBank(ans, calc){
  const t=[];
  if(calc.goal==='lose') t.push('Protein + fiber each meal; plan snacks to stay ahead of hunger.');
  if(calc.goal==='gain') t.push('Progressive overload: add a rep or a little weight weekly.');
  if(calc.bmi>=25) t.push('Accumulate 7–9k steps across the day; small bouts add up.');
  if(calc.bmi<18.5) t.push('Use calorie-dense foods and post-workout smoothies to grow without feeling stuffed.');
  if(ans.vegan) t.push('Vary plant proteins (tofu/tempeh, beans, lentils); include B12 and iron sources.');
  if(ans.location==='home') t.push('A pair of adjustable dumbbells and a band cover 90% of moves.');
  if(ans.location==='gym') t.push('Master the hinge, squat, push, pull; ask for a form check if unsure.');
  if(ans.sleep && ans.sleep<7) t.push('Protect a consistent bedtime; dim screens 60 minutes before sleep.');
  t.push(`Hydration target ~${calc.waterMl} ml. Increase in heat or long sessions.`);
  return t;
}

// ---------- draw mini pie ----------
function drawPie(id, vals, colors){
  const c = byId(id); if(!c) return;
  const ctx = c.getContext('2d');
  const total = vals.reduce((a,b)=>a+b,0);
  let start=0;
  ctx.clearRect(0,0,c.width,c.height);
  vals.forEach((v,i)=>{
    const ang = (v/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(90,90);
    ctx.arc(90,90,90,start,start+ang);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    start += ang;
  });
}

// ---------- exports to pages ----------
window.computeMetrics = computeMetrics;
window.kpi = kpi;
window.FOODS = FOODS;
window.safeDaily = safeDaily;
window.baseGym = ()=> tweakGoal(baseGym(), (getAnswers()?computeMetrics(getAnswers()).goal:'maintain'));
window.baseHome = ()=> tweakGoal(baseHome(), (getAnswers()?computeMetrics(getAnswers()).goal:'maintain'));
window.baseGymFull = baseGymFull;
window.baseHomeFull = baseHomeFull;
window.tipsBank = tipsBank;
window.getUser = getUser;
window.getAnswers = getAnswers;
window.saveAnswers = saveAnswers;
window.defaultAnswers = defaultAnswers;
window.getProgress = getProgress;
window.saveProgress = saveProgress;
window.resetAll = resetAll;
window.todayKey = todayKey;
window.dayKey = dayKey;
window.dowIndex = dowIndex;
