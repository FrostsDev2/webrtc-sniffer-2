// ============================================================
//  🐉 Frosts WebRTC Peer Inspector v0.1.3
// ============================================================

const origPC = window.RTCPeerConnection;
const seenIPs = new Set();
const peerLog = [];
const activePeers = new Map();
let sessionStats = { total:0, vpn:0, residential:0, mobile:0, hosting:0, tor:0, countries:{} };

// ---- Cookie settings ----
function saveCookies() {
  const data = {};
  Object.keys(settings).forEach(k => data[k] = settings[k].val);
  data.theme = Object.keys(themes).find(k => themes[k] === currentTheme) || 'midnight';
  document.cookie = `frostSettings=${encodeURIComponent(JSON.stringify(data))};max-age=31536000;path=/`;
}

function loadCookies() {
  const match = document.cookie.match(/frostSettings=([^;]+)/);
  if (!match) return;
  try {
    const data = JSON.parse(decodeURIComponent(match[1]));
    Object.keys(settings).forEach(k => { if (data[k] !== undefined) settings[k].val = data[k]; });
    if (data.theme && themes[data.theme]) currentTheme = themes[data.theme];
  } catch(e) {}
}

// ---- Repeat peer history (localStorage) ----
function getHistory() {
  try { return JSON.parse(localStorage.getItem('frostPeerHistory') || '{}'); } catch(e) { return {}; }
}
function saveHistory(ip) {
  try {
    const h = getHistory();
    h[ip] = (h[ip] || 0) + 1;
    localStorage.setItem('frostPeerHistory', JSON.stringify(h));
  } catch(e) {}
}
function getSeenCount(ip) { return getHistory()[ip] || 0; }

// ---- Tor exit node list ----
let torExits = new Set();
async function loadTorExits() {
  try {
    const r = await fetch('https://check.torproject.org/torbulkexitlist');
    const t = await r.text();
    torExits = new Set(t.split('\n').map(s => s.trim()).filter(Boolean));
  } catch(e) {}
}
loadTorExits();

const themes = {
  matrix:   { bg:'#0a0a0a', border:'#00ff88', text:'#00ff88', sub:'#aaffcc', dim:'#446644', header:'#001a00', name:'💚 Matrix' },
  midnight: { bg:'#0d0d1a', border:'#7b68ee', text:'#c8b8ff', sub:'#9988cc', dim:'#443366', header:'#0a0520', name:'🌙 Midnight' },
  blood:    { bg:'#0a0000', border:'#ff2222', text:'#ff6666', sub:'#cc4444', dim:'#441111', header:'#1a0000', name:'🔴 Blood' },
  ice:      { bg:'#0a0f1a', border:'#00bfff', text:'#aaddff', sub:'#88bbdd', dim:'#224466', header:'#001133', name:'🧊 Ice' },
  gold:     { bg:'#0f0a00', border:'#ffaa00', text:'#ffdd88', sub:'#ccaa44', dim:'#443300', header:'#1a0f00', name:'👑 Gold' },
  rose:     { bg:'#0f0a0d', border:'#ff69b4', text:'#ffb6d9', sub:'#cc88aa', dim:'#553344', header:'#1a0010', name:'🌸 Rose' },
};

let currentTheme = themes.midnight;
let peerCount = 0;
let activeTab = 'peers';
let filterText = '';
let panelSnapped = false;

const settings = {
  showAll:        { val:false, label:'📋 Show All Peers',       desc:'Keep all peers. Off = clear on new peer.' },
  notifications:  { val:true,  label:'🔔 Notifications',        desc:'Browser popup when peer connects.' },
  soundAlert:     { val:false, label:'🔊 Sound Alert',          desc:'Audio ping on new peer.' },
  autoScroll:     { val:true,  label:'⬇️ Auto Scroll',          desc:'Scroll to latest peer automatically.' },
  showCloudflare: { val:false, label:'☁️ Show Cloudflare IPs',  desc:'Show Cloudflare relay addresses.' },
  showIPv6:       { val:true,  label:'🔵 Show IPv6',            desc:'Include IPv6 peer addresses.' },
  compactMode:    { val:false, label:'📦 Compact Mode',         desc:'Minimal one-line view per peer.' },
  showTimestamp:  { val:true,  label:'🕐 Timestamp',            desc:'Show time each peer connected.' },
  showCoords:     { val:true,  label:'🌐 Coordinates',          desc:'Show lat/lon of peer location.' },
  showPostal:     { val:true,  label:'📮 Postal Code',          desc:'Show zip/postal code.' },
  highlightVPN:   { val:true,  label:'🔴 Highlight VPN/DC',    desc:'Flag VPN and datacenter IPs in red.' },
  showPort:       { val:true,  label:'🔌 Show Port',            desc:'Show port number alongside IP.' },
  showCandType:   { val:true,  label:'📡 Candidate Type',       desc:'Show srflx/relay/host type.' },
  autoCopyNew:    { val:false, label:'📎 Auto-Copy New IP',     desc:'Auto copies each new peer IP.' },
  darkOverlay:    { val:false, label:'🌑 Page Dim Overlay',     desc:'Dims the page behind the panel.' },
  showRepeat:     { val:true,  label:'🔁 Repeat Peer Alert',    desc:'Flag IPs seen in previous sessions.' },
  showTor:        { val:true,  label:'🧅 Tor Detection',        desc:'Flag known Tor exit nodes.' },
  showPrivacy:    { val:true,  label:'🛡️ Privacy/Proxy Score',  desc:'Show ipinfo.io proxy score.' },
  showDuration:   { val:true,  label:'⏱️ Connection Duration',  desc:'Track how long each peer is connected.' },
  showTimeline:   { val:true,  label:'📈 Connection Timeline',  desc:'Show visual timeline bar per peer.' },
  snapToEdge:     { val:false, label:'📌 Snap to Edge',         desc:'Snap panel to right edge of screen.' },
};

loadCookies();

// ---- Styles ----
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes dragonPulse {
    from { transform:scale(1) rotate(-5deg); filter:drop-shadow(0 0 8px #7b68ee); }
    to   { transform:scale(1.18) rotate(5deg); filter:drop-shadow(0 0 22px #7b68ee); }
  }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes barShimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
  @keyframes loaderFadeOut { from{opacity:1} to{opacity:0} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  #peerFloatPanel * { box-sizing:border-box; }
  #peerFloatPanel button:active { opacity:0.65; transform:scale(0.97); }
  .frostToggle { transition:background 0.25s; }
  .frostToggle .frostKnob { transition:left 0.25s; }
  .themeBtn { transition:transform 0.15s,opacity 0.15s; }
  .themeBtn:hover { opacity:1!important; transform:scale(1.08)!important; }
  .tabBtn { transition:all 0.2s; }
  .peerEntry { animation:fadeIn 0.2s ease; }
  .liveDot { animation:pulse 1.5s infinite; }
  #ppBody::-webkit-scrollbar,#tabSettings::-webkit-scrollbar,
  #tabStats::-webkit-scrollbar,#tabMap::-webkit-scrollbar { width:3px; }
  #ppBody::-webkit-scrollbar-thumb,#tabSettings::-webkit-scrollbar-thumb,
  #tabStats::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
  #frostResizeHandle { position:absolute; bottom:0; right:0; width:18px; height:18px;
    cursor:se-resize; z-index:10; opacity:0.4; display:flex; align-items:flex-end;
    justify-content:flex-end; padding:3px; color:#888; font-size:12px; }
  #frostResizeHandle:hover { opacity:1; }
  .peerNote { width:100%; background:#111; border:1px solid #333; color:#aaa;
    border-radius:4px; padding:4px 6px; font-family:inherit; font-size:10px;
    margin-top:5px; resize:none; outline:none; }
  .peerNote:focus { border-color:#7b68ee; }
  #ppSearchBar { width:100%; background:#0a0818; border:1px solid #2a1a4a;
    color:#c8b8ff; border-radius:8px; padding:7px 10px; font-family:inherit;
    font-size:11px; outline:none; box-sizing:border-box; }
  #ppSearchBar:focus { border-color:#7b68ee; }
  #ppSearchBar::placeholder { color:#443366; }
`;
document.head.appendChild(styleTag);

// ---- Overlay ----
const overlay = document.createElement('div');
overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999990;display:none;pointer-events:none;transition:opacity 0.3s;`;
document.body.appendChild(overlay);
function updateOverlay() { overlay.style.display = settings.darkOverlay.val ? 'block' : 'none'; }

// ---- Sound ----
function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type='sine'; o.frequency.value=880;
    g.gain.setValueAtTime(0.3,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
    o.start(); o.stop(ctx.currentTime+0.4);
  } catch(e) {}
}

// ---- Loader ----
const loader = document.createElement('div');
loader.id = 'frostLoader';
loader.style.cssText = `position:fixed;inset:0;background:linear-gradient(160deg,#050508 0%,#0a0814 100%);z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'SF Mono','Fira Code',monospace;`;
loader.innerHTML = `
  <div style="font-size:clamp(40px,12vw,64px);animation:dragonPulse 1.2s infinite alternate;margin-bottom:20px;">🐉</div>
  <div style="font-size:clamp(18px,5vw,26px);font-weight:700;color:#c8b8ff;letter-spacing:3px;margin-bottom:6px;">Frosts Tools</div>
  <div style="font-size:clamp(9px,2.5vw,12px);color:#443366;letter-spacing:2px;margin-bottom:36px;">VERSION 0.1.3</div>
  <div style="width:clamp(160px,50vw,220px);margin-bottom:10px;">
    <div style="width:100%;height:3px;background:#1a1025;border-radius:2px;overflow:hidden;">
      <div id="frostBar" style="width:0%;height:100%;border-radius:2px;background:linear-gradient(90deg,#7b68ee,#c8b8ff,#7b68ee);background-size:200px 100%;animation:barShimmer 1.5s infinite linear;transition:width 0.3s ease;"></div>
    </div>
  </div>
  <div id="frostLoadTxt" style="font-size:clamp(9px,2.5vw,11px);color:#443366;letter-spacing:1px;height:16px;margin-bottom:32px;">INITIALIZING...</div>
  <div style="padding:10px clamp(14px,4vw,22px);border:1px solid #2a1a4a;border-radius:20px;background:#0d0a1a;font-size:clamp(10px,2.5vw,12px);color:#443366;letter-spacing:0.5px;">
    💡 Tip: Join Discord for updates!
  </div>
`;
document.body.appendChild(loader);

const steps = ['HOOKING WEBRTC...','LOADING TOR LIST...','LOADING THEMES...','BUILDING UI...','RESTORING SETTINGS...','READY 🐉'];
let step = 0;
const barEl = document.getElementById('frostBar');
const txtEl = document.getElementById('frostLoadTxt');
const loadInterval = setInterval(() => {
  step++;
  barEl.style.width = ((step/steps.length)*100)+'%';
  txtEl.textContent = steps[step-1]||'';
  if (step>=steps.length) {
    clearInterval(loadInterval);
    setTimeout(()=>{
      loader.style.animation='loaderFadeOut 0.5s ease forwards';
      setTimeout(()=>loader.remove(),500);
    },400);
  }
},380);

// ---- Dragon ----
const dragon = document.createElement('div');
dragon.innerHTML='🐉';
dragon.style.cssText=`position:fixed;bottom:28px;right:24px;font-size:clamp(28px,8vw,40px);cursor:pointer;z-index:999998;display:none;filter:drop-shadow(0 0 10px #7b68ee);transition:filter 0.3s,transform 0.2s;user-select:none;touch-action:none;`;
document.body.appendChild(dragon);
dragon.addEventListener('mouseenter',()=>{ dragon.style.transform='scale(1.25) rotate(10deg)'; dragon.style.filter=`drop-shadow(0 0 18px ${currentTheme.border})`; });
dragon.addEventListener('mouseleave',()=>{ dragon.style.transform='scale(1) rotate(0deg)'; dragon.style.filter=`drop-shadow(0 0 10px ${currentTheme.border})`; });

let draggingDragon=false,dox=0,doy=0,dMoved=false;
dragon.addEventListener('mousedown',e=>{ draggingDragon=true;dMoved=false;dox=e.clientX-dragon.offsetLeft;doy=e.clientY-dragon.offsetTop; });
document.addEventListener('mousemove',e=>{ if(!draggingDragon)return;dMoved=true;dragon.style.left=Math.max(0,e.clientX-dox)+'px';dragon.style.top=Math.max(0,e.clientY-doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto'; });
document.addEventListener('mouseup',()=>{ if(draggingDragon&&!dMoved)openPanel();draggingDragon=false; });
dragon.addEventListener('touchstart',e=>{ const t=e.touches[0];draggingDragon=true;dMoved=false;dox=t.clientX-dragon.offsetLeft;doy=t.clientY-dragon.offsetTop; },{passive:true});
document.addEventListener('touchmove',e=>{ if(!draggingDragon)return;dMoved=true;const t=e.touches[0];dragon.style.left=Math.max(0,t.clientX-dox)+'px';dragon.style.top=Math.max(0,t.clientY-doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto'; },{passive:true});
document.addEventListener('touchend',()=>{ if(draggingDragon&&!dMoved)openPanel();draggingDragon=false; });

// ---- Toggle builder ----
function buildToggleHTML(key) {
  const s = settings[key];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:clamp(8px,2.5vw,12px) 0;border-bottom:1px solid #161616;">
      <div style="flex:1;padding-right:12px;">
        <div style="font-size:clamp(11px,3vw,13px);font-weight:500;">${s.label}</div>
        <div style="font-size:clamp(9px,2.2vw,10px);color:#443366;margin-top:3px;line-height:1.5;">${s.desc}</div>
      </div>
      <div class="frostToggle" data-key="${key}" style="width:44px;height:24px;border-radius:12px;flex-shrink:0;background:${s.val?currentTheme.border:'#1e1e1e'};border:1px solid ${s.val?currentTheme.border:'#333'};position:relative;cursor:pointer;">
        <div class="frostKnob" style="position:absolute;top:3px;left:${s.val?'21px':'3px'};width:16px;height:16px;border-radius:50%;background:${s.val?'#fff':'#555'};box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>
      </div>
    </div>`;
}

// ---- Panel ----
const panel = document.createElement('div');
panel.id = 'peerFloatPanel';
panel.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:clamp(280px,92vw,420px);min-height:200px;background:#0d0d1a;border:1px solid #7b68ee;border-radius:clamp(12px,3vw,20px);font-family:'SF Mono','Fira Code',monospace;font-size:clamp(10px,2.8vw,13px);color:#c8b8ff;z-index:999999;box-shadow:0 0 40px rgba(123,104,238,0.25),0 20px 60px rgba(0,0,0,0.8);display:flex;flex-direction:column;overflow:hidden;max-height:clamp(400px,88vh,700px);animation:fadeIn 0.3s ease;`;

panel.innerHTML = `
  <!-- Header -->
  <div id="pph" style="padding:clamp(10px,3vw,14px) clamp(12px,3.5vw,16px);background:linear-gradient(135deg,#0a0520,#120830);border-bottom:1px solid #2a1a4a;display:flex;justify-content:space-between;align-items:center;cursor:grab;user-select:none;flex-shrink:0;">
    <div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:clamp(16px,4.5vw,22px);">🐉</span>
        <span style="font-weight:700;font-size:clamp(13px,3.5vw,16px);letter-spacing:1px;color:#c8b8ff;">Frosts Tools</span>
      </div>
      <div style="font-size:clamp(8px,2vw,10px);color:#443366;margin-top:3px;letter-spacing:1px;">v0.1.3 • WebRTC Peer Inspector</div>
    </div>
    <div style="display:flex;gap:clamp(3px,1.5vw,5px);align-items:center;">
      <button id="ppCopyAll" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:clamp(12px,3.5vw,15px);padding:clamp(4px,1.5vw,7px) clamp(5px,2vw,9px);border-radius:8px;">📋</button>
      <button id="ppExportBtn" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:clamp(12px,3.5vw,15px);padding:clamp(4px,1.5vw,7px) clamp(5px,2vw,9px);border-radius:8px;">💾</button>
      <button id="ppSnapBtn" title="Snap to edge" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:clamp(12px,3.5vw,15px);padding:clamp(4px,1.5vw,7px) clamp(5px,2vw,9px);border-radius:8px;">📌</button>
      <button id="ppClose" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:clamp(12px,3.5vw,15px);padding:clamp(4px,1.5vw,7px) clamp(5px,2vw,9px);border-radius:8px;">🐉</button>
    </div>
  </div>

  <!-- Themes -->
  <div id="ppThemes" style="padding:clamp(6px,2vw,8px);background:#080614;border-bottom:1px solid #1a1025;display:flex;gap:clamp(3px,1.5vw,5px);flex-wrap:wrap;flex-shrink:0;">
    ${Object.entries(themes).map(([key,t])=>`<button class="themeBtn" data-theme="${key}" style="background:${t.header};border:1px solid ${t.border}55;color:${t.text};border-radius:8px;padding:clamp(3px,1vw,5px) clamp(6px,2vw,10px);cursor:pointer;font-size:clamp(9px,2.2vw,11px);font-family:inherit;opacity:0.65;">${t.name}</button>`).join('')}
  </div>

  <!-- Search -->
  <div style="padding:6px 10px;background:#080614;border-bottom:1px solid #1a1025;flex-shrink:0;">
    <input id="ppSearchBar" placeholder="🔍 Filter by IP, city, ISP, country..." />
  </div>

  <!-- Tabs -->
  <div id="ppTabs" style="display:flex;background:#080614;border-bottom:1px solid #1a1025;flex-shrink:0;overflow-x:auto;">
    <button class="tabBtn" data-tab="peers" style="flex:1;min-width:60px;padding:clamp(7px,2.5vw,10px) 4px;background:linear-gradient(135deg,#0a0520,#120830);border:none;border-bottom:2px solid #7b68ee;color:#c8b8ff;cursor:pointer;font-family:inherit;font-size:clamp(9px,2.5vw,11px);white-space:nowrap;">👥 Peers</button>
    <button class="tabBtn" data-tab="stats" style="flex:1;min-width:60px;padding:clamp(7px,2.5vw,10px) 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:clamp(9px,2.5vw,11px);white-space:nowrap;">📊 Stats</button>
    <button class="tabBtn" data-tab="map" style="flex:1;min-width:60px;padding:clamp(7px,2.5vw,10px) 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:clamp(9px,2.5vw,11px);white-space:nowrap;">🗺️ Map</button>
    <button class="tabBtn" data-tab="settings" style="flex:1;min-width:60px;padding:clamp(7px,2.5vw,10px) 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:clamp(9px,2.5vw,11px);white-space:nowrap;">⚙️ Settings</button>
    <button class="tabBtn" data-tab="about" style="flex:1;min-width:60px;padding:clamp(7px,2.5vw,10px) 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:clamp(9px,2.5vw,11px);white-space:nowrap;">ℹ️ About</button>
  </div>

  <!-- Peers Tab -->
  <div id="tabPeers" style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;">
    <div id="ppBody" style="overflow-y:auto;padding:clamp(6px,2vw,10px);flex:1;">
      <div id="ppEmpty" style="color:#443366;text-align:center;padding:clamp(20px,8vw,40px) 0;font-size:clamp(11px,3vw,14px);display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div>Waiting for peer connection...</div>
        <div style="font-size:clamp(9px,2.2vw,11px);color:#2a1a4a;">Run before starting a call</div>
      </div>
    </div>
    <div style="padding:clamp(6px,2vw,9px) clamp(10px,3vw,14px);background:linear-gradient(135deg,#080614,#0a0818);border-top:1px solid #1a1025;display:flex;justify-content:space-between;align-items:center;font-size:clamp(10px,2.5vw,12px);color:#443366;flex-shrink:0;">
      <span id="ppCount">Peers: 0</span>
      <div style="display:flex;gap:6px;">
        <button id="ppClearHistory" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#443366;cursor:pointer;font-family:inherit;font-size:clamp(9px,2.2vw,10px);padding:3px 8px;border-radius:6px;">🗑 History</button>
        <button id="ppClear" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#443366;cursor:pointer;font-family:inherit;font-size:clamp(9px,2.2vw,10px);padding:3px 8px;border-radius:6px;">🗑 Clear</button>
      </div>
    </div>
  </div>

  <!-- Stats Tab -->
  <div id="tabStats" style="display:none;overflow-y:auto;padding:clamp(10px,3vw,14px);flex:1;">
    <div id="statsContent" style="display:flex;flex-direction:column;gap:10px;">
      <div style="color:#443366;text-align:center;padding:20px 0;">No data yet — connect to some peers first.</div>
    </div>
  </div>

  <!-- Map Tab -->
  <div id="tabMap" style="display:none;flex:1;flex-direction:column;min-height:0;">
    <div id="frostMap" style="flex:1;min-height:260px;background:#080614;"></div>
    <div id="mapLegend" style="padding:6px 10px;background:#080614;border-top:1px solid #1a1025;font-size:10px;color:#443366;flex-shrink:0;">
      🟣 Residential &nbsp; 🔴 VPN/DC &nbsp; 🟡 Hosting &nbsp; 📱 Mobile &nbsp; 🧅 Tor
    </div>
  </div>

  <!-- Settings Tab -->
  <div id="tabSettings" style="display:none;overflow-y:auto;padding:clamp(10px,3vw,14px) clamp(12px,3.5vw,16px);flex:1;">
    <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin-bottom:8px;font-weight:600;">DISPLAY</div>
    ${['showAll','compactMode','showTimestamp','showCoords','showPostal','showPort','showCandType','highlightVPN','darkOverlay','showTimeline'].map(buildToggleHTML).join('')}
    <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin:14px 0 8px;font-weight:600;">FILTERING</div>
    ${['showCloudflare','showIPv6'].map(buildToggleHTML).join('')}
    <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin:14px 0 8px;font-weight:600;">INTELLIGENCE</div>
    ${['showRepeat','showTor','showPrivacy','showDuration'].map(buildToggleHTML).join('')}
    <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin:14px 0 8px;font-weight:600;">ALERTS</div>
    ${['notifications','soundAlert','autoCopyNew'].map(buildToggleHTML).join('')}
    <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin:14px 0 8px;font-weight:600;">BEHAVIOUR</div>
    ${['autoScroll','snapToEdge'].map(buildToggleHTML).join('')}
    <div style="height:16px;"></div>
  </div>

  <!-- About Tab -->
  <div id="tabAbout" style="display:none;padding:clamp(16px,5vw,24px) clamp(14px,4vw,20px);flex:1;overflow-y:auto;">
    <div style="text-align:center;margin-bottom:clamp(14px,4vw,22px);">
      <div style="font-size:clamp(32px,10vw,48px);margin-bottom:10px;">🐉</div>
      <div style="font-size:clamp(14px,4vw,18px);font-weight:700;color:#c8b8ff;letter-spacing:2px;">Frosts Tools</div>
      <div style="font-size:clamp(9px,2.2vw,11px);color:#443366;margin-top:5px;letter-spacing:1px;">WebRTC Peer Inspector • v0.1.3</div>
    </div>
    <div style="font-size:clamp(10px,2.5vw,12px);color:#9988cc;line-height:1.8;background:#0a0818;border:1px solid #1a1030;border-radius:10px;padding:clamp(10px,3vw,14px);margin-bottom:clamp(12px,3.5vw,18px);">
      Captures WebRTC ICE candidates in real-time, geolocates peer IPs, detects VPNs, Tor nodes, and datacenters, tracks connection durations, and plots peers on a live map.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      <a href="https://discord.gg" target="_blank" style="display:flex;align-items:center;gap:10px;padding:clamp(10px,3vw,13px);border-radius:10px;background:#0d0a1a;border:1px solid #2a1a4a;color:#7b68ee;text-decoration:none;font-size:clamp(11px,3vw,13px);">
        <span style="font-size:20px;">💬</span>
        <div><div style="font-weight:600;">Join Discord</div><div style="font-size:10px;color:#2a1a4a;margin-top:2px;">Updates, support & community</div></div>
      </a>
      <a href="https://github.com/FrostsDev2/webrtc-sniffer-2" target="_blank" style="display:flex;align-items:center;gap:10px;padding:clamp(10px,3vw,13px);border-radius:10px;background:#0a0f1a;border:1px solid #1a2a3a;color:#00bfff;text-decoration:none;font-size:clamp(11px,3vw,13px);">
        <span style="font-size:20px;">🐙</span>
        <div><div style="font-weight:600;">GitHub Repository</div><div style="font-size:10px;color:#224466;margin-top:2px;">Source code & releases</div></div>
      </a>
    </div>
    <div style="text-align:center;font-size:clamp(9px,2.2vw,10px);color:#2a1a4a;padding-top:12px;border-top:1px solid #1a1025;line-height:1.7;">
      Geo via ipinfo.io • Flags via flagcdn.com • Tor via torproject.org<br>Made with 🐉 by FrostsDev
    </div>
  </div>

  <!-- Resize handle -->
  <div id="frostResizeHandle">⊿</div>
`;

document.body.appendChild(panel);

// ---- Leaflet map ----
let mapLoaded = false;
let leafletMap = null;
const mapMarkers = [];

function initMap() {
  if (mapLoaded) return;
  mapLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = () => {
    const mapEl = document.getElementById('frostMap');
    mapEl.style.height = '100%';
    leafletMap = L.map('frostMap', { zoomControl:true, attributionControl:false }).setView([20,0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(leafletMap);
    peerLog.forEach(p => addMapMarker(p));
  };
  document.head.appendChild(script);
}

function addMapMarker(p) {
  if (!leafletMap || !p.loc || p.loc === '?') return;
  const [lat, lon] = p.loc.split(',').map(Number);
  if (isNaN(lat) || isNaN(lon)) return;
  const color = p.type.includes('🔴') ? '#ff4444' : p.type.includes('🧅') ? '#ff8800' : p.type.includes('🟡') ? '#ffaa00' : p.type.includes('📱') ? '#00bfff' : '#7b68ee';
  const marker = L.circleMarker([lat, lon], {
    radius:8, fillColor:color, color:'#fff',
    weight:1.5, opacity:1, fillOpacity:0.85
  }).addTo(leafletMap);
  marker.bindPopup(`<div style="font-family:monospace;font-size:11px;min-width:140px;"><b>${p.ip}</b><br>${p.city}, ${p.region}<br>${p.country}<br>${p.org}<br>${p.type}</div>`);
  mapMarkers.push(marker);
}

// ---- Stats ----
function updateStats() {
  const el = document.getElementById('statsContent');
  if (!el) return;
  const total = peerLog.length;
  if (total === 0) { el.innerHTML = '<div style="color:#443366;text-align:center;padding:20px 0;">No data yet.</div>'; return; }

  const vpnPct   = Math.round((sessionStats.vpn/total)*100);
  const resPct   = Math.round((sessionStats.residential/total)*100);
  const mobPct   = Math.round((sessionStats.mobile/total)*100);
  const hostPct  = Math.round((sessionStats.hosting/total)*100);
  const torPct   = Math.round((sessionStats.tor/total)*100);
  const topCountries = Object.entries(sessionStats.countries).sort((a,b)=>b[1]-a[1]).slice(0,5);

  function bar(pct, color) {
    return `<div style="height:6px;background:#111;border-radius:3px;overflow:hidden;margin-top:3px;"><div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width 0.5s;"></div></div>`;
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
      ${[
        ['Total Peers',total,'#c8b8ff'],
        ['VPN/DC',sessionStats.vpn,'#ff4444'],
        ['Residential',sessionStats.residential,'#7b68ee'],
        ['Mobile',sessionStats.mobile,'#00bfff'],
        ['Hosting',sessionStats.hosting,'#ffaa00'],
        ['Tor',sessionStats.tor,'#ff8800'],
      ].map(([label,val,color])=>`
        <div style="background:#0a0818;border:1px solid #1a1030;border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:#443366;">${label}</div>
          <div style="font-size:20px;font-weight:700;color:${color};margin-top:2px;">${val}</div>
        </div>
      `).join('')}
    </div>

    <div style="background:#0a0818;border:1px solid #1a1030;border-radius:8px;padding:12px;margin-bottom:8px;">
      <div style="font-size:10px;color:#443366;letter-spacing:1px;margin-bottom:8px;">TYPE BREAKDOWN</div>
      ${[['🔴 VPN/DC',vpnPct,'#ff4444'],['🟢 Residential',resPct,'#7b68ee'],['📱 Mobile',mobPct,'#00bfff'],['🟡 Hosting',hostPct,'#ffaa00'],['🧅 Tor',torPct,'#ff8800']].map(([label,pct,color])=>`
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;"><span>${label}</span><span style="color:${color};">${pct}%</span></div>
          ${bar(pct,color)}
        </div>
      `).join('')}
    </div>

    <div style="background:#0a0818;border:1px solid #1a1030;border-radius:8px;padding:12px;">
      <div style="font-size:10px;color:#443366;letter-spacing:1px;margin-bottom:8px;">TOP COUNTRIES</div>
      ${topCountries.map(([country,count])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #161616;font-size:11px;">
          <span>${country}</span>
          <span style="color:#7b68ee;font-weight:700;">${count}</span>
        </div>
      `).join('')}
    </div>

    <div style="background:#0a0818;border:1px solid #1a1030;border-radius:8px;padding:12px;">
      <div style="font-size:10px;color:#443366;letter-spacing:1px;margin-bottom:8px;">CONNECTION TIMELINE</div>
      <div id="frostTimeline" style="display:flex;flex-direction:column;gap:4px;max-height:140px;overflow-y:auto;">
        ${peerLog.map((p,i)=>`
          <div style="display:flex;align-items:center;gap:6px;font-size:10px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${p.type.includes('🔴')?'#ff4444':'#7b68ee'};flex-shrink:0;"></div>
            <span style="color:#443366;">${p.time}</span>
            <span style="color:#c8b8ff;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.ip}</span>
            <span style="color:#443366;">${p.city||'?'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ---- Toggle logic ----
document.querySelectorAll('.frostToggle').forEach(wrap => {
  wrap.addEventListener('click', () => {
    const key = wrap.dataset.key;
    settings[key].val = !settings[key].val;
    const on = settings[key].val;
    wrap.style.background  = on ? currentTheme.border : '#1e1e1e';
    wrap.style.borderColor = on ? currentTheme.border : '#333';
    const knob = wrap.querySelector('.frostKnob');
    knob.style.left       = on ? '21px' : '3px';
    knob.style.background = on ? '#fff' : '#555';
    if (key === 'darkOverlay') updateOverlay();
    if (key === 'snapToEdge') applySnap();
    saveCookies();
  });
});

// ---- Tabs ----
document.querySelectorAll('.tabBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tabBtn').forEach(b => {
      const a = b.dataset.tab===activeTab;
      b.style.background   = a ? currentTheme.header : 'none';
      b.style.color        = a ? currentTheme.text : currentTheme.dim;
      b.style.borderBottom = a ? `2px solid ${currentTheme.border}` : '2px solid transparent';
    });
    document.getElementById('tabPeers').style.display    = activeTab==='peers'    ? 'flex'  : 'none';
    document.getElementById('tabStats').style.display    = activeTab==='stats'    ? 'block' : 'none';
    document.getElementById('tabMap').style.display      = activeTab==='map'      ? 'flex'  : 'none';
    document.getElementById('tabSettings').style.display = activeTab==='settings' ? 'block' : 'none';
    document.getElementById('tabAbout').style.display    = activeTab==='about'    ? 'block' : 'none';
    if (activeTab==='stats') updateStats();
    if (activeTab==='map') { initMap(); setTimeout(()=>leafletMap&&leafletMap.invalidateSize(),200); }
  });
});

// ---- Theme ----
function applyTheme(t) {
  currentTheme = t;
  panel.style.borderColor = t.border;
  panel.style.boxShadow   = `0 0 40px ${t.border}33,0 20px 60px rgba(0,0,0,0.8)`;
  panel.style.color       = t.text;
  panel.style.background  = t.bg;
  dragon.style.filter     = `drop-shadow(0 0 10px ${t.border})`;
  document.getElementById('pph').style.background      = `linear-gradient(135deg,${t.header},${t.header}dd)`;
  document.getElementById('ppThemes').style.background = t.bg;
  document.getElementById('ppTabs').style.background   = t.bg;
  document.querySelectorAll('.frostToggle').forEach(w => {
    const on = settings[w.dataset.key].val;
    w.style.background  = on ? t.border : '#1e1e1e';
    w.style.borderColor = on ? t.border : '#333';
  });
  document.querySelectorAll('.tabBtn').forEach(b => {
    const a = b.dataset.tab===activeTab;
    b.style.color        = a ? t.text : t.dim;
    b.style.borderBottom = a ? `2px solid ${t.border}` : '2px solid transparent';
    b.style.background   = a ? t.header : 'none';
  });
  document.querySelectorAll('.themeBtn').forEach(b => {
    b.style.opacity = themes[b.dataset.theme]===t ? '1' : '0.6';
  });
  saveCookies();
}
document.querySelectorAll('.themeBtn').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(themes[btn.dataset.theme]));
});

// ---- Snap to edge ----
function applySnap() {
  if (settings.snapToEdge.val) {
    panel.style.transform = 'none';
    panel.style.top  = '10px';
    panel.style.left = 'auto';
    panel.style.right = '10px';
    panel.style.maxHeight = 'calc(100vh - 20px)';
  }
}
document.getElementById('ppSnapBtn').addEventListener('click', () => {
  settings.snapToEdge.val = !settings.snapToEdge.val;
  applySnap();
  saveCookies();
});

// ---- Drag ----
const pph = document.getElementById('pph');
let dragging=false,ox=0,oy=0;
pph.addEventListener('mousedown',e=>{ if(settings.snapToEdge.val)return;dragging=true;const r=panel.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;panel.style.transform='none';pph.style.cursor='grabbing'; });
document.addEventListener('mousemove',e=>{ if(!dragging)return;panel.style.left=Math.max(0,e.clientX-ox)+'px';panel.style.top=Math.max(0,e.clientY-oy)+'px';panel.style.right='auto'; });
document.addEventListener('mouseup',()=>{ dragging=false;pph.style.cursor='grab'; });
pph.addEventListener('touchstart',e=>{ if(settings.snapToEdge.val)return;const t=e.touches[0];dragging=true;const r=panel.getBoundingClientRect();ox=t.clientX-r.left;oy=t.clientY-r.top;panel.style.transform='none'; },{passive:true});
document.addEventListener('touchmove',e=>{ if(!dragging)return;const t=e.touches[0];panel.style.left=Math.max(0,t.clientX-ox)+'px';panel.style.top=Math.max(0,t.clientY-oy)+'px';panel.style.right='auto'; },{passive:true});
document.addEventListener('touchend',()=>dragging=false);

// ---- Resize ----
const resizeHandle = document.getElementById('frostResizeHandle');
let resizing=false,rox=0,roy=0,rw=0,rh=0;
resizeHandle.addEventListener('mousedown',e=>{ e.preventDefault();e.stopPropagation();resizing=true;rox=e.clientX;roy=e.clientY;rw=panel.offsetWidth;rh=panel.offsetHeight; });
document.addEventListener('mousemove',e=>{ if(!resizing)return;const nw=Math.max(280,rw+(e.clientX-rox));const nh=Math.max(300,rh+(e.clientY-roy));panel.style.width=nw+'px';panel.style.maxHeight=nh+'px'; });
document.addEventListener('mouseup',()=>resizing=false);

// ---- Search ----
document.getElementById('ppSearchBar').addEventListener('input', e => {
  filterText = e.target.value.toLowerCase();
  document.querySelectorAll('.peerEntry').forEach(el => {
    el.style.display = el.dataset.searchText?.includes(filterText) ? 'block' : 'none';
  });
});

// ---- Open/Close ----
function closePanel() { panel.style.display='none';dragon.style.display='block';overlay.style.display='none'; }
function openPanel() {
  dragon.style.display='none';panel.style.display='flex';
  if (!settings.snapToEdge.val) { panel.style.top='50%';panel.style.left='50%';panel.style.right='auto';panel.style.transform='translate(-50%,-50%)'; }
  else applySnap();
  if (settings.darkOverlay.val) overlay.style.display='block';
}
document.getElementById('ppClose').addEventListener('click', closePanel);

// ---- Copy all ----
document.getElementById('ppCopyAll').addEventListener('click', () => {
  const text = peerLog.map((p,i)=>[
    `--- Peer #${i+1} ---`,`IP:      ${p.ip}`,`Type:    ${p.label} ${p.type}`,
    `City:    ${p.city}, ${p.region}`,`Country: ${p.country}`,`ISP:     ${p.org}`,
    `Coords:  ${p.loc}`,`Postal:  ${p.postal}`,`Port:    ${p.port}`,
    `Cand:    ${p.candType}`,`Time:    ${p.time}`,`Duration:${p.duration||'active'}`,
  ].join('\n')).join('\n\n');
  navigator.clipboard.writeText(text||'No peers yet').then(()=>{
    const btn=document.getElementById('ppCopyAll');btn.textContent='✅';
    setTimeout(()=>btn.textContent='📋',1500);
  });
});

// ---- Export ----
document.getElementById('ppExportBtn').addEventListener('click', () => {
  const blob=new Blob([JSON.stringify(peerLog,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`frosts_peers_${Date.now()}.json`;a.click();
});

// ---- Clear ----
document.getElementById('ppClear').addEventListener('click', () => {
  document.getElementById('ppBody').innerHTML=`<div id="ppEmpty" style="color:#443366;text-align:center;padding:clamp(20px,8vw,40px) 0;font-size:clamp(11px,3vw,14px);display:flex;flex-direction:column;align-items:center;gap:10px;"><div>Waiting for peer connection...</div><div style="font-size:clamp(9px,2.2vw,11px);color:#2a1a4a;">Run before starting a call</div></div>`;
  seenIPs.clear();peerLog.length=0;peerCount=0;activePeers.clear();
  sessionStats={total:0,vpn:0,residential:0,mobile:0,hosting:0,tor:0,countries:{}};
  document.getElementById('ppCount').textContent='Peers: 0';
  mapMarkers.forEach(m=>leafletMap&&leafletMap.removeLayer(m));
  mapMarkers.length=0;
});

document.getElementById('ppClearHistory').addEventListener('click', () => {
  try { localStorage.removeItem('frostPeerHistory'); } catch(e) {}
  const btn=document.getElementById('ppClearHistory');
  btn.textContent='✅ Cleared';setTimeout(()=>btn.textContent='🗑 History',1500);
});

// ---- Add peer to panel ----
function addToPanel(p) {
  const body = document.getElementById('ppBody');
  if (!settings.showAll.val) { body.innerHTML='';peerCount=0; }
  const empty = document.getElementById('ppEmpty');
  if (empty) empty.remove();

  const seenCount = getSeenCount(p.ip);
  const isTor     = torExits.has(p.ip);
  const vpnColor  = settings.highlightVPN.val && (p.type.includes('🔴')||isTor) ? '#ff4444' : currentTheme.text;

  const entry = document.createElement('div');
  entry.className = 'peerEntry';
  entry.dataset.searchText = `${p.ip} ${p.city} ${p.region} ${p.country} ${p.org} ${p.type}`.toLowerCase();
  entry.style.cssText = `border:1px solid ${currentTheme.dim}44;border-radius:clamp(8px,2.5vw,12px);padding:clamp(8px,2.5vw,12px);margin-bottom:clamp(6px,2vw,9px);background:${currentTheme.header}88;`;

  const badges = [];
  if (isTor && settings.showTor.val) badges.push(`<span style="background:#ff880022;border:1px solid #ff8800;color:#ff8800;border-radius:4px;padding:1px 5px;font-size:9px;">🧅 TOR</span>`);
  if (seenCount>0 && settings.showRepeat.val) badges.push(`<span style="background:#ffaa0022;border:1px solid #ffaa00;color:#ffaa00;border-radius:4px;padding:1px 5px;font-size:9px;">🔁 SEEN ${seenCount}x</span>`);
  if (p.privacyScore && settings.showPrivacy.val) badges.push(`<span style="background:#ff222222;border:1px solid #ff2222;color:#ff6666;border-radius:4px;padding:1px 5px;font-size:9px;">🛡️ PROXY</span>`);

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">
      <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;flex-wrap:wrap;">
        ${p.flag?`<img src="${p.flag}" style="width:16px;height:12px;border-radius:2px;flex-shrink:0;">`:''}
        <b style="color:${currentTheme.text};font-size:clamp(10px,2.8vw,12px);word-break:break-all;">${p.label} ${p.ip}${settings.showPort.val&&p.port?`<span style="color:${currentTheme.dim};font-size:clamp(9px,2.2vw,10px);">:${p.port}</span>`:''}</b>
      </div>
      <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅');setTimeout(()=>this.textContent='📋',1500)"
        style="background:${currentTheme.header};border:1px solid ${currentTheme.dim}44;color:${currentTheme.dim};cursor:pointer;font-size:clamp(9px,2.5vw,11px);border-radius:6px;padding:clamp(2px,1vw,4px) clamp(5px,2vw,8px);flex-shrink:0;margin-left:6px;">📋</button>
    </div>
    ${badges.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">${badges.join('')}</div>`:''}
    <div style="color:${vpnColor};font-size:clamp(10px,2.5vw,11px);margin-bottom:4px;">
      ${isTor?'🧅 Tor Exit Node':p.type}${settings.showCandType.val?` <span style="color:${currentTheme.dim};">• ${p.candType}</span>`:''}
    </div>
  `;

  if (!settings.compactMode.val) {
    html+=`<div style="color:${currentTheme.sub};font-size:clamp(10px,2.5vw,11px);">📍 ${p.city}, ${p.region} ${p.country}</div>`;
    html+=`<div style="color:${currentTheme.sub};font-size:clamp(10px,2.5vw,11px);margin-top:2px;">🏢 ${p.org}</div>`;
    const extras=[];
    if (settings.showCoords.val)    extras.push(`🌐 ${p.loc}`);
    if (settings.showPostal.val)    extras.push(`📮 ${p.postal}`);
    if (settings.showTimestamp.val) extras.push(`🕐 ${p.time}`);
    if (extras.length) html+=`<div style="color:${currentTheme.dim};font-size:clamp(9px,2.2vw,10px);margin-top:5px;line-height:1.6;">${extras.join(' • ')}</div>`;

    if (settings.showDuration.val) {
      html+=`<div id="dur_${p.ip.replace(/[:.]/g,'_')}" style="color:${currentTheme.dim};font-size:10px;margin-top:3px;">⏱️ Connected: 0s <span class="liveDot" style="color:#00ff88;">●</span></div>`;
    }

    if (settings.showTimeline.val) {
      html+=`<div style="height:3px;background:#111;border-radius:2px;margin-top:6px;overflow:hidden;"><div id="tl_${p.ip.replace(/[:.]/g,'_')}" style="height:100%;width:0%;background:${currentTheme.border};border-radius:2px;transition:width 0.5s;"></div></div>`;
    }

    html+=`<textarea class="peerNote" placeholder="Add a note about this peer..." rows="1" onfocus="this.rows=3" onblur="this.rows=1"></textarea>`;
  } else {
    html+=`<div style="color:${currentTheme.sub};font-size:clamp(9px,2.2vw,11px);">📍 ${p.city}, ${p.country} • 🏢 ${p.org}</div>`;
  }

  entry.innerHTML = html;
  body.appendChild(entry);
  if (settings.autoScroll.val) body.scrollTop=body.scrollHeight;
  peerCount++;
  document.getElementById('ppCount').textContent=`Peers: ${peerCount}`;

  // Duration timer
  if (settings.showDuration.val) {
    const startTime = Date.now();
    const durId = `dur_${p.ip.replace(/[:.]/g,'_')}`;
    const tlId  = `tl_${p.ip.replace(/[:.]/g,'_')}`;
    const timer = setInterval(()=>{
      const el = document.getElementById(durId);
      const tl = document.getElementById(tlId);
      if (!el) { clearInterval(timer); return; }
      const secs = Math.floor((Date.now()-startTime)/1000);
      const mins = Math.floor(secs/60);
      const s = secs%60;
      el.innerHTML=`⏱️ Connected: ${mins>0?mins+'m ':''}${s}s <span class="liveDot" style="color:#00ff88;">●</span>`;
      if (tl) tl.style.width = Math.min(100, (secs/300)*100)+'%';
      activePeers.set(p.ip, { timer, startTime });
    },1000);
    activePeers.set(p.ip, { timer, startTime });
  }

  // Map marker
  addMapMarker(p);
  // Stats update
  if (activeTab==='stats') updateStats();
}

// ---- Helpers ----
function isCloudflare(ip) {
  return ['104.30.','104.16.','104.17.','104.18.','104.19.','172.64.','162.158.'].some(p=>ip.startsWith(p));
}
function isIPv6(ip) { return ip.includes(':'); }

const vpnASNs = new Set(['AS13335','AS14061','AS16276','AS14618','AS15169','AS8075','AS20473','AS9009','AS60068','AS212238','AS24940']);
function classifyASN(org) {
  const asn=org?.split(' ')[0];
  if (vpnASNs.has(asn)) return '🔴 VPN/DC';
  if (org?.toLowerCase().includes('vpn'))      return '🔴 VPN';
  if (org?.toLowerCase().includes('hosting'))  return '🟡 Hosting';
  if (org?.toLowerCase().includes('wireless')||org?.toLowerCase().includes('mobile')) return '📱 Mobile';
  return '🟢 Residential';
}

// ---- Geo ----
async function geoIP(ip, port, candType) {
  if (!settings.showCloudflare.val && isCloudflare(ip)) return;
  if (!settings.showIPv6.val && isIPv6(ip)) return;
  try {
    const r = await fetch(`https://ipinfo.io/${ip}/json`);
    const d = await r.json();
    const isTor = torExits.has(ip);
    const typeRaw = classifyASN(d.org);
    const privacyScore = d.privacy?.proxy || d.privacy?.vpn || false;

    const p = {
      ip, port:port||'?', candType:candType||'?',
      label: isIPv6(ip)?'🔵 IPv6':'🟣 IPv4',
      type: isTor?'🧅 Tor':typeRaw,
      city:d.city||'?', region:d.region||'?',
      country:d.country||'?', org:d.org||'Unknown',
      loc:d.loc||'?', postal:d.postal||'?',
      flag:d.country?`https://flagcdn.com/16x12/${d.country.toLowerCase()}.png`:'',
      time:new Date().toLocaleTimeString(),
      privacyScore, duration:null
    };

    // Session stats
    sessionStats.total++;
    if (isTor) sessionStats.tor++;
    else if (typeRaw.includes('VPN')) sessionStats.vpn++;
    else if (typeRaw.includes('Hosting')) sessionStats.hosting++;
    else if (typeRaw.includes('Mobile')) sessionStats.mobile++;
    else sessionStats.residential++;
    if (p.country!=='?') sessionStats.countries[p.country]=(sessionStats.countries[p.country]||0)+1;

    peerLog.push(p);
    saveHistory(ip);
    addToPanel(p);

    if (settings.autoCopyNew.val) navigator.clipboard.writeText(ip).catch(()=>{});
    if (settings.soundAlert.val) playPing();
    if (settings.notifications.val) {
      const body=`${ip} — ${p.city}, ${p.region} (${p.type})`;
      if (Notification.permission==='granted') new Notification('🐉 Frosts Tools',{body});
      else if (Notification.permission!=='denied') Notification.requestPermission().then(per=>{ if(per==='granted') new Notification('🐉 Frosts Tools',{body}); });
    }
  } catch(e) { console.warn('[FROST GEO FAILED]',ip); }
}

// ---- Hook ----
window.RTCPeerConnection = function(...args) {
  const pc = new origPC(...args);
  setInterval(async()=>{
    const stats = await pc.getStats();
    stats.forEach(r=>{
      if (r.type==='remote-candidate'&&r.address&&!seenIPs.has(r.address)) {
        seenIPs.add(r.address);
        geoIP(r.address,r.port,r.candidateType);
      }
    });
  },2000);
  return pc;
};

applyTheme(currentTheme);
if (settings.snapToEdge.val) applySnap();
console.log('%c[🐉 Frosts Tools v0.1.3 Ready]','color:#7b68ee;font-weight:bold;font-size:14px;');