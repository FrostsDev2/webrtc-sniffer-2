// ============================================================
//  🐉 Frosts Tools v0.2.2 — ASN Intelligence Update
// ============================================================

const origPC = window.RTCPeerConnection;
const seenIPs = new Set();
const peerLog = [];
const activePeers = new Map();
const eventLog = [];
const connectionMap = new Map();
const countryCollection = new Set();
const subnetMap = new Map(); // /24 subnet tracking
let sessionStats = { total:0, vpn:0, residential:0, mobile:0, hosting:0, tor:0, countries:{}, totalTime:0, messages:0, skips:0, matches:0, longestConvo:0 };
let embeddedMode = false;
let embedLeafletMap = null;
let embedMapLoaded2 = false;
const embedMapMarkers = [];
let embedCurrentMarker = null;
let sessionStartTime = Date.now();
let currentConvoStart = null;
let totalPackets = 0, totalBytes = 0, ppsCount = 0, ppsHistory = [];
let leafletMap = null, mapLoaded = false;
const mapMarkers = [];
let currentMapMarker = null;
let activeTab = 'peers';
let targetCountry = null;
let autoSkipEnabled = false;
let peerCountFloat = 0;
let activeNetSubTab = 'connections';
let netConnections = new Map();
let protocolCounts = { TCP:0, UDP:0, STUN:0, WebRTC:0, DNS:0, HTTPS:0, Other:0 };
let webrtcStats = { state:'N/A', localCand:'N/A', remoteCand:'N/A', rtt:'N/A', jitter:'N/A', bytesSent:0, bytesReceived:0 };
let activePC = null;
let disablePaymentPopups = false;

// ---- ASN Database ----
const VPN_PROVIDERS = {
  'AS9009':  { name:'M247',        type:'VPN_HOST',  risk:8,  label:'🔴 M247 (VPN Host)' },
  'AS60068': { name:'NordVPN',     type:'VPN',       risk:9,  label:'🔴 NordVPN' },
  'AS212238':{ name:'Datacamp',    type:'VPN_HOST',  risk:8,  label:'🔴 Datacamp (VPN)' },
  'AS20473': { name:'Vultr',       type:'CLOUD',     risk:6,  label:'🟡 Vultr' },
  'AS14061': { name:'DigitalOcean',type:'CLOUD',     risk:6,  label:'🟡 DigitalOcean' },
  'AS16276': { name:'OVH',         type:'CLOUD',     risk:5,  label:'🟡 OVH' },
  'AS14618': { name:'AWS',         type:'CLOUD',     risk:5,  label:'🟡 Amazon AWS' },
  'AS15169': { name:'Google Cloud',type:'CLOUD',     risk:4,  label:'🟡 Google Cloud' },
  'AS8075':  { name:'Microsoft Azure',type:'CLOUD',  risk:4,  label:'🟡 Microsoft Azure' },
  'AS13335': { name:'Cloudflare',  type:'CDN',       risk:3,  label:'☁️ Cloudflare' },
  'AS24940': { name:'Hetzner',     type:'CLOUD',     risk:5,  label:'🟡 Hetzner' },
  'AS19318': { name:'Interserver', type:'VPN_HOST',  risk:7,  label:'🔴 Interserver' },
  'AS35913': { name:'dhosting',    type:'VPN_HOST',  risk:7,  label:'🔴 dhosting' },
  'AS4713':  { name:'NTT',         type:'TRANSIT',   risk:2,  label:'🟢 NTT' },
  'AS7018':  { name:'AT&T',        type:'ISP',       risk:1,  label:'🟢 AT&T' },
  'AS22773': { name:'Cox',         type:'ISP',       risk:1,  label:'🟢 Cox' },
  'AS7922':  { name:'Comcast',     type:'ISP',       risk:1,  label:'🟢 Comcast' },
  'AS701':   { name:'Verizon',     type:'ISP',       risk:1,  label:'🟢 Verizon' },
  'AS20001': { name:'Charter',     type:'ISP',       risk:1,  label:'🟢 Charter/Spectrum' },
  'AS11351': { name:'Charter',     type:'ISP',       risk:1,  label:'🟢 Charter Business' },
  'AS33363': { name:'BrightHouse', type:'ISP',       risk:1,  label:'🟢 BrightHouse' },
  'AS30036': { name:'Mediacom',    type:'ISP',       risk:1,  label:'🟢 Mediacom' },
  'AS6128':  { name:'Cablevision', type:'ISP',       risk:1,  label:'🟢 Cablevision' },
  'AS10796': { name:'Spectrum',    type:'ISP',       risk:1,  label:'🟢 Spectrum' },
  'AS21928': { name:'T-Mobile',    type:'MOBILE',    risk:1,  label:'📱 T-Mobile' },
  'AS7583':  { name:'T-Mobile',    type:'MOBILE',    risk:1,  label:'📱 T-Mobile' },
  'AS21307': { name:'AT&T Mobile', type:'MOBILE',    risk:1,  label:'📱 AT&T Mobile' },
  'AS2510':  { name:'KDDI',        type:'ISP',       risk:1,  label:'🟢 KDDI' },
  'AS9121':  { name:'Turk Telekom',type:'ISP',       risk:2,  label:'🟢 Turk Telekom' },
  'AS3209':  { name:'Vodafone DE', type:'ISP',       risk:1,  label:'🟢 Vodafone DE' },
  'AS5483':  { name:'T-Home HU',   type:'ISP',       risk:1,  label:'🟢 T-Home' },
  'AS44901': { name:'Belcloud',    type:'VPN_HOST',  risk:8,  label:'🔴 Belcloud (VPN)' },
  'AS202425':{ name:'IP Volume',   type:'VPN_HOST',  risk:9,  label:'🔴 IP Volume (VPN)' },
  'AS51167': { name:'Contabo',     type:'CLOUD',     risk:6,  label:'🟡 Contabo' },
  'AS34665': { name:'Petersburg',  type:'HOSTING',   risk:6,  label:'🟡 Petersburg Internet' },
  'AS62240': { name:'Clouvider',   type:'VPN_HOST',  risk:7,  label:'🔴 Clouvider' },
  'AS136907':{ name:'Huawei Cloud',type:'CLOUD',     risk:5,  label:'🟡 Huawei Cloud' },
  'AS45102': { name:'Alibaba',     type:'CLOUD',     risk:5,  label:'🟡 Alibaba Cloud' },
  'AS4808':  { name:'China Unicom',type:'ISP',       risk:3,  label:'🟢 China Unicom' },
  'AS4134':  { name:'ChinaNet',    type:'ISP',       risk:3,  label:'🟢 ChinaNet' },
  'AS9808':  { name:'China Mobile',type:'MOBILE',    risk:2,  label:'📱 China Mobile' },
};

const BAD_ASNS = new Set([
  'AS9009','AS60068','AS212238','AS44901','AS202425','AS62240',
  'AS34665','AS19318','AS35913',
]);

function lookupASN(org) {
  if (!org) return null;
  const asn = org.split(' ')[0];
  return VPN_PROVIDERS[asn] || null;
}

function getRiskColor(risk) {
  if (risk >= 8) return '#ff2222';
  if (risk >= 6) return '#ff6600';
  if (risk >= 4) return '#ffaa00';
  if (risk >= 2) return '#88cc44';
  return '#00ff88';
}

function getRiskLabel(risk) {
  if (risk >= 8) return '🔴 HIGH RISK';
  if (risk >= 6) return '🟠 MEDIUM RISK';
  if (risk >= 4) return '🟡 LOW RISK';
  if (risk >= 2) return '🟢 CLEAN';
  return '✅ RESIDENTIAL';
}

// ---- Connection Quality Scoring ----
function scoreConnection(p, asnInfo) {
  let score = 5;
  let reasons = [];

  // Deduct for VPN/DC
  if (p.type?.includes('VPN') || p.type?.includes('DC')) { score -= 2; reasons.push('VPN/DC'); }
  if (p.type?.includes('Hosting')) { score -= 1; reasons.push('Hosting'); }
  if (p.type?.includes('Tor')) { score -= 3; reasons.push('Tor'); }
  if (asnInfo?.risk >= 8) { score -= 2; reasons.push('Bad ASN'); }
  if (asnInfo?.risk >= 5 && asnInfo?.risk < 8) { score -= 1; reasons.push('Cloud ASN'); }

  // Deduct for bad candidate type
  if (p.candType === 'relay') { score -= 1; reasons.push('Relay'); }

  // Deduct for repeat peer
  const seen = getSeenCount(p.ip);
  if (seen > 3) { score -= 1; reasons.push(`Seen ${seen}x`); }

  // Deduct for Tor
  if (torExits.has(p.ip)) { score -= 3; reasons.push('Tor exit'); }

  // Clamp
  score = Math.max(1, Math.min(5, score));
  return { score, reasons };
}

function renderStars(score) {
  const colors = { 1:'#ff2222', 2:'#ff6600', 3:'#ffaa00', 4:'#88cc44', 5:'#00ff88' };
  const color = colors[score] || '#888';
  return '★'.repeat(score) + '☆'.repeat(5-score);
}

// ---- /24 Subnet Tracker ----
function getSubnet24(ip) {
  if (isIPv6(ip)) return null;
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

function trackSubnet(ip, peerData) {
  const subnet = getSubnet24(ip);
  if (!subnet) return null;
  if (!subnetMap.has(subnet)) {
    subnetMap.set(subnet, { subnet, ips:[], firstSeen:new Date().toLocaleTimeString() });
  }
  const entry = subnetMap.get(subnet);
  if (!entry.ips.find(e=>e.ip===ip)) {
    entry.ips.push({ ip, city:peerData.city, country:peerData.country, time:new Date().toLocaleTimeString() });
  }
  return entry;
}

// ---- Cookie / Storage ----
function saveCookies() {
  const data = {};
  Object.keys(settings).forEach(k => data[k] = settings[k].val);
  data.theme = Object.keys(themes).find(k => themes[k] === currentTheme) || 'midnight';
  data.targetCountry = targetCountry;
  data.autoSkip = autoSkipEnabled;
  data.disablePaymentPopups = disablePaymentPopups;
  document.cookie = `frostSettings=${encodeURIComponent(JSON.stringify(data))};max-age=31536000;path=/`;
}
function loadCookies() {
  const match = document.cookie.match(/frostSettings=([^;]+)/);
  if (!match) return;
  try {
    const data = JSON.parse(decodeURIComponent(match[1]));
    Object.keys(settings).forEach(k => { if (data[k] !== undefined) settings[k].val = data[k]; });
    if (data.theme && themes[data.theme]) currentTheme = themes[data.theme];
    if (data.targetCountry) targetCountry = data.targetCountry;
    if (data.autoSkip !== undefined) autoSkipEnabled = data.autoSkip;
    if (data.disablePaymentPopups !== undefined) disablePaymentPopups = data.disablePaymentPopups;
  } catch(e) {}
}
function getHistory() { try { return JSON.parse(localStorage.getItem('frostPeerHistory')||'{}'); } catch(e){return{};} }
function saveHistory(ip) { try { const h=getHistory(); h[ip]=(h[ip]||0)+1; localStorage.setItem('frostPeerHistory',JSON.stringify(h)); } catch(e){} }
function getSeenCount(ip) { return getHistory()[ip]||0; }
function getCollection() { try { return JSON.parse(localStorage.getItem('frostCollection')||'[]'); } catch(e){return[];} }
function saveCollection(items) { try { localStorage.setItem('frostCollection',JSON.stringify(items)); } catch(e){} }
function addToCollection(ip, data) {
  const col = getCollection();
  if (!col.find(c=>c.ip===ip)) { col.push({ip,...data,saved:new Date().toLocaleString()}); saveCollection(col); }
}

// ---- Payment Popup Blocker ----
function initPaymentPopupBlocker() {
  if (!disablePaymentPopups) return;
  
  // Watch for new elements being added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Check if this is a payment popup or contains one
          if (node.id && (node.id.includes('payment') || node.id.includes('pay') || node.id.includes('modal'))) {
            node.style.display = 'none';
            node.remove();
          }
          // Check for payment popup classes
          if (node.className && typeof node.className === 'string') {
            const classes = node.className.split(' ');
            if (classes.some(c => c.includes('payment') || c.includes('pay') || c.includes('modal') || c.includes('popup'))) {
              node.style.display = 'none';
              node.remove();
            }
          }
          // Check for payment button clicks
          if (node.tagName === 'BUTTON' && node.textContent && 
              (node.textContent.toLowerCase().includes('pay') || 
               node.textContent.toLowerCase().includes('buy') || 
               node.textContent.toLowerCase().includes('purchase') ||
               node.textContent.toLowerCase().includes('upgrade'))) {
            node.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              return false;
            });
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also block existing payment elements
  document.querySelectorAll('*').forEach(el => {
    if (el.id && (el.id.includes('payment') || el.id.includes('pay') || el.id.includes('modal'))) {
      el.style.display = 'none';
      el.remove();
    }
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ');
      if (classes.some(c => c.includes('payment') || c.includes('pay') || c.includes('modal') || c.includes('popup'))) {
        el.style.display = 'none';
        el.remove();
      }
    }
  });

  // Block payment-related event listeners
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName === 'BUTTON' && target.textContent) {
      const text = target.textContent.toLowerCase();
      if (text.includes('pay') || text.includes('buy') || text.includes('purchase') || text.includes('upgrade')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, true);

  logEvent('success', '💳 Payment popups blocked');
}

// ---- Tor ----
let torExits = new Set();
async function loadTorExits() {
  try { const r=await fetch('https://check.torproject.org/torbulkexitlist'); torExits=new Set((await r.text()).split('\n').map(s=>s.trim()).filter(Boolean)); } catch(e){}
}
loadTorExits();

// ---- Themes ----
const themes = {
  midnight: { bg:'#0d0d1a', border:'#7b68ee', text:'#c8b8ff', sub:'#9988cc', dim:'#443366', header:'#0a0520', name:'🌙 Midnight', gradient:'linear-gradient(135deg,#0a0520,#1a1040)', site:{ body:'#080612', chat:'#0d0820', input:'#120830', border:'#2a1a4a', text:'#c8b8ff', accent:'#7b68ee' } },
  matrix:   { bg:'#0a0a0a', border:'#00ff88', text:'#00ff88', sub:'#aaffcc', dim:'#446644', header:'#001a00', name:'💚 Matrix',   gradient:'linear-gradient(135deg,#001a00,#002a00)', site:{ body:'#050a05', chat:'#081008', input:'#0a1a0a', border:'#1a4a1a', text:'#00ff88', accent:'#00ff88' } },
  blood:    { bg:'#0a0000', border:'#ff2222', text:'#ff6666', sub:'#cc4444', dim:'#441111', header:'#1a0000', name:'🔴 Blood',    gradient:'linear-gradient(135deg,#1a0000,#2a0000)', site:{ body:'#080000', chat:'#120000', input:'#1a0000', border:'#4a0000', text:'#ff6666', accent:'#ff2222' } },
  ice:      { bg:'#0a0f1a', border:'#00bfff', text:'#aaddff', sub:'#88bbdd', dim:'#224466', header:'#001133', name:'🧊 Ice',      gradient:'linear-gradient(135deg,#001133,#002244)', site:{ body:'#050810', chat:'#080f1a', input:'#0a1428', border:'#1a3a5a', text:'#aaddff', accent:'#00bfff' } },
  gold:     { bg:'#0f0a00', border:'#ffaa00', text:'#ffdd88', sub:'#ccaa44', dim:'#443300', header:'#1a0f00', name:'👑 Gold',     gradient:'linear-gradient(135deg,#1a0f00,#2a1a00)', site:{ body:'#080500', chat:'#120a00', input:'#1a0f00', border:'#4a2a00', text:'#ffdd88', accent:'#ffaa00' } },
  rose:     { bg:'#0f0a0d', border:'#ff69b4', text:'#ffb6d9', sub:'#cc88aa', dim:'#553344', header:'#1a0010', name:'🌸 Rose',     gradient:'linear-gradient(135deg,#1a0010,#2a0020)', site:{ body:'#080005', chat:'#12000a', input:'#1a0010', border:'#4a0030', text:'#ffb6d9', accent:'#ff69b4' } },
  cyber:    { bg:'#050510', border:'#00ffff', text:'#00ffff', sub:'#88ffff', dim:'#224444', header:'#001a1a', name:'⚡ Cyber',    gradient:'linear-gradient(135deg,#001a1a,#002828)', site:{ body:'#020810', chat:'#05101a', input:'#001818', border:'#004444', text:'#00ffff', accent:'#00ffff' } },
  ember:    { bg:'#100800', border:'#ff6600', text:'#ffaa44', sub:'#cc7722', dim:'#442200', header:'#1a0800', name:'🔥 Ember',    gradient:'linear-gradient(135deg,#1a0800,#2a1000)', site:{ body:'#080400', chat:'#120600', input:'#1a0800', border:'#4a1a00', text:'#ffaa44', accent:'#ff6600' } },
};
let currentTheme = themes.midnight;

// ---- Settings ----
const settings = {
  showAll:         { val:false, label:'📋 Show All Peers',       desc:'Keep all peers. Off = clear on new peer.' },
  notifications:   { val:true,  label:'🔔 Notifications',        desc:'Browser popup when peer connects.' },
  soundAlert:      { val:false, label:'🔊 Sound Alert',          desc:'Audio ping on new peer.' },
  autoScroll:      { val:true,  label:'⬇️ Auto Scroll',          desc:'Scroll to latest peer.' },
  showCloudflare:  { val:false, label:'☁️ Show Cloudflare IPs',  desc:'Show Cloudflare relays.' },
  showIPv6:        { val:true,  label:'🔵 Show IPv6',            desc:'Include IPv6 addresses.' },
  compactMode:     { val:false, label:'📦 Compact Mode',         desc:'Minimal one-line per peer.' },
  showTimestamp:   { val:true,  label:'🕐 Timestamp',            desc:'Show time connected.' },
  showCoords:      { val:true,  label:'🌐 Coordinates',          desc:'Show lat/lon.' },
  showPostal:      { val:true,  label:'📮 Postal Code',          desc:'Show zip/postal.' },
  highlightVPN:    { val:true,  label:'🔴 Highlight VPN/DC',    desc:'Flag VPN IPs in red.' },
  showPort:        { val:true,  label:'🔌 Show Port',            desc:'Show port number.' },
  showCandType:    { val:true,  label:'📡 Candidate Type',       desc:'Show srflx/relay/host.' },
  autoCopyNew:     { val:false, label:'📎 Auto-Copy New IP',     desc:'Auto copies each IP.' },
  darkOverlay:     { val:false, label:'🌑 Page Dim Overlay',     desc:'Dims page behind panel.' },
  showRepeat:      { val:true,  label:'🔁 Repeat Peer Alert',    desc:'Flag IPs seen before.' },
  showTor:         { val:true,  label:'🧅 Tor Detection',        desc:'Flag Tor exit nodes.' },
  showPrivacy:     { val:true,  label:'🛡️ Privacy/Proxy Score',  desc:'Show proxy score.' },
  showDuration:    { val:true,  label:'⏱️ Connection Duration',  desc:'Track connection time.' },
  showTimeline:    { val:true,  label:'📈 Timeline Bar',         desc:'Visual timeline per peer.' },
  snapToEdge:      { val:false, label:'📌 Snap to Edge',         desc:'Snap to right edge.' },
  autoSkipVPN:     { val:false, label:'🚫 Auto-Skip VPN Peers',  desc:'Auto skip VPN peers.' },
  showNetStats:    { val:true,  label:'📊 Network Stats',        desc:'Show network statistics.' },
  embedDarkMode:   { val:true,  label:'🌑 Embed Dark Mode',      desc:'Apply dark mode to site.' },
  siteMods:        { val:true,  label:'🔧 Site Modifications',   desc:'Apply UI improvements.' },
  keyboardShorts:  { val:true,  label:'⌨️ Keyboard Shortcuts',   desc:'Space=skip, M=mute, F=full.' },
  autoFocusChat:   { val:true,  label:'💬 Auto-Focus Chat',      desc:'Auto focus chat box.' },
  showQualityScore:{ val:true,  label:'⭐ Quality Score',        desc:'Rate each peer 1-5 stars.' },
  showASNInfo:     { val:true,  label:'🏢 ASN Intelligence',     desc:'Show VPN provider details.' },
  showSubnetAlert: { val:true,  label:'🕸️ Subnet Clustering',    desc:'Alert when IPs share /24 subnet.' },
  showBadASN:      { val:true,  label:'⚠️ Bad ASN Alert',        desc:'Highlight known bad ASNs.' },
  pipMode:         { val:false, label:'📺 Picture-in-Picture',   desc:'Enable PiP for video.' },
};
loadCookies();

// ---- Countries ----
const COUNTRIES = {
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
const styleTag = document.createElement('style');
styleTag.id = 'frostStyles';
styleTag.textContent = `
  @keyframes dragonPulse { from{transform:scale(1) rotate(-5deg);filter:drop-shadow(0 0 8px #7b68ee)} to{transform:scale(1.18) rotate(5deg);filter:drop-shadow(0 0 22px #7b68ee)} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeInScale { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
  @keyframes barShimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
  @keyframes loaderFadeOut { from{opacity:1} to{opacity:0} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes slideIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
  @keyframes matchPulse { 0%{transform:scale(1)} 50%{transform:scale(1.02)} 100%{transform:scale(1)} }
  @keyframes badASN { 0%,100%{box-shadow:0 0 5px #ff2222} 50%{box-shadow:0 0 20px #ff2222,0 0 40px #ff222244} }
  @keyframes subnetAlert { 0%{border-color:#ffaa0044} 50%{border-color:#ffaa00} 100%{border-color:#ffaa0044} }
  #peerFloatPanel * { box-sizing:border-box; }
  #peerFloatPanel button:active { opacity:0.65; transform:scale(0.97); }
  .frostToggle { transition:background 0.25s; }
  .frostToggle .frostKnob { transition:left 0.25s; }
  .themeBtn { transition:transform 0.15s,opacity 0.15s,box-shadow 0.15s; }
  .themeBtn:hover { opacity:1!important; transform:scale(1.05)!important; }
  .tabBtn,.netSubBtn { transition:all 0.2s; }
  .peerEntry,.embedPeerCard { animation:fadeIn 0.2s ease; }
  .liveDot { animation:pulse 1.5s infinite; }
  .eventEntry { animation:slideIn 0.15s ease; }
  .frost-country-match { animation:matchPulse 0.5s ease; }
  .frost-bad-asn { animation:badASN 1.5s ease infinite; }
  .frost-subnet-alert { animation:subnetAlert 1.5s ease infinite; }
  #ppBody::-webkit-scrollbar,#tabSettings::-webkit-scrollbar,#tabStats::-webkit-scrollbar,
  #tabEvents::-webkit-scrollbar,#tabSubnets::-webkit-scrollbar,
  #frostEmbedContainer::-webkit-scrollbar,#netContent::-webkit-scrollbar { width:3px; }
  #ppBody::-webkit-scrollbar-thumb,#tabSettings::-webkit-scrollbar-thumb,
  #tabStats::-webkit-scrollbar-thumb,#tabEvents::-webkit-scrollbar-thumb,
  #frostEmbedContainer::-webkit-scrollbar-thumb,#netContent::-webkit-scrollbar-thumb { background:#333;border-radius:2px; }
  #frostResizeHandle { position:absolute;bottom:0;right:0;width:18px;height:18px;cursor:se-resize;z-index:10;opacity:0.4;display:flex;align-items:flex-end;justify-content:flex-end;padding:3px;color:#888;font-size:12px; }
  #frostResizeHandle:hover { opacity:1; }
  .peerNote { width:100%;background:#111;border:1px solid #333;color:#aaa;border-radius:4px;padding:4px 6px;font-family:inherit;font-size:10px;margin-top:5px;resize:none;outline:none; }
  .peerNote:focus { border-color:#7b68ee; }
  .leaflet-popup-content-wrapper { background:#0d0d1a!important;border:1px solid #2a1a4a!important;color:#c8b8ff!important;border-radius:8px!important; }
  .leaflet-popup-tip { background:#0d0d1a!important; }
  .frost-badge { border-radius:4px;padding:1px 5px;font-size:9px;border:1px solid; }
  .frost-select { background:#0a0818;border:1px solid #2a1a4a;color:#c8b8ff;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12px;outline:none;width:100%;cursor:pointer; }
  .frost-select:focus { border-color:#7b68ee; }
  .quality-stars { letter-spacing:1px;font-size:13px; }
  .asn-badge { display:inline-flex;align-items:center;gap:3px;border-radius:6px;padding:3px 7px;font-size:10px;border:1px solid;margin-top:4px; }
  .subnet-cluster { border-radius:8px;padding:8px 10px;margin-bottom:6px;border:1px solid; }
  #frostEmbedContainer { animation:fadeInScale 0.3s ease; }
  .embedPeerCard { border-radius:10px;overflow:hidden;margin-bottom:8px; }
  .frostStatBar { height:4px;background:#111;border-radius:2px;overflow:hidden;margin-top:3px; }
  .frostStatBarFill { height:100%;border-radius:2px;transition:width 0.5s; }
`;
document.head.appendChild(styleTag);

// ---- Overlay ----
const overlay=document.createElement('div');
overlay.style.cssText=`position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999990;display:none;pointer-events:none;`;
document.body.appendChild(overlay);
function updateOverlay(){overlay.style.display=settings.darkOverlay.val?'block':'none';}

// ---- Sound ----
function playPing(freq=880){
  try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);o.start();o.stop(ctx.currentTime+0.4);}catch(e){}
}
function playMatchSound(){playPing(440);setTimeout(()=>playPing(660),150);}
function playBadASNSound(){playPing(200);setTimeout(()=>playPing(150),200);}

// ---- Event log ----
function logEvent(severity,desc){
  eventLog.unshift({time:new Date().toLocaleTimeString(),severity,desc});
  if(eventLog.length>200)eventLog.pop();
  if(activeTab==='events')updateEventLog();
}

// ---- Loader ----
const loader=document.createElement('div');
loader.id='frostLoader';
loader.style.cssText=`position:fixed;inset:0;background:linear-gradient(160deg,#050508 0%,#0a0814 100%);z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'SF Mono','Fira Code',monospace;`;
loader.innerHTML=`
  <div style="font-size:clamp(40px,12vw,64px);animation:dragonPulse 1.2s infinite alternate;margin-bottom:20px;">🐉</div>
  <div style="font-size:clamp(18px,5vw,26px);font-weight:700;color:#c8b8ff;letter-spacing:3px;margin-bottom:6px;">Frosts Tools</div>
  <div style="font-size:clamp(9px,2.5vw,12px);color:#443366;letter-spacing:2px;margin-bottom:36px;">VERSION 0.2.2</div>
  <div style="width:clamp(160px,50vw,220px);margin-bottom:10px;">
    <div style="width:100%;height:3px;background:#1a1025;border-radius:2px;overflow:hidden;">
      <div id="frostBar" style="width:0%;height:100%;border-radius:2px;background:linear-gradient(90deg,#7b68ee,#c8b8ff,#7b68ee);background-size:200px 100%;animation:barShimmer 1.5s infinite linear;transition:width 0.3s ease;"></div>
    </div>
  </div>
  <div id="frostLoadTxt" style="font-size:clamp(9px,2.5vw,11px);color:#443366;letter-spacing:1px;height:16px;margin-bottom:32px;">INITIALIZING...</div>
  <div style="padding:10px clamp(14px,4vw,22px);border:1px solid #2a1a4a;border-radius:20px;background:#0d0a1a;font-size:clamp(10px,2.5vw,12px);color:#443366;">💡 Tip: Join Discord for updates!</div>
`;
document.body.appendChild(loader);
const steps=['HOOKING WEBRTC...','LOADING TOR LIST...','LOADING ASN DATABASE...','BUILDING UI...','RESTORING SETTINGS...','READY 🐉'];
let step=0;
const barEl=document.getElementById('frostBar'),txtEl=document.getElementById('frostLoadTxt');
const loadInterval=setInterval(()=>{
  step++;barEl.style.width=((step/steps.length)*100)+'%';txtEl.textContent=steps[step-1]||'';
  if(step>=steps.length){clearInterval(loadInterval);setTimeout(()=>{loader.style.animation='loaderFadeOut 0.5s ease forwards';setTimeout(()=>loader.remove(),500);},400);}
},380);

// ---- Dragon ----
const dragon=document.createElement('div');
dragon.innerHTML='🐉';
dragon.style.cssText=`position:fixed;bottom:28px;right:24px;font-size:clamp(28px,8vw,40px);cursor:pointer;z-index:999998;display:none;filter:drop-shadow(0 0 10px #7b68ee);transition:filter 0.3s,transform 0.2s;user-select:none;touch-action:none;`;
document.body.appendChild(dragon);
dragon.addEventListener('mouseenter',()=>{dragon.style.transform='scale(1.25) rotate(10deg)';dragon.style.filter=`drop-shadow(0 0 18px ${currentTheme.border})`;});
dragon.addEventListener('mouseleave',()=>{dragon.style.transform='scale(1) rotate(0deg)';dragon.style.filter=`drop-shadow(0 0 10px ${currentTheme.border})`;});
let draggingDragon=false,dox=0,doy=0,dMoved=false;
dragon.addEventListener('mousedown',e=>{draggingDragon=true;dMoved=false;dox=e.clientX-dragon.offsetLeft;doy=e.clientY-dragon.offsetTop;});
document.addEventListener('mousemove',e=>{if(!draggingDragon)return;dMoved=true;dragon.style.left=Math.max(0,e.clientX-dox)+'px';dragon.style.top=Math.max(0,e.clientY-doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto';});
document.addEventListener('mouseup',()=>{if(draggingDragon&&!dMoved)openPanel();draggingDragon=false;});
dragon.addEventListener('touchstart',e=>{const t=e.touches[0];draggingDragon=true;dMoved=false;dox=t.clientX-dragon.offsetLeft;doy=t.clientY-dragon.offsetTop;},{passive:true});
document.addEventListener('touchmove',e=>{if(!draggingDragon)return;dMoved=true;const t=e.touches[0];dragon.style.left=Math.max(0,t.clientX-dox)+'px';dragon.style.top=Math.max(0,t.clientY-doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto';},{passive:true});
document.addEventListener('touchend',()=>{if(draggingDragon&&!dMoved)openPanel();draggingDragon=false;});

// ---- Toggle builder ----
function buildToggleHTML(key){
  const s=settings[key];
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #161616;">
    <div style="flex:1;padding-right:12px;"><div style="font-size:12px;font-weight:500;">${s.label}</div><div style="font-size:10px;color:#443366;margin-top:3px;line-height:1.5;">${s.desc}</div></div>
    <div class="frostToggle" data-key="${key}" style="width:44px;height:24px;border-radius:12px;flex-shrink:0;background:${s.val?currentTheme.border:'#1e1e1e'};border:1px solid ${s.val?currentTheme.border:'#333'};position:relative;cursor:pointer;">
      <div class="frostKnob" style="position:absolute;top:3px;left:${s.val?'21px':'3px'};width:16px;height:16px;border-radius:50%;background:${s.val?'#fff':'#555'};box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>
    </div>
  </div>`;
}

function buildThemeHTML(){
  return `<div style="font-size:10px;color:#443366;letter-spacing:2px;margin-bottom:10px;font-weight:600;">THEME</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:18px;">
    ${Object.entries(themes).map(([key,t])=>`<button class="themeBtn" data-theme="${key}" style="background:${t.gradient};border:1px solid ${t.border}${themes[key]===currentTheme?'':'55'};color:${t.text};border-radius:10px;padding:8px 10px;cursor:pointer;font-size:11px;font-family:inherit;opacity:${themes[key]===currentTheme?'1':'0.65'};box-shadow:${themes[key]===currentTheme?`0 0 12px ${t.border}44`:''};text-align:left;font-weight:600;">${t.name}</button>`).join('')}
  </div>`;
}

function buildCountryTargetHTML(){
  return `<div style="font-size:10px;color:#443366;letter-spacing:2px;margin-bottom:10px;font-weight:600;">🎯 COUNTRY TARGETING</div>
  <div style="background:#0a0818;border:1px solid #2a1a4a;border-radius:10px;padding:12px;margin-bottom:14px;">
    <select class="frost-select" id="targetCountrySelect">
      <option value="">🌍 No target (show all)</option>
      ${Object.entries(COUNTRIES).map(([code,name])=>`<option value="${code}" ${targetCountry===code?'selected':''}>${name}</option>`).join('')}
    </select>
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
      <div id="autoSkipToggle" style="width:44px;height:24px;border-radius:12px;flex-shrink:0;background:${autoSkipEnabled?currentTheme.border:'#1e1e1e'};border:1px solid ${autoSkipEnabled?currentTheme.border:'#333'};position:relative;cursor:pointer;">
        <div class="frostKnob" style="position:absolute;top:3px;left:${autoSkipEnabled?'21px':'3px'};width:16px;height:16px;border-radius:50%;background:${autoSkipEnabled?'#fff':'#555'};"></div>
      </div>
      <span style="font-size:11px;color:#9988cc;">Auto-skip non-target</span>
    </div>
    <div id="targetCountryDisplay" style="margin-top:8px;font-size:11px;color:${currentTheme.border};">${targetCountry?`🎯 Targeting: ${COUNTRIES[targetCountry]||targetCountry}`:'🌍 No target set'}</div>
  </div>`;
}

function buildPaymentPopupHTML(){
  return `<div style="font-size:10px;color:#443366;letter-spacing:2px;margin-bottom:10px;font-weight:600;">💳 PAYMENT POPUPS</div>
  <div style="background:#0a0818;border:1px solid #2a1a4a;border-radius:10px;padding:12px;margin-bottom:14px;">
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
      <div id="paymentPopupToggle" style="width:44px;height:24px;border-radius:12px;flex-shrink:0;background:${disablePaymentPopups?currentTheme.border:'#1e1e1e'};border:1px solid ${disablePaymentPopups?currentTheme.border:'#333'};position:relative;cursor:pointer;">
        <div class="frostKnob" style="position:absolute;top:3px;left:${disablePaymentPopups?'21px':'3px'};width:16px;height:16px;border-radius:50%;background:${disablePaymentPopups?'#fff':'#555'};"></div>
      </div>
      <span style="font-size:11px;color:#9988cc;">Disable payment popups</span>
    </div>
    <div style="margin-top:8px;font-size:10px;color:#443366;line-height:1.5;">Blocks all payment, upgrade, and purchase popups on the site.</div>
  </div>`;
}

function buildCollectionHTML(){
  const col=getCollection();
  return `<div style="font-size:10px;color:#443366;letter-spacing:2px;margin-bottom:10px;font-weight:600;">📦 SAVED COLLECTION</div>
  <div style="background:#0a0818;border:1px solid #2a1a4a;border-radius:10px;padding:12px;margin-bottom:14px;">
    ${col.length===0
      ?`<div style="color:#443366;text-align:center;padding:12px 0;font-size:11px;">No saved peers yet.<br>Tap 📌 on any peer to save.</div>`
      :col.map((c,i)=>`<div style="border-bottom:1px solid #1a1025;padding:8px 0;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <b style="color:${currentTheme.text};">${c.ip}</b>
          <button onclick="removeFromCollection(${i})" style="background:none;border:none;color:#441111;cursor:pointer;font-size:12px;">🗑</button>
        </div>
        <div style="color:${currentTheme.sub};">📍 ${c.city||'?'}, ${c.region||'?'} ${c.country||''}</div>
        <div style="color:${currentTheme.dim};font-size:10px;">🏢 ${c.org||'?'} • 🕐 ${c.saved}</div>
      </div>`).join('')}
    ${col.length>0?`<button onclick="exportCollection()" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-family:inherit;font-size:10px;padding:4px 10px;border-radius:6px;margin-top:8px;">💾 Export</button>`:''}
  </div>`;
}

window.removeFromCollection=function(i){const col=getCollection();col.splice(i,1);saveCollection(col);const el=document.getElementById('collectionContent');if(el)el.innerHTML=buildCollectionHTML();};
window.exportCollection=function(){const blob=new Blob([JSON.stringify(getCollection(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`frost_collection_${Date.now()}.json`;a.click();};

// ---- Panel ----
const panel=document.createElement('div');
panel.id='peerFloatPanel';
panel.style.cssText=`position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:clamp(300px,95vw,440px);min-height:200px;background:#0d0d1a;border:1px solid #7b68ee;border-radius:clamp(12px,3vw,20px);font-family:'SF Mono','Fira Code',monospace;font-size:12px;color:#c8b8ff;z-index:999999;box-shadow:0 0 40px rgba(123,104,238,0.25),0 20px 60px rgba(0,0,0,0.8);display:flex;flex-direction:column;overflow:hidden;max-height:clamp(500px,92vh,800px);animation:fadeIn 0.3s ease;`;

panel.innerHTML=`
  <div id="pph" style="padding:12px 14px;background:linear-gradient(135deg,#0a0520,#120830);border-bottom:1px solid #2a1a4a;display:flex;justify-content:space-between;align-items:center;cursor:grab;user-select:none;flex-shrink:0;">
    <div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:20px;">🐉</span>
        <span style="font-weight:700;font-size:15px;letter-spacing:1px;color:#c8b8ff;">Frosts Tools</span>
        <span style="font-size:9px;background:#1a1040;border:1px solid #7b68ee44;color:#7b68ee;padding:2px 6px;border-radius:8px;">v0.2.2</span>
      </div>
      <div style="font-size:9px;color:#443366;margin-top:2px;letter-spacing:1px;">ASN Intelligence + Network Monitor</div>
    </div>
    <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
      <button id="ppEmbedBtn" style="background:linear-gradient(135deg,#1a0f40,#2a1a60);border:1px solid #7b68ee;color:#c8b8ff;cursor:pointer;font-size:10px;padding:5px 8px;border-radius:8px;font-family:inherit;font-weight:600;">🔗 Embed</button>
      <button id="ppCopyAll" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:14px;padding:5px 8px;border-radius:8px;">📋</button>
      <button id="ppExportBtn" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:14px;padding:5px 8px;border-radius:8px;">💾</button>
      <button id="ppSnapBtn" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:14px;padding:5px 8px;border-radius:8px;">📌</button>
      <button id="ppClose" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#c8b8ff;cursor:pointer;font-size:14px;padding:5px 8px;border-radius:8px;">🐉</button>
    </div>
  </div>

  <div id="ppTabs" style="display:flex;background:#080614;border-bottom:1px solid #1a1025;flex-shrink:0;overflow-x:auto;-webkit-overflow-scrolling:touch;">
    <button class="tabBtn" data-tab="peers" style="flex:1;min-width:52px;padding:9px 4px;background:linear-gradient(135deg,#0a0520,#120830);border:none;border-bottom:2px solid #7b68ee;color:#c8b8ff;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">👥<br>Peers</button>
    <button class="tabBtn" data-tab="map" style="flex:1;min-width:52px;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">🗺️<br>Map</button>
    <button class="tabBtn" data-tab="network" style="flex:1;min-width:52px;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">📡<br>Net</button>
    <button class="tabBtn" data-tab="stats" style="flex:1;min-width:52px;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">📊<br>Stats</button>
    <button class="tabBtn" data-tab="events" style="flex:1;min-width:52px;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">📋<br>Events</button>
    <button class="tabBtn" data-tab="collection" style="flex:1;min-width:52px;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">📦<br>Saved</button>
    <button class="tabBtn" data-tab="settings" style="flex:1;min-width:52px;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">⚙️<br>Settings</button>
    <button class="tabBtn" data-tab="about" style="flex:1;min-width:52px;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">ℹ️<br>About</button>
  </div>

  <!-- Peers Tab -->
  <div id="tabPeers" style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;">
    <div id="ppBody" style="overflow-y:auto;padding:8px;flex:1;">
      <div id="ppEmpty" style="color:#443366;text-align:center;padding:40px 0;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div style="font-size:32px;opacity:0.3;">🐉</div>
        <div>Waiting for peer connection...</div>
        <div style="font-size:10px;color:#2a1a4a;">Run before starting a call</div>
      </div>
    </div>
    <div style="padding:8px 12px;background:linear-gradient(135deg,#080614,#0a0818);border-top:1px solid #1a1025;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#443366;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="ppCount">Peers: 0</span>
        <span id="targetDisplay" style="font-size:10px;color:${currentTheme.border};display:${targetCountry?'block':'none'};">🎯 ${COUNTRIES[targetCountry]||''}</span>
      </div>
      <div style="display:flex;gap:5px;">
        <button id="ppClearHistory" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;padding:3px 8px;border-radius:6px;">🗑 History</button>
        <button id="ppClear" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;padding:3px 8px;border-radius:6px;">🗑 Clear</button>
      </div>
    </div>
  </div>

  <!-- Map Tab -->
  <div id="tabMap" style="display:none;flex:1;flex-direction:column;min-height:0;">
    <div id="frostMap" style="flex:1;min-height:280px;background:#080614;"></div>
    <div style="padding:6px 10px;background:#080614;border-top:1px solid #1a1025;font-size:10px;color:#443366;flex-shrink:0;">🟣 Residential &nbsp;🔴 VPN/DC &nbsp;🟡 Hosting &nbsp;📱 Mobile &nbsp;🧅 Tor</div>
  </div>

  <!-- Network Tab -->
  <div id="tabNetwork" style="display:none;flex-direction:column;flex:1;overflow:hidden;min-height:0;">
    <div style="display:flex;background:#050410;border-bottom:1px solid #1a1025;flex-shrink:0;overflow-x:auto;">
      <button class="netSubBtn" data-net="connections" style="flex:1;min-width:70px;padding:7px 4px;background:#0a0520;border:none;border-bottom:2px solid #7b68ee;color:#c8b8ff;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">🔗 Connections</button>
      <button class="netSubBtn" data-net="protocols" style="flex:1;min-width:70px;padding:7px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">📡 Protocols</button>
      <button class="netSubBtn" data-net="live" style="flex:1;min-width:70px;padding:7px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">⚡ Live</button>
      <button class="netSubBtn" data-net="webrtc" style="flex:1;min-width:70px;padding:7px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:10px;white-space:nowrap;">📺 WebRTC</button>
    </div>
    <div id="netContent" style="overflow-y:auto;padding:8px;flex:1;"></div>
  </div>

  <!-- Stats Tab -->
  <div id="tabStats" style="display:none;overflow-y:auto;padding:8px;flex:1;">
    <div id="statsContent"><div style="color:#443366;text-align:center;padding:20px 0;">No data yet.</div></div>
  </div>

  <!-- Events Tab -->
  <div id="tabEvents" style="display:none;overflow-y:auto;padding:8px;flex:1;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:10px;color:#443366;letter-spacing:1px;">EVENT LOG</span>
      <button onclick="eventLog.length=0;updateEventLog();" style="background:#0d0a1a;border:1px solid #2a1a4a;color:#443366;cursor:pointer;font-size:10px;padding:3px 8px;border-radius:6px;font-family:inherit;">🗑 Clear</button>
    </div>
    <div id="eventContent"><div style="color:#443366;text-align:center;padding:20px 0;font-size:11px;">No events yet.</div></div>
  </div>

  <!-- Collection Tab -->
  <div id="tabCollection" style="display:none;overflow-y:auto;padding:8px;flex:1;">
    <div id="collectionContent">${buildCollectionHTML()}</div>
  </div>

  <!-- Settings Tab -->
  <div id="tabSettings" style="display:none;overflow-y:auto;padding:12px 14px;flex:1;">
    ${buildThemeHTML()}
    ${buildCountryTargetHTML()}
    ${buildPaymentPopupHTML()}
    <div style="font-size:10px;color:#443366;letter-spacing:2px;margin-bottom:8px;font-weight:600;">DISPLAY</div>
    ${['showAll','compactMode','showTimestamp','showCoords','showPostal','showPort','showCandType','highlightVPN','darkOverlay','showTimeline'].map(buildToggleHTML).join('')}
    <div style="font-size:10px;color:#443366;letter-spacing:2px;margin:14px 0 8px;font-weight:600;">FILTERING</div>
    ${['showCloudflare','showIPv6','autoSkipVPN'].map(buildToggleHTML).join('')}
    <div style="font-size:10px;color:#443366;letter-spacing:2px;margin:14px 0 8px;font-weight:600;">ASN INTELLIGENCE</div>
    ${['showQualityScore','showASNInfo','showSubnetAlert','showBadASN'].map(buildToggleHTML).join('')}
    <div style="font-size:10px;color:#443366;letter-spacing:2px;margin:14px 0 8px;font-weight:600;">INTELLIGENCE</div>
    ${['showRepeat','showTor','showPrivacy','showDuration'].map(buildToggleHTML).join('')}
    <div style="font-size:10px;color:#443366;letter-spacing:2px;margin:14px 0 8px;font-weight:600;">SITE MODS (EMBED)</div>
    ${['embedDarkMode','siteMods','keyboardShorts','autoFocusChat','pipMode'].map(buildToggleHTML).join('')}
    <div style="font-size:10px;color:#443366;letter-spacing:2px;margin:14px 0 8px;font-weight:600;">ALERTS</div>
    ${['notifications','soundAlert','autoCopyNew'].map(buildToggleHTML).join('')}
    <div style="font-size:10px;color:#443366;letter-spacing:2px;margin:14px 0 8px;font-weight:600;">BEHAVIOUR</div>
    ${['autoScroll','snapToEdge'].map(buildToggleHTML).join('')}
    <div style="height:20px;"></div>
  </div>

  <!-- About Tab -->
  <div id="tabAbout" style="display:none;padding:20px 16px;flex:1;overflow-y:auto;">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:44px;margin-bottom:10px;">🐉</div>
      <div style="font-size:17px;font-weight:700;color:#c8b8ff;letter-spacing:2px;">Frosts Tools</div>
      <div style="font-size:10px;color:#443366;margin-top:5px;letter-spacing:1px;">v0.2.2 • ASN Intelligence Update</div>
    </div>
    <div style="font-size:11px;color:#9988cc;line-height:1.8;background:#0a0818;border:1px solid #1a1030;border-radius:10px;padding:12px;margin-bottom:14px;">
      Full WebRTC peer inspector with ASN reputation database, VPN provider identification, connection quality scoring, /24 subnet clustering, country targeting, network monitoring, and site embedding.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
      <a href="https://discord.gg" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;background:#0d0a1a;border:1px solid #2a1a4a;color:#7b68ee;text-decoration:none;font-size:12px;">
        <span style="font-size:18px;">💬</span><div><div style="font-weight:600;">Join Discord</div><div style="font-size:10px;color:#2a1a4a;margin-top:2px;">Updates & community</div></div>
      </a>
      <a href="https://github.com/FrostsDev2/webrtc-sniffer-2" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;background:#0a0f1a;border:1px solid #1a2a3a;color:#00bfff;text-decoration:none;font-size:12px;">
        <span style="font-size:18px;">🐙</span><div><div style="font-weight:600;">GitHub Repository</div><div style="font-size:10px;color:#224466;margin-top:2px;">Source code & releases</div></div>
      </a>
    </div>
    <div style="text-align:center;font-size:10px;color:#2a1a4a;padding-top:12px;border-top:1px solid #1a1025;line-height:1.7;">
      Geo via ipinfo.io • Flags via flagcdn.com • Tor via torproject.org<br>Made with 🐉 by FrostsDev
    </div>
  </div>

  <div id="frostResizeHandle">⊿</div>
`;
document.body.appendChild(panel);

// ---- Net content updater ----
function updateNetContent() {
  const el=document.getElementById('netContent');if(!el)return;
  const t=currentTheme;
  if (activeNetSubTab==='connections') {
    const conns=[...netConnections.values()].sort((a,b)=>b.packets-a.packets).slice(0,30);
    el.innerHTML=conns.length===0?`<div style="color:#443366;text-align:center;padding:20px 0;font-size:11px;">No connections yet.</div>`:conns.map(c=>`
      <div style="border:1px solid ${t.border}22;border-left:3px solid ${c.color};border-radius:8px;padding:8px 10px;margin-bottom:6px;background:${t.header}88;font-size:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <b style="color:${t.text};font-size:11px;">${c.remote}</b>
          <span style="color:${c.color};font-size:9px;background:${c.color}22;padding:1px 5px;border-radius:4px;">${c.protocol}</span>
        </div>
        <div style="color:${t.sub};">Pkts: ${c.packets} • Bytes: ${formatBytes(c.bytes)} • Port: ${c.port}</div>
        <div style="color:${t.dim};">Last: ${c.lastSeen}</div>
      </div>`).join('');
  } else if (activeNetSubTab==='protocols') {
    const total=Object.values(protocolCounts).reduce((a,b)=>a+b,0)||1;
    const colors={TCP:'#00bfff',UDP:'#ffaa00',STUN:'#00ff88',WebRTC:'#ff69b4',DNS:'#aaffcc',HTTPS:'#7b68ee',Other:'#888'};
    el.innerHTML=`
      <div style="margin-bottom:12px;">
        ${Object.entries(protocolCounts).map(([proto,count])=>`
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
              <span style="color:${colors[proto]||'#888'};">${proto}</span>
              <span style="color:${t.dim};">${count} (${Math.round(count/total*100)}%)</span>
            </div>
            <div class="frostStatBar"><div class="frostStatBarFill" style="width:${Math.round(count/total*100)}%;background:${colors[proto]||'#888'};"></div></div>
          </div>`).join('')}
      </div>
      <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:10px;font-size:11px;">
        <div style="color:${t.dim};margin-bottom:4px;">TOTALS</div>
        <div style="color:${t.text};">Packets: ${totalPackets}</div>
        <div style="color:${t.sub};">Bytes: ${formatBytes(totalBytes)}</div>
      </div>`;
  } else if (activeNetSubTab==='live') {
    const maxPPS=Math.max(...ppsHistory,1);
    const bars=ppsHistory.map(p=>`<div style="flex:1;background:${t.border};border-radius:2px 2px 0 0;height:${Math.round((p/maxPPS)*60)}px;min-height:2px;opacity:0.8;"></div>`).join('');
    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        ${[['PPS',ppsHistory[ppsHistory.length-1]||0,t.border],['Total Pkts',totalPackets,'#00bfff'],['Total Bytes',formatBytes(totalBytes),'#ffaa00'],['Connections',netConnections.size,'#00ff88']].map(([l,v,c])=>`<div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:10px;"><div style="font-size:10px;color:${t.dim};">${l}</div><div style="font-size:16px;font-weight:700;color:${c};margin-top:2px;">${v}</div></div>`).join('')}
      </div>
      <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:10px;">
        <div style="font-size:10px;color:${t.dim};margin-bottom:6px;">PACKETS/SEC (30s)</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:64px;">${bars}</div>
      </div>`;
  } else if (activeNetSubTab==='webrtc') {
    const s=webrtcStats;
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;">
      <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:12px;">
        <div style="font-size:10px;color:${t.dim};margin-bottom:4px;">CONNECTION STATE</div>
        <div style="font-size:14px;font-weight:700;color:${s.state==='Connected'?'#00ff88':t.border};">${s.state}</div>
      </div>
      ${[['🏠 Local',s.localCand],['🌐 Remote',s.remoteCand],['📶 RTT',s.rtt],['🎵 Jitter',s.jitter],['⬆ Sent',formatBytes(s.bytesSent)],['⬇️ Received',formatBytes(s.bytesReceived)]].map(([l,v])=>`<div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:10px;"><div style="font-size:10px;color:${t.dim};">${l}</div><div style="font-size:11px;color:${t.text};margin-top:3px;word-break:break-all;">${v}</div></div>`).join('')}
    </div>`;
  }
}

// ---- Event log updater ----
function updateEventLog(){
  const el=document.getElementById('eventContent');if(!el)return;
  if(eventLog.length===0){el.innerHTML='<div style="color:#443366;text-align:center;padding:20px 0;font-size:11px;">No events yet.</div>';return;}
  const colors={info:'#7b68ee',success:'#00ff88',warning:'#ffaa00',danger:'#ff4444'};
  el.innerHTML=eventLog.slice(0,100).map(ev=>`
    <div class="eventEntry" style="border-bottom:1px solid #161616;padding:6px 0;font-size:11px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="color:${colors[ev.severity]||'#888'};font-size:9px;">●</span>
        <span style="color:#443366;font-size:10px;">${ev.time}</span>
        <span style="background:${colors[ev.severity]||'#888'}22;border:1px solid ${colors[ev.severity]||'#888'}44;color:${colors[ev.severity]||'#888'};font-size:9px;padding:1px 4px;border-radius:3px;">${ev.severity.toUpperCase()}</span>
      </div>
      <div style="color:${currentTheme.sub};margin-top:3px;padding-left:14px;">${ev.desc}</div>
    </div>`).join('');
}

// ---- Stats updater ----
function updateStats(){
  const el=document.getElementById('statsContent');if(!el)return;
  const total=peerLog.length;
  if(total===0){el.innerHTML='<div style="color:#443366;text-align:center;padding:20px 0;">No data yet.</div>';return;}
  const t=currentTheme;
  const bar=(pct,color)=>`<div class="frostStatBar"><div class="frostStatBarFill" style="width:${pct}%;background:${color};"></div></div>`;
  const topC=Object.entries(sessionStats.countries).sort((a,b)=>b[1]-a[1]).slice(0,5);
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
      ${[['Total',sessionStats.total,'#c8b8ff'],['Matches',sessionStats.matches,'#00ff88'],['Skips',sessionStats.skips,'#ffaa00'],['VPN/DC',sessionStats.vpn,'#ff4444'],['Residential',sessionStats.residential,'#7b68ee'],['Tor',sessionStats.tor,'#ff8800']].map(([l,v,c])=>`<div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:10px;"><div style="font-size:10px;color:${t.dim};">${l}</div><div style="font-size:18px;font-weight:700;color:${c};margin-top:2px;">${v}</div></div>`).join('')}
    </div>
    <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:12px;margin-bottom:8px;">
      <div style="font-size:10px;color:${t.dim};letter-spacing:1px;margin-bottom:8px;">SESSION INFO</div>
      ${[['⏱️ Session Time',formatDuration(Date.now()-sessionStartTime)],['🌍 Countries Seen',Object.keys(sessionStats.countries).length],['💬 Messages',sessionStats.messages]].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #161616;font-size:11px;"><span style="color:${t.dim};">${l}</span><span style="color:${t.text};font-weight:600;">${v}</span></div>`).join('')}
    </div>
    <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:12px;margin-bottom:8px;">
      <div style="font-size:10px;color:${t.dim};letter-spacing:1px;margin-bottom:8px;">TYPE BREAKDOWN</div>
      ${[['🔴 VPN/DC',Math.round(sessionStats.vpn/total*100),'#ff4444'],['🟢 Residential',Math.round(sessionStats.residential/total*100),'#7b68ee'],['📱 Mobile',Math.round(sessionStats.mobile/total*100),'#00bfff'],['🟡 Hosting',Math.round(sessionStats.hosting/total*100),'#ffaa00'],['🧅 Tor',Math.round(sessionStats.tor/total*100),'#ff8800']].map(([l,p,c])=>`<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:11px;"><span>${l}</span><span style="color:${c};">${p}%</span></div>${bar(p,c)}</div>`).join('')}
    </div>
    ${topC.length>0?`<div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:12px;margin-bottom:8px;">
      <div style="font-size:10px;color:${t.dim};letter-spacing:1px;margin-bottom:8px;">TOP COUNTRIES</div>
      ${topC.map(([c,n])=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #161616;font-size:11px;"><span>${COUNTRIES[c]||c}</span><span style="color:${t.border};font-weight:700;">${n}</span></div>`).join('')}
    </div>`:''}
    <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:12px;">
      <div style="font-size:10px;color:${t.dim};letter-spacing:1px;margin-bottom:8px;">TIMELINE</div>
      <div style="display:flex;flex-direction:column;gap:3px;max-height:120px;overflow-y:auto;">
        ${peerLog.map(p=>`<div style="display:flex;align-items:center;gap:6px;font-size:10px;"><div style="width:6px;height:6px;border-radius:50%;background:${p.type?.includes('🔴')?'#ff4444':t.border};flex-shrink:0;"></div><span style="color:${t.dim};">${p.time}</span><span style="color:${t.text};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.ip}</span><span style="color:${t.dim};">${p.city||'?'}</span></div>`).join('')}
      </div>
    </div>`;
}

// ---- Tab switching ----
document.querySelectorAll('.tabBtn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    activeTab=btn.dataset.tab;
    document.querySelectorAll('.tabBtn').forEach(b=>{
      const a=b.dataset.tab===activeTab;
      b.style.background=a?currentTheme.header:'none';b.style.color=a?currentTheme.text:currentTheme.dim;b.style.borderBottom=a?`2px solid ${currentTheme.border}`:'2px solid transparent';
    });
    ['Peers','Map','Network','Stats','Events','Collection','Settings','About'].forEach(n=>{
      const el=document.getElementById(`tab${n}`);if(el)el.style.display='none';
    });
    const tabEl=document.getElementById(`tab${activeTab.charAt(0).toUpperCase()+activeTab.slice(1)}`);
    if(tabEl)tabEl.style.display=['peers','network','map'].includes(activeTab)?'flex':'block';
    if(activeTab==='stats')updateStats();
    if(activeTab==='map'){initMap();setTimeout(()=>{if(leafletMap){leafletMap.invalidateSize();if(currentMapMarker)flyToLatest();}},200);}
    if(activeTab==='network')updateNetContent();
    if(activeTab==='events')updateEventLog();
    if(activeTab==='collection'){const el=document.getElementById('collectionContent');if(el)el.innerHTML=buildCollectionHTML();}
  });
});

// ---- Net sub tabs ----
document.addEventListener('click',e=>{
  if(e.target.classList.contains('netSubBtn')){
    activeNetSubTab=e.target.dataset.net;
    document.querySelectorAll('.netSubBtn').forEach(b=>{
      const a=b.dataset.net===activeNetSubTab;
      b.style.background=a?currentTheme.header:'none';b.style.color=a?currentTheme.text:currentTheme.dim;b.style.borderBottom=a?`2px solid ${currentTheme.border}`:'2px solid transparent';
    });
    updateNetContent();
  }
  if(e.target.classList.contains('themeBtn')&&e.target.dataset.theme)applyTheme(themes[e.target.dataset.theme]);
  if(e.target.id==='autoSkipToggle'||e.target.closest('#autoSkipToggle')){
    autoSkipEnabled=!autoSkipEnabled;
    const tog=document.getElementById('autoSkipToggle');
    if(tog){tog.style.background=autoSkipEnabled?currentTheme.border:'#1e1e1e';tog.querySelector('.frostKnob').style.left=autoSkipEnabled?'21px':'3px';}
    saveCookies();
  }
  if(e.target.id==='paymentPopupToggle'||e.target.closest('#paymentPopupToggle')){
    disablePaymentPopups=!disablePaymentPopups;
    const tog=document.getElementById('paymentPopupToggle');
    if(tog){tog.style.background=disablePaymentPopups?currentTheme.border:'#1e1e1e';tog.querySelector('.frostKnob').style.left=disablePaymentPopups?'21px':'3px';}
    if(disablePaymentPopups){
      initPaymentPopupBlocker();
      logEvent('success', '💳 Payment popup blocking enabled');
    } else {
      logEvent('info', '💳 Payment popup blocking disabled');
    }
    saveCookies();
  }
});

// Country select
document.getElementById('targetCountrySelect')?.addEventListener('change',e=>{
  targetCountry=e.target.value||null;
  const disp=document.getElementById('targetCountryDisplay');if(disp)disp.textContent=targetCountry?`🎯 Targeting: ${COUNTRIES[targetCountry]||targetCountry}`:'🌍 No target set';
  const tdisplay=document.getElementById('targetDisplay');if(tdisplay){tdisplay.textContent=`🎯 ${COUNTRIES[targetCountry]||''}`;tdisplay.style.display=targetCountry?'block':'none';}
  saveCookies();logEvent('info',`Target: ${COUNTRIES[targetCountry]||'None'}`);
});

// ---- Toggles ----
document.querySelectorAll('.frostToggle').forEach(wrap=>{
  if(wrap.id==='autoSkipToggle' || wrap.id==='paymentPopupToggle')return;
  wrap.addEventListener('click',()=>{
    const key=wrap.dataset.key;if(!key||!settings[key])return;
    settings[key].val=!settings[key].val;
    const on=settings[key].val;
    wrap.style.background=on?currentTheme.border:'#1e1e1e';wrap.style.borderColor=on?currentTheme.border:'#333';
    const knob=wrap.querySelector('.frostKnob');knob.style.left=on?'21px':'3px';knob.style.background=on?'#fff':'#555';
    if(key==='darkOverlay')updateOverlay();
    if(key==='snapToEdge')applySnap();
    if((key==='embedDarkMode'||key==='siteMods')&&embeddedMode)applySiteTheme(currentTheme);
    saveCookies();
  });
});

// ---- Helpers ----
function formatBytes(b){if(!b||b===0)return'0 B';const k=1024,s=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(k));return(b/Math.pow(k,i)).toFixed(1)+' '+s[i];}
function formatDuration(ms){if(!ms)return'0s';const s=Math.floor(ms/1000);return s<60?s+'s':Math.floor(s/60)+'m '+s%60+'s';}
function isCloudflare(ip){return['104.30.','104.16.','104.17.','104.18.','104.19.','172.64.','162.158.'].some(p=>ip.startsWith(p));}
function isIPv6(ip){return ip.includes(':');}
function classifyASN(org){
  const asn=org?.split(' ')[0];
  const known=VPN_PROVIDERS[asn];
  if(known){
    if(known.type==='VPN'||known.type==='VPN_HOST')return'🔴 VPN/DC';
    if(known.type==='CLOUD')return'🟡 Hosting';
    if(known.type==='MOBILE')return'📱 Mobile';
    if(known.type==='ISP')return'🟢 Residential';
  }
  if(org?.toLowerCase().includes('vpn'))return'🔴 VPN';
  if(org?.toLowerCase().includes('hosting'))return'🟡 Hosting';
  if(org?.toLowerCase().includes('wireless')||org?.toLowerCase().includes('mobile'))return'📱 Mobile';
  return'🟢 Residential';
}
function getMarkerColor(p){
  if(p.type?.includes('🧅'))return'#ff8800';
  if(p.type?.includes('🔴'))return'#ff4444';
  if(p.type?.includes('🟡'))return'#ffaa00';
  if(p.type?.includes('📱'))return'#00bfff';
  return currentTheme.border;
}

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
  // Add all existing peers to the map
  peerLog.forEach(p => addMapMarker(p, false));
  if(peerLog.length > 0) {
    // Fly to the most recent peer
    const lastPeer = peerLog[peerLog.length - 1];
    if(lastPeer && lastPeer.loc && lastPeer.loc !== '?') {
      const [lat, lon] = lastPeer.loc.split(',').map(Number);
      if(!isNaN(lat) && !isNaN(lon)) {
        leafletMap.setView([lat, lon], 8);
        // Open popup for the last marker
        setTimeout(() => {
          if(currentMapMarker) currentMapMarker.openPopup();
        }, 500);
      }
    }
  }
}
function addMapMarker(p,fly=true){
  if(!leafletMap||!p.loc||p.loc==='?')return;
  const[lat,lon]=p.loc.split(',').map(Number);if(isNaN(lat)||isNaN(lon))return;
  const color=getMarkerColor(p);
  const icon=L.divIcon({className:'',html:`<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 10px ${color};"></div>`,iconSize:[16,16],iconAnchor:[8,8]});
  const m=L.marker([lat,lon],{icon}).addTo(leafletMap);
  m.bindPopup(`<div style="font-family:monospace;font-size:11px;min-width:160px;line-height:1.6;">
    <b style="color:#c8b8ff;">${p.ip}</b><br>
    ${p.city}, ${p.region}<br>
    ${p.country}<br>
    <span style="color:#9988cc;">${p.org}</span><br>
    <span style="color:${color};">${p.type}</span>
    ${p.port && p.port !== '?' ? `<br>🔌 Port: ${p.port}` : ''}
    ${p.candType && p.candType !== '?' ? `<br>📡 ${p.candType}` : ''}
    ${p.time ? `<br>🕐 ${p.time}` : ''}
  </div>`);
  mapMarkers.push(m);
  currentMapMarker=m;
  if(fly)flyToLatest();
}
function flyToLatest(){
  if(!leafletMap||!currentMapMarker)return;
  leafletMap.flyTo(currentMapMarker.getLatLng(),8,{animate:true,duration:1.5});
  setTimeout(()=>currentMapMarker.openPopup(),1600);
}

// ---- Snap / Drag / Resize ----
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
document.addEventListener('mousemove',e=>{if(!resizing)return;panel.style.width=Math.max(300,rw+(e.clientX-rox))+'px';panel.style.maxHeight=Math.max(400,rh+(e.clientY-roy))+'px';});
document.addEventListener('mouseup',()=>resizing=false);

// ---- Open/Close ----
function closePanel(){panel.style.display='none';dragon.style.display='block';overlay.style.display='none';}
function openPanel(){dragon.style.display='none';panel.style.display='flex';if(!settings.snapToEdge.val){panel.style.top='50%';panel.style.left='50%';panel.style.right='auto';panel.style.transform='translate(-50%,-50%)';}else applySnap();if(settings.darkOverlay.val)overlay.style.display='block';}
document.getElementById('ppClose').addEventListener('click',closePanel);

// ---- Copy/Export ----
document.getElementById('ppCopyAll').addEventListener('click',()=>{
  const text=peerLog.map((p,i)=>{
    const asn=lookupASN(p.org);const{score,reasons}=scoreConnection(p,asn);
    return[`--- Peer #${i+1} ---`,`IP: ${p.ip}`,`Type: ${p.label} ${p.type}`,`City: ${p.city}, ${p.region}`,`Country: ${p.country}`,`ISP: ${p.org}`,`ASN Provider: ${asn?.name||'Unknown'} (${asn?.label||'?'})`,`Quality Score: ${renderStars(score)} ${score}/5`,`Risk: ${getRiskLabel(asn?.risk||0)}`,`Reasons: ${reasons.join(', ')||'None'}`,`Time: ${p.time}`].join('\n');
  }).join('\n\n');
  navigator.clipboard.writeText(text||'No peers yet').then(()=>{const btn=document.getElementById('ppCopyAll');btn.textContent='✅';setTimeout(()=>btn.textContent='📋',1500);});
});
document.getElementById('ppExportBtn').addEventListener('click',()=>{
  const data={version:'0.2.2',peers:peerLog.map(p=>{const asn=lookupASN(p.org);const q=scoreConnection(p,asn);return{...p,asnInfo:asn,qualityScore:q.score,qualityReasons:q.reasons};}),events:eventLog,stats:sessionStats,connections:[...netConnections.values()],subnets:[...subnetMap.values()],protocols:protocolCounts,collection:getCollection()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`frosts_v021_${Date.now()}.json`;a.click();
  logEvent('info','Full session exported');
});
document.getElementById('ppClear').addEventListener('click',()=>{
  document.getElementById('ppBody').innerHTML=`<div id="ppEmpty" style="color:#443366;text-align:center;padding:40px 0;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px;"><div style="font-size:32px;opacity:0.3;">🐉</div><div>Waiting for peer connection...</div></div>`;
  seenIPs.clear();peerLog.length=0;peerCountFloat=0;activePeers.clear();subnetMap.clear();
  sessionStats={total:0,vpn:0,residential:0,mobile:0,hosting:0,tor:0,countries:{},totalTime:0,messages:0,skips:0,matches:0,longestConvo:0};
  document.getElementById('ppCount').textContent='Peers: 0';
  mapMarkers.forEach(m=>leafletMap&&leafletMap.removeLayer(m));mapMarkers.length=0;currentMapMarker=null;
  if(leafletMap)leafletMap.setView([20,0],2);
  logEvent('info','Session cleared');
});
document.getElementById('ppClearHistory').addEventListener('click',()=>{
  try{localStorage.removeItem('frostPeerHistory');}catch(e){}
  const btn=document.getElementById('ppClearHistory');btn.textContent='✅ Cleared';setTimeout(()=>btn.textContent='🗑 History',1500);
});

// ---- Add peer to panel ----
function addToPanel(p) {
  const body=document.getElementById('ppBody');
  if(!settings.showAll.val){body.innerHTML='';peerCountFloat=0;}
  const empty=document.getElementById('ppEmpty');if(empty)empty.remove();

  const isTor=torExits.has(p.ip);
  const seenCount=getSeenCount(p.ip);
  const color=getMarkerColor(p);
  const asnInfo=lookupASN(p.org);
  const{score,reasons}=scoreConnection(p,asnInfo);
  const riskColor=asnInfo?getRiskColor(asnInfo.risk):'#888';
  const isBadASN=asnInfo&&BAD_ASNS.has(p.org?.split(' ')[0]);
  const subnetEntry=trackSubnet(p.ip,p);
  const isSubnetCluster=subnetEntry&&subnetEntry.ips.length>1;
  const isTarget=targetCountry&&p.country===targetCountry;
  const vpnColor=settings.highlightVPN.val&&(p.type?.includes('🔴')||isTor)?'#ff4444':currentTheme.text;

  const entry=document.createElement('div');
  entry.className='peerEntry';
  if(isBadASN&&settings.showBadASN.val)entry.classList.add('frost-bad-asn');
  if(isSubnetCluster&&settings.showSubnetAlert.val)entry.classList.add('frost-subnet-alert');
  if(isTarget)entry.classList.add('frost-country-match');
  entry.style.cssText=`border:1px solid ${currentTheme.dim}44;border-left:3px solid ${color};border-radius:12px;padding:10px 12px;margin-bottom:8px;background:${currentTheme.header}88;`;

  const badges=[];
  if(isTor&&settings.showTor.val)badges.push(`<span class="frost-badge" style="background:#ff880022;border-color:#ff8800;color:#ff8800;">🧅 TOR</span>`);
  if(seenCount>0&&settings.showRepeat.val)badges.push(`<span class="frost-badge" style="background:#ffaa0022;border-color:#ffaa00;color:#ffaa00;">🔁 ${seenCount}x</span>`);
  if(p.privacyScore&&settings.showPrivacy.val)badges.push(`<span class="frost-badge" style="background:#ff222222;border-color:#ff2222;color:#ff6666;">🛡️ PROXY</span>`);
  if(isBadASN&&settings.showBadASN.val)badges.push(`<span class="frost-badge" style="background:#ff000022;border-color:#ff0000;color:#ff4444;">⚠️ BAD ASN</span>`);
  if(isSubnetCluster&&settings.showSubnetAlert.val)badges.push(`<span class="frost-badge" style="background:#ffaa0022;border-color:#ffaa00;color:#ffaa00;">🕸️ /24 CLUSTER</span>`);
  if(isTarget)badges.push(`<span class="frost-badge" style="background:#00ff8822;border-color:#00ff88;color:#00ff88;">🎯 MATCH</span>`);

  let html=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">
      <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;flex-wrap:wrap;">
        ${p.flag?`<img src="${p.flag}" style="width:16px;height:12px;border-radius:2px;flex-shrink:0;">`:''}
        <b style="color:${currentTheme.text};font-size:12px;word-break:break-all;">${p.label} ${p.ip}${settings.showPort.val&&p.port?`<span style="color:${currentTheme.dim};font-size:10px;">:${p.port}</span>`:''}</b>
      </div>
      <div style="display:flex;gap:3px;flex-shrink:0;">
        <button onclick="addToCollection('${p.ip}',${JSON.stringify({city:p.city,region:p.region,country:p.country,org:p.org,type:p.type}).replace(/"/g,"'")})" style="background:${currentTheme.header};border:1px solid ${currentTheme.dim}44;color:${currentTheme.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:3px 6px;">📌</button>
        <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅');setTimeout(()=>this.textContent='📋',1500)" style="background:${currentTheme.header};border:1px solid ${currentTheme.dim}44;color:${currentTheme.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:3px 6px;">📋</button>
      </div>
    </div>
    ${badges.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">${badges.join('')}</div>`:''}
    <div style="color:${vpnColor};font-size:11px;margin-bottom:4px;">${isTor?'🧅 Tor Exit Node':p.type}${settings.showCandType.val?` <span style="color:${currentTheme.dim};">• ${p.candType}</span>`:''}</div>
  `;

  if(!settings.compactMode.val){
    html+=`<div style="color:${currentTheme.sub};font-size:11px;">📍 ${p.city}, ${p.region} ${p.country}</div>`;
    html+=`<div style="color:${currentTheme.sub};font-size:11px;margin-top:2px;">🏢 ${p.org}</div>`;

    // ASN Intelligence block
    if(settings.showASNInfo.val&&asnInfo){
      html+=`<div class="asn-badge" style="background:${riskColor}22;border-color:${riskColor}44;color:${riskColor};margin-top:4px;">
        🏢 ${asnInfo.name} • ${asnInfo.label} • Risk ${asnInfo.risk}/10
      </div>`;
    }

    // Quality score
    if(settings.showQualityScore.val){
      html+=`<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
        <span class="quality-stars" style="color:${riskColor};font-size:13px;">${renderStars(score)}</span>
        <span style="font-size:10px;color:${currentTheme.dim};">${score}/5 ${reasons.length?'('+reasons.join(', ')+')':''}</span>
      </div>`;
    }

    // Subnet cluster info
    if(isSubnetCluster&&settings.showSubnetAlert.val){
      html+=`<div style="font-size:10px;color:#ffaa00;margin-top:4px;">🕸️ ${subnetEntry.ips.length} IPs from ${subnetEntry.subnet}</div>`;
    }

    const extras=[];
    if(settings.showCoords.val)extras.push(`🌐 ${p.loc}`);
    if(settings.showPostal.val)extras.push(`📮 ${p.postal}`);
    if(settings.showTimestamp.val)extras.push(`🕐 ${p.time}`);
    if(extras.length)html+=`<div style="color:${currentTheme.dim};font-size:10px;margin-top:4px;line-height:1.6;">${extras.join(' • ')}</div>`;
    if(settings.showDuration.val)html+=`<div id="dur_${p.ip.replace(/[:.]/g,'_')}" style="color:${currentTheme.dim};font-size:10px;margin-top:3px;">⏱️ 0s <span class="liveDot" style="color:${color};">●</span></div>`;
    if(settings.showTimeline.val)html+=`<div style="height:3px;background:#111;border-radius:2px;margin-top:6px;overflow:hidden;"><div id="tl_${p.ip.replace(/[:.]/g,'_')}" style="height:100%;width:0%;background:${color};border-radius:2px;transition:width 0.5s;"></div></div>`;
    html+=`<textarea class="peerNote" placeholder="Add a note..." rows="1" onfocus="this.rows=3" onblur="this.rows=1"></textarea>`;
  }else{
    html+=`<div style="color:${currentTheme.sub};font-size:10px;">📍 ${p.city}, ${p.country} • 🏢 ${p.org}</div>`;
    if(settings.showQualityScore.val)html+=`<span class="quality-stars" style="color:${riskColor};font-size:11px;">${renderStars(score)}</span>`;
  }

  entry.innerHTML=html;body.appendChild(entry);
  if(settings.autoScroll.val)body.scrollTop=body.scrollHeight;
  peerCountFloat++;document.getElementById('ppCount').textContent=`Peers: ${peerCountFloat}`;

  if(settings.showDuration.val){
    const startTime=Date.now();const durId=`dur_${p.ip.replace(/[:.]/g,'_')}`;const tlId=`tl_${p.ip.replace(/[:.]/g,'_')}`;
    const timer=setInterval(()=>{
      const el=document.getElementById(durId);const tl=document.getElementById(tlId);
      if(!el){clearInterval(timer);return;}
      const secs=Math.floor((Date.now()-startTime)/1000);const mins=Math.floor(secs/60);
      el.innerHTML=`⏱️ ${mins>0?mins+'m ':''}${secs%60}s <span class="liveDot" style="color:${color};">●</span>`;
      if(tl)tl.style.width=Math.min(100,(secs/300)*100)+'%';
    },1000);
    activePeers.set(p.ip,{timer,startTime});
  }
  // Add marker to map if map is loaded
  if(leafletMap) {
    addMapMarker(p, true);
  }
  if(activeTab==='stats')updateStats();
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
  s.textContent=`body{background:${c.body}!important;color:${c.text}!important;}.main,.mainContent,.videoGrid{background:${c.body}!important;}.chatWindow{background:${c.chat}!important;}.rightBox,.outlined{border-color:${c.border}!important;background:${c.chat}!important;}.messageInput{background:${c.input}!important;color:${c.text}!important;border-color:${c.border}!important;}.sb{color:${c.accent}!important;}header,.header{background:${c.body}!important;border-color:${c.border}!important;}*{scrollbar-color:${c.accent} ${c.body};}::-webkit-scrollbar-track{background:${c.body}!important;}::-webkit-scrollbar-thumb{background:${c.accent}!important;}`;
}

// ---- Apply theme ----
function applyTheme(t){
  currentTheme=t;
  panel.style.borderColor=t.border;panel.style.boxShadow=`0 0 40px ${t.border}33,0 20px 60px rgba(0,0,0,0.8)`;panel.style.color=t.text;panel.style.background=t.bg;
  dragon.style.filter=`drop-shadow(0 0 10px ${t.border})`;
  document.getElementById('pph').style.background=t.gradient;
  document.getElementById('ppTabs').style.background=t.bg;
  document.querySelectorAll('.frostToggle').forEach(w=>{if(w.id==='autoSkipToggle'||w.id==='paymentPopupToggle')return;const key=w.dataset.key;if(!key||!settings[key])return;const on=settings[key].val;w.style.background=on?t.border:'#1e1e1e';w.style.borderColor=on?t.border:'#333';});
  document.querySelectorAll('.tabBtn').forEach(b=>{const a=b.dataset.tab===activeTab;b.style.color=a?t.text:t.dim;b.style.borderBottom=a?`2px solid ${t.border}`:'2px solid transparent';b.style.background=a?t.header:'none';});
  document.querySelectorAll('.themeBtn').forEach(b=>{const active=themes[b.dataset.theme]===t;b.style.opacity=active?'1':'0.65';b.style.border=`1px solid ${themes[b.dataset.theme].border}${active?'':'55'}`;b.style.boxShadow=active?`0 0 12px ${themes[b.dataset.theme].border}44`:'';});
  document.querySelectorAll('.netSubBtn').forEach(b=>{const a=b.dataset.net===activeNetSubTab;b.style.color=a?t.text:t.dim;b.style.borderBottom=a?`2px solid ${t.border}`:'2px solid transparent';b.style.background=a?t.header:'none';});
  if(embeddedMode){applySiteTheme(t);updateEmbedTheme(t);}
  saveCookies();
}

// ---- Geo ----
async function geoIP(ip,port,candType){
  if(!settings.showCloudflare.val&&isCloudflare(ip))return;
  if(!settings.showIPv6.val&&isIPv6(ip))return;
  try{
    const r=await fetch(`https://ipinfo.io/${ip}/json`);const d=await r.json();
    const isTor=torExits.has(ip);const typeRaw=classifyASN(d.org);
    const privacyScore=d.privacy?.proxy||d.privacy?.vpn||false;
    const peerCountry=d.country||'?';

    // Country targeting
    if(targetCountry&&peerCountry!==targetCountry&&autoSkipEnabled){
      logEvent('warning',`Auto-skipped non-target: ${ip} (${peerCountry})`);tryAutoSkip();return;
    }
    if(settings.autoSkipVPN.val&&typeRaw.includes('VPN')){
      logEvent('warning',`Auto-skipped VPN: ${ip}`);tryAutoSkip();return;
    }

    const p={ip,port:port||'?',candType:candType||'?',label:isIPv6(ip)?'🔵 IPv6':'🟣 IPv4',type:isTor?'🧅 Tor':typeRaw,city:d.city||'?',region:d.region||'?',country:peerCountry,org:d.org||'Unknown',loc:d.loc||'?',postal:d.postal||'?',flag:d.country?`https://flagcdn.com/16x12/${d.country.toLowerCase()}.png`:'',time:new Date().toLocaleTimeString(),privacyScore,duration:null};

    // ASN checks
    const asnInfo=lookupASN(d.org);
    const asnKey=d.org?.split(' ')[0];
    if(asnInfo&&BAD_ASNS.has(asnKey)&&settings.showBadASN.val){
      logEvent('danger',`⚠️ BAD ASN detected: ${ip} on ${asnInfo.name} (Risk: ${asnInfo.risk}/10)`);
      playBadASNSound();
      if(settings.notifications.val&&Notification.permission==='granted')new Notification('⚠️ Bad ASN Detected',{body:`${ip} — ${asnInfo.name} (Risk ${asnInfo.risk}/10)`});
    }

    // Subnet check
    const subnet=trackSubnet(ip,p);
    if(subnet&&subnet.ips.length>1&&settings.showSubnetAlert.val){
      logEvent('warning',`🕸️ /24 cluster: ${subnet.ips.length} IPs from ${subnet.subnet}`);
    }

    // Country stats
    if(peerCountry!=='?'){countryCollection.add(peerCountry);sessionStats.countries[peerCountry]=(sessionStats.countries[peerCountry]||0)+1;}
    sessionStats.total++;sessionStats.matches++;
    if(isTor)sessionStats.tor++;
    else if(typeRaw.includes('VPN'))sessionStats.vpn++;
    else if(typeRaw.includes('Hosting'))sessionStats.hosting++;
    else if(typeRaw.includes('Mobile'))sessionStats.mobile++;
    else sessionStats.residential++;

    peerLog.push(p);saveHistory(ip);
    addToPanel(p);
    if(embeddedMode){addEmbedPeerCard(p);addEmbedMapMarker(p,true);}

    logEvent('success',`Peer: ${ip} — ${p.city}, ${p.country} | ${p.type} | Score: ${scoreConnection(p,asnInfo).score}/5`);

    if(targetCountry&&peerCountry===targetCountry){
      logEvent('success',`🎯 MATCH: ${ip} from ${COUNTRIES[peerCountry]||peerCountry}`);
      playMatchSound();
      if(settings.notifications.val&&Notification.permission==='granted')new Notification('🎯 Target Match!',{body:`${ip} — ${p.city}, ${p.country}`});
    }

    if(settings.autoCopyNew.val)navigator.clipboard.writeText(ip).catch(()=>{});
    if(settings.soundAlert.val)playPing();
    if(settings.notifications.val){
      const body=`${ip} — ${p.city}, ${p.country} (${p.type})`;
      if(Notification.permission==='granted')new Notification('🐉 Frosts Tools',{body});
      else if(Notification.permission!=='denied')Notification.requestPermission().then(per=>{if(per==='granted')new Notification('🐉 Frosts Tools',{body});});
    }
  }catch(e){console.warn('[FROST GEO FAILED]',ip);}
}

function tryAutoSkip(){
  try{
    const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.toLowerCase().includes('skip')||b.textContent.toLowerCase().includes('next')||b.textContent==='Stop');
    if(btn){btn.click();sessionStats.skips++;logEvent('info','Auto-skip triggered');}
  }catch(e){}
}

// ---- Embed ----
function buildEmbedContainer(){
  const t=currentTheme;
  const el=document.createElement('div');el.id='frostEmbedContainer';
  el.style.cssText=`width:100%;background:${t.bg};border-top:2px solid ${t.border};padding:10px;font-family:'SF Mono','Fira Code',monospace;overflow-y:auto;max-height:420px;transition:background 0.3s;`;
  el.innerHTML=`
    <div id="frostEmbedHeader" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:10px;margin-bottom:8px;background:${t.gradient};border:1px solid ${t.border}44;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">🐉</span>
        <div><div style="font-weight:700;font-size:12px;color:${t.text};">Frosts Tools</div><div style="font-size:9px;color:${t.dim};letter-spacing:1px;">v0.2.2 • ASN INTEL</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span id="embedPeerCount" style="font-size:10px;color:${t.dim};background:${t.header};padding:3px 8px;border-radius:10px;border:1px solid ${t.border}44;">Peers: 0</span>
        ${targetCountry?`<span style="font-size:10px;color:${t.border};background:${t.header};padding:3px 8px;border-radius:10px;border:1px solid ${t.border}44;">🎯 ${COUNTRIES[targetCountry]||targetCountry}</span>`:''}
        <button id="embedCopyAll" style="background:${t.header};border:1px solid ${t.border}44;color:${t.text};cursor:pointer;font-size:10px;padding:4px 8px;border-radius:6px;font-family:inherit;">📋</button>
        <button id="embedClose" style="background:${t.header};border:1px solid ${t.border}44;color:${t.dim};cursor:pointer;font-size:12px;padding:4px 8px;border-radius:6px;">✕</button>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
      <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:5px 10px;font-size:10px;color:${t.dim};flex:1;min-width:70px;">⏱️ <span id="embedTimer">0s</span></div>
      <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:5px 10px;font-size:10px;color:${t.dim};flex:1;min-width:70px;">💬 <span id="embedMsgCount">0</span></div>
      <div style="background:${t.header};border:1px solid ${t.border}22;border-radius:8px;padding:5px 10px;font-size:10px;color:${t.dim};flex:1;min-width:70px;">🌍 <span id="embedCountries">0</span></div>
    </div>
    <div id="embedMapEl" style="width:100%;height:140px;background:${t.header};border:1px solid ${t.border}22;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;">
      <div style="color:${t.dim};font-size:11px;">🗺️ Map loads on first peer...</div>
    </div>
    <div id="embedPeerArea"><div id="embedEmpty" style="color:${t.dim};text-align:center;padding:16px 0;font-size:11px;">⏳ Waiting for peer connection...</div></div>
  `;
  return el;
}

function updateEmbedTheme(t){
  const el=document.getElementById('frostEmbedContainer');if(!el)return;
  el.style.background=t.bg;el.style.borderTopColor=t.border;
  const hdr=document.getElementById('frostEmbedHeader');if(hdr){hdr.style.background=t.gradient;hdr.style.borderColor=t.border+'44';}
}

function initEmbedMap(){
  if(embedMapLoaded2)return;embedMapLoaded2=true;
  if(!document.querySelector('link[href*="leaflet"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
  if(window.L){setupEmbedMap();return;}
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=setupEmbedMap;document.head.appendChild(s);
}
function setupEmbedMap(){
  const el=document.getElementById('embedMapEl');if(!el)return;
  el.innerHTML='';el.style.display='block';
  embedLeafletMap=L.map('embedMapEl',{zoomControl:false,attributionControl:false}).setView([20,0],2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(embedLeafletMap);
  peerLog.forEach(p=>addEmbedMapMarker(p,false));
  if(peerLog.length>0)flyEmbedMap();
}
function addEmbedMapMarker(p,fly=true){
  if(!embedLeafletMap||!p.loc||p.loc==='?')return;
  const[lat,lon]=p.loc.split(',').map(Number);if(isNaN(lat)||isNaN(lon))return;
  const color=getMarkerColor(p);
  const icon=L.divIcon({className:'',html:`<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px ${color};"></div>`,iconSize:[12,12],iconAnchor:[6,6]});
  const m=L.marker([lat,lon],{icon}).addTo(embedLeafletMap);
  m.bindPopup(`<div style="font-family:monospace;font-size:10px;"><b>${p.ip}</b><br>${p.city}, ${p.country}<br>${p.type}</div>`);
  embedMapMarkers.push(m);embedCurrentMarker=m;if(fly)flyEmbedMap();
}
function flyEmbedMap(){if(!embedLeafletMap||!embedCurrentMarker)return;embedLeafletMap.flyTo(embedCurrentMarker.getLatLng(),7,{animate:true,duration:1.2});setTimeout(()=>embedCurrentMarker.openPopup(),1300);}

function addEmbedPeerCard(p){
  const area=document.getElementById('embedPeerArea');if(!area)return;
  const empty=document.getElementById('embedEmpty');if(empty)empty.remove();
  if(!settings.showAll.val){area.innerHTML='';const cnt=document.getElementById('embedPeerCount');if(cnt)cnt.textContent='Peers: 0';}
  const t=currentTheme;const color=getMarkerColor(p);
  const isTor=torExits.has(p.ip);const seenCount=getSeenCount(p.ip);
  const asnInfo=lookupASN(p.org);const{score}=scoreConnection(p,asnInfo);
  const riskColor=asnInfo?getRiskColor(asnInfo.risk):'#888';
  const isMatch=targetCountry&&p.country===targetCountry;
  const isBadASN=asnInfo&&BAD_ASNS.has(p.org?.split(' ')[0]);

  const card=document.createElement('div');
  card.className='embedPeerCard';
  card.style.cssText=`background:${t.header};border:1px solid ${isMatch?'#00ff88':isBadASN?'#ff444444':t.border+'33'};border-left:3px solid ${color};padding:10px 12px;`;
  if(isMatch)card.style.boxShadow=`0 0 10px #00ff8844`;
  if(isBadASN)card.style.animation='badASN 1.5s ease infinite';

  card.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
        ${p.flag?`<img src="${p.flag}" style="width:14px;height:10px;border-radius:2px;">`:''}
        <b style="color:${t.text};font-size:11px;">${p.label} ${p.ip}</b>
        ${isMatch?`<span class="frost-badge" style="background:#00ff8822;border-color:#00ff88;color:#00ff88;">🎯</span>`:''}
        ${isBadASN?`<span class="frost-badge" style="background:#ff000022;border-color:#ff0000;color:#ff4444;">⚠️</span>`:''}
        ${seenCount>0?`<span class="frost-badge" style="background:#ffaa0022;border-color:#ffaa00;color:#ffaa00;">🔁</span>`:''}
        ${isTor?`<span class="frost-badge" style="background:#ff880022;border-color:#ff8800;color:#ff8800;">🧅</span>`:''}
      </div>
      <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅');setTimeout(()=>this.textContent='📋',1500)" style="background:${t.bg};border:1px solid ${t.border}33;color:${t.dim};cursor:pointer;font-size:10px;border-radius:4px;padding:2px 6px;">📋</button>
    </div>
    <div style="color:${isTor?'#ff8800':color};font-size:11px;margin-bottom:3px;">${isTor?'🧅 Tor':p.type}</div>
    ${asnInfo&&settings.showASNInfo.val?`<div class="asn-badge" style="background:${riskColor}22;border-color:${riskColor}44;color:${riskColor};margin-bottom:4px;">🏢 ${asnInfo.name} • Risk ${asnInfo.risk}/10</div>`:''}
    ${settings.showQualityScore.val?`<div style="margin-bottom:4px;"><span class="quality-stars" style="color:${riskColor};font-size:12px;">${renderStars(score)}</span> <span style="font-size:10px;color:${t.dim};">${score}/5</span></div>`:''}
    <div style="color:${t.sub};font-size:11px;">📍 ${p.city}, ${p.region} ${p.country}</div>
    <div style="color:${t.sub};font-size:11px;margin-top:2px;">🏢 ${p.org}</div>
    <div style="color:${t.dim};font-size:10px;margin-top:3px;">🕐 ${p.time}</div>
    ${settings.showDuration.val?`<div id="embedDur_${p.ip.replace(/[:.]/g,'_')}" style="color:${t.dim};font-size:10px;margin-top:3px;">⏱️ 0s <span class="liveDot" style="color:${color};">●</span></div>`:''}
  `;
  area.appendChild(card);
  const cnt=document.getElementById('embedPeerCount');if(cnt){const c=parseInt(cnt.textContent.replace('Peers: ','')||'0');cnt.textContent=`Peers: ${c+1}`;}
  document.getElementById('embedCountries').textContent=countryCollection.size;
  if(settings.showDuration.val){const startTime=Date.now();const durId=`embedDur_${p.ip.replace(/[:.]/g,'_')}`;setInterval(()=>{const el=document.getElementById(durId);if(!el)return;const secs=Math.floor((Date.now()-startTime)/1000);const mins=Math.floor(secs/60);el.innerHTML=`⏱️ ${mins>0?mins+'m ':''}${secs%60}s <span class="liveDot" style="color:${color};">●</span>`;},1000);}
  const container=document.getElementById('frostEmbedContainer');if(container)container.scrollTop=container.scrollHeight;
}

setInterval(()=>{const el=document.getElementById('embedTimer');if(el)el.textContent=formatDuration(Date.now()-sessionStartTime);const msgEl=document.getElementById('embedMsgCount');if(msgEl)msgEl.textContent=sessionStats.messages;},1000);

function enableEmbedMode(){
  if(embeddedMode)return;
  const chatWindow=document.querySelector('.chatWindow');
  if(!chatWindow){alert('Could not find chat window.');return;}
  embeddedMode=true;
  const btn=document.getElementById('ppEmbedBtn');btn.textContent='✅ Embedded';btn.style.background='linear-gradient(135deg,#003300,#005500)';btn.style.borderColor='#00ff88';
  const container=buildEmbedContainer();chatWindow.insertBefore(container,chatWindow.firstChild);
  document.getElementById('embedCopyAll').addEventListener('click',()=>{
    const text=peerLog.map((p,i)=>{const asn=lookupASN(p.org);const{score}=scoreConnection(p,asn);return[`--- Peer #${i+1} ---`,`IP: ${p.ip}`,`Type: ${p.type}`,`ASN: ${asn?.name||'?'} (Risk ${asn?.risk||0}/10)`,`Quality: ${renderStars(score)} ${score}/5`,`City: ${p.city}, ${p.country}`,`ISP: ${p.org}`].join('\n');}).join('\n\n');
    navigator.clipboard.writeText(text||'No peers yet').then(()=>{const b=document.getElementById('embedCopyAll');b.textContent='✅';setTimeout(()=>b.textContent='📋',1500);});
  });
  document.getElementById('embedClose').addEventListener('click',()=>{
    const el=document.getElementById('frostEmbedContainer');if(el)el.remove();
    embeddedMode=false;const btn=document.getElementById('ppEmbedBtn');btn.textContent='🔗 Embed';btn.style.background='linear-gradient(135deg,#1a0f40,#2a1a60)';btn.style.borderColor='#7b68ee';
    embedMapLoaded2=false;embedLeafletMap=null;embedMapMarkers.length=0;embedCurrentMarker=null;
    const s=document.getElementById('frostSiteTheme');if(s)s.textContent='';
  });
  initEmbedMap();applySiteTheme(currentTheme);
  peerLog.forEach(p=>{addEmbedPeerCard(p);addEmbedMapMarker(p,false);});
  logEvent('success','Embedded into site');closePanel();
}
document.getElementById('ppEmbedBtn').addEventListener('click',enableEmbedMode);

// ---- Keyboard shortcuts ----
document.addEventListener('keydown',e=>{
  if(!settings.keyboardShorts.val)return;
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if(e.code==='Space'&&!e.shiftKey){e.preventDefault();tryAutoSkip();sessionStats.skips++;}
  if(e.code==='KeyM'){const v=document.querySelector('video');if(v)v.muted=!v.muted;}
  if(e.code==='KeyF'){document.fullscreenElement?document.exitFullscreen():document.querySelector('.main,.mainContent,.videoGrid')?.requestFullscreen();}
});
document.addEventListener('keydown',e=>{if(e.code==='Enter'&&e.target.classList.contains('messageInput')){sessionStats.messages++;}});

// ---- Hook ----
window.RTCPeerConnection=function(...args){
  const pc=new origPC(...args);activePC=pc;
  pc.addEventListener('connectionstatechange',()=>{
    webrtcStats.state=pc.connectionState;
    logEvent('info',`WebRTC: ${pc.connectionState}`);
    if(pc.connectionState==='connected')currentConvoStart=Date.now();
    if(['disconnected','failed','closed'].includes(pc.connectionState)){
      if(currentConvoStart){const dur=Date.now()-currentConvoStart;if(dur>sessionStats.longestConvo)sessionStats.longestConvo=dur;sessionStats.totalTime+=dur;currentConvoStart=null;logEvent('info',`Disconnected after ${formatDuration(dur)}`);}
    }
  });
  pc.addEventListener('icecandidate',e=>{
    if(e.candidate){totalPackets++;ppsCount++;
      if(e.candidate.type==='srflx')protocolCounts.STUN++;
      else if(e.candidate.protocol==='udp')protocolCounts.UDP++;
      else protocolCounts.TCP++;
      protocolCounts.WebRTC++;
      const ip=e.candidate.address||'';const port=e.candidate.port||0;
      if(ip){const key=`${ip}:${port}`;if(!netConnections.has(key))netConnections.set(key,{remote:ip,port,protocol:e.candidate.protocol?.toUpperCase()||'UDP',packets:0,bytes:0,duration:0,started:Date.now(),lastSeen:new Date().toLocaleTimeString(),color:currentTheme.border});const conn=netConnections.get(key);conn.packets++;conn.bytes+=100;conn.lastSeen=new Date().toLocaleTimeString();conn.duration=Date.now()-conn.started;}
    }
  });
  setInterval(async()=>{
    const stats=await pc.getStats();
    stats.forEach(r=>{
      if(r.type==='remote-candidate'&&r.address&&!seenIPs.has(r.address)){seenIPs.add(r.address);geoIP(r.address,r.port,r.candidateType);}
      if(r.type==='inbound-rtp'||r.type==='outbound-rtp'){totalPackets++;ppsCount++;totalBytes+=r.bytesReceived||r.bytesSent||0;}
    });
  },2000);
  return pc;
};

// Initialize payment popup blocker if enabled
if(disablePaymentPopups){
  initPaymentPopupBlocker();
}

applyTheme(currentTheme);
if(settings.snapToEdge.val)applySnap();
logEvent('success','Frosts Tools v0.2.2 ready');
console.log('%c[🐉 Frosts Tools v0.2.2 — ASN Intelligence Ready]','color:#7b68ee;font-weight:bold;font-size:14px;');
