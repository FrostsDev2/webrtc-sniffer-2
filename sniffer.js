const origPC = window.RTCPeerConnection;
const seenIPs = new Set();
const peerLog = [];

const themes = {
 matrix: { bg: '#0a0a0a', border: '#00ff88', text: '#00ff88', sub: '#aaffcc', dim: '#446644', header: '#001a00', name: '💚 Matrix' },
 midnight: { bg: '#0d0d1a', border: '#7b68ee', text: '#c8b8ff', sub: '#9988cc', dim: '#443366', header: '#0a0520', name: '🌙 Midnight' },
 blood: { bg: '#0a0000', border: '#ff2222', text: '#ff6666', sub: '#cc4444', dim: '#441111', header: '#1a0000', name: '🔴 Blood' },
 ice: { bg: '#0a0f1a', border: '#00bfff', text: '#aaddff', sub: '#88bbdd', dim: '#224466', header: '#001133', name: '🧊 Ice' },
 gold: { bg: '#0f0a00', border: '#ffaa00', text: '#ffdd88', sub: '#ccaa44', dim: '#443300', header: '#1a0f00', name: '👑 Gold' }
};

let currentTheme = themes.matrix;
let peerCount = 0;
let activeTab = 'peers';

const settings = {
 showAll: true,
 notifications: true,
 soundAlert: false,
 autoScroll: true,
 showCloudflare: false,
 showIPv6: true,
 compactMode: false,
 showTimestamp: true,
 showCoords: true,
 showPostal: true,
 highlightVPN: true,
};

// --- Audio ping ---
function playPing(t) {
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

// --- Dragon icon ---
const dragon = document.createElement('div');
dragon.id = 'peerDragon';
dragon.innerHTML = '🐉';
dragon.style.cssText = `
 position: fixed;
 bottom: 30px;
 right: 30px;
 font-size: 32px;
 cursor: pointer;
 z-index: 999998;
 display: none;
 filter: drop-shadow(0 0 8px #00ff88);
 transition: filter 0.3s, transform 0.2s;
 user-select: none;
 touch-action: none;
`;
dragon.title = 'Open Peer Inspector';
document.body.appendChild(dragon);

dragon.addEventListener('mouseenter', () => {
 dragon.style.transform = 'scale(1.2)';
 dragon.style.filter = `drop-shadow(0 0 14px ${currentTheme.border})`;
});
dragon.addEventListener('mouseleave', () => {
 dragon.style.transform = 'scale(1)';
 dragon.style.filter = `drop-shadow(0 0 8px ${currentTheme.border})`;
});
dragon.addEventListener('click', () => {
 if (!draggingDragon) openPanel();
});

// Dragon drag
let draggingDragon = false, dox = 0, doy = 0, dMoved = false;
dragon.addEventListener('mousedown', e => {
 draggingDragon = true; dMoved = false;
 dox = e.clientX - dragon.offsetLeft;
 doy = e.clientY - dragon.offsetTop;
});
document.addEventListener('mousemove', e => {
 if (!draggingDragon) return;
 dMoved = true;
 dragon.style.left = Math.max(0, e.clientX - dox) + 'px';
 dragon.style.top = Math.max(0, e.clientY - doy) + 'px';
 dragon.style.right = 'auto'; dragon.style.bottom = 'auto';
});
document.addEventListener('mouseup', () => { draggingDragon = false; });

dragon.addEventListener('touchstart', e => {
 const t = e.touches[0];
 draggingDragon = true; dMoved = false;
 dox = t.clientX - dragon.offsetLeft;
 doy = t.clientY - dragon.offsetTop;
}, { passive: true });
document.addEventListener('touchmove', e => {
 if (!draggingDragon) return;
 dMoved = true;
 const t = e.touches[0];
 dragon.style.left = Math.max(0, t.clientX - dox) + 'px';
 dragon.style.top = Math.max(0, t.clientY - doy) + 'px';
 dragon.style.right = 'auto'; dragon.style.bottom = 'auto';
}, { passive: true });
document.addEventListener('touchend', () => { draggingDragon = false; });

// --- Main Panel ---
const panel = document.createElement('div');
panel.id = 'peerFloatPanel';
panel.style.cssText = `
 position: fixed;
 top: 50%; left: 50%;
 transform: translate(-50%, -50%);
 width: 340px;
 background: #0a0a0a;
 border: 1px solid #00ff88;
 border-radius: 14px;
 font-family: monospace;
 font-size: 11px;
 color: #00ff88;
 z-index: 999999;
 box-shadow: 0 0 30px rgba(0,255,136,0.3);
 display: flex;
 flex-direction: column;
 overflow: hidden;
 max-height: 560px;
`;

panel.innerHTML = `
 <div id="pph" style="
   padding: 10px 14px;
   background: #001a00;
   border-bottom: 1px solid #00ff88;
   display: flex;
   justify-content: space-between;
   align-items: center;
   cursor: grab;
   user-select: none;
 ">
   <span style="font-weight:bold;font-size:13px;">🐉 Peer Inspector</span>
   <div style="display:flex;gap:8px;align-items:center;">
     <button id="ppCopyAll" title="Copy all" style="background:none;border:none;color:inherit;cursor:pointer;font-size:13px;">📋</button>
     <button id="ppExportBtn" title="Export JSON" style="background:none;border:none;color:inherit;cursor:pointer;font-size:13px;">💾</button>
     <button id="ppClose" title="Close to dragon" style="background:none;border:none;color:inherit;cursor:pointer;font-size:13px;">🐉</button>
   </div>
 </div>

 <div id="ppThemes" style="
   padding: 6px 8px;
   background: #001200;
   border-bottom: 1px solid #003300;
   display: flex;
   gap: 4px;
   flex-wrap: wrap;
 ">
   ${Object.entries(themes).map(([key, t]) => `
     <button class="themeBtn" data-theme="${key}" style="
       background:${t.header};border:1px solid ${t.border};
       color:${t.text};border-radius:4px;padding:3px 7px;
       cursor:pointer;font-size:10px;font-family:monospace;
     ">${t.name}</button>
   `).join('')}
 </div>

 <div id="ppTabs" style="
   display: flex;
   border-bottom: 1px solid #003300;
   background: #001200;
 ">
   <button class="tabBtn" data-tab="peers" style="
     flex:1;padding:7px;background:#001a00;border:none;
     color:#00ff88;cursor:pointer;font-family:monospace;
     font-size:11px;border-bottom:2px solid #00ff88;
   ">👥 Peers</button>
   <button class="tabBtn" data-tab="settings" style="
     flex:1;padding:7px;background:none;border:none;
     color:#446644;cursor:pointer;font-family:monospace;font-size:11px;
   ">⚙️ Settings</button>
 </div>

 <div id="tabPeers" style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
   <div id="ppBody" style="overflow-y:auto;padding:8px;max-height:340px;min-height:80px;">
     <div id="ppEmpty" style="color:#446644;text-align:center;padding:24px 0;">
       ⏳ Waiting for peer connection...
     </div>
   </div>
   <div id="ppFooter" style="
     padding: 6px 10px;
     background: #001200;
     border-top: 1px solid #003300;
     display: flex;
     justify-content: space-between;
     align-items: center;
     font-size: 10px;
     color: #446644;
   ">
     <span id="ppCount">Peers: 0</span>
     <button id="ppClear" style="background:none;border:none;color:#446644;cursor:pointer;font-family:monospace;font-size:10px;">🗑 Clear</button>
   </div>
 </div>

 <div id="tabSettings" style="display:none;overflow-y:auto;max-height:400px;padding:10px 14px;flex-direction:column;gap:4px;">
   <div style="color:#446644;font-size:10px;margin-bottom:6px;letter-spacing:1px;">DISPLAY</div>
   ${buildToggle('showAll', '📋 Show All Peers', 'Keep all peers visible. Off = clear on new peer.')}
   ${buildToggle('compactMode', '📦 Compact Mode', 'Show minimal info per peer.')}
   ${buildToggle('showTimestamp', '🕐 Show Timestamp', 'Show time peer connected.')}
   ${buildToggle('showCoords', '🌐 Show Coordinates', 'Show lat/lon of peer.')}
   ${buildToggle('showPostal', '📮 Show Postal Code', 'Show zip/postal of peer.')}
   ${buildToggle('highlightVPN', '🔴 Highlight VPN/DC', 'Flag VPN and datacenter IPs.')}
   <div style="color:#446644;font-size:10px;margin:8px 0 4px;letter-spacing:1px;">FILTERING</div>
   ${buildToggle('showCloudflare', '☁️ Show Cloudflare IPs', 'Show Cloudflare relay IPs.')}
   ${buildToggle('showIPv6', '🔵 Show IPv6', 'Show IPv6 addresses.')}
   <div style="color:#446644;font-size:10px;margin:8px 0 4px;letter-spacing:1px;">ALERTS</div>
   ${buildToggle('notifications', '🔔 Browser Notifications', 'Popup when peer connects.')}
   ${buildToggle('soundAlert', '🔊 Sound Alert', 'Play a tone when peer connects.')}
   <div style="color:#446644;font-size:10px;margin:8px 0 4px;letter-spacing:1px;">SCROLL</div>
   ${buildToggle('autoScroll', '⬇️ Auto Scroll', 'Auto scroll to latest peer.')}
 </div>
`;

document.body.appendChild(panel);

function buildToggle(key, label, desc) {
 return `
   <div style="
     display:flex;justify-content:space-between;align-items:center;
     padding:8px 0;border-bottom:1px solid #003300;
   ">
     <div>
       <div style="font-size:11px;">${label}</div>
       <div style="font-size:9px;color:#446644;margin-top:2px;">${desc}</div>
     </div>
     <div class="toggleWrap" data-key="${key}" style="
       width:36px;height:20px;border-radius:10px;
       background:${settings[key] ? '#00ff88' : '#333'};
       position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;margin-left:10px;
     ">
       <div style="
         position:absolute;top:2px;
         left:${settings[key] ? '18px' : '2px'};
         width:16px;height:16px;border-radius:50%;
         background:#fff;transition:left 0.2s;
       "></div>
     </div>
   </div>
 `;
}

// --- Toggle logic ---
document.querySelectorAll('.toggleWrap').forEach(wrap => {
 wrap.addEventListener('click', () => {
   const key = wrap.dataset.key;
   settings[key] = !settings[key];
   wrap.style.background = settings[key] ? currentTheme.border : '#333';
   wrap.querySelector('div').style.left = settings[key] ? '18px' : '2px';
 });
});

// --- Tabs ---
document.querySelectorAll('.tabBtn').forEach(btn => {
 btn.addEventListener('click', () => {
   activeTab = btn.dataset.tab;
   document.querySelectorAll('.tabBtn').forEach(b => {
     b.style.background = 'none';
     b.style.color = currentTheme.dim;
     b.style.borderBottom = 'none';
   });
   btn.style.background = currentTheme.header;
   btn.style.color = currentTheme.text;
   btn.style.borderBottom = `2px solid ${currentTheme.border}`;
   document.getElementById('tabPeers').style.display = activeTab === 'peers' ? 'flex' : 'none';
   document.getElementById('tabSettings').style.display = activeTab === 'settings' ? 'block' : 'none';
 });
});

// --- Theme ---
function applyTheme(t) {
 currentTheme = t;
 panel.style.background = t.bg;
 panel.style.borderColor = t.border;
 panel.style.boxShadow = `0 0 30px ${t.border}44`;
 panel.style.color = t.text;
 ['pph','ppThemes','ppTabs','ppFooter'].forEach(id => {
   const el = document.getElementById(id);
   if (el) { el.style.background = t.header; el.style.borderColor = t.dim; }
 });
 dragon.style.filter = `drop-shadow(0 0 8px ${t.border})`;
 document.querySelectorAll('.toggleWrap').forEach(w => {
   w.style.background = settings[w.dataset.key] ? t.border : '#333';
 });
 document.querySelectorAll('.tabBtn').forEach(b => {
   b.style.color = b.dataset.tab === activeTab ? t.text : t.dim;
   b.style.borderBottom = b.dataset.tab === activeTab ? `2px solid ${t.border}` : 'none';
   b.style.background = b.dataset.tab === activeTab ? t.header : 'none';
 });
}

document.querySelectorAll('.themeBtn').forEach(btn => {
 btn.addEventListener('click', () => applyTheme(themes[btn.dataset.theme]));
});

// --- Drag panel ---
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
 panel.style.top = Math.max(0, e.clientY - oy) + 'px';
});
document.addEventListener('mouseup', () => { dragging = false; pph.style.cursor = 'grab'; });

pph.addEventListener('touchstart', e => {
 const t = e.touches[0];
 dragging = true;
 const r = panel.getBoundingClientRect();
 ox = t.clientX - r.left; oy = t.clientY - r.top;
 panel.style.transform = 'none';
}, { passive: true });
document.addEventListener('touchmove', e => {
 if (!dragging) return;
 const t = e.touches[0];
 panel.style.left = Math.max(0, t.clientX - ox) + 'px';
 panel.style.top = Math.max(0, t.clientY - oy) + 'px';
}, { passive: true });
document.addEventListener('touchend', () => dragging = false);

// --- Close to dragon ---
function closePanel() {
 panel.style.display = 'none';
 dragon.style.display = 'block';
}
function openPanel() {
 dragon.style.display = 'none';
 panel.style.display = 'flex';
 panel.style.top = '50%';
 panel.style.left = '50%';
 panel.style.transform = 'translate(-50%, -50%)';
}
document.getElementById('ppClose').addEventListener('click', closePanel);

// --- Copy all ---
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
   `Time:    ${p.time}`,
 ].join('\n')).join('\n\n');
 navigator.clipboard.writeText(text || 'No peers yet').then(() => {
   document.getElementById('ppCopyAll').textContent = '✅';
   setTimeout(() => document.getElementById('ppCopyAll').textContent = '📋', 1500);
 });
});

// --- Export ---
document.getElementById('ppExportBtn').addEventListener('click', () => {
 const blob = new Blob([JSON.stringify(peerLog, null, 2)], { type: 'application/json' });
 const a = document.createElement('a');
 a.href = URL.createObjectURL(blob);
 a.download = `peers_${Date.now()}.json`;
 a.click();
});

// --- Clear ---
document.getElementById('ppClear').addEventListener('click', () => {
 document.getElementById('ppBody').innerHTML = `<div id="ppEmpty" style="color:${currentTheme.dim};text-align:center;padding:24px 0;">⏳ Waiting for peer connection...</div>`;
 seenIPs.clear();
 peerLog.length = 0;
 peerCount = 0;
 document.getElementById('ppCount').textContent = 'Peers: 0';
});

// --- Add to panel ---
function addToPanel(p) {
 const body = document.getElementById('ppBody');

 if (!settings.showAll) {
   body.innerHTML = '';
   peerCount = 0;
 }

 const empty = document.getElementById('ppEmpty');
 if (empty) empty.remove();

 const entry = document.createElement('div');
 entry.style.cssText = `border-bottom:1px solid ${currentTheme.dim};padding:8px 4px;`;

 let html = `
   <div style="display:flex;justify-content:space-between;align-items:center;">
     <span>
       ${p.flag ? `<img src="${p.flag}" style="vertical-align:middle;margin-right:4px">` : ''}
       <b style="color:${currentTheme.text}">${p.label} ${p.ip}</b>
     </span>
     <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅'); setTimeout(()=>this.textContent='📋',1500)"
       style="background:none;border:none;color:${currentTheme.dim};cursor:pointer;font-size:11px;">📋</button>
   </div>
   <div style="color:${settings.highlightVPN && p.type.includes('🔴') ? '#ff4444' : currentTheme.text};margin-top:2px;">${p.type}</div>
 `;

 if (!settings.compactMode) {
   html += `<div style="color:${currentTheme.sub};">📍 ${p.city}, ${p.region} ${p.country}</div>`;
   html += `<div style="color:${currentTheme.sub};">🏢 ${p.org}</div>`;
   if (settings.showCoords || settings.showPostal || settings.showTimestamp) {
     const extras = [];
     if (settings.showCoords) extras.push(`🌐 ${p.loc}`);
     if (settings.showPostal) extras.push(`📮 ${p.postal}`);
     if (settings.showTimestamp) extras.push(`🕐 ${p.time}`);
     html += `<div style="color:${currentTheme.dim};font-size:10px;">${extras.join(' | ')}</div>`;
   }
 } else {
   html += `<div style="color:${currentTheme.sub};font-size:10px;">📍 ${p.city}, ${p.country} | 🏢 ${p.org}</div>`;
 }

 entry.innerHTML = html;
 body.appendChild(entry);
 if (settings.autoScroll) body.scrollTop = body.scrollHeight;

 peerCount++;
 document.getElementById('ppCount').textContent = `Peers: ${peerCount}`;
}

// --- Helpers ---
function isCloudflare(ip) {
 return ['104.30.','104.16.','104.17.','104.18.','104.19.','172.64.','162.158.'].some(p => ip.startsWith(p));
}
function isIPv6(ip) { return ip.includes(':'); }

const vpnASNs = new Set(['AS13335','AS14061','AS16276','AS14618','AS15169','AS8075','AS20473','AS9009','AS60068','AS212238','AS24940']);
function classifyASN(org) {
 const asn = org?.split(' ')[0];
 if (vpnASNs.has(asn)) return '🔴 VPN/DC';
 if (org?.toLowerCase().includes('vpn')) return '🔴 VPN';
 if (org?.toLowerCase().includes('hosting')) return '🟡 Hosting';
 if (org?.toLowerCase().includes('wireless') || org?.toLowerCase().includes('mobile')) return '📱 Mobile';
 return '🟢 Residential';
}

// --- Geo ---
async function geoIP(ip) {
 if (!settings.showCloudflare && isCloudflare(ip)) return;
 if (!settings.showIPv6 && isIPv6(ip)) return;

 try {
   const r = await fetch(`https://ipinfo.io/${ip}/json`);
   const d = await r.json();
   const p = {
     ip, label: isIPv6(ip) ? '🔵 IPv6' : '🟣 IPv4',
     type: classifyASN(d.org),
     city: d.city || '?', region: d.region || '?',
     country: d.country || '?', org: d.org || 'Unknown',
     loc: d.loc || '?', postal: d.postal || '?',
     flag: d.country ? `https://flagcdn.com/16x12/${d.country.toLowerCase()}.png` : '',
     time: new Date().toLocaleTimeString()
   };
   peerLog.push(p);
   addToPanel(p);

   if (settings.soundAlert) playPing();

   if (settings.notifications) {
     if (Notification.permission === 'granted') {
       new Notification('🐉 New Peer', { body: `${ip} — ${p.city}, ${p.region} (${p.type})` });
     } else if (Notification.permission !== 'denied') {
       Notification.requestPermission().then(per => {
         if (per === 'granted') new Notification('🐉 New Peer', { body: `${ip} — ${p.city}, ${p.region} (${p.type})` });
       });
     }
   }
 } catch(e) {
   console.warn('[GEO FAILED]', ip);
 }
}

// --- Hook ---
window.RTCPeerConnection = function(...args) {
 const pc = new origPC(...args);
 setInterval(async () => {
   const stats = await pc.getStats();
   stats.forEach(r => {
     if (r.type === 'remote-candidate' && r.address && !seenIPs.has(r.address)) {
       seenIPs.add(r.address);
       geoIP(r.address);
     }
   });
 }, 2000);
 return pc;
};

applyTheme(themes.matrix);
console.log('%c[🐉 PEER INSPECTOR READY]', 'color:lime;font-weight:bold');
