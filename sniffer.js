// ============================================================
//  🐉 Frosts Tools v0.2.2
// ============================================================

const origPC = window.RTCPeerConnection;
const seenIPs = new Set();
const peerLog = [];
const activePeers = new Map();
const eventLog = [];
const connectionMap = new Map();
const countryCollection = new Set();
const subnetMap = new Map();
let sessionStats = { total:0, vpn:0, residential:0, mobile:0, hosting:0, tor:0, countries:{}, totalTime:0, messages:0, skips:0, matches:0, longestConvo:0 };
let embeddedMode = false;
let embedLeafletMap = null;
let embedMapLoaded = false;
const embedMapMarkers = [];
let embedCurrentMarker = null;
let sessionStartTime = Date.now();
let currentConvoStart = null;
let totalPackets = 0, totalBytes = 0, ppsCount = 0;
const ppsHistory = [];
let leafletMap = null, mapLoaded = false;
const mapMarkers = [];
let currentMapMarker = null;
let activeTab = 'peers';
let targetCountry = null;
let autoSkipEnabled = false;
let peerCountFloat = 0;
let activeNetSubTab = 'connections';
const netConnections = new Map();
let protocolCounts = { TCP:0, UDP:0, STUN:0, WebRTC:0, DNS:0, HTTPS:0, Other:0 };
let webrtcStats = { state:'N/A', localCand:'N/A', remoteCand:'N/A', rtt:'N/A', jitter:'N/A', bytesSent:0, bytesReceived:0 };
let activePC = null;

// ---- Private IP detection ----
function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip.includes(':')) return false; // IPv6 — allow
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true;
  // 10.x.x.x
  if (parts[0] === 10) return true;
  // 172.16-31.x.x
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.x.x
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 127.x.x.x
  if (parts[0] === 127) return true;
  // 169.254.x.x (link-local)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.x.x.x
  if (parts[0] === 0) return true;
  return false;
}

// ---- ASN Database ----
const VPN_PROVIDERS = {
  'AS9009':  { name:'M247',         type:'VPN_HOST', risk:8, label:'🔴 M247 (VPN Host)' },
  'AS60068': { name:'NordVPN',      type:'VPN',      risk:9, label:'🔴 NordVPN' },
  'AS212238':{ name:'Datacamp',     type:'VPN_HOST', risk:8, label:'🔴 Datacamp' },
  'AS20473': { name:'Vultr',        type:'CLOUD',    risk:6, label:'🟡 Vultr' },
  'AS14061': { name:'DigitalOcean', type:'CLOUD',    risk:6, label:'🟡 DigitalOcean' },
  'AS16276': { name:'OVH',          type:'CLOUD',    risk:5, label:'🟡 OVH' },
  'AS14618': { name:'AWS',          type:'CLOUD',    risk:5, label:'🟡 Amazon AWS' },
  'AS15169': { name:'Google Cloud', type:'CLOUD',    risk:4, label:'🟡 Google Cloud' },
  'AS8075':  { name:'Azure',        type:'CLOUD',    risk:4, label:'🟡 Microsoft Azure' },
  'AS13335': { name:'Cloudflare',   type:'CDN',      risk:3, label:'☁️ Cloudflare' },
  'AS24940': { name:'Hetzner',      type:'CLOUD',    risk:5, label:'🟡 Hetzner' },
  'AS44901': { name:'Belcloud',     type:'VPN_HOST', risk:8, label:'🔴 Belcloud' },
  'AS202425':{ name:'IP Volume',    type:'VPN_HOST', risk:9, label:'🔴 IP Volume' },
  'AS51167': { name:'Contabo',      type:'CLOUD',    risk:6, label:'🟡 Contabo' },
  'AS62240': { name:'Clouvider',    type:'VPN_HOST', risk:7, label:'🔴 Clouvider' },
  'AS7018':  { name:'AT&T',         type:'ISP',      risk:1, label:'🟢 AT&T' },
  'AS22773': { name:'Cox',          type:'ISP',      risk:1, label:'🟢 Cox' },
  'AS7922':  { name:'Comcast',      type:'ISP',      risk:1, label:'🟢 Comcast' },
  'AS701':   { name:'Verizon',      type:'ISP',      risk:1, label:'🟢 Verizon' },
  'AS20001': { name:'Charter',      type:'ISP',      risk:1, label:'🟢 Charter/Spectrum' },
  'AS6128':  { name:'Cablevision',  type:'ISP',      risk:1, label:'🟢 Cablevision' },
  'AS10796': { name:'Spectrum',     type:'ISP',      risk:1, label:'🟢 Spectrum' },
  'AS21928': { name:'T-Mobile',     type:'MOBILE',   risk:1, label:'📱 T-Mobile' },
  'AS21307': { name:'AT&T Mobile',  type:'MOBILE',   risk:1, label:'📱 AT&T Mobile' },
  'AS3209':  { name:'Vodafone DE',  type:'ISP',      risk:1, label:'🟢 Vodafone' },
  'AS136907':{ name:'Huawei Cloud', type:'CLOUD',    risk:5, label:'🟡 Huawei Cloud' },
  'AS45102': { name:'Alibaba',      type:'CLOUD',    risk:5, label:'🟡 Alibaba Cloud' },
  'AS4134':  { name:'ChinaNet',     type:'ISP',      risk:3, label:'🟢 ChinaNet' },
  'AS9808':  { name:'China Mobile', type:'MOBILE',   risk:2, label:'📱 China Mobile' },
};
const BAD_ASNS = new Set(['AS9009','AS60068','AS212238','AS44901','AS202425','AS62240']);

function lookupASN(org) { if(!org)return null; return VPN_PROVIDERS[org.split(' ')[0]]||null; }
function getRiskColor(risk) { if(risk>=8)return'#ff2222'; if(risk>=6)return'#ff6600'; if(risk>=4)return'#ffaa00'; if(risk>=2)return'#88cc44'; return'#00ff88'; }
function getRiskLabel(risk) { if(risk>=8)return'🔴 HIGH RISK'; if(risk>=6)return'🟠 MEDIUM'; if(risk>=4)return'🟡 LOW RISK'; if(risk>=2)return'🟢 CLEAN'; return'✅ RESIDENTIAL'; }
function renderStars(score) { const c={1:'#ff2222',2:'#ff6600',3:'#ffaa00',4:'#88cc44',5:'#00ff88'}; return`<span style="color:${c[score]||'#888'};">${'★'.repeat(score)}${'☆'.repeat(5-score)}</span>`; }

function scoreConnection(p, asnInfo) {
  let score=5, reasons=[];
  if(p.type?.includes('VPN')||p.type?.includes('DC')){score-=2;reasons.push('VPN/DC');}
  if(p.type?.includes('Hosting')){score-=1;reasons.push('Hosting');}
  if(p.type?.includes('Tor')){score-=3;reasons.push('Tor');}
  if(asnInfo?.risk>=8){score-=2;reasons.push('Bad ASN');}
  else if(asnInfo?.risk>=5){score-=1;reasons.push('Cloud ASN');}
  if(p.candType==='relay'){score-=1;reasons.push('Relay');}
  if(getSeenCount(p.ip)>3){score-=1;reasons.push(`Seen ${getSeenCount(p.ip)}x`);}
  if(torExits.has(p.ip)){score-=3;reasons.push('Tor exit');}
  return{score:Math.max(1,Math.min(5,score)),reasons};
}

function getSubnet24(ip) {
  if(isIPv6(ip)||!ip)return null;
  const p=ip.split('.');
  if(p.length!==4)return null;
  return`${p[0]}.${p[1]}.${p[2]}.0/24`;
}
function trackSubnet(ip,peerData) {
  const subnet=getSubnet24(ip);if(!subnet)return null;
  if(!subnetMap.has(subnet))subnetMap.set(subnet,{subnet,ips:[],firstSeen:new Date().toLocaleTimeString()});
  const entry=subnetMap.get(subnet);
  if(!entry.ips.find(e=>e.ip===ip))entry.ips.push({ip,city:peerData.city,country:peerData.country,time:new Date().toLocaleTimeString()});
  return entry;
}

// ---- Cookie/Storage ----
function saveCookies() {
  const data={};
  Object.keys(settings).forEach(k=>data[k]=settings[k].val);
  data.theme=Object.keys(themes).find(k=>themes[k]===currentTheme)||'midnight';
  data.targetCountry=targetCountry;data.autoSkip=autoSkipEnabled;
  document.cookie=`frostSettings=${encodeURIComponent(JSON.stringify(data))};max-age=31536000;path=/`;
}
function loadCookies() {
  const match=document.cookie.match(/frostSettings=([^;]+)/);if(!match)return;
  try{const data=JSON.parse(decodeURIComponent(match[1]));Object.keys(settings).forEach(k=>{if(data[k]!==undefined)settings[k].val=data[k];});if(data.theme&&themes[data.theme])currentTheme=themes[data.theme];if(data.targetCountry)targetCountry=data.targetCountry;if(data.autoSkip!==undefined)autoSkipEnabled=data.autoSkip;}catch(e){}
}
function getHistory(){try{return JSON.parse(localStorage.getItem('frostPeerHistory')||'{}');}catch(e){return{};}}
function saveHistory(ip){try{const h=getHistory();h[ip]=(h[ip]||0)+1;localStorage.setItem('frostPeerHistory',JSON.stringify(h));}catch(e){}}
function getSeenCount(ip){return getHistory()[ip]||0;}
function getCollection(){try{return JSON.parse(localStorage.getItem('frostCollection')||'[]');}catch(e){return[];}}
function saveCollection(items){try{localStorage.setItem('frostCollection',JSON.stringify(items));}catch(e){}}
function addToCollection(ip,data){const col=getCollection();if(!col.find(c=>c.ip===ip)){col.push({ip,...data,saved:new Date().toLocaleString()});saveCollection(col);}}

// ---- Tor ----
let torExits=new Set();
async function loadTorExits(){try{const r=await fetch('https://check.torproject.org/torbulkexitlist');torExits=new Set((await r.text()).split('\n').map(s=>s.trim()).filter(Boolean));}catch(e){}}
loadTorExits();

// ---- Themes ----
const themes={
  midnight:{bg:'#0d0d1a',border:'#7b68ee',text:'#c8b8ff',sub:'#9988cc',dim:'#443366',header:'#0a0520',card:'#110d28',name:'🌙 Midnight',gradient:'linear-gradient(135deg,#0a0520,#1a1040)',site:{body:'#080612',chat:'#0d0820',input:'#120830',border:'#2a1a4a',text:'#c8b8ff',accent:'#7b68ee'}},
  matrix:  {bg:'#0a0a0a',border:'#00ff88',text:'#00ff88',sub:'#aaffcc',dim:'#446644',header:'#001a00',card:'#0a1a0a',name:'💚 Matrix',  gradient:'linear-gradient(135deg,#001a00,#002a00)',site:{body:'#050a05',chat:'#081008',input:'#0a1a0a',border:'#1a4a1a',text:'#00ff88',accent:'#00ff88'}},
  blood:   {bg:'#0a0000',border:'#ff2222',text:'#ff6666',sub:'#cc4444',dim:'#441111',header:'#1a0000',card:'#1a0808',name:'🔴 Blood',   gradient:'linear-gradient(135deg,#1a0000,#2a0000)',site:{body:'#080000',chat:'#120000',input:'#1a0000',border:'#4a0000',text:'#ff6666',accent:'#ff2222'}},
  ice:     {bg:'#0a0f1a',border:'#00bfff',text:'#aaddff',sub:'#88bbdd',dim:'#224466',header:'#001133',card:'#0a1428',name:'🧊 Ice',     gradient:'linear-gradient(135deg,#001133,#002244)',site:{body:'#050810',chat:'#080f1a',input:'#0a1428',border:'#1a3a5a',text:'#aaddff',accent:'#00bfff'}},
  gold:    {bg:'#0f0a00',border:'#ffaa00',text:'#ffdd88',sub:'#ccaa44',dim:'#443300',header:'#1a0f00',card:'#1a1200',name:'👑 Gold',    gradient:'linear-gradient(135deg,#1a0f00,#2a1a00)',site:{body:'#080500',chat:'#120a00',input:'#1a0f00',border:'#4a2a00',text:'#ffdd88',accent:'#ffaa00'}},
  rose:    {bg:'#0f0a0d',border:'#ff69b4',text:'#ffb6d9',sub:'#cc88aa',dim:'#553344',header:'#1a0010',card:'#1a0818',name:'🌸 Rose',    gradient:'linear-gradient(135deg,#1a0010,#2a0020)',site:{body:'#080005',chat:'#12000a',input:'#1a0010',border:'#4a0030',text:'#ffb6d9',accent:'#ff69b4'}},
  cyber:   {bg:'#050510',border:'#00ffff',text:'#00ffff',sub:'#88ffff',dim:'#224444',header:'#001a1a',card:'#051818',name:'⚡ Cyber',   gradient:'linear-gradient(135deg,#001a1a,#002828)',site:{body:'#020810',chat:'#05101a',input:'#001818',border:'#004444',text:'#00ffff',accent:'#00ffff'}},
  ember:   {bg:'#100800',border:'#ff6600',text:'#ffaa44',sub:'#cc7722',dim:'#442200',header:'#1a0800',card:'#1a1000',name:'🔥 Ember',   gradient:'linear-gradient(135deg,#1a0800,#2a1000)',site:{body:'#080400',chat:'#120600',input:'#1a0800',border:'#4a1a00',text:'#ffaa44',accent:'#ff6600'}},
};
let currentTheme=themes.midnight;

// ---- Settings ----
const settings={
  showAll:          {val:false, label:'📋 Show All Peers',        desc:'Keep all peers. Off = clear on new peer.'},
  notifications:    {val:true,  label:'🔔 Notifications',         desc:'Browser popup when peer connects.'},
  soundAlert:       {val:false, label:'🔊 Sound Alert',           desc:'Audio ping on new peer.'},
  autoScroll:       {val:true,  label:'⬇️ Auto Scroll',           desc:'Scroll to latest peer.'},
  showCloudflare:   {val:false, label:'☁️ Show Cloudflare IPs',   desc:'Show Cloudflare relay addresses.'},
  showIPv6:         {val:true,  label:'🔵 Show IPv6',             desc:'Include IPv6 addresses.'},
  compactMode:      {val:false, label:'📦 Compact Mode',          desc:'Minimal one-line per peer.'},
  showTimestamp:    {val:true,  label:'🕐 Timestamp',             desc:'Show time connected.'},
  showCoords:       {val:true,  label:'🌐 Coordinates',           desc:'Show lat/lon.'},
  showPostal:       {val:true,  label:'📮 Postal Code',           desc:'Show zip/postal.'},
  highlightVPN:     {val:true,  label:'🔴 Highlight VPN/DC',      desc:'Flag VPN IPs in red.'},
  showPort:         {val:true,  label:'🔌 Show Port',             desc:'Show port number.'},
  showCandType:     {val:true,  label:'📡 Candidate Type',        desc:'Show srflx/relay/host.'},
  autoCopyNew:      {val:false, label:'📎 Auto-Copy New IP',      desc:'Auto copies each IP.'},
  darkOverlay:      {val:false, label:'🌑 Page Dim Overlay',      desc:'Dims page behind panel.'},
  showRepeat:       {val:true,  label:'🔁 Repeat Peer Alert',     desc:'Flag IPs seen before.'},
  showTor:          {val:true,  label:'🧅 Tor Detection',         desc:'Flag Tor exit nodes.'},
  showPrivacy:      {val:true,  label:'🛡️ Privacy/Proxy Score',   desc:'Show proxy score.'},
  showDuration:     {val:true,  label:'⏱️ Connection Duration',   desc:'Track connection time.'},
  showTimeline:     {val:true,  label:'📈 Timeline Bar',          desc:'Visual timeline per peer.'},
  snapToEdge:       {val:false, label:'📌 Snap to Edge',          desc:'Snap to right edge.'},
  autoSkipVPN:      {val:false, label:'🚫 Auto-Skip VPN Peers',   desc:'Auto skip VPN peers.'},
  showNetStats:     {val:true,  label:'📊 Network Stats',         desc:'Show network statistics.'},
  embedDarkMode:    {val:true,  label:'🌑 Embed Dark Mode',       desc:'Apply dark mode to site.'},
  siteMods:         {val:true,  label:'🔧 Site Modifications',    desc:'Apply UI improvements.'},
  keyboardShorts:   {val:true,  label:'⌨️ Keyboard Shortcuts',    desc:'Space=skip, M=mute, F=full.'},
  autoFocusChat:    {val:true,  label:'💬 Auto-Focus Chat',       desc:'Auto focus chat box.'},
  showQualityScore: {val:true,  label:'⭐ Quality Score',         desc:'Rate each peer 1-5 stars.'},
  showASNInfo:      {val:true,  label:'🏢 ASN Intelligence',      desc:'Show VPN provider details.'},
  showSubnetAlert:  {val:true,  label:'🕸️ Subnet Clustering',     desc:'Alert on /24 subnet clusters.'},
  showBadASN:       {val:true,  label:'⚠️ Bad ASN Alert',         desc:'Highlight known bad ASNs.'},
  disablePayPopups: {val:false, label:'🚫 Disable Payment Popups',desc:'Hide premium/unban/payment modals on umingle.'},
  pipMode:          {val:false, label:'📺 Picture-in-Picture',    desc:'Enable PiP for video.'},
};
loadCookies();

// ---- Payment popup blocker ----
let paymentBlockerActive = false;
let paymentObserver = null;

function enablePaymentBlocker() {
  if (paymentBlockerActive) return;
  paymentBlockerActive = true;

  const PAYMENT_SELECTORS = [
    // Premium upgrade modal
    '[class*="premium"]','[class*="Premium"]',
    '[class*="upgrade"]','[class*="Upgrade"]',
    '[class*="payment"]','[class*="Payment"]',
    '[class*="checkout"]','[class*="Checkout"]',
    '[class*="modal"]','[class*="Modal"]',
    '[class*="overlay"]','[class*="Overlay"]',
    '[class*="popup"]','[class*="Popup"]',
    '[class*="unban"]','[class*="Unban"]',
    '[class*="ban"]',
    '[class*="stripe"]','[class*="Stripe"]',
    '[class*="vip"]','[class*="VIP"]',
    '[class*="paywall"]',
  ];

  // Hide via CSS injection first
  let blocker = document.getElementById('frostPayBlocker');
  if (!blocker) {
    blocker = document.createElement('style');
    blocker.id = 'frostPayBlocker';
    document.head.appendChild(blocker);
  }

  blocker.textContent = `
    /* Frosts Tools — Payment Blocker */
    [class*="premium"]:not(button):not(span):not(a),
    [class*="Premium"]:not(button):not(span):not(a),
    [class*="upgrade"]:not(button):not(span):not(a),
    [class*="Upgrade"]:not(button):not(span):not(a),
    [class*="paywall"],
    [class*="unban"],
    [class*="stripe"],
    div[class*="modal"]:not([class*="face"]):not([class*="camera"]):not([class*="age"]):not([class*="ban"i]) {
      /* Let DOM observer handle these */
    }
  `;

  // Keyword-based DOM scanner
  function scanAndHide() {
    const payKeywords = [
      'go premium', 'upgrade to premium', 'pay $', 'pay to unban',
      'loading secure checkout', '$4.99', '$9.99', 'non-refundable',
      '1-hour access', 'instant unban', 'upgrade', '⚡ go premium',
      'skip speed slowed'
    ];

    document.querySelectorAll('div,section,aside,article').forEach(el => {
      const text = el.innerText?.toLowerCase() || '';
      const isPayment = payKeywords.some(k => text.includes(k.toLowerCase()));
      const isSmall = el.children.length < 20; // avoid hiding whole page
      const isOverlay = getComputedStyle(el).position === 'fixed' || getComputedStyle(el).position === 'absolute';

      if (isPayment && isSmall && isOverlay) {
        el.style.setProperty('display','none','important');
        logEvent('info', `Payment popup blocked: "${el.innerText.slice(0,40).trim()}..."`);
      }
    });

    // Also hide the "skip speed slowed" banner specifically
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.innerText?.toLowerCase().includes('skip speed slowed')) {
        const parent = el.closest('div') || el.parentElement;
        if (parent) parent.style.setProperty('display','none','important');
      }
    });
  }

  scanAndHide();

  // Watch for dynamically injected popups
  paymentObserver = new MutationObserver(() => scanAndHide());
  paymentObserver.observe(document.body, { childList:true, subtree:true, attributes:true });

  logEvent('success', 'Payment popup blocker enabled');
}

function disablePaymentBlocker() {
  paymentBlockerActive = false;
  if (paymentObserver) { paymentObserver.disconnect(); paymentObserver = null; }
  const blocker = document.getElementById('frostPayBlocker');
  if (blocker) blocker.remove();
  // Restore hidden elements
  document.querySelectorAll('[style*="display: none"]').forEach(el => {
    el.style.removeProperty('display');
  });
  logEvent('info', 'Payment popup blocker disabled');
}

// ---- Countries ----
const COUNTRIES={
  'US':'🇺🇸 United States','GB':'🇬🇧 United Kingdom','CA':'🇨🇦 Canada','AU':'🇦🇺 Australia',
  'DE':'🇩🇪 Germany','FR':'🇫🇷 France','IN':'🇮🇳 India','BR':'🇧🇷 Brazil','MX':'🇲🇽 Mexico',
  'JP':'🇯🇵 Japan','KR':'🇰🇷 South Korea','RU':'🇷🇺 Russia','CN':'🇨🇳 China','IT':'🇮🇹 Italy',
  'ES':'🇪🇸 Spain','NL':'🇳🇱 Netherlands','SE':'🇸🇪 Sweden','NO':'🇳🇴 Norway','PL':'🇵🇱 Poland',
  'TR':'🇹🇷 Turkey','AR':'🇦🇷 Argentina','CO':'🇨🇴 Colombia','PH':'🇵🇭 Philippines','NG':'🇳🇬 Nigeria',
  'ZA':'🇿🇦 South Africa','EG':'🇪🇬 Egypt','SA':'🇸🇦 Saudi Arabia','AE':'🇦🇪 UAE','SG':'🇸🇬 Singapore',
  'TH':'🇹🇭 Thailand','ID':'🇮🇩 Indonesia','MY':'🇲🇾 Malaysia','VN':'🇻🇳 Vietnam','PK':'🇵🇰 Pakistan',
  'UA':'🇺🇦 Ukraine','RO':'🇷🇴 Romania','CZ':'🇨🇿 Czech Republic','HU':'🇭🇺 Hungary','PT':'🇵🇹 Portugal',
  'GR':'🇬🇷 Greece','FI':'🇫🇮 Finland','DK':'🇩🇰 Denmark','CH':'🇨🇭 Switzerland','AT':'🇦🇹 Austria',
  'BE':'🇧🇪 Belgium','IL':'🇮🇱 Israel','NZ':'🇳🇿 New Zealand','IE':'🇮🇪 Ireland','CL':'🇨🇱 Chile',
};

// ---- Styles ----
const styleTag=document.createElement('style');
styleTag.id='frostStyles';
styleTag.textContent=`
  @keyframes dragonPulse{from{transform:scale(1) rotate(-5deg);filter:drop-shadow(0 0 8px #7b68ee)}to{transform:scale(1.18) rotate(5deg);filter:drop-shadow(0 0 22px #7b68ee)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeInScale{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
  @keyframes barShimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
  @keyframes loaderFadeOut{from{opacity:1}to{opacity:0}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
  @keyframes matchPulse{0%{transform:scale(1)}50%{transform:scale(1.02)}100%{transform:scale(1)}}
  @keyframes badASNGlow{0%,100%{box-shadow:0 0 6px #ff222266,inset 0 0 4px #ff222211}50%{box-shadow:0 0 18px #ff2222aa,inset 0 0 8px #ff222222}}
  @keyframes subnetPulse{0%,100%{border-color:#ffaa0044}50%{border-color:#ffaa00aa}}

  #peerFloatPanel{font-family:'Inter','SF Pro','Segoe UI',system-ui,sans-serif!important;}
  #peerFloatPanel *{box-sizing:border-box;font-family:inherit;}
  #peerFloatPanel button{transition:opacity 0.15s,transform 0.1s,background 0.15s;}
  #peerFloatPanel button:active{opacity:0.65;transform:scale(0.97);}
  #peerFloatPanel button:hover{opacity:0.85;}
  .frostToggle{transition:background 0.25s,border-color 0.25s;}
  .frostToggle .frostKnob{transition:left 0.25s,background 0.25s;}
  .themeBtn{transition:transform 0.15s,opacity 0.15s,box-shadow 0.2s;}
  .themeBtn:hover{opacity:1!important;transform:translateY(-2px)!important;}
  .tabBtn{transition:all 0.2s;}
  .peerEntry{animation:fadeIn 0.25s ease;}
  .embedPeerCard{animation:fadeIn 0.2s ease;}
  .liveDot{animation:pulse 1.5s infinite;}
  .eventEntry{animation:slideIn 0.15s ease;}
  .frost-country-match{animation:matchPulse 0.6s ease;}
  .frost-bad-asn{animation:badASNGlow 1.5s ease infinite;}
  .frost-subnet-alert{animation:subnetPulse 2s ease infinite;}

  #ppBody::-webkit-scrollbar,#tabSettings::-webkit-scrollbar,#tabStats::-webkit-scrollbar,
  #tabEvents::-webkit-scrollbar,#netContent::-webkit-scrollbar,#frostEmbedContainer::-webkit-scrollbar{width:4px;}
  #ppBody::-webkit-scrollbar-track,#tabSettings::-webkit-scrollbar-track,#tabStats::-webkit-scrollbar-track,
  #tabEvents::-webkit-scrollbar-track,#netContent::-webkit-scrollbar-track,#frostEmbedContainer::-webkit-scrollbar-track{background:transparent;}
  #ppBody::-webkit-scrollbar-thumb,#tabSettings::-webkit-scrollbar-thumb,#tabStats::-webkit-scrollbar-thumb,
  #tabEvents::-webkit-scrollbar-thumb,#netContent::-webkit-scrollbar-thumb,#frostEmbedContainer::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:4px;}

  #frostResizeHandle{position:absolute;bottom:0;right:0;width:20px;height:20px;cursor:se-resize;z-index:10;opacity:0.3;display:flex;align-items:flex-end;justify-content:flex-end;padding:3px;color:#888;font-size:12px;transition:opacity 0.2s;}
  #frostResizeHandle:hover{opacity:0.8;}

  .peerNote{width:100%;background:#0a0818;border:1px solid #2a1a4a;color:#9988cc;border-radius:6px;padding:5px 8px;font-family:inherit;font-size:11px;margin-top:6px;resize:none;outline:none;transition:border-color 0.2s;}
  .peerNote:focus{border-color:#7b68ee;}
  .peerNote::placeholder{color:#443366;}

  .leaflet-popup-content-wrapper{background:#0d0d1a!important;border:1px solid #2a1a4a!important;color:#c8b8ff!important;border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,0.6)!important;}
  .leaflet-popup-tip{background:#0d0d1a!important;}
  .leaflet-popup-close-button{color:#7b68ee!important;}

  .frost-badge{display:inline-flex;align-items:center;gap:2px;border-radius:5px;padding:2px 6px;font-size:9px;font-weight:600;border:1px solid;letter-spacing:0.3px;}
  .frost-select{background:#0a0818;border:1px solid #2a1a4a;color:#c8b8ff;border-radius:8px;padding:8px 12px;font-family:inherit;font-size:12px;outline:none;width:100%;cursor:pointer;transition:border-color 0.2s;}
  .frost-select:focus{border-color:#7b68ee;}
  .quality-stars{font-size:13px;letter-spacing:1px;}
  .asn-badge{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:3px 8px;font-size:10px;border:1px solid;margin-top:4px;font-weight:500;}
  .frostStatBar{height:4px;background:#111;border-radius:2px;overflow:hidden;margin-top:4px;}
  .frostStatBarFill{height:100%;border-radius:2px;transition:width 0.6s ease;}

  /* PC-specific improvements */
  @media (min-width:768px){
    #peerFloatPanel{min-width:380px;}
    .peerEntry:hover{background:rgba(123,104,238,0.08)!important;transition:background 0.2s;}
    .tabBtn:hover{background:rgba(255,255,255,0.05)!important;}
  }

  /* Embed styles */
  #frostEmbedContainer{animation:fadeInScale 0.3s ease;}
  #frostEmbedContainer *{box-sizing:border-box;font-family:'Inter','SF Pro',system-ui,sans-serif;}
  .embedPeerCard{border-radius:12px;overflow:hidden;}
  .embedPeerCard:hover{filter:brightness(1.05);transition:filter 0.2s;}
  .embedStat{transition:transform 0.2s;}
  .embedStat:hover{transform:translateY(-1px);}
`;
document.head.appendChild(styleTag);

// ---- Overlay ----
const overlay=document.createElement('div');
overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:999990;display:none;pointer-events:none;backdrop-filter:blur(2px);';
document.body.appendChild(overlay);
function updateOverlay(){overlay.style.display=settings.darkOverlay.val?'block':'none';}

// ---- Sound ----
function playPing(freq=880){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);o.start();o.stop(ctx.currentTime+0.4);}catch(e){}}
function playMatchSound(){playPing(440);setTimeout(()=>playPing(660),150);}
function playBadASNSound(){playPing(200);setTimeout(()=>playPing(150),200);}

// ---- Event log ----
function logEvent(severity,desc){eventLog.unshift({time:new Date().toLocaleTimeString(),severity,desc});if(eventLog.length>200)eventLog.pop();if(activeTab==='events')updateEventLog();}

// ---- Loader ----
const loader=document.createElement('div');
loader.id='frostLoader';
loader.style.cssText='position:fixed;inset:0;background:linear-gradient(160deg,#050508 0%,#0a0814 100%);z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;';
loader.innerHTML=`
  <div style="font-size:clamp(40px,10vw,64px);animation:dragonPulse 1.2s infinite alternate;margin-bottom:24px;">🐉</div>
  <div style="font-size:clamp(20px,5vw,28px);font-weight:700;color:#c8b8ff;letter-spacing:3px;margin-bottom:6px;">Frosts Tools</div>
  <div style="font-size:clamp(10px,2.5vw,13px);color:#443366;letter-spacing:2px;margin-bottom:40px;">VERSION 0.2.2</div>
  <div style="width:clamp(180px,40vw,240px);margin-bottom:12px;">
    <div style="width:100%;height:3px;background:#1a1025;border-radius:2px;overflow:hidden;">
      <div id="frostBar" style="width:0%;height:100%;border-radius:2px;background:linear-gradient(90deg,#7b68ee,#c8b8ff,#7b68ee);background-size:200px 100%;animation:barShimmer 1.5s infinite linear;transition:width 0.3s ease;"></div>
    </div>
  </div>
  <div id="frostLoadTxt" style="font-size:11px;color:#443366;letter-spacing:1px;height:18px;margin-bottom:36px;">INITIALIZING...</div>
  <div style="padding:10px 22px;border:1px solid #2a1a4a;border-radius:20px;background:#0d0a1a;font-size:12px;color:#443366;">💡 Tip: Join Discord for updates!</div>
`;
document.body.appendChild(loader);
const steps=['HOOKING WEBRTC...','LOADING TOR LIST...','LOADING ASN DATABASE...','BUILDING UI...','RESTORING SETTINGS...','READY 🐉'];
let _step=0;
const _barEl=document.getElementById('frostBar'),_txtEl=document.getElementById('frostLoadTxt');
const _loadInt=setInterval(()=>{_step++;_barEl.style.width=((_step/steps.length)*100)+'%';_txtEl.textContent=steps[_step-1]||'';if(_step>=steps.length){clearInterval(_loadInt);setTimeout(()=>{loader.style.animation='loaderFadeOut 0.5s ease forwards';setTimeout(()=>loader.remove(),500);},400);}},380);

// ---- Dragon ----
const dragon=document.createElement('div');
dragon.innerHTML='🐉';
dragon.style.cssText='position:fixed;bottom:28px;right:28px;font-size:36px;cursor:pointer;z-index:999998;display:none;filter:drop-shadow(0 0 10px #7b68ee);transition:filter 0.3s,transform 0.2s;user-select:none;touch-action:none;';
document.body.appendChild(dragon);
dragon.addEventListener('mouseenter',()=>{dragon.style.transform='scale(1.2) rotate(8deg)';dragon.style.filter=`drop-shadow(0 0 18px ${currentTheme.border})`;});
dragon.addEventListener('mouseleave',()=>{dragon.style.transform='scale(1) rotate(0deg)';dragon.style.filter=`drop-shadow(0 0 10px ${currentTheme.border})`;});
let _dd=false,_dox=0,_doy=0,_dm=false;
dragon.addEventListener('mousedown',e=>{_dd=true;_dm=false;_dox=e.clientX-dragon.offsetLeft;_doy=e.clientY-dragon.offsetTop;});
document.addEventListener('mousemove',e=>{if(!_dd)return;_dm=true;dragon.style.left=Math.max(0,e.clientX-_dox)+'px';dragon.style.top=Math.max(0,e.clientY-_doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto';});
document.addEventListener('mouseup',()=>{if(_dd&&!_dm)openPanel();_dd=false;});
dragon.addEventListener('touchstart',e=>{const t=e.touches[0];_dd=true;_dm=false;_dox=t.clientX-dragon.offsetLeft;_doy=t.clientY-dragon.offsetTop;},{passive:true});
document.addEventListener('touchmove',e=>{if(!_dd)return;_dm=true;const t=e.touches[0];dragon.style.left=Math.max(0,t.clientX-_dox)+'px';dragon.style.top=Math.max(0,t.clientY-_doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto';},{passive:true});
document.addEventListener('touchend',()=>{if(_dd&&!_dm)openPanel();_dd=false;});

// ---- Builders ----
function buildToggleHTML(key){
  const s=settings[key];
  return`<label style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;gap:12px;">
    <div style="flex:1;min-width:0;">
      <div style="font-size:12px;font-weight:500;color:${currentTheme.text};">${s.label}</div>
      <div style="font-size:10px;color:${currentTheme.dim};margin-top:2px;line-height:1.4;">${s.desc}</div>
    </div>
    <div class="frostToggle" data-key="${key}" style="width:42px;height:23px;border-radius:12px;flex-shrink:0;background:${s.val?currentTheme.border:'#1e1e2e'};border:1px solid ${s.val?currentTheme.border:'rgba(255,255,255,0.1)'};position:relative;cursor:pointer;">
      <div class="frostKnob" style="position:absolute;top:3px;left:${s.val?'20px':'3px'};width:15px;height:15px;border-radius:50%;background:${s.val?'#fff':'#555'};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
    </div>
  </label>`;
}

function buildThemeHTML(){
  return`<div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">Theme</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:20px;">
    ${Object.entries(themes).map(([key,t])=>`<button class="themeBtn" data-theme="${key}" style="background:${t.gradient};border:1.5px solid ${themes[key]===currentTheme?t.border:t.border+'44'};color:${t.text};border-radius:10px;padding:9px 11px;cursor:pointer;font-size:11px;font-weight:600;text-align:left;opacity:${themes[key]===currentTheme?'1':'0.6'};box-shadow:${themes[key]===currentTheme?`0 0 14px ${t.border}44,inset 0 1px 0 rgba(255,255,255,0.1)`:''}">${t.name}</button>`).join('')}
  </div>`;
}

function buildCountryTargetHTML(){
  return`<div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">🎯 Country Selection</div>
  <div style="background:${currentTheme.card};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:6px;">
    <div style="font-size:11px;color:${currentTheme.sub};margin-bottom:10px;">Select a target country — skip anyone not from here</div>
    <select class="frost-select" id="targetCountrySelect" style="margin-bottom:10px;">
      <option value="">🌍 No target (show all)</option>
      ${Object.entries(COUNTRIES).map(([code,name])=>`<option value="${code}" ${targetCountry===code?'selected':''}>${name}</option>`).join('')}
    </select>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0;">
      <div id="autoSkipToggle" style="width:42px;height:23px;border-radius:12px;flex-shrink:0;background:${autoSkipEnabled?currentTheme.border:'#1e1e2e'};border:1px solid ${autoSkipEnabled?currentTheme.border:'rgba(255,255,255,0.1)'};position:relative;cursor:pointer;">
        <div class="frostKnob" style="position:absolute;top:3px;left:${autoSkipEnabled?'20px':'3px'};width:15px;height:15px;border-radius:50%;background:${autoSkipEnabled?'#fff':'#555'};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
      </div>
      <span style="font-size:11px;color:${currentTheme.sub};">Auto-skip non-target countries</span>
    </label>
    <div id="targetCountryDisplay" style="margin-top:10px;font-size:11px;color:${currentTheme.border};font-weight:500;">${targetCountry?`🎯 Targeting: ${COUNTRIES[targetCountry]||targetCountry}`:'🌍 No target set'}</div>
  </div>
  <div style="background:${currentTheme.card};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:20px;">
    ${buildToggleHTML('disablePayPopups')}
  </div>`;
}

function buildCollectionHTML(){
  const col=getCollection();
  return`<div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">📦 Saved Collection</div>
  <div style="background:${currentTheme.card};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px;margin-bottom:14px;">
    ${col.length===0
      ?`<div style="color:${currentTheme.dim};text-align:center;padding:16px 0;font-size:11px;line-height:1.6;">No saved peers yet.<br>Tap 📌 on any peer to save them here.</div>`
      :col.map((c,i)=>`<div style="border-bottom:1px solid rgba(255,255,255,0.04);padding:10px 0;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <b style="color:${currentTheme.text};font-size:12px;">${c.ip}</b>
          <button onclick="removeFromCollection(${i})" style="background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);color:#ff6666;cursor:pointer;font-size:10px;padding:2px 7px;border-radius:5px;font-family:inherit;">Remove</button>
        </div>
        <div style="color:${currentTheme.sub};">📍 ${c.city||'?'}, ${c.region||'?'} ${c.country||''}</div>
        <div style="color:${currentTheme.dim};font-size:10px;margin-top:2px;">🏢 ${c.org||'?'} • 🕐 ${c.saved}</div>
      </div>`).join('')}
    ${col.length>0?`<button onclick="exportCollection()" style="background:${currentTheme.header};border:1px solid ${currentTheme.border}44;color:${currentTheme.text};cursor:pointer;font-family:inherit;font-size:11px;padding:6px 14px;border-radius:8px;margin-top:10px;font-weight:500;">💾 Export JSON</button>`:''}
  </div>`;
}

window.removeFromCollection=function(i){const col=getCollection();col.splice(i,1);saveCollection(col);const el=document.getElementById('collectionContent');if(el)el.innerHTML=buildCollectionHTML();};
window.exportCollection=function(){const blob=new Blob([JSON.stringify(getCollection(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`frost_collection_${Date.now()}.json`;a.click();};

// ---- Panel ----
const panel=document.createElement('div');
panel.id='peerFloatPanel';
panel.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:clamp(320px,92vw,460px);background:#0d0d1a;border:1px solid #7b68ee;border-radius:16px;font-family:Inter,system-ui,sans-serif;font-size:13px;color:#c8b8ff;z-index:999999;box-shadow:0 0 0 1px rgba(123,104,238,0.2),0 24px 48px rgba(0,0,0,0.8),0 0 60px rgba(123,104,238,0.15);display:flex;flex-direction:column;overflow:hidden;max-height:clamp(520px,90vh,820px);animation:fadeIn 0.3s ease;';

panel.innerHTML=`
  <!-- Header -->
  <div id="pph" style="padding:14px 16px;background:linear-gradient(135deg,#0a0520 0%,#120830 100%);border-bottom:1px solid rgba(123,104,238,0.2);display:flex;justify-content:space-between;align-items:center;cursor:grab;user-select:none;flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:22px;line-height:1;">🐉</span>
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:700;font-size:15px;letter-spacing:0.5px;color:#c8b8ff;">Frosts Tools</span>
          <span style="font-size:9px;background:rgba(123,104,238,0.2);border:1px solid rgba(123,104,238,0.4);color:#7b68ee;padding:2px 7px;border-radius:10px;font-weight:600;letter-spacing:0.5px;">v0.2.2</span>
        </div>
        <div style="font-size:10px;color:#443366;margin-top:2px;letter-spacing:0.3px;">WebRTC Inspector + ASN Intelligence</div>
      </div>
    </div>
    <div style="display:flex;gap:5px;align-items:center;">
      <button id="ppEmbedBtn" style="background:linear-gradient(135deg,rgba(123,104,238,0.2),rgba(123,104,238,0.35));border:1px solid rgba(123,104,238,0.5);color:#c8b8ff;cursor:pointer;font-size:11px;padding:6px 10px;border-radius:8px;font-family:inherit;font-weight:600;white-space:nowrap;">🔗 Embed</button>
      <button id="ppCopyAll" title="Copy all peers" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;">📋</button>
      <button id="ppExportBtn" title="Export JSON" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;">💾</button>
      <button id="ppSnapBtn" title="Snap to edge" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;">📌</button>
      <button id="ppClose" title="Minimize to dragon" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;">🐉</button>
    </div>
  </div>

  <!-- Tabs -->
  <div id="ppTabs" style="display:flex;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;overflow-x:auto;-webkit-overflow-scrolling:touch;">
    <button class="tabBtn" data-tab="peers" style="flex:1;min-width:60px;padding:10px 6px;background:rgba(123,104,238,0.15);border:none;border-bottom:2px solid #7b68ee;color:#c8b8ff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">👥 Peers</button>
    <button class="tabBtn" data-tab="map" style="flex:1;min-width:60px;padding:10px 6px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">🗺️ Map</button>
    <button class="tabBtn" data-tab="network" style="flex:1;min-width:60px;padding:10px 6px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📡 Network</button>
    <button class="tabBtn" data-tab="stats" style="flex:1;min-width:60px;padding:10px 6px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📊 Stats</button>
    <button class="tabBtn" data-tab="events" style="flex:1;min-width:60px;padding:10px 6px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📋 Events</button>
    <button class="tabBtn" data-tab="collection" style="flex:1;min-width:60px;padding:10px 6px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📦 Saved</button>
    <button class="tabBtn" data-tab="settings" style="flex:1;min-width:60px;padding:10px 6px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">⚙️ Settings</button>
    <button class="tabBtn" data-tab="about" style="flex:1;min-width:60px;padding:10px 6px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">ℹ️ About</button>
  </div>

  <!-- Peers Tab -->
  <div id="tabPeers" style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;">
    <div id="ppBody" style="overflow-y:auto;padding:10px;flex:1;">
      <div id="ppEmpty" style="color:#443366;text-align:center;padding:50px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div style="font-size:40px;opacity:0.2;">🐉</div>
        <div style="font-size:13px;color:#553366;">Waiting for peer connection...</div>
        <div style="font-size:11px;color:#2a1a4a;line-height:1.5;">Run this script before starting a call<br>on umingle.com/video/</div>
      </div>
    </div>
    <div style="padding:8px 14px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span id="ppCount" style="font-size:11px;color:#443366;font-weight:500;">Peers: 0</span>
        <span id="targetDisplay" style="font-size:10px;color:${currentTheme.border};background:${currentTheme.border}22;padding:2px 8px;border-radius:10px;border:1px solid ${currentTheme.border}44;display:${targetCountry?'block':'none'};">🎯 ${COUNTRIES[targetCountry]||''}</span>
      </div>
      <div style="display:flex;gap:5px;">
        <button id="ppClearHistory" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#443366;cursor:pointer;font-family:inherit;font-size:10px;padding:4px 10px;border-radius:6px;">🗑 History</button>
        <button id="ppClear" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#443366;cursor:pointer;font-family:inherit;font-size:10px;padding:4px 10px;border-radius:6px;">🗑 Clear</button>
      </div>
    </div>
  </div>

  <!-- Map Tab -->
  <div id="tabMap" style="display:none;flex:1;flex-direction:column;min-height:0;">
    <div id="frostMap" style="flex:1;min-height:300px;background:#080614;"></div>
    <div style="padding:8px 12px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.05);font-size:10px;color:#443366;flex-shrink:0;display:flex;gap:12px;flex-wrap:wrap;">
      <span>🟣 Residential</span><span>🔴 VPN/DC</span><span>🟡 Hosting</span><span>📱 Mobile</span><span>🧅 Tor</span>
    </div>
  </div>

  <!-- Network Tab -->
  <div id="tabNetwork" style="display:none;flex-direction:column;flex:1;overflow:hidden;min-height:0;">
    <div style="display:flex;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;overflow-x:auto;">
      <button class="netSubBtn" data-net="connections" style="flex:1;min-width:80px;padding:8px 4px;background:rgba(123,104,238,0.15);border:none;border-bottom:2px solid #7b68ee;color:#c8b8ff;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;font-weight:500;">🔗 Connections</button>
      <button class="netSubBtn" data-net="protocols" style="flex:1;min-width:80px;padding:8px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;font-weight:500;">📡 Protocols</button>
      <button class="netSubBtn" data-net="live" style="flex:1;min-width:80px;padding:8px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;font-weight:500;">⚡ Live</button>
      <button class="netSubBtn" data-net="webrtc" style="flex:1;min-width:80px;padding:8px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;font-weight:500;">📺 WebRTC</button>
    </div>
    <div id="netContent" style="overflow-y:auto;padding:10px;flex:1;"></div>
  </div>

  <!-- Stats Tab -->
  <div id="tabStats" style="display:none;overflow-y:auto;padding:10px;flex:1;">
    <div id="statsContent"><div style="color:#443366;text-align:center;padding:30px 0;font-size:12px;">No data yet — connect to some peers first.</div></div>
  </div>

  <!-- Events Tab -->
  <div id="tabEvents" style="display:none;overflow-y:auto;padding:10px;flex:1;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <span style="font-size:11px;color:#443366;font-weight:600;letter-spacing:1px;">EVENT LOG</span>
      <button onclick="eventLog.length=0;updateEventLog();" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#443366;cursor:pointer;font-size:10px;padding:3px 10px;border-radius:6px;font-family:inherit;">Clear</button>
    </div>
    <div id="eventContent"><div style="color:#443366;text-align:center;padding:20px 0;font-size:11px;">No events yet.</div></div>
  </div>

  <!-- Collection Tab -->
  <div id="tabCollection" style="display:none;overflow-y:auto;padding:10px;flex:1;">
    <div id="collectionContent">${buildCollectionHTML()}</div>
  </div>

  <!-- Settings Tab -->
  <div id="tabSettings" style="display:none;overflow-y:auto;padding:14px 16px;flex:1;">
    ${buildThemeHTML()}
    ${buildCountryTargetHTML()}
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">Display</div>
    <div style="background:${currentTheme.card||'#110d28'};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showAll','compactMode','showTimestamp','showCoords','showPostal','showPort','showCandType','highlightVPN','darkOverlay','showTimeline'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">Filtering</div>
    <div style="background:${currentTheme.card||'#110d28'};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showCloudflare','showIPv6','autoSkipVPN'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">ASN Intelligence</div>
    <div style="background:${currentTheme.card||'#110d28'};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showQualityScore','showASNInfo','showSubnetAlert','showBadASN'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">Intelligence</div>
    <div style="background:${currentTheme.card||'#110d28'};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showRepeat','showTor','showPrivacy','showDuration'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">Site Mods (Embed)</div>
    <div style="background:${currentTheme.card||'#110d28'};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['embedDarkMode','siteMods','keyboardShorts','autoFocusChat','pipMode'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">Alerts</div>
    <div style="background:${currentTheme.card||'#110d28'};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['notifications','soundAlert','autoCopyNew'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">Behaviour</div>
    <div style="background:${currentTheme.card||'#110d28'};border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['autoScroll','snapToEdge'].map(buildToggleHTML).join('')}
    </div>
    <div style="height:16px;"></div>
  </div>

  <!-- About Tab -->
  <div id="tabAbout" style="display:none;padding:20px 18px;flex:1;overflow-y:auto;">
    <div style="text-align:center;margin-bottom:22px;">
      <div style="font-size:48px;margin-bottom:12px;">🐉</div>
      <div style="font-size:18px;font-weight:700;color:#c8b8ff;letter-spacing:1px;">Frosts Tools</div>
      <div style="font-size:10px;color:#443366;margin-top:6px;letter-spacing:1px;">v0.2.2 — ASN Intelligence Update</div>
    </div>
    <div style="font-size:11px;color:#9988cc;line-height:1.8;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:16px;">
      Full WebRTC peer inspector with ASN reputation database, VPN provider identification, connection quality scoring, /24 subnet clustering, country targeting, payment popup blocker, network monitoring, and site embedding with theme sync.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
      <a href="https://discord.gg" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:rgba(123,104,238,0.1);border:1px solid rgba(123,104,238,0.25);color:#7b68ee;text-decoration:none;font-size:12px;transition:background 0.2s;">
        <span style="font-size:20px;">💬</span><div><div style="font-weight:600;">Join Discord</div><div style="font-size:10px;color:#443366;margin-top:2px;">Updates, support & community</div></div>
      </a>
      <a href="https://github.com/FrostsDev2/webrtc-sniffer-2" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:rgba(0,191,255,0.08);border:1px solid rgba(0,191,255,0.2);color:#00bfff;text-decoration:none;font-size:12px;">
        <span style="font-size:20px;">🐙</span><div><div style="font-weight:600;">GitHub Repository</div><div style="font-size:10px;color:#224466;margin-top:2px;">Source code & releases</div></div>
      </a>
    </div>
    <div style="text-align:center;font-size:10px;color:#2a1a4a;padding-top:14px;border-top:1px solid rgba(255,255,255,0.05);line-height:1.8;">
      Geo via ipinfo.io • Flags via flagcdn.com • Tor via torproject.org<br>Made with 🐉 by FrostsDev
    </div>
  </div>

  <div id="frostResizeHandle">⊿</div>
`;
document.body.appendChild(panel);

// ---- Net content ----
function updateNetContent(){
  const el=document.getElementById('netContent');if(!el)return;
  const t=currentTheme;
  if(activeNetSubTab==='connections'){
    const conns=[...netConnections.values()].sort((a,b)=>b.packets-a.packets).slice(0,30);
    el.innerHTML=conns.length===0?`<div style="color:#443366;text-align:center;padding:30px 0;font-size:12px;">No connections captured yet.</div>`:conns.map(c=>`
      <div style="border:1px solid ${t.border}18;border-left:3px solid ${c.color};border-radius:10px;padding:10px 12px;margin-bottom:6px;background:${t.card}88;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="color:${t.text};font-size:12px;">${c.remote}</b>
          <span style="color:${c.color};font-size:9px;font-weight:600;background:${c.color}18;padding:2px 7px;border-radius:8px;border:1px solid ${c.color}33;">${c.protocol}</span>
        </div>
        <div style="color:${t.sub};font-size:11px;">Pkts: ${c.packets} • ${formatBytes(c.bytes)} • Port: ${c.port}</div>
        <div style="color:${t.dim};font-size:10px;margin-top:2px;">Last: ${c.lastSeen}</div>
      </div>`).join('');
  }else if(activeNetSubTab==='protocols'){
    const total=Object.values(protocolCounts).reduce((a,b)=>a+b,0)||1;
    const colors={TCP:'#00bfff',UDP:'#ffaa00',STUN:'#00ff88',WebRTC:'#ff69b4',DNS:'#aaffcc',HTTPS:'#7b68ee',Other:'#666'};
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;">
      ${Object.entries(protocolCounts).map(([proto,count])=>`
        <div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="color:${colors[proto]||'#888'};font-weight:600;font-size:12px;">${proto}</span>
            <span style="color:${t.dim};font-size:11px;">${count} (${Math.round(count/total*100)}%)</span>
          </div>
          <div class="frostStatBar"><div class="frostStatBarFill" style="width:${Math.round(count/total*100)}%;background:${colors[proto]||'#888'};"></div></div>
        </div>`).join('')}
      <div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px;">
        <div style="font-size:11px;color:${t.text};">Total Packets: <b>${totalPackets}</b></div>
        <div style="font-size:11px;color:${t.sub};margin-top:4px;">Total Bytes: <b>${formatBytes(totalBytes)}</b></div>
      </div>
    </div>`;
  }else if(activeNetSubTab==='live'){
    const maxPPS=Math.max(...ppsHistory,1);
    const bars=ppsHistory.map(p=>`<div style="flex:1;background:${t.border};border-radius:2px 2px 0 0;height:${Math.round((p/maxPPS)*60)}px;min-height:2px;opacity:0.8;"></div>`).join('');
    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        ${[['PPS',ppsHistory[ppsHistory.length-1]||0,t.border],['Packets',totalPackets,'#00bfff'],['Bytes',formatBytes(totalBytes),'#ffaa00'],['Connections',netConnections.size,'#00ff88']].map(([l,v,c])=>`<div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px;"><div style="font-size:10px;color:${t.dim};margin-bottom:4px;">${l}</div><div style="font-size:18px;font-weight:700;color:${c};">${v}</div></div>`).join('')}
      </div>
      <div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px;">
        <div style="font-size:10px;color:${t.dim};margin-bottom:8px;font-weight:500;">PACKETS/SEC (30s)</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:64px;">${bars}</div>
      </div>`;
  }else if(activeNetSubTab==='webrtc'){
    const s=webrtcStats;
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;">
      <div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:${t.dim};margin-bottom:6px;font-weight:500;letter-spacing:0.5px;">CONNECTION STATE</div>
        <div style="font-size:16px;font-weight:700;color:${s.state==='Connected'?'#00ff88':t.border};">${s.state}</div>
      </div>
      ${[['🏠 Local Candidate',s.localCand],['🌐 Remote Candidate',s.remoteCand],['📶 Round Trip Time',s.rtt],['🎵 Audio Jitter',s.jitter],['⬆️ Bytes Sent',formatBytes(s.bytesSent)],['⬇️ Bytes Received',formatBytes(s.bytesReceived)]].map(([l,v])=>`<div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:11px 12px;"><div style="font-size:10px;color:${t.dim};margin-bottom:3px;">${l}</div><div style="font-size:11px;color:${t.text};word-break:break-all;">${v}</div></div>`).join('')}
    </div>`;
  }
}

// ---- Event log ----
function updateEventLog(){
  const el=document.getElementById('eventContent');if(!el)return;
  if(eventLog.length===0){el.innerHTML='<div style="color:#443366;text-align:center;padding:20px 0;font-size:11px;">No events yet.</div>';return;}
  const colors={info:'#7b68ee',success:'#00ff88',warning:'#ffaa00',danger:'#ff4444'};
  el.innerHTML=eventLog.slice(0,100).map(ev=>`
    <div class="eventEntry" style="border-bottom:1px solid rgba(255,255,255,0.04);padding:8px 0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${colors[ev.severity]||'#888'};flex-shrink:0;"></div>
        <span style="color:#443366;font-size:10px;">${ev.time}</span>
        <span style="background:${colors[ev.severity]||'#888'}18;border:1px solid ${colors[ev.severity]||'#888'}33;color:${colors[ev.severity]||'#888'};font-size:9px;padding:1px 5px;border-radius:4px;font-weight:600;">${ev.severity.toUpperCase()}</span>
      </div>
      <div style="color:${currentTheme.sub};font-size:11px;padding-left:12px;line-height:1.4;">${ev.desc}</div>
    </div>`).join('');
}

// ---- Stats ----
function updateStats(){
  const el=document.getElementById('statsContent');if(!el)return;
  const total=peerLog.length;
  if(total===0){el.innerHTML='<div style="color:#443366;text-align:center;padding:30px 0;font-size:12px;">No data yet.</div>';return;}
  const t=currentTheme;
  const bar=(pct,color)=>`<div class="frostStatBar"><div class="frostStatBarFill" style="width:${pct}%;background:${color};"></div></div>`;
  const topC=Object.entries(sessionStats.countries).sort((a,b)=>b[1]-a[1]).slice(0,5);
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      ${[['Total Peers',sessionStats.total,'#c8b8ff'],['Skips',sessionStats.skips,'#ffaa00'],['VPN/DC',sessionStats.vpn,'#ff4444'],['Residential',sessionStats.residential,'#7b68ee'],['Mobile',sessionStats.mobile,'#00bfff'],['Tor',sessionStats.tor,'#ff8800']].map(([l,v,c])=>`<div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px;"><div style="font-size:10px;color:${t.dim};margin-bottom:4px;">${l}</div><div style="font-size:20px;font-weight:700;color:${c};">${v}</div></div>`).join('')}
    </div>
    <div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;letter-spacing:0.5px;margin-bottom:10px;">SESSION INFO</div>
      ${[['⏱️ Session Time',formatDuration(Date.now()-sessionStartTime)],['🌍 Countries Seen',Object.keys(sessionStats.countries).length],['💬 Messages',sessionStats.messages]].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;"><span style="color:${t.dim};">${l}</span><span style="color:${t.text};font-weight:600;">${v}</span></div>`).join('')}
    </div>
    <div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;letter-spacing:0.5px;margin-bottom:10px;">TYPE BREAKDOWN</div>
      ${[['🔴 VPN/DC',Math.round(sessionStats.vpn/total*100),'#ff4444'],['🟢 Residential',Math.round(sessionStats.residential/total*100),'#7b68ee'],['📱 Mobile',Math.round(sessionStats.mobile/total*100),'#00bfff'],['🟡 Hosting',Math.round(sessionStats.hosting/total*100),'#ffaa00'],['🧅 Tor',Math.round(sessionStats.tor/total*100),'#ff8800']].map(([l,p,c])=>`<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span style="color:${t.sub};">${l}</span><span style="color:${c};font-weight:600;">${p}%</span></div>${bar(p,c)}</div>`).join('')}
    </div>
    ${topC.length>0?`<div style="background:${t.card};border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:14px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;letter-spacing:0.5px;margin-bottom:10px;">TOP COUNTRIES</div>
      ${topC.map(([c,n])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;"><span style="color:${t.sub};">${COUNTRIES[c]||c}</span><span style="color:${t.border};font-weight:700;">${n}</span></div>`).join('')}
    </div>`:''}`;
}

// ---- Tab switching ----
document.querySelectorAll('.tabBtn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    activeTab=btn.dataset.tab;
    document.querySelectorAll('.tabBtn').forEach(b=>{
      const a=b.dataset.tab===activeTab;
      b.style.background=a?`rgba(${currentTheme.border.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)).join(',')},0.15)`:'none';
      b.style.color=a?currentTheme.text:currentTheme.dim;
      b.style.borderBottom=a?`2px solid ${currentTheme.border}`:'2px solid transparent';
    });
    ['Peers','Map','Network','Stats','Events','Collection','Settings','About'].forEach(n=>{const el=document.getElementById(`tab${n}`);if(el)el.style.display='none';});
    const tabEl=document.getElementById(`tab${activeTab.charAt(0).toUpperCase()+activeTab.slice(1)}`);
    if(tabEl)tabEl.style.display=['peers','network','map'].includes(activeTab)?'flex':'block';
    if(activeTab==='stats')updateStats();
    if(activeTab==='map'){initMap();setTimeout(()=>{if(leafletMap){leafletMap.invalidateSize();if(currentMapMarker)flyToLatest();}},200);}
    if(activeTab==='network')updateNetContent();
    if(activeTab==='events')updateEventLog();
    if(activeTab==='collection'){const el=document.getElementById('collectionContent');if(el)el.innerHTML=buildCollectionHTML();}
  });
});

// ---- Click delegation ----
document.addEventListener('click',e=>{
  if(e.target.classList.contains('netSubBtn')){
    activeNetSubTab=e.target.dataset.net;
    document.querySelectorAll('.netSubBtn').forEach(b=>{const a=b.dataset.net===activeNetSubTab;b.style.background=a?`rgba(123,104,238,0.15)`:'none';b.style.color=a?currentTheme.text:currentTheme.dim;b.style.borderBottom=a?`2px solid ${currentTheme.border}`:'2px solid transparent';});
    updateNetContent();
  }
  if(e.target.classList.contains('themeBtn')&&e.target.dataset.theme)applyTheme(themes[e.target.dataset.theme]);
  if(e.target.id==='autoSkipToggle'||e.target.closest('#autoSkipToggle')){
    autoSkipEnabled=!autoSkipEnabled;
    const tog=document.getElementById('autoSkipToggle');
    if(tog){tog.style.background=autoSkipEnabled?currentTheme.border:'#1e1e2e';tog.style.borderColor=autoSkipEnabled?currentTheme.border:'rgba(255,255,255,0.1)';const k=tog.querySelector('.frostKnob');if(k){k.style.left=autoSkipEnabled?'20px':'3px';k.style.background=autoSkipEnabled?'#fff':'#555';}}
    saveCookies();
  }
});

// Country select
document.getElementById('targetCountrySelect')?.addEventListener('change',e=>{
  targetCountry=e.target.value||null;
  const disp=document.getElementById('targetCountryDisplay');if(disp)disp.textContent=targetCountry?`🎯 Targeting: ${COUNTRIES[targetCountry]||targetCountry}`:'🌍 No target set';
  const td=document.getElementById('targetDisplay');if(td){td.textContent=`🎯 ${COUNTRIES[targetCountry]||''}`;td.style.display=targetCountry?'block':'none';}
  saveCookies();logEvent('info',`Target: ${COUNTRIES[targetCountry]||'None'}`);
});

// ---- Toggles ----
document.querySelectorAll('.frostToggle').forEach(wrap=>{
  if(wrap.id==='autoSkipToggle')return;
  wrap.addEventListener('click',()=>{
    const key=wrap.dataset.key;if(!key||!settings[key])return;
    settings[key].val=!settings[key].val;
    const on=settings[key].val;
    wrap.style.background=on?currentTheme.border:'#1e1e2e';
    wrap.style.borderColor=on?currentTheme.border:'rgba(255,255,255,0.1)';
    const knob=wrap.querySelector('.frostKnob');
    if(knob){knob.style.left=on?'20px':'3px';knob.style.background=on?'#fff':'#555';}
    if(key==='darkOverlay')updateOverlay();
    if(key==='snapToEdge')applySnap();
    if((key==='embedDarkMode'||key==='siteMods')&&embeddedMode)applySiteTheme(currentTheme);
    if(key==='disablePayPopups'){if(on)enablePaymentBlocker();else disablePaymentBlocker();}
    saveCookies();
  });
});

// ---- Helpers ----
function formatBytes(b){if(!b||b===0)return'0 B';const k=1024,s=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(k));return(b/Math.pow(k,i)).toFixed(1)+' '+s[i];}
function formatDuration(ms){if(!ms)return'0s';const s=Math.floor(ms/1000);return s<60?s+'s':Math.floor(s/60)+'m '+s%60+'s';}
function isCloudflare(ip){return['104.30.','104.16.','104.17.','104.18.','104.19.','172.64.','162.158.'].some(p=>ip.startsWith(p));}
function isIPv6(ip){return ip.includes(':');}
function classifyASN(org){
  const asn=org?.split(' ')[0];const known=VPN_PROVIDERS[asn];
  if(known){if(known.type==='VPN'||known.type==='VPN_HOST')return'🔴 VPN/DC';if(known.type==='CLOUD')return'🟡 Hosting';if(known.type==='MOBILE')return'📱 Mobile';if(known.type==='ISP')return'🟢 Residential';}
  if(org?.toLowerCase().includes('vpn'))return'🔴 VPN';
  if(org?.toLowerCase().includes('hosting'))return'🟡 Hosting';
  if(org?.toLowerCase().includes('wireless')||org?.toLowerCase().includes('mobile'))return'📱 Mobile';
  return'🟢 Residential';
}
function getMarkerColor(p){if(p.type?.includes('🧅'))return'#ff8800';if(p.type?.includes('🔴'))return'#ff4444';if(p.type?.includes('🟡'))return'#ffaa00';if(p.type?.includes('📱'))return'#00bfff';return currentTheme.border;}

// ---- Map ----
function initMap(){
  if(mapLoaded)return;mapLoaded=true;
  if(!document.querySelector('link[href*="leaflet"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
  if(window.L){setupMap();return;}
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=setupMap;document.head.appendChild(s);
}
function setupMap(){
  const el=document.getElementById('frostMap');el.style.height='100%';
  leafletMap=L.map('frostMap',{zoomControl:true,attributionControl:false}).setView([20,0],2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(leafletMap);
  peerLog.forEach(p=>addMapMarker(p,false));if(peerLog.length>0)flyToLatest();
}
function addMapMarker(p,fly=true){
  if(!leafletMap||!p.loc||p.loc==='?')return;
  const[lat,lon]=p.loc.split(',').map(Number);if(isNaN(lat)||isNaN(lon))return;
  const color=getMarkerColor(p);
  const icon=L.divIcon({className:'',html:`<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 10px ${color},0 0 20px ${color}44;"></div>`,iconSize:[14,14],iconAnchor:[7,7]});
  const m=L.marker([lat,lon],{icon}).addTo(leafletMap);
  m.bindPopup(`<div style="font-family:Inter,sans-serif;font-size:11px;min-width:160px;line-height:1.6;"><b style="color:#c8b8ff;font-size:12px;">${p.ip}</b><br><span style="color:#9988cc;">${p.city}, ${p.region}</span><br>${p.country}<br><span style="color:#7b68ee;">${p.org}</span><br><span style="color:${color};font-weight:600;">${p.type}</span></div>`);
  mapMarkers.push(m);currentMapMarker=m;if(fly)flyToLatest();
}
function flyToLatest(){
  if(!leafletMap||!currentMapMarker)return;
  leafletMap.flyTo(currentMapMarker.getLatLng(),8,{animate:true,duration:1.5});
  setTimeout(()=>currentMapMarker.openPopup(),1600);
}

// ---- Snap/Drag/Resize ----
function applySnap(){if(settings.snapToEdge.val){panel.style.transform='none';panel.style.top='10px';panel.style.left='auto';panel.style.right='10px';panel.style.maxHeight='calc(100vh - 20px)';}}
document.getElementById('ppSnapBtn').addEventListener('click',()=>{settings.snapToEdge.val=!settings.snapToEdge.val;applySnap();saveCookies();});
const pph=document.getElementById('pph');let dragging=false,ox=0,oy=0;
pph.addEventListener('mousedown',e=>{if(settings.snapToEdge.val)return;dragging=true;const r=panel.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;panel.style.transform='none';pph.style.cursor='grabbing';});
document.addEventListener('mousemove',e=>{if(!dragging)return;panel.style.left=Math.max(0,e.clientX-ox)+'px';panel.style.top=Math.max(0,e.clientY-oy)+'px';panel.style.right='auto';});
document.addEventListener('mouseup',()=>{dragging=false;pph.style.cursor='grab';});
pph.addEventListener('touchstart',e=>{if(settings.snapToEdge.val)return;const t=e.touches[0];dragging=true;const r=panel.getBoundingClientRect();ox=t.clientX-r.left;oy=t.clientY-r.top;panel.style.transform='none';},{passive:true});
document.addEventListener('touchmove',e=>{if(!dragging)return;const t=e.touches[0];panel.style.left=Math.max(0,t.clientX-ox)+'px';panel.style.top=Math.max(0,t.clientY-oy)+'px';panel.style.right='auto';},{passive:true});
document.addEventListener('touchend',()=>dragging=false);
const resizeHandle=document.getElementById('frostResizeHandle');let resizing=false,rox=0,roy=0,rw=0,rh=0;
resizeHandle.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();resizing=true;rox=e.clientX;roy=e.clientY;rw=panel.offsetWidth;rh=panel.offsetHeight;});
document.addEventListener('mousemove',e=>{if(!resizing)return;panel.style.width=Math.max(320,rw+(e.clientX-rox))+'px';panel.style.maxHeight=Math.max(400,rh+(e.clientY-roy))+'px';});
document.addEventListener('mouseup',()=>resizing=false);

// ---- Open/Close ----
function closePanel(){panel.style.display='none';dragon.style.display='block';overlay.style.display='none';}
function openPanel(){dragon.style.display='none';panel.style.display='flex';if(!settings.snapToEdge.val){panel.style.top='50%';panel.style.left='50%';panel.style.right='auto';panel.style.transform='translate(-50%,-50%)';}else applySnap();if(settings.darkOverlay.val)overlay.style.display='block';}
document.getElementById('ppClose').addEventListener('click',closePanel);

// ---- Copy/Export ----
document.getElementById('ppCopyAll').addEventListener('click',()=>{
  const text=peerLog.map((p,i)=>{const asn=lookupASN(p.org);const{score,reasons}=scoreConnection(p,asn);return[`--- Peer #${i+1} ---`,`IP:      ${p.ip}`,`Type:    ${p.label} ${p.type}`,`ASN:     ${asn?.name||'?'} — ${asn?.label||'?'} — Risk ${asn?.risk||0}/10`,`Quality: ${'★'.repeat(score)}${'☆'.repeat(5-score)} ${score}/5`,`Reasons: ${reasons.join(', ')||'None'}`,`City:    ${p.city}, ${p.region}`,`Country: ${p.country}`,`ISP:     ${p.org}`,`Time:    ${p.time}`].join('\n');}).join('\n\n');
  navigator.clipboard.writeText(text||'No peers yet').then(()=>{const btn=document.getElementById('ppCopyAll');btn.textContent='✅';setTimeout(()=>btn.textContent='📋',1500);});
});
document.getElementById('ppExportBtn').addEventListener('click',()=>{
  const data={version:'0.2.2',peers:peerLog.map(p=>{const asn=lookupASN(p.org);const q=scoreConnection(p,asn);return{...p,asnInfo:asn,qualityScore:q.score,qualityReasons:q.reasons};}),events:eventLog,stats:sessionStats,connections:[...netConnections.values()],subnets:[...subnetMap.values()],protocols:protocolCounts,collection:getCollection()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`frosts_v022_${Date.now()}.json`;a.click();
  logEvent('info','Session exported');
});
document.getElementById('ppClear').addEventListener('click',()=>{
  document.getElementById('ppBody').innerHTML=`<div id="ppEmpty" style="color:#443366;text-align:center;padding:50px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;"><div style="font-size:40px;opacity:0.2;">🐉</div><div style="font-size:13px;color:#553366;">Waiting for peer connection...</div></div>`;
  seenIPs.clear();peerLog.length=0;peerCountFloat=0;activePeers.clear();subnetMap.clear();
  sessionStats={total:0,vpn:0,residential:0,mobile:0,hosting:0,tor:0,countries:{},totalTime:0,messages:0,skips:0,matches:0,longestConvo:0};
  document.getElementById('ppCount').textContent='Peers: 0';
  mapMarkers.forEach(m=>leafletMap&&leafletMap.removeLayer(m));mapMarkers.length=0;currentMapMarker=null;
  if(leafletMap)leafletMap.setView([20,0],2);
  clearEmbedPeers();logEvent('info','Session cleared');
});
document.getElementById('ppClearHistory').addEventListener('click',()=>{try{localStorage.removeItem('frostPeerHistory');}catch(e){}const btn=document.getElementById('ppClearHistory');btn.textContent='✅ Cleared';setTimeout(()=>btn.textContent='🗑 History',1500);});

// ---- Add peer to panel ----
function addToPanel(p){
  const body=document.getElementById('ppBody');
  if(!settings.showAll.val){body.innerHTML='';peerCountFloat=0;}
  const empty=document.getElementById('ppEmpty');if(empty)empty.remove();

  const isTor=torExits.has(p.ip);
  const seenCount=getSeenCount(p.ip);
  const color=getMarkerColor(p);
  const asnInfo=lookupASN(p.org);
  const{score,reasons}=scoreConnection(p,asnInfo);
  const riskColor=asnInfo?getRiskColor(asnInfo.risk):'#666';
  const isBadASN=asnInfo&&BAD_ASNS.has(p.org?.split(' ')[0]);
  const subnetEntry=trackSubnet(p.ip,p);
  const isSubnetCluster=subnetEntry&&subnetEntry.ips.length>1;
  const isTarget=targetCountry&&p.country===targetCountry;
  const vpnColor=settings.highlightVPN.val&&(p.type?.includes('🔴')||isTor)?'#ff4444':currentTheme.text;
  const t=currentTheme;

  const entry=document.createElement('div');
  entry.className='peerEntry';
  if(isBadASN&&settings.showBadASN.val)entry.classList.add('frost-bad-asn');
  if(isSubnetCluster&&settings.showSubnetAlert.val)entry.classList.add('frost-subnet-alert');
  if(isTarget)entry.classList.add('frost-country-match');
  entry.style.cssText=`border:1px solid ${color}22;border-left:3px solid ${color};border-radius:12px;padding:12px 14px;margin-bottom:8px;background:${t.card}cc;position:relative;`;

  const badges=[];
  if(isTor&&settings.showTor.val)badges.push(`<span class="frost-badge" style="background:#ff880020;border-color:#ff880066;color:#ff8800;">🧅 TOR</span>`);
  if(seenCount>0&&settings.showRepeat.val)badges.push(`<span class="frost-badge" style="background:#ffaa0020;border-color:#ffaa0066;color:#ffaa00;">🔁 ${seenCount}x</span>`);
  if(p.privacyScore&&settings.showPrivacy.val)badges.push(`<span class="frost-badge" style="background:#ff222220;border-color:#ff222266;color:#ff6666;">🛡️ PROXY</span>`);
  if(isBadASN&&settings.showBadASN.val)badges.push(`<span class="frost-badge" style="background:#ff000020;border-color:#ff000066;color:#ff4444;">⚠️ BAD ASN</span>`);
  if(isSubnetCluster&&settings.showSubnetAlert.val)badges.push(`<span class="frost-badge" style="background:#ffaa0020;border-color:#ffaa0066;color:#ffaa00;">🕸️ CLUSTER</span>`);
  if(isTarget)badges.push(`<span class="frost-badge" style="background:#00ff8820;border-color:#00ff8866;color:#00ff88;">🎯 MATCH</span>`);

  let html=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0;flex-wrap:wrap;">
        ${p.flag?`<img src="${p.flag}" style="width:18px;height:13px;border-radius:3px;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.4);">`:''}
        <b style="color:${t.text};font-size:13px;word-break:break-all;">${p.label} ${p.ip}${settings.showPort.val&&p.port?`<span style="color:${t.dim};font-size:11px;font-weight:400;">:${p.port}</span>`:''}</b>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">
        <button onclick="addToCollection('${p.ip}',${JSON.stringify({city:p.city,region:p.region,country:p.country,org:p.org,type:p.type}).replace(/"/g,"'")})" title="Save to collection" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:${t.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:4px 8px;transition:all 0.15s;">📌</button>
        <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅');setTimeout(()=>this.textContent='📋',1500)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:${t.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:4px 8px;transition:all 0.15s;">📋</button>
      </div>
    </div>
    ${badges.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">${badges.join('')}</div>`:''}
    <div style="color:${vpnColor};font-size:11px;font-weight:500;margin-bottom:5px;">${isTor?'🧅 Tor Exit Node':p.type}${settings.showCandType.val?` <span style="color:${t.dim};font-weight:400;">• ${p.candType}</span>`:''}</div>
  `;

  if(!settings.compactMode.val){
    html+=`<div style="color:${t.sub};font-size:12px;">📍 ${p.city}, ${p.region} ${p.country}</div>`;
    html+=`<div style="color:${t.sub};font-size:12px;margin-top:3px;">🏢 ${p.org}</div>`;

    // ASN Intelligence
    if(settings.showASNInfo.val&&asnInfo){
      html+=`<div class="asn-badge" style="background:${riskColor}18;border-color:${riskColor}44;color:${riskColor};margin-top:6px;">🏢 ${asnInfo.name} • ${asnInfo.label} • Risk ${asnInfo.risk}/10</div>`;
    }

    // Quality score
    if(settings.showQualityScore.val){
      html+=`<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span class="quality-stars">${renderStars(score)}</span>
        <span style="font-size:10px;color:${t.dim};">${score}/5${reasons.length?' — '+reasons.join(', '):''}</span>
      </div>`;
    }

    if(isSubnetCluster&&settings.showSubnetAlert.val){
      html+=`<div style="font-size:10px;color:#ffaa00;margin-top:5px;font-weight:500;">🕸️ ${subnetEntry.ips.length} IPs from ${subnetEntry.subnet}</div>`;
    }

    const extras=[];
    if(settings.showCoords.val)extras.push(`🌐 ${p.loc}`);
    if(settings.showPostal.val)extras.push(`📮 ${p.postal}`);
    if(settings.showTimestamp.val)extras.push(`🕐 ${p.time}`);
    if(extras.length)html+=`<div style="color:${t.dim};font-size:10px;margin-top:6px;line-height:1.6;">${extras.join(' • ')}</div>`;
    if(settings.showDuration.val)html+=`<div id="dur_${p.ip.replace(/[:.]/g,'_')}" style="color:${t.dim};font-size:10px;margin-top:4px;">⏱️ 0s <span class="liveDot" style="color:${color};">●</span></div>`;
    if(settings.showTimeline.val)html+=`<div style="height:3px;background:rgba(255,255,255,0.05);border-radius:2px;margin-top:8px;overflow:hidden;"><div id="tl_${p.ip.replace(/[:.]/g,'_')}" style="height:100%;width:0%;background:${color};border-radius:2px;transition:width 0.5s;"></div></div>`;
    html+=`<textarea class="peerNote" placeholder="Add a note about this peer..." rows="1" onfocus="this.rows=3" onblur="this.rows=1"></textarea>`;
  }else{
    html+=`<div style="color:${t.sub};font-size:11px;">📍 ${p.city}, ${p.country} • 🏢 ${p.org}</div>`;
    if(settings.showQualityScore.val)html+=`<span class="quality-stars" style="font-size:11px;margin-top:3px;display:block;">${renderStars(score)}</span>`;
  }

  entry.innerHTML=html;body.appendChild(entry);
  if(settings.autoScroll.val)body.scrollTop=body.scrollHeight;
  peerCountFloat++;document.getElementById('ppCount').textContent=`Peers: ${peerCountFloat}`;

  if(settings.showDuration.val){
    const startTime=Date.now();const durId=`dur_${p.ip.replace(/[:.]/g,'_')}`;const tlId=`tl_${p.ip.replace(/[:.]/g,'_')}`;
    const timer=setInterval(()=>{const el=document.getElementById(durId);const tl=document.getElementById(tlId);if(!el){clearInterval(timer);return;}const secs=Math.floor((Date.now()-startTime)/1000);const mins=Math.floor(secs/60);el.innerHTML=`⏱️ ${mins>0?mins+'m ':''}${secs%60}s <span class="liveDot" style="color:${color};">●</span>`;if(tl)tl.style.width=Math.min(100,(secs/300)*100)+'%';},1000);
    activePeers.set(p.ip,{timer,startTime});
  }
  addMapMarker(p,true);
  if(activeTab==='stats')updateStats();
}

// ---- Embed mode ----
function buildEmbedContainer(){
  const t=currentTheme;
  const el=document.createElement('div');el.id='frostEmbedContainer';
  el.style.cssText=`width:100%;background:${t.bg};border-top:2px solid ${t.border};font-family:Inter,system-ui,sans-serif;overflow-y:auto;max-height:480px;transition:background 0.3s,border-color 0.3s;`;
  el.innerHTML=`
    <!-- Embed Header -->
    <div id="frostEmbedHeader" style="padding:12px 14px;background:${t.gradient};border-bottom:1px solid ${t.border}22;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;transition:background 0.3s;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">🐉</span>
        <div>
          <div style="font-weight:700;font-size:13px;color:${t.text};letter-spacing:0.3px;">Frosts Tools</div>
          <div style="font-size:9px;color:${t.dim};letter-spacing:1px;margin-top:1px;">v0.2.2 • ASN Intelligence</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <div class="embedStat" style="background:rgba(0,0,0,0.3);border:1px solid ${t.border}22;border-radius:8px;padding:4px 10px;font-size:10px;color:${t.dim};">👥 <b id="embedPeerCount" style="color:${t.text};">0</b></div>
          <div class="embedStat" style="background:rgba(0,0,0,0.3);border:1px solid ${t.border}22;border-radius:8px;padding:4px 10px;font-size:10px;color:${t.dim};">⏱️ <span id="embedTimer" style="color:${t.text};">0s</span></div>
          <div class="embedStat" style="background:rgba(0,0,0,0.3);border:1px solid ${t.border}22;border-radius:8px;padding:4px 10px;font-size:10px;color:${t.dim};">🌍 <span id="embedCountries" style="color:${t.text};">0</span></div>
          ${targetCountry?`<div class="embedStat" style="background:${t.border}18;border:1px solid ${t.border}44;border-radius:8px;padding:4px 10px;font-size:10px;color:${t.border};font-weight:600;">🎯 ${COUNTRIES[targetCountry]?.split(' ')[0]||targetCountry}</div>`:''}
        </div>
        <button id="embedCopyAll" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:${t.text};cursor:pointer;font-size:11px;padding:5px 10px;border-radius:7px;font-family:inherit;font-weight:500;transition:background 0.15s;">📋 Copy</button>
        <button id="embedClose" style="background:rgba(255,68,68,0.15);border:1px solid rgba(255,68,68,0.3);color:#ff6666;cursor:pointer;font-size:11px;padding:5px 10px;border-radius:7px;transition:background 0.15s;">✕ Close</button>
      </div>
    </div>

    <!-- Map -->
    <div id="embedMapEl" style="width:100%;height:160px;background:${t.header};border-bottom:1px solid ${t.border}11;position:relative;overflow:hidden;">
      <div id="embedMapPlaceholder" style="display:flex;align-items:center;justify-content:center;height:100%;color:${t.dim};font-size:12px;gap:8px;">
        <span style="font-size:20px;opacity:0.4;">🗺️</span>
        <span>Map appears when first peer connects</span>
      </div>
    </div>

    <!-- Peer area -->
    <div id="embedPeerArea" style="padding:10px;">
      <div id="embedEmpty" style="color:${t.dim};text-align:center;padding:20px;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px;">
        <span style="font-size:28px;opacity:0.2;">🐉</span>
        <span>Waiting for peer connection...</span>
        <span style="font-size:10px;color:${t.dim};opacity:0.6;">Start a call — peer info will appear here</span>
      </div>
    </div>
  `;
  return el;
}

function updateEmbedTheme(t){
  const el=document.getElementById('frostEmbedContainer');if(!el)return;
  el.style.background=t.bg;el.style.borderTopColor=t.border;
  const hdr=document.getElementById('frostEmbedHeader');if(hdr){hdr.style.background=t.gradient;hdr.style.borderBottomColor=t.border+'22';}
}

function clearEmbedPeers(){
  const area=document.getElementById('embedPeerArea');
  const t=currentTheme;
  if(area)area.innerHTML=`<div id="embedEmpty" style="color:${t.dim};text-align:center;padding:20px;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px;"><span style="font-size:28px;opacity:0.2;">🐉</span><span>Waiting for peer connection...</span></div>`;
  const cnt=document.getElementById('embedPeerCount');if(cnt)cnt.textContent='0';
  embedMapMarkers.forEach(m=>embedLeafletMap&&embedLeafletMap.removeLayer(m));
  embedMapMarkers.length=0;embedCurrentMarker=null;
  if(embedLeafletMap)embedLeafletMap.setView([20,0],2);
}

function initEmbedMap(){
  if(embedMapLoaded)return;embedMapLoaded=true;
  if(!document.querySelector('link[href*="leaflet"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
  if(window.L){setupEmbedMap();return;}
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=setupEmbedMap;document.head.appendChild(s);
}
function setupEmbedMap(){
  const placeholder=document.getElementById('embedMapPlaceholder');if(placeholder)placeholder.remove();
  const el=document.getElementById('embedMapEl');if(!el)return;
  embedLeafletMap=L.map('embedMapEl',{zoomControl:false,attributionControl:false}).setView([20,0],2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(embedLeafletMap);
  peerLog.forEach(p=>addEmbedMapMarker(p,false));
  if(peerLog.length>0)flyEmbedMap();
}
function addEmbedMapMarker(p,fly=true){
  if(!embedLeafletMap||!p.loc||p.loc==='?')return;
  const[lat,lon]=p.loc.split(',').map(Number);if(isNaN(lat)||isNaN(lon))return;
  const color=getMarkerColor(p);
  const icon=L.divIcon({className:'',html:`<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 8px ${color};"></div>`,iconSize:[12,12],iconAnchor:[6,6]});
  const m=L.marker([lat,lon],{icon}).addTo(embedLeafletMap);
  m.bindPopup(`<div style="font-family:Inter,sans-serif;font-size:10px;line-height:1.5;"><b>${p.ip}</b><br>${p.city}, ${p.country}<br><span style="color:${color};font-weight:600;">${p.type}</span></div>`);
  embedMapMarkers.push(m);embedCurrentMarker=m;if(fly)flyEmbedMap();
}
function flyEmbedMap(){if(!embedLeafletMap||!embedCurrentMarker)return;embedLeafletMap.flyTo(embedCurrentMarker.getLatLng(),7,{animate:true,duration:1.2});setTimeout(()=>embedCurrentMarker.openPopup(),1300);}

function addEmbedPeerCard(p){
  const area=document.getElementById('embedPeerArea');if(!area)return;
  const empty=document.getElementById('embedEmpty');if(empty)empty.remove();
  if(!settings.showAll.val){area.innerHTML='';const cnt=document.getElementById('embedPeerCount');if(cnt)cnt.textContent='0';}
  const t=currentTheme;const color=getMarkerColor(p);
  const isTor=torExits.has(p.ip);const seenCount=getSeenCount(p.ip);
  const asnInfo=lookupASN(p.org);const{score}=scoreConnection(p,asnInfo);
  const riskColor=asnInfo?getRiskColor(asnInfo.risk):'#666';
  const isMatch=targetCountry&&p.country===targetCountry;
  const isBadASN=asnInfo&&BAD_ASNS.has(p.org?.split(' ')[0]);

  const card=document.createElement('div');
  card.className='embedPeerCard';
  card.style.cssText=`background:${t.card};border:1px solid ${isMatch?'#00ff8844':isBadASN?'#ff444433':color+'22'};border-left:3px solid ${color};padding:12px 14px;margin-bottom:8px;box-shadow:${isMatch?'0 0 12px #00ff8822':''};`;
  if(isBadASN)card.style.animation='badASNGlow 1.5s ease infinite';

  const badges=[];
  if(isMatch)badges.push(`<span class="frost-badge" style="background:#00ff8820;border-color:#00ff8866;color:#00ff88;">🎯 MATCH</span>`);
  if(isBadASN)badges.push(`<span class="frost-badge" style="background:#ff000020;border-color:#ff000066;color:#ff4444;">⚠️ BAD ASN</span>`);
  if(isTor)badges.push(`<span class="frost-badge" style="background:#ff880020;border-color:#ff880066;color:#ff8800;">🧅 TOR</span>`);
  if(seenCount>0)badges.push(`<span class="frost-badge" style="background:#ffaa0020;border-color:#ffaa0066;color:#ffaa00;">🔁 ${seenCount}x</span>`);

  card.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
        ${p.flag?`<img src="${p.flag}" style="width:18px;height:13px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.4);">`:''}
        <b style="color:${t.text};font-size:13px;">${p.label} ${p.ip}</b>
        ${badges.join('')}
      </div>
      <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅');setTimeout(()=>this.textContent='📋',1500)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:${t.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:4px 8px;flex-shrink:0;">📋</button>
    </div>
    <div style="color:${isTor?'#ff8800':color};font-size:11px;font-weight:500;margin-bottom:5px;">${isTor?'🧅 Tor Exit Node':p.type}</div>
    ${asnInfo&&settings.showASNInfo.val?`<div class="asn-badge" style="background:${riskColor}18;border-color:${riskColor}44;color:${riskColor};margin-bottom:6px;">🏢 ${asnInfo.name} • Risk ${asnInfo.risk}/10</div>`:''}
    ${settings.showQualityScore.val?`<div style="margin-bottom:5px;"><span class="quality-stars">${renderStars(score)}</span> <span style="font-size:10px;color:${t.dim};">${score}/5</span></div>`:''}
    <div style="color:${t.sub};font-size:12px;">📍 ${p.city}, ${p.region}, ${p.country}</div>
    <div style="color:${t.sub};font-size:12px;margin-top:3px;">🏢 ${p.org}</div>
    <div style="color:${t.dim};font-size:10px;margin-top:5px;display:flex;gap:10px;flex-wrap:wrap;">
      <span>🕐 ${p.time}</span>
      ${settings.showCoords.val?`<span>🌐 ${p.loc}</span>`:''}
    </div>
    ${settings.showDuration.val?`<div id="embedDur_${p.ip.replace(/[:.]/g,'_')}" style="color:${t.dim};font-size:10px;margin-top:5px;">⏱️ 0s <span class="liveDot" style="color:${color};">●</span></div>`:''}
    ${settings.showTimeline.val?`<div style="height:2px;background:rgba(255,255,255,0.05);border-radius:1px;margin-top:8px;overflow:hidden;"><div id="embedTl_${p.ip.replace(/[:.]/g,'_')}" style="height:100%;width:0%;background:${color};border-radius:1px;transition:width 0.5s;"></div></div>`:''}
  `;
  area.appendChild(card);

  const cnt=document.getElementById('embedPeerCount');if(cnt){const c=parseInt(cnt.textContent||'0');cnt.textContent=c+1;}
  document.getElementById('embedCountries').textContent=countryCollection.size;

  if(settings.showDuration.val){
    const startTime=Date.now();const durId=`embedDur_${p.ip.replace(/[:.]/g,'_')}`;const tlId=`embedTl_${p.ip.replace(/[:.]/g,'_')}`;
    setInterval(()=>{const el=document.getElementById(durId);const tl=document.getElementById(tlId);if(!el)return;const secs=Math.floor((Date.now()-startTime)/1000);const mins=Math.floor(secs/60);el.innerHTML=`⏱️ ${mins>0?mins+'m ':''}${secs%60}s <span class="liveDot" style="color:${color};">●</span>`;if(tl)tl.style.width=Math.min(100,(secs/300)*100)+'%';},1000);
  }
  const container=document.getElementById('frostEmbedContainer');if(container)container.scrollTop=container.scrollHeight;
}

setInterval(()=>{const el=document.getElementById('embedTimer');if(el)el.textContent=formatDuration(Date.now()-sessionStartTime);},1000);

function applySiteTheme(t){
  let s=document.getElementById('frostSiteTheme');if(!s){s=document.createElement('style');s.id='frostSiteTheme';document.head.appendChild(s);}
  if(!settings.embedDarkMode.val){s.textContent='';return;}
  const c=t.site;
  s.textContent=`body{background:${c.body}!important;color:${c.text}!important;transition:background 0.3s,color 0.3s;}.main,.mainContent,.videoGrid{background:${c.body}!important;}.chatWindow{background:${c.chat}!important;transition:background 0.3s;}.rightBox,.outlined{border-color:${c.border}!important;background:${c.chat}!important;}.messageInput{background:${c.input}!important;color:${c.text}!important;border-color:${c.border}!important;}.sb{color:${c.accent}!important;}header,.header{background:${c.body}!important;border-color:${c.border}!important;}*{scrollbar-color:${c.accent} ${c.body};transition:background 0.3s;}::-webkit-scrollbar-track{background:${c.body}!important;}::-webkit-scrollbar-thumb{background:${c.accent}!important;border-radius:4px;}`;
}

function enableEmbedMode(){
  if(embeddedMode)return;
  const chatWindow=document.querySelector('.chatWindow');
  if(!chatWindow){alert('Could not find .chatWindow — make sure you\'re on umingle.com/video/');return;}
  embeddedMode=true;
  const btn=document.getElementById('ppEmbedBtn');
  btn.textContent='✅ Embedded';btn.style.background='linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,255,136,0.35))';btn.style.borderColor='rgba(0,255,136,0.5)';
  const container=buildEmbedContainer();chatWindow.insertBefore(container,chatWindow.firstChild);
  document.getElementById('embedCopyAll').addEventListener('click',()=>{
    const text=peerLog.map((p,i)=>{const asn=lookupASN(p.org);const{score}=scoreConnection(p,asn);return[`--- Peer #${i+1} ---`,`IP: ${p.ip}`,`Type: ${p.type}`,`ASN: ${asn?.name||'?'} (Risk ${asn?.risk||0}/10)`,`Quality: ${'★'.repeat(score)}${'☆'.repeat(5-score)} ${score}/5`,`City: ${p.city}, ${p.country}`,`ISP: ${p.org}`].join('\n');}).join('\n\n');
    navigator.clipboard.writeText(text||'No peers yet').then(()=>{const b=document.getElementById('embedCopyAll');b.textContent='✅ Copied';setTimeout(()=>b.textContent='📋 Copy',1500);});
  });
  document.getElementById('embedClose').addEventListener('click',()=>{
    const el=document.getElementById('frostEmbedContainer');if(el)el.remove();
    embeddedMode=false;embedMapLoaded=false;embedLeafletMap=null;embedMapMarkers.length=0;embedCurrentMarker=null;
    const btn=document.getElementById('ppEmbedBtn');btn.textContent='🔗 Embed';btn.style.background='linear-gradient(135deg,rgba(123,104,238,0.2),rgba(123,104,238,0.35))';btn.style.borderColor='rgba(123,104,238,0.5)';
    const s=document.getElementById('frostSiteTheme');if(s)s.textContent='';
  });
  initEmbedMap();applySiteTheme(currentTheme);
  if(settings.disablePayPopups.val)enablePaymentBlocker();
  peerLog.forEach(p=>{addEmbedPeerCard(p);addEmbedMapMarker(p,false);});
  logEvent('success','Embedded into site');closePanel();
}
document.getElementById('ppEmbedBtn').addEventListener('click',enableEmbedMode);

// ---- Apply theme ----
function applyTheme(t){
  currentTheme=t;
  panel.style.borderColor=t.border;
  panel.style.boxShadow=`0 0 0 1px ${t.border}22,0 24px 48px rgba(0,0,0,0.8),0 0 60px ${t.border}18`;
  panel.style.color=t.text;panel.style.background=t.bg;
  dragon.style.filter=`drop-shadow(0 0 10px ${t.border})`;
  document.getElementById('pph').style.background=t.gradient;
  document.getElementById('ppTabs').style.background='rgba(0,0,0,0.3)';
  document.querySelectorAll('.frostToggle').forEach(w=>{if(w.id==='autoSkipToggle')return;const key=w.dataset.key;if(!key||!settings[key])return;const on=settings[key].val;w.style.background=on?t.border:'#1e1e2e';w.style.borderColor=on?t.border:'rgba(255,255,255,0.1)';const k=w.querySelector('.frostKnob');if(k){k.style.left=on?'20px':'3px';k.style.background=on?'#fff':'#555';}});
  document.querySelectorAll('.tabBtn').forEach(b=>{const a=b.dataset.tab===activeTab;b.style.color=a?t.text:t.dim;b.style.borderBottom=a?`2px solid ${t.border}`:'2px solid transparent';b.style.background=a?`${t.border}22`:'none';});
  document.querySelectorAll('.themeBtn').forEach(b=>{const active=themes[b.dataset.theme]===t;b.style.opacity=active?'1':'0.6';b.style.border=`1.5px solid ${themes[b.dataset.theme].border}${active?'':'44'}`;b.style.boxShadow=active?`0 0 14px ${themes[b.dataset.theme].border}44,inset 0 1px 0 rgba(255,255,255,0.1)`:'';});
  document.querySelectorAll('.netSubBtn').forEach(b=>{const a=b.dataset.net===activeNetSubTab;b.style.color=a?t.text:t.dim;b.style.borderBottom=a?`2px solid ${t.border}`:'2px solid transparent';b.style.background=a?`rgba(123,104,238,0.15)`:'none';});
  if(embeddedMode){applySiteTheme(t);updateEmbedTheme(t);}
  saveCookies();
}

// ---- WebRTC Stats Polling ----
setInterval(()=>{
  if(!activePC)return;
  try{activePC.getStats().then(stats=>{stats.forEach(r=>{if(r.type==='candidate-pair'&&r.state==='succeeded'&&r.nominated){webrtcStats.rtt=r.currentRoundTripTime?(r.currentRoundTripTime*1000).toFixed(0)+'ms':'N/A';webrtcStats.bytesSent=r.bytesSent||0;webrtcStats.bytesReceived=r.bytesReceived||0;webrtcStats.state='Connected';const rem=stats.get(r.remoteCandidateId);const loc=stats.get(r.localCandidateId);if(rem)webrtcStats.remoteCand=`${rem.address}:${rem.port} (${rem.candidateType})`;if(loc)webrtcStats.localCand=`${loc.address}:${loc.port} (${loc.candidateType})`;}if(r.type==='inbound-rtp'&&r.kind==='audio')webrtcStats.jitter=r.jitter?(r.jitter*1000).toFixed(1)+'ms':'N/A';});});}catch(e){}
},2000);
setInterval(()=>{ppsHistory.push(ppsCount);if(ppsHistory.length>30)ppsHistory.shift();ppsCount=0;if(activeNetSubTab==='live'&&activeTab==='network')updateNetContent();},1000);

// ---- Site theme ----
function applySiteTheme(t){
  let s=document.getElementById('frostSiteTheme');if(!s){s=document.createElement('style');s.id='frostSiteTheme';document.head.appendChild(s);}
  if(!settings.embedDarkMode.val){s.textContent='';return;}
  const c=t.site;
  s.textContent=`body{background:${c.body}!important;color:${c.text}!important;}.main,.mainContent,.videoGrid{background:${c.body}!important;}.chatWindow{background:${c.chat}!important;}.rightBox,.outlined{border-color:${c.border}!important;background:${c.chat}!important;}.messageInput{background:${c.input}!important;color:${c.text}!important;border-color:${c.border}!important;}.sb{color:${c.accent}!important;}header,.header{background:${c.body}!important;border-color:${c.border}!important;}*{scrollbar-color:${c.accent} ${c.body};}::-webkit-scrollbar-track{background:${c.body}!important;}::-webkit-scrollbar-thumb{background:${c.accent}!important;border-radius:4px;}`;
}

// ---- Hook ----
window.RTCPeerConnection=function(...args){
  const pc=new origPC(...args);activePC=pc;
  pc.addEventListener('connectionstatechange',()=>{
    webrtcStats.state=pc.connectionState;
    logEvent('info',`WebRTC: ${pc.connectionState}`);
    if(pc.connectionState==='connected')currentConvoStart=Date.now();
    if(['disconnected','failed','closed'].includes(pc.connectionState)){if(currentConvoStart){const dur=Date.now()-currentConvoStart;if(dur>sessionStats.longestConvo)sessionStats.longestConvo=dur;sessionStats.totalTime+=dur;currentConvoStart=null;logEvent('info',`Disconnected after ${formatDuration(dur)}`);}}
  });
  pc.addEventListener('icecandidate',e=>{
    if(e.candidate){totalPackets++;ppsCount++;
      if(e.candidate.type==='srflx')protocolCounts.STUN++;
      else if(e.candidate.protocol==='udp')protocolCounts.UDP++;
      else protocolCounts.TCP++;
      protocolCounts.WebRTC++;
      const ip=e.candidate.address||'';const port=e.candidate.port||0;
      if(ip&&!isPrivateIP(ip)){
        const key=`${ip}:${port}`;
        if(!netConnections.has(key))netConnections.set(key,{remote:ip,port,protocol:e.candidate.protocol?.toUpperCase()||'UDP',packets:0,bytes:0,duration:0,started:Date.now(),lastSeen:new Date().toLocaleTimeString(),color:currentTheme.border});
        const conn=netConnections.get(key);conn.packets++;conn.bytes+=100;conn.lastSeen=new Date().toLocaleTimeString();conn.duration=Date.now()-conn.started;
      }
    }
  });
  setInterval(async()=>{
    const stats=await pc.getStats();
    stats.forEach(r=>{
      // ---- PRIVATE IP FIX: only process srflx/relay remote candidates ----
      if(r.type==='remote-candidate'&&r.address&&!seenIPs.has(r.address)){
        // Skip private/local IPs — these are YOUR addresses, not the peer's
        if(isPrivateIP(r.address))return;
        // Skip host candidates on PC (usually your own LAN IP leaking)
        if(r.candidateType==='host'&&!isIPv6(r.address))return;
        seenIPs.add(r.address);
        geoIP(r.address,r.port,r.candidateType);
      }
      if(r.type==='inbound-rtp'||r.type==='outbound-rtp'){totalPackets++;ppsCount++;totalBytes+=r.bytesReceived||r.bytesSent||0;}
    });
  },2000);
  return pc;
};

// ---- Keyboard shortcuts ----
document.addEventListener('keydown',e=>{
  if(!settings.keyboardShorts.val)return;
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if(e.code==='Space'&&!e.shiftKey){e.preventDefault();tryAutoSkip();sessionStats.skips++;}
  if(e.code==='KeyM'){const v=document.querySelector('video');if(v)v.muted=!v.muted;logEvent('info','Mute toggled');}
  if(e.code==='KeyF'){document.fullscreenElement?document.exitFullscreen():document.querySelector('.main,.mainContent,.videoGrid')?.requestFullscreen();}
});
document.addEventListener('keydown',e=>{if(e.code==='Enter'&&e.target.classList?.contains('messageInput')){sessionStats.messages++;}});

function tryAutoSkip(){
  try{const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.toLowerCase().includes('skip')||b.textContent.toLowerCase().includes('next')||b.textContent==='Stop');if(btn){btn.click();sessionStats.skips++;logEvent('info','Auto-skip');}}catch(e){}
}

// ---- Geo ----
async function geoIP(ip,port,candType){
  if(!settings.showCloudflare.val&&isCloudflare(ip))return;
  if(!settings.showIPv6.val&&isIPv6(ip))return;
  if(isPrivateIP(ip))return; // Extra safety check
  try{
    const r=await fetch(`https://ipinfo.io/${ip}/json`);const d=await r.json();
    const isTor=torExits.has(ip);const typeRaw=classifyASN(d.org);
    const privacyScore=d.privacy?.proxy||d.privacy?.vpn||false;
    const peerCountry=d.country||'?';

    if(targetCountry&&peerCountry!==targetCountry&&autoSkipEnabled){logEvent('warning',`Auto-skipped: ${ip} (${peerCountry})`);tryAutoSkip();return;}
    if(settings.autoSkipVPN.val&&typeRaw.includes('VPN')){logEvent('warning',`Auto-skipped VPN: ${ip}`);tryAutoSkip();return;}

    const p={ip,port:port||'?',candType:candType||'?',label:isIPv6(ip)?'🔵 IPv6':'🟣 IPv4',type:isTor?'🧅 Tor':typeRaw,city:d.city||'?',region:d.region||'?',country:peerCountry,org:d.org||'Unknown',loc:d.loc||'?',postal:d.postal||'?',flag:d.country?`https://flagcdn.com/16x12/${d.country.toLowerCase()}.png`:'',time:new Date().toLocaleTimeString(),privacyScore,duration:null};

    const asnInfo=lookupASN(d.org);const asnKey=d.org?.split(' ')[0];
    if(asnInfo&&BAD_ASNS.has(asnKey)&&settings.showBadASN.val){
      logEvent('danger',`⚠️ BAD ASN: ${ip} on ${asnInfo.name} (Risk ${asnInfo.risk}/10)`);
      playBadASNSound();
      if(settings.notifications.val&&Notification.permission==='granted')new Notification('⚠️ Bad ASN',{body:`${ip} — ${asnInfo.name} (Risk ${asnInfo.risk}/10)`});
    }

    const subnet=trackSubnet(ip,p);
    if(subnet&&subnet.ips.length>1&&settings.showSubnetAlert.val)logEvent('warning',`🕸️ /24 cluster: ${subnet.ips.length} IPs from ${subnet.subnet}`);

    if(peerCountry!=='?'){countryCollection.add(peerCountry);sessionStats.countries[peerCountry]=(sessionStats.countries[peerCountry]||0)+1;}
    sessionStats.total++;sessionStats.matches++;
    if(isTor)sessionStats.tor++;else if(typeRaw.includes('VPN'))sessionStats.vpn++;else if(typeRaw.includes('Hosting'))sessionStats.hosting++;else if(typeRaw.includes('Mobile'))sessionStats.mobile++;else sessionStats.residential++;

    peerLog.push(p);saveHistory(ip);
    addToPanel(p);
    if(embeddedMode){addEmbedPeerCard(p);addEmbedMapMarker(p,true);}

    const{score}=scoreConnection(p,asnInfo);
    logEvent('success',`Peer: ${ip} — ${p.city}, ${p.country} | ${p.type} | ⭐${score}/5`);

    if(targetCountry&&peerCountry===targetCountry){logEvent('success',`🎯 MATCH: ${ip} from ${COUNTRIES[peerCountry]||peerCountry}`);playMatchSound();if(settings.notifications.val&&Notification.permission==='granted')new Notification('🎯 Target Match!',{body:`${ip} — ${p.city}, ${p.country}`});}
    if(settings.autoCopyNew.val)navigator.clipboard.writeText(ip).catch(()=>{});
    if(settings.soundAlert.val)playPing();
    if(settings.notifications.val){const body=`${ip} — ${p.city}, ${p.country} (${p.type})`;if(Notification.permission==='granted')new Notification('🐉 Frosts Tools',{body});else if(Notification.permission!=='denied')Notification.requestPermission().then(per=>{if(per==='granted')new Notification('🐉 Frosts Tools',{body});});}
  }catch(e){console.warn('[FROST GEO FAILED]',ip);}
}

applyTheme(currentTheme);
if(settings.snapToEdge.val)applySnap();
if(settings.disablePayPopups.val)enablePaymentBlocker();
logEvent('success','Frosts Tools v0.2.2 ready');
console.log('%c[🐉 Frosts Tools v0.2.2]','color:#7b68ee;font-weight:bold;font-size:14px;');
