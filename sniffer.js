// ============================================================
//  🐉 Frosts WebRTC Peer Inspector v0.1.2
// ============================================================

const origPC = window.RTCPeerConnection;
const seenIPs = new Set();
const peerLog = [];

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

const settings = {
 showAll:        { val:false, label:'📋 Show All Peers',      desc:'Keep all peers visible. Off = clear on new peer.' },
 notifications:  { val:true,  label:'🔔 Notifications',       desc:'Browser popup when peer connects.' },
 soundAlert:     { val:false, label:'🔊 Sound Alert',         desc:'Audio ping on new peer.' },
 autoScroll:     { val:true,  label:'⬇️ Auto Scroll',         desc:'Scroll to latest peer automatically.' },
 showCloudflare: { val:false, label:'☁️ Show Cloudflare IPs', desc:'Show Cloudflare relay addresses.' },
 showIPv6:       { val:true,  label:'🔵 Show IPv6',           desc:'Include IPv6 peer addresses.' },
 compactMode:    { val:false, label:'📦 Compact Mode',        desc:'Minimal one-line view per peer.' },
 showTimestamp:  { val:true,  label:'🕐 Timestamp',           desc:'Show time each peer connected.' },
 showCoords:     { val:true,  label:'🌐 Coordinates',         desc:'Show lat/lon of peer location.' },
 showPostal:     { val:true,  label:'📮 Postal Code',         desc:'Show zip/postal code.' },
 highlightVPN:   { val:true,  label:'🔴 Highlight VPN/DC',   desc:'Flag VPN and datacenter IPs in red.' },
 showPort:       { val:true,  label:'🔌 Show Port',           desc:'Show port number alongside IP.' },
 showCandType:   { val:true,  label:'📡 Candidate Type',      desc:'Show srflx/relay/host type.' },
 autoCopyNew:    { val:false, label:'📎 Auto-Copy New IP',    desc:'Auto copies each new peer IP.' },
 darkOverlay:    { val:false, label:'🌑 Page Dim Overlay',    desc:'Dims the page behind the panel.' },
};

// ---- Styles ----
const styleTag = document.createElement('style');
styleTag.textContent = `
 @keyframes dragonPulse {
   from { transform:scale(1) rotate(-5deg); filter:drop-shadow(0 0 8px #7b68ee); }
   to   { transform:scale(1.18) rotate(5deg); filter:drop-shadow(0 0 22px #7b68ee); }
 }
 @keyframes fadeIn {
   from { opacity:0; transform:translateY(8px); }
   to   { opacity:1; transform:translateY(0); }
 }
 @keyframes barShimmer {
   0%   { background-position:-200px 0; }
   100% { background-position:200px 0; }
 }
 @keyframes loaderFadeOut {
   from { opacity:1; }
   to   { opacity:0; }
 }
 #peerFloatPanel * { box-sizing:border-box; }
 #peerFloatPanel button:active { opacity:0.65; transform:scale(0.97); }
 .frostToggle { transition:background 0.25s; }
 .frostToggle .frostKnob { transition:left 0.25s; }
 .themeBtn { transition:transform 0.15s,opacity 0.15s; }
 .themeBtn:hover { opacity:1 !important; transform:scale(1.08) !important; }
 .tabBtn { transition:all 0.2s; }
 .peerEntry { animation:fadeIn 0.2s ease; }
 #ppBody::-webkit-scrollbar { width:3px; }
 #ppBody::-webkit-scrollbar-track { background:transparent; }
 #ppBody::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
 #tabSettings::-webkit-scrollbar { width:3px; }
 #tabSettings::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
`;
document.head.appendChild(styleTag);

// ---- Overlay ----
const overlay = document.createElement('div');
overlay.style.cssText = `
 position:fixed;inset:0;background:rgba(0,0,0,0.6);
 z-index:999990;display:none;pointer-events:none;transition:opacity 0.3s;
`;
document.body.appendChild(overlay);

function updateOverlay() {
 overlay.style.display = settings.darkOverlay.val ? 'block' : 'none';
}

// ---- Sound ----
function playPing() {
 try {
   const ctx = new (window.AudioContext || window.webkitAudioContext)();
   const o = ctx.createOscillator();
   const g = ctx.createGain();
   o.connect(g); g.connect(ctx.destination);
   o.type = 'sine'; o.frequency.value = 880;
   g.gain.setValueAtTime(0.3, ctx.currentTime);
   g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
   o.start(); o.stop(ctx.currentTime + 0.4);
 } catch(e) {}
}

// ---- Loading Screen ----
const loader = document.createElement('div');
loader.id = 'frostLoader';
loader.style.cssText = `
 position:fixed;inset:0;
 background:linear-gradient(160deg,#050508 0%,#0a0814 100%);
 z-index:9999999;display:flex;flex-direction:column;
 align-items:center;justify-content:center;
 font-family:'SF Mono','Fira Code',monospace;
`;

loader.innerHTML = `
 <div style="font-size:clamp(40px,12vw,64px);animation:dragonPulse 1.2s infinite alternate;margin-bottom:20px;">🐉</div>

 <div style="font-size:clamp(18px,5vw,26px);font-weight:700;color:#c8b8ff;letter-spacing:3px;margin-bottom:6px;">
   Frosts Tools
 </div>

 <div style="font-size:clamp(9px,2.5vw,12px);color:#443366;letter-spacing:2px;margin-bottom:36px;">
   VERSION 0.1.2
 </div>

 <div style="width:clamp(160px,50vw,220px);margin-bottom:10px;">
   <div style="width:100%;height:3px;background:#1a1025;border-radius:2px;overflow:hidden;">
     <div id="frostBar" style="
       width:0%;height:100%;border-radius:2px;
       background:linear-gradient(90deg,#7b68ee,#c8b8ff,#7b68ee);
       background-size:200px 100%;
       animation:barShimmer 1.5s infinite linear;
       transition:width 0.3s ease;
     "></div>
   </div>
 </div>

 <div id="frostLoadTxt" style="font-size:clamp(9px,2.5vw,11px);color:#443366;letter-spacing:1px;height:16px;margin-bottom:32px;">
   INITIALIZING...
 </div>

 <div style="
   padding:10px clamp(14px,4vw,22px);
   border:1px solid #2a1a4a;
   border-radius:20px;
   background:#0d0a1a;
   font-size:clamp(10px,2.5vw,12px);
   color:#443366;
   letter-spacing:0.5px;
 ">
   💡 Tip: Join Discord for updates!
 </div>
`;

document.body.appendChild(loader);

const steps = ['HOOKING WEBRTC...','LOADING THEMES...','BUILDING UI...','ALMOST READY...','READY 🐉'];
let step = 0;
const barEl = document.getElementById('frostBar');
const txtEl = document.getElementById('frostLoadTxt');

const loadInterval = setInterval(() => {
 step++;
 barEl.style.width = ((step / steps.length) * 100) + '%';
 txtEl.textContent = steps[step - 1] || '';
 if (step >= steps.length) {
   clearInterval(loadInterval);
   setTimeout(() => {
     loader.style.animation = 'loaderFadeOut 0.5s ease forwards';
     setTimeout(() => loader.remove(), 500);
   }, 500);
 }
}, 380);

// ---- Dragon ----
const dragon = document.createElement('div');
dragon.id = 'peerDragon';
dragon.innerHTML = '🐉';
dragon.style.cssText = `
 position:fixed;bottom:28px;right:24px;
 font-size:clamp(28px,8vw,40px);
 cursor:pointer;z-index:999998;display:none;
 filter:drop-shadow(0 0 10px #7b68ee);
 transition:filter 0.3s,transform 0.2s;
 user-select:none;touch-action:none;
`;
document.body.appendChild(dragon);

dragon.addEventListener('mouseenter', () => {
 dragon.style.transform = 'scale(1.25) rotate(10deg)';
 dragon.style.filter = `drop-shadow(0 0 18px ${currentTheme.border})`;
});
dragon.addEventListener('mouseleave', () => {
 dragon.style.transform = 'scale(1) rotate(0deg)';
 dragon.style.filter = `drop-shadow(0 0 10px ${currentTheme.border})`;
});

let draggingDragon = false, dox = 0, doy = 0, dMoved = false;
dragon.addEventListener('mousedown', e => {
 draggingDragon = true; dMoved = false;
 dox = e.clientX - dragon.offsetLeft;
 doy = e.clientY - dragon.offsetTop;
});
document.addEventListener('mousemove', e => {
 if (!draggingDragon) return; dMoved = true;
 dragon.style.left   = Math.max(0, e.clientX - dox) + 'px';
 dragon.style.top    = Math.max(0, e.clientY - doy) + 'px';
 dragon.style.right  = 'auto';
 dragon.style.bottom = 'auto';
});
document.addEventListener('mouseup', () => {
 if (draggingDragon && !dMoved) openPanel();
 draggingDragon = false;
});
dragon.addEventListener('touchstart', e => {
 const t = e.touches[0]; draggingDragon = true; dMoved = false;
 dox = t.clientX - dragon.offsetLeft;
 doy = t.clientY - dragon.offsetTop;
}, { passive:true });
document.addEventListener('touchmove', e => {
 if (!draggingDragon) return; dMoved = true;
 const t = e.touches[0];
 dragon.style.left   = Math.max(0, t.clientX - dox) + 'px';
 dragon.style.top    = Math.max(0, t.clientY - doy) + 'px';
 dragon.style.right  = 'auto';
 dragon.style.bottom = 'auto';
}, { passive:true });
document.addEventListener('touchend', () => {
 if (draggingDragon && !dMoved) openPanel();
 draggingDragon = false;
});

// ---- Toggle builder ----
function buildToggleHTML(key) {
 const s = settings[key];
 return `
   <div style="display:flex;justify-content:space-between;align-items:center;
     padding:clamp(8px,2.5vw,12px) 0;border-bottom:1px solid #161616;">
     <div style="flex:1;padding-right:12px;">
       <div style="font-size:clamp(11px,3vw,13px);font-weight:500;">${s.label}</div>
       <div style="font-size:clamp(9px,2.2vw,10px);color:#443366;margin-top:3px;line-height:1.5;">${s.desc}</div>
     </div>
     <div class="frostToggle" data-key="${key}" style="
       width:44px;height:24px;border-radius:12px;flex-shrink:0;
       background:${s.val ? '#7b68ee' : '#1e1e1e'};
       border:1px solid ${s.val ? '#7b68ee' : '#333'};
       position:relative;cursor:pointer;
     ">
       <div class="frostKnob" style="
         position:absolute;top:3px;
         left:${s.val ? '21px' : '3px'};
         width:16px;height:16px;border-radius:50%;
         background:${s.val ? '#fff' : '#555'};
         box-shadow:0 1px 3px rgba(0,0,0,0.5);
       "></div>
     </div>
   </div>
 `;
}

// ---- Main Panel ----
const panel = document.createElement('div');
panel.id = 'peerFloatPanel';
panel.style.cssText = `
 position:fixed;top:50%;left:50%;
 transform:translate(-50%,-50%);
 width:clamp(280px,92vw,400px);
 background:#0d0d1a;
 border:1px solid #7b68ee;
 border-radius:clamp(12px,3vw,20px);
 font-family:'SF Mono','Fira Code',monospace;
 font-size:clamp(10px,2.8vw,13px);
 color:#c8b8ff;
 z-index:999999;
 box-shadow:0 0 40px rgba(123,104,238,0.25),0 20px 60px rgba(0,0,0,0.8);
 display:flex;flex-direction:column;
 overflow:hidden;
 max-height:clamp(400px,88vh,700px);
 animation:fadeIn 0.3s ease;
`;

panel.innerHTML = `
 <!-- Header -->
 <div id="pph" style="
   padding:clamp(10px,3vw,14px) clamp(12px,3.5vw,16px);
   background:linear-gradient(135deg,#0a0520,#120830);
   border-bottom:1px solid #2a1a4a;
   display:flex;justify-content:space-between;align-items:center;
   cursor:grab;user-select:none;flex-shrink:0;
 ">
   <div>
     <div style="display:flex;align-items:center;gap:8px;">
       <span style="font-size:clamp(16px,4.5vw,22px);">🐉</span>
       <span style="font-weight:700;font-size:clamp(13px,3.5vw,16px);letter-spacing:1px;color:#c8b8ff;">Frosts Tools</span>
     </div>
     <div style="font-size:clamp(8px,2vw,10px);color:#443366;margin-top:3px;letter-spacing:1px;">
       v0.1.2 • WebRTC Peer Inspector
     </div>
   </div>
   <div style="display:flex;gap:clamp(3px,1.5vw,6px);align-items:center;">
     <button id="ppCopyAll" title="Copy all" style="
       background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;
       cursor:pointer;font-size:clamp(12px,3.5vw,15px);
       padding:clamp(4px,1.5vw,7px) clamp(5px,2vw,9px);border-radius:8px;
     ">📋</button>
     <button id="ppExportBtn" title="Export JSON" style="
       background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;
       cursor:pointer;font-size:clamp(12px,3.5vw,15px);
       padding:clamp(4px,1.5vw,7px) clamp(5px,2vw,9px);border-radius:8px;
     ">💾</button>
     <button id="ppClose" title="Minimize to dragon" style="
       background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;
       cursor:pointer;font-size:clamp(12px,3.5vw,15px);
       padding:clamp(4px,1.5vw,7px) clamp(5px,2vw,9px);border-radius:8px;
     ">🐉</button>
   </div>
 </div>

 <!-- Themes -->
 <div id="ppThemes" style="
   padding:clamp(6px,2vw,8px) clamp(8px,2.5vw,10px);
   background:#080614;
   border-bottom:1px solid #1a1025;
   display:flex;gap:clamp(3px,1.5vw,5px);flex-wrap:wrap;flex-shrink:0;
 ">
   ${Object.entries(themes).map(([key, t]) => `
     <button class="themeBtn" data-theme="${key}" style="
       background:${t.header};border:1px solid ${t.border}55;
       color:${t.text};border-radius:8px;
       padding:clamp(3px,1vw,5px) clamp(6px,2vw,10px);
       cursor:pointer;font-size:clamp(9px,2.2vw,11px);
       font-family:inherit;opacity:0.65;
     ">${t.name}</button>
   `).join('')}
 </div>

 <!-- Tabs -->
 <div id="ppTabs" style="
   display:flex;background:#080614;
   border-bottom:1px solid #1a1025;flex-shrink:0;
 ">
   <button class="tabBtn" data-tab="peers" style="
     flex:1;padding:clamp(8px,2.5vw,11px) 6px;
     background:linear-gradient(135deg,#0a0520,#120830);
     border:none;border-bottom:2px solid #7b68ee;
     color:#c8b8ff;cursor:pointer;font-family:inherit;
     font-size:clamp(10px,2.5vw,12px);
   ">👥 Peers</button>
   <button class="tabBtn" data-tab="settings" style="
     flex:1;padding:clamp(8px,2.5vw,11px) 6px;
     background:none;border:none;border-bottom:2px solid transparent;
     color:#443366;cursor:pointer;font-family:inherit;
     font-size:clamp(10px,2.5vw,12px);
   ">⚙ Settings</button>
   <button class="tabBtn" data-tab="about" style="
     flex:1;padding:clamp(8px,2.5vw,11px) 6px;
     background:none;border:none;border-bottom:2px solid transparent;
     color:#443366;cursor:pointer;font-family:inherit;
     font-size:clamp(10px,2.5vw,12px);
   ">ℹ️ About</button>
 </div>

 <!-- Peers Tab -->
 <div id="tabPeers" style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;">
   <div id="ppBody" style="overflow-y:auto;padding:clamp(6px,2vw,10px);flex:1;">
     <div id="ppEmpty" style="
       color:#443366;text-align:center;
       padding:clamp(20px,8vw,40px) 0;
       font-size:clamp(11px,3vw,14px);
       display:flex;flex-direction:column;align-items:center;gap:10px;
     ">
       <div>Waiting for peer connection...</div>
       <div style="font-size:clamp(9px,2.2vw,11px);color:#2a1a4a;">Run before starting a call</div>
     </div>
   </div>
   <div id="ppFooter" style="
     padding:clamp(6px,2vw,9px) clamp(10px,3vw,14px);
     background:linear-gradient(135deg,#080614,#0a0818);
     border-top:1px solid #1a1025;
     display:flex;justify-content:space-between;align-items:center;
     font-size:clamp(10px,2.5vw,12px);color:#443366;flex-shrink:0;
   ">
     <span id="ppCount" style="letter-spacing:0.5px;">Peers: 0</span>
     <button id="ppClear" style="
       background:#0d0a1a;border:1px solid #2a1a4a;
       color:#443366;cursor:pointer;font-family:inherit;
       font-size:clamp(9px,2.2vw,11px);
       padding:clamp(3px,1vw,5px) clamp(8px,2.5vw,12px);border-radius:6px;
     ">🗑 Clear</button>
   </div>
 </div>

 <!-- Settings Tab -->
 <div id="tabSettings" style="display:none;overflow-y:auto;padding:clamp(10px,3vw,14px) clamp(12px,3.5vw,16px);flex:1;">
   <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin-bottom:8px;font-weight:600;">DISPLAY</div>
   ${['showAll','compactMode','showTimestamp','showCoords','showPostal','showPort','showCandType','highlightVPN','darkOverlay'].map(buildToggleHTML).join('')}
   <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin:14px 0 8px;font-weight:600;">FILTERING</div>
   ${['showCloudflare','showIPv6'].map(buildToggleHTML).join('')}
   <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin:14px 0 8px;font-weight:600;">ALERTS</div>
   ${['notifications','soundAlert','autoCopyNew'].map(buildToggleHTML).join('')}
   <div style="color:#443366;font-size:clamp(8px,2vw,10px);letter-spacing:2px;margin:14px 0 8px;font-weight:600;">BEHAVIOUR</div>
   ${['autoScroll'].map(buildToggleHTML).join('')}
   <div style="height:16px;"></div>
 </div>

 <!-- About Tab -->
 <div id="tabAbout" style="display:none;padding:clamp(16px,5vw,24px) clamp(14px,4vw,20px);flex:1;overflow-y:auto;">
   <div style="text-align:center;margin-bottom:clamp(14px,4vw,22px);">
     <div style="font-size:clamp(32px,10vw,48px);margin-bottom:10px;">🐉</div>
     <div style="font-size:clamp(14px,4vw,18px);font-weight:700;color:#c8b8ff;letter-spacing:2px;">Frosts Tools</div>
     <div style="font-size:clamp(9px,2.2vw,11px);color:#443366;margin-top:5px;letter-spacing:1px;">WebRTC Peer Inspector • v0.1.2</div>
   </div>

   <div style="
     font-size:clamp(10px,2.5vw,12px);color:#9988cc;line-height:1.8;
     background:#0a0818;border:1px solid #1a1030;
     border-radius:10px;padding:clamp(10px,3vw,14px);margin-bottom:clamp(12px,3.5vw,18px);
   ">
     Captures WebRTC ICE candidates in real-time, geolocates peer IPs,
     detects VPNs and datacenters, and displays peer connection info
     without needing packet capture tools.
   </div>

   <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
     <a href="https://discord.gg" target="_blank" style="
       display:flex;align-items:center;gap:10px;
       padding:clamp(10px,3vw,13px) clamp(12px,3.5vw,15px);
       border-radius:10px;background:#0d0a1a;border:1px solid #2a1a4a;
       color:#7b68ee;text-decoration:none;
       font-size:clamp(11px,3vw,13px);
     ">
       <span style="font-size:clamp(16px,4.5vw,20px);">💬</span>
       <div>
         <div style="font-weight:600;">Join Discord</div>
         <div style="font-size:clamp(9px,2.2vw,10px);color:#2a1a4a;margin-top:2px;">Updates, support & community</div>
       </div>
     </a>
     <a href="https://github.com/FrostsDev2/webrtc-sniffer-2" target="_blank" style="
       display:flex;align-items:center;gap:10px;
       padding:clamp(10px,3vw,13px) clamp(12px,3.5vw,15px);
       border-radius:10px;background:#0a0f1a;border:1px solid #1a2a3a;
       color:#00bfff;text-decoration:none;
       font-size:clamp(11px,3vw,13px);
     ">
       <span style="font-size:clamp(16px,4.5vw,20px);">🐙</span>
       <div>
         <div style="font-weight:600;">GitHub Repository</div>
         <div style="font-size:clamp(9px,2.2vw,10px);color:#224466;margin-top:2px;">Source code & releases</div>
       </div>
     </a>
   </div>

   <div style="
     text-align:center;font-size:clamp(9px,2.2vw,10px);color:#2a1a4a;
     padding-top:12px;border-top:1px solid #1a1025;line-height:1.7;
   ">
     Geo via ipinfo.io • Flags via flagcdn.com<br>
     Made with 🐉 by FrostsDev
   </div>
 </div>
`;

document.body.appendChild(panel);

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
 });
});

// ---- Tabs ----
document.querySelectorAll('.tabBtn').forEach(btn => {
 btn.addEventListener('click', () => {
   activeTab = btn.dataset.tab;
   document.querySelectorAll('.tabBtn').forEach(b => {
     const isActive = b.dataset.tab === activeTab;
     b.style.background   = isActive ? currentTheme.header : 'none';
     b.style.color        = isActive ? currentTheme.text : currentTheme.dim;
     b.style.borderBottom = isActive ? `2px solid ${currentTheme.border}` : '2px solid transparent';
   });
   document.getElementById('tabPeers').style.display    = activeTab === 'peers'    ? 'flex'  : 'none';
   document.getElementById('tabSettings').style.display = activeTab === 'settings' ? 'block' : 'none';
   document.getElementById('tabAbout').style.display    = activeTab === 'about'    ? 'block' : 'none';
 });
});

// ---- Theme ----
function applyTheme(t) {
 currentTheme = t;
 panel.style.borderColor  = t.border;
 panel.style.boxShadow    = `0 0 40px ${t.border}33,0 20px 60px rgba(0,0,0,0.8)`;
 panel.style.color        = t.text;
 panel.style.background   = t.bg;
 dragon.style.filter      = `drop-shadow(0 0 10px ${t.border})`;

 document.getElementById('pph').style.background       = `linear-gradient(135deg,${t.header},${t.header}dd)`;
 document.getElementById('ppThemes').style.background  = t.bg;
 document.getElementById('ppTabs').style.background    = t.bg;
 document.getElementById('ppFooter').style.background  = t.header;

 document.querySelectorAll('.frostToggle').forEach(w => {
   const on = settings[w.dataset.key].val;
   w.style.background  = on ? t.border : '#1e1e1e';
   w.style.borderColor = on ? t.border : '#333';
   w.querySelector('.frostKnob').style.background = on ? '#fff' : '#555';
 });

 document.querySelectorAll('.tabBtn').forEach(b => {
   const isActive = b.dataset.tab === activeTab;
   b.style.color        = isActive ? t.text : t.dim;
   b.style.borderBottom = isActive ? `2px solid ${t.border}` : '2px solid transparent';
   b.style.background   = isActive ? t.header : 'none';
 });

 document.querySelectorAll('.themeBtn').forEach(b => {
   b.style.opacity = themes[b.dataset.theme] === t ? '1' : '0.6';
 });
}

document.querySelectorAll('.themeBtn').forEach(btn => {
 btn.addEventListener('click', () => applyTheme(themes[btn.dataset.theme]));
});

// ---- Drag panel ----
const pph = document.getElementById('pph');
let dragging = false, ox = 0, oy = 0;

pph.addEventListener('mousedown', e => {
 dragging = true;
 const r = panel.getBoundingClientRect();
 ox = e.clientX - r.left; oy = e.clientY - r.top;
 panel.style.transform = 'none';
 pph.style.cursor = 'grabbing';
});
document.addEventListener('mousemove', e => {
 if (!dragging) return;
 panel.style.left = Math.max(0, e.clientX - ox) + 'px';
 panel.style.top  = Math.max(0, e.clientY - oy) + 'px';
});
document.addEventListener('mouseup', () => { dragging = false; pph.style.cursor = 'grab'; });

pph.addEventListener('touchstart', e => {
 const t = e.touches[0]; dragging = true;
 const r = panel.getBoundingClientRect();
 ox = t.clientX - r.left; oy = t.clientY - r.top;
 panel.style.transform = 'none';
}, { passive:true });
document.addEventListener('touchmove', e => {
 if (!dragging) return;
 const t = e.touches[0];
 panel.style.left = Math.max(0, t.clientX - ox) + 'px';
 panel.style.top  = Math.max(0, t.clientY - oy) + 'px';
}, { passive:true });
document.addEventListener('touchend', () => dragging = false);

// ---- Open / Close ----
function closePanel() {
 panel.style.display = 'none';
 dragon.style.display = 'block';
 overlay.style.display = 'none';
}
function openPanel() {
 dragon.style.display = 'none';
 panel.style.display  = 'flex';
 panel.style.top      = '50%';
 panel.style.left     = '50%';
 panel.style.transform = 'translate(-50%,-50%)';
 if (settings.darkOverlay.val) overlay.style.display = 'block';
}

document.getElementById('ppClose').addEventListener('click', closePanel);

// ---- Copy all ----
document.getElementById('ppCopyAll').addEventListener('click', () => {
 const text = peerLog.map((p, i) => [
   `--- Peer #${i+1} ---`,
   `IP:      ${p.ip}`,
   `Type:    ${p.label} ${p.type}`,
   `City:    ${p.city}, ${p.region}`,
   `Country: ${p.country}`,
   `ISP:     ${p.org}`,
   `Coords:  ${p.loc}`,
   `Postal:  ${p.postal}`,
   `Port:    ${p.port}`,
   `Cand:    ${p.candType}`,
   `Time:    ${p.time}`,
 ].join('\n')).join('\n\n');
 navigator.clipboard.writeText(text || 'No peers yet').then(() => {
   const btn = document.getElementById('ppCopyAll');
   btn.textContent = '✅';
   setTimeout(() => btn.textContent = '📋', 1500);
 });
});

// ---- Export ----
document.getElementById('ppExportBtn').addEventListener('click', () => {
 const blob = new Blob([JSON.stringify(peerLog, null, 2)], { type:'application/json' });
 const a = document.createElement('a');
 a.href = URL.createObjectURL(blob);
 a.download = `frosts_peers_${Date.now()}.json`;
 a.click();
});

// ---- Clear ----
document.getElementById('ppClear').addEventListener('click', () => {
 document.getElementById('ppBody').innerHTML = `
   <div id="ppEmpty" style="color:#443366;text-align:center;
     padding:clamp(20px,8vw,40px) 0;font-size:clamp(11px,3vw,14px);
     display:flex;flex-direction:column;align-items:center;gap:10px;">
     <div>Waiting for peer connection...</div>
     <div style="font-size:clamp(9px,2.2vw,11px);color:#2a1a4a;">Run before starting a call</div>
   </div>`;
 seenIPs.clear(); peerLog.length = 0; peerCount = 0;
 document.getElementById('ppCount').textContent = 'Peers: 0';
});

// ---- Add peer entry ----
function addToPanel(p) {
 const body = document.getElementById('ppBody');
 if (!settings.showAll.val) {
   body.innerHTML = ''; peerCount = 0;
 }
 const empty = document.getElementById('ppEmpty');
 if (empty) empty.remove();

 const entry = document.createElement('div');
 entry.className = 'peerEntry';
 entry.style.cssText = `
   border:1px solid ${currentTheme.dim}44;
   border-radius:clamp(8px,2.5vw,12px);
   padding:clamp(8px,2.5vw,12px);
   margin-bottom:clamp(6px,2vw,9px);
   background:${currentTheme.header}88;
 `;

 const vpnColor = settings.highlightVPN.val && p.type.includes('🔴') ? '#ff4444' : currentTheme.text;

 let html = `
   <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">
     <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
       ${p.flag ? `<img src="${p.flag}" style="width:16px;height:12px;border-radius:2px;flex-shrink:0;">` : ''}
       <b style="color:${currentTheme.text};font-size:clamp(10px,2.8vw,12px);word-break:break-all;">
         ${p.label} ${p.ip}${settings.showPort.val && p.port ? `<span style="color:${currentTheme.dim};font-size:clamp(9px,2.2vw,10px);">:${p.port}</span>` : ''}
       </b>
     </div>
     <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅'); setTimeout(()=>this.textContent='📋',1500)"
       style="background:${currentTheme.header};border:1px solid ${currentTheme.dim}44;
       color:${currentTheme.dim};cursor:pointer;
       font-size:clamp(9px,2.5vw,11px);
       border-radius:6px;padding:clamp(2px,1vw,4px) clamp(5px,2vw,8px);
       flex-shrink:0;margin-left:6px;">📋</button>
   </div>
   <div style="color:${vpnColor};font-size:clamp(10px,2.5vw,11px);margin-bottom:4px;">
     ${p.type}${settings.showCandType.val ? ` <span style="color:${currentTheme.dim};">• ${p.candType}</span>` : ''}
   </div>
 `;

 if (!settings.compactMode.val) {
   html += `
     <div style="color:${currentTheme.sub};font-size:clamp(10px,2.5vw,11px);">📍 ${p.city}, ${p.region} ${p.country}</div>
     <div style="color:${currentTheme.sub};font-size:clamp(10px,2.5vw,11px);margin-top:2px;">🏢 ${p.org}</div>
   `;
   const extras = [];
   if (settings.showCoords.val)    extras.push(`🌐 ${p.loc}`);
   if (settings.showPostal.val)    extras.push(`📮 ${p.postal}`);
   if (settings.showTimestamp.val) extras.push(`🕐 ${p.time}`);
   if (extras.length) {
     html += `<div style="color:${currentTheme.dim};font-size:clamp(9px,2.2vw,10px);margin-top:5px;line-height:1.6;">${extras.join(' • ')}</div>`;
   }
 } else {
   html += `<div style="color:${currentTheme.sub};font-size:clamp(9px,2.2vw,11px);">📍 ${p.city}, ${p.country} • 🏢 ${p.org}</div>`;
 }

 entry.innerHTML = html;
 body.appendChild(entry);
 if (settings.autoScroll.val) body.scrollTop = body.scrollHeight;
 peerCount++;
 document.getElementById('ppCount').textContent = `Peers: ${peerCount}`;
}

// ---- Helpers ----
function isCloudflare(ip) {
 return ['104.30.','104.16.','104.17.','104.18.','104.19.','172.64.','162.158.'].some(p => ip.startsWith(p));
}
function isIPv6(ip) { return ip.includes(':'); }

const vpnASNs = new Set(['AS13335','AS14061','AS16276','AS14618','AS15169','AS8075','AS20473','AS9009','AS60068','AS212238','AS24940']);
function classifyASN(org) {
 const asn = org?.split(' ')[0];
 if (vpnASNs.has(asn)) return '🔴 VPN/DC';
 if (org?.toLowerCase().includes('vpn'))      return '🔴 VPN';
 if (org?.toLowerCase().includes('hosting'))  return '🟡 Hosting';
 if (org?.toLowerCase().includes('wireless') || org?.toLowerCase().includes('mobile')) return '📱 Mobile';
 return '🟢 Residential';
}

// ---- Geo ----
async function geoIP(ip, port, candType) {
 if (!settings.showCloudflare.val && isCloudflare(ip)) return;
 if (!settings.showIPv6.val && isIPv6(ip)) return;
 try {
   const r = await fetch(`https://ipinfo.io/${ip}/json`);
   const d = await r.json();
   const p = {
     ip, port: port || '?', candType: candType || '?',
     label: isIPv6(ip) ? '🔵 IPv6' : '🟣 IPv4',
     type: classifyASN(d.org),
     city: d.city || '?', region: d.region || '?',
     country: d.country || '?', org: d.org || 'Unknown',
     loc: d.loc || '?', postal: d.postal || '?',
     flag: d.country ? `https://flagcdn.com/16x12/${d.country.toLowerCase()}.png` : '',
     time: new Date().toLocaleTimeString()
   };
   peerLog.push(p);
   addToPanel(p);

   if (settings.autoCopyNew.val) navigator.clipboard.writeText(ip).catch(() => {});
   if (settings.soundAlert.val) playPing();
   if (settings.notifications.val) {
     if (Notification.permission === 'granted') {
       new Notification('🐉 Frosts Tools', { body:`${ip} — ${p.city}, ${p.region} (${p.type})` });
     } else if (Notification.permission !== 'denied') {
       Notification.requestPermission().then(per => {
         if (per === 'granted') new Notification('🐉 Frosts Tools', { body:`${ip} — ${p.city}, ${p.region} (${p.type})` });
       });
     }
   }
 } catch(e) { console.warn('[FROST GEO FAILED]', ip); }
}

// ---- Hook ----
window.RTCPeerConnection = function(...args) {
 const pc = new origPC(...args);
 setInterval(async () => {
   const stats = await pc.getStats();
   stats.forEach(r => {
     if (r.type === 'remote-candidate' && r.address && !seenIPs.has(r.address)) {
       seenIPs.add(r.address);
       geoIP(r.address, r.port, r.candidateType);
     }
   });
 }, 2000);
 return pc;
};

applyTheme(themes.midnight);
console.log('%c[🐉 Frosts Tools v0.1.2 Ready]', 'color:#7b68ee;font-weight:bold;font-size:14px;');
