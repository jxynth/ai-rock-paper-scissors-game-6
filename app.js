// Predictor AI that decides BEFORE player input using n-gram/Markov patterns
let model = {
  history: [],          // user move history
  freq: { rock:0, paper:0, scissors:0 },
  trans1: { rock:{rock:0,paper:0,scissors:0}, paper:{rock:0,paper:0,scissors:0}, scissors:{rock:0,paper:0,scissors:0} },
  trans2: {}            // key: "a-b" -> {rock:..,paper:..,scissors:..}
};

let round = { aiLocked: null, playing: false };

const els = {
  video: document.getElementById('hiddenVideo'),
  previewVideo: document.getElementById('previewVideo'),
  previewContainer: document.querySelector('.camera-preview-container'),
  play: document.getElementById('playBtn'),
  cameraToggle: document.getElementById('cameraToggle'),
  themeToggle: document.getElementById('themeToggle'),
  reset: document.getElementById('resetBtn'),
  status: document.getElementById('cameraStatus'),
  tabs: document.querySelectorAll('.tab'),
  modes: { camera: document.getElementById('cameraMode'), manual: document.getElementById('manualMode') },
  countdown: document.getElementById('countdown'),
  pulse: document.querySelector('.pulse-ring'),
  humanHand: document.getElementById('humanHand'),
  aiHand: document.getElementById('aiHand'),
  outcome: document.getElementById('outcome'),
  y: document.getElementById('yourScore'),
  a: document.getElementById('aiScore'),
  aiIndicator: document.getElementById('aiIndicator'),
  notice: document.getElementById('manualNotice')
};

let score = { y:0, a:0 };
let cameraReady = false; let dark=false; let samples=[];

// MediaPipe Hands
const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands:1, selfieMode:true, modelComplexity:1, minDetectionConfidence:0.5, minTrackingConfidence:0.7 });

function detectGesture(lm){
  if (!lm) return 'none';
  const upI = lm[8].y < lm[6].y; const upM = lm[12].y < lm[10].y; const upR = lm[16].y < lm[14].y; const upP = lm[20].y < lm[18].y; const upT = lm[4].x < lm[3].x;
  let minx=1,miny=1,maxx=0,maxy=0; for (const p of lm){ minx=Math.min(minx,p.x); miny=Math.min(miny,p.y); maxx=Math.max(maxx,p.x); maxy=Math.max(maxy,p.y); }
  const scale = Math.hypot(maxx-minx, maxy-miny);
  const gap=(a,b)=> Math.hypot(lm[a].x-lm[b].x, lm[a].y-lm[b].y);
  const gIM=gap(8,12), gMR=gap(12,16), gRP=gap(16,20); const minSpread=Math.min(gIM,gMR,gRP);
  if (!upT && !upI && !upM && !upR && !upP) return 'rock';
  if ( upT &&  upI &&  upM &&  upR &&  upP && minSpread>0.12*scale) return 'paper';
  if (!upT &&  upI &&  upM && !upR && !upP && gIM>0.16*scale) return 'scissors';
  return 'none';
}

hands.onResults(res=>{ if (round.playing && res.multiHandLandmarks?.[0]){ const g = detectGesture(res.multiHandLandmarks[0]); if (g!=='none') samples.push(g); } });

// Camera
async function enableCamera(){ 
  try{ 
    const s=await navigator.mediaDevices.getUserMedia({ 
      video:{ facingMode:{ideal:'user'}, width:{ideal:1280}, height:{ideal:720} } 
    }); 
    
    els.video.srcObject = s;
    els.previewVideo.srcObject = s;
    
    await els.video.play();
    await els.previewVideo.play();
    
    // Show the preview
    els.previewContainer.classList.remove('hidden');
    
    const loop=async()=>{ 
      await hands.send({ image: els.video }); 
      requestAnimationFrame(loop); 
    }; 
    loop(); 
    
    cameraReady=true; 
    els.status.textContent='Camera ready! Press Play to start'; 
    els.play.disabled=false; 
    els.cameraToggle.textContent='📷 Hide Cam'; 
  } catch(e){ 
    console.error(e); 
    els.status.textContent='Camera denied or unavailable'; 
    // Hide preview on error
    els.previewContainer.classList.add('hidden');
  } 
}

// Pattern model updates
function updateModels(userMove){
  model.history.push(userMove); model.freq[userMove]++;
  const n = model.history.length; if (n>=2){ const prev = model.history[n-2]; model.trans1[prev][userMove]++; }
  if (n>=3){ const k = model.history[n-3]+'-'+model.history[n-2]; if(!model.trans2[k]) model.trans2[k]={rock:0,paper:0,scissors:0}; model.trans2[k][userMove]++; }
}

function argmaxCount(obj){ let best=null, bestc=-1; for (const k in obj){ if (obj[k]>bestc){ best=k; bestc=obj[k]; } } return best; }

function predictNext(){
  const n = model.history.length; if (n>=2){ const k = model.history[n-2]+'-'+model.history[n-1]; if (model.trans2[k]){ const best = argmaxCount(model.trans2[k]); if (model.trans2[k][best]>0) return best; } }
  if (n>=1){ const prev = model.history[n-1]; const best = argmaxCount(model.trans1[prev]); if (model.trans1[prev][best]>0) return best; }
  const bestGlobal = argmaxCount(model.freq); if (model.freq[bestGlobal]>0) return bestGlobal; return ['rock','paper','scissors'][Math.floor(Math.random()*3)];
}

function counter(m){ return ({rock:'paper', paper:'scissors', scissors:'rock'})[m]; }

function lockAiMove(){ const predicted = predictNext(); round.aiLocked = counter(predicted); els.aiIndicator.textContent = 'AI: locked'; }

function revealAiMove(){ const map={rock:'🗿',paper:'📄',scissors:'✂️'}; els.aiHand.textContent = map[round.aiLocked] || '✋'; }

function finish(user){ revealAiMove(); const ai=round.aiLocked||['rock','paper','scissors'][Math.floor(Math.random()*3)]; const map={rock:'🗿',paper:'📄',scissors:'✂️'}; els.humanHand.textContent=map[user]; let res='tie', msg="It's a tie!"; if (user!==ai){ const win={rock:'scissors',paper:'rock',scissors:'paper'}; if (win[user]===ai){ res='win'; msg='You win!'; score.y++; } else { res='lose'; msg='AI wins!'; score.a++; } } els.outcome.textContent=msg; els.outcome.className='outcome '+res; els.y.textContent=String(score.y); els.a.textContent=String(score.a); // reset displays later
  setTimeout(()=>{ els.humanHand.textContent='✋'; els.aiHand.textContent='✋'; }, 1500);
  updateModels(user); round.aiLocked=null; }

function animateHands(){ els.humanHand.classList.add('shake'); els.aiHand.classList.add('shake'); setTimeout(()=>{ els.humanHand.classList.remove('shake'); els.aiHand.classList.remove('shake'); }, 600); }

async function playRound(){ if (!cameraReady || round.playing) return; round.playing=true; samples.length=0; lockAiMove(); els.play.textContent='⏸ Stop'; animateHands(); const seq=['AI ready','3','2','1','Show!']; let i=0; const iv=setInterval(()=>{ els.countdown.textContent=seq[i++]||'Show!'; if(i>=seq.length){ clearInterval(iv);} }, 700); setTimeout(()=>{ const valid=samples.filter(s=>s!=='none'); if (!valid.length){ els.outcome.textContent='No gesture detected. Try again!'; els.outcome.className='outcome'; round.aiLocked=null; } else { const user = argmaxCount(valid.reduce((acc,v)=>(acc[v]=(acc[v]||0)+1,acc),{})); finish(user); } els.countdown.textContent='Ready?'; els.play.textContent='▶ Play Round'; els.aiIndicator.textContent='AI: waiting…'; round.playing=false; }, 1500); }

function onManualStart(){ if (!round.aiLocked) { lockAiMove(); els.notice.textContent='AI locked. Choose your move.'; } }

function manualChoose(user){ if (!round.aiLocked) lockAiMove(); animateHands(); setTimeout(()=> finish(user), 600); els.aiIndicator.textContent='AI: waiting…'; }

function switchMode(m){ document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.mode===m)); Object.entries(els.modes).forEach(([k,v])=> v.classList.toggle('active', k===m)); if (m==='manual') onManualStart(); }

function reset(){ score={y:0,a:0}; els.y.textContent='0'; els.a.textContent='0'; els.outcome.textContent='Game reset! Ready?'; els.outcome.className='outcome'; model={ history:[], freq:{rock:0,paper:0,scissors:0}, trans1:{ rock:{rock:0,paper:0,scissors:0}, paper:{rock:0,paper:0,scissors:0}, scissors:{rock:0,paper:0,scissors:0} }, trans2:{} }; round.aiLocked=null; els.aiIndicator.textContent='AI: waiting…'; }

function toggleTheme(){ dark=!dark; document.body.classList.toggle('dark', dark); els.themeToggle.textContent = dark? '☀️ Light' : '🌙 Dark'; localStorage.setItem('darkMode', dark); }

// Wire events
els.play.addEventListener('click', playRound);
els.cameraToggle.addEventListener('click', enableCamera);
els.themeToggle.addEventListener('click', toggleTheme);
els.reset.addEventListener('click', reset);
els.tabs.forEach(t=> t.addEventListener('click', ()=> switchMode(t.dataset.mode)));
document.querySelectorAll('.choice-btn').forEach(b=> b.addEventListener('click', ()=> manualChoose(b.dataset.move)));

// Preview close button
document.querySelector('.preview-close').addEventListener('click', function() {
  els.previewContainer.classList.add('hidden');
  els.cameraToggle.textContent = '📷 Show Cam';
});

// Toggle preview visibility when camera button is clicked and camera is already ready
els.cameraToggle.addEventListener('click', function() {
  if (cameraReady) {
    els.previewContainer.classList.toggle('hidden');
    els.cameraToggle.textContent = els.previewContainer.classList.contains('hidden') ? 
      '📷 Show Cam' : '📷 Hide Cam';
  }
});

// Init
if (localStorage.getItem('darkMode')==='true'){ dark=true; document.body.classList.add('dark'); els.themeToggle.textContent='☀️ Light'; }
if (!window.isSecureContext && location.hostname!=='localhost'){ els.status.textContent='Camera requires HTTPS. Open the secure URL.'; els.play.disabled=true; }
