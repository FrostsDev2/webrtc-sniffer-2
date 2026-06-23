// ============================================================
//  🐉 Frosts Tools v0.2.3 — Embed Redesign (Wider UI Mod)
// ============================================================

const origPC = window.RTCPeerConnection;
const seenIPs = new Set();
const peerLog = [];
const activePeers = new Map();
const eventLog = [];
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
let paymentObserver = null;
let embedActiveTab = 'peers';

// ---- Private IP Filter ----
function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip.includes(':')) return false;
  const p = ip.split('.').map(Number);
  if (p.length !== 4) return true;
  if (p[0] === 10) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 127) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 0) return true;
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
  'AS19318': { name:'Interserver',  type:'VPN_HOST', risk:7, label:'🔴 Interserver' },
  'AS35913': { name:'dhosting',     type:'VPN_HOST', risk:7, label:'🔴 dhosting' },
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
  'AS4713':  { name:'NTT',          type:'TRANSIT',  risk:2, label:'🟢 NTT' },
  'AS9121':  { name:'Turk Telekom', type:'ISP',      risk:2, label:'🟢 Turk Telekom' },
  'AS136907':{ name:'Huawei Cloud', type:'CLOUD',    risk:5, label:'🟡 Huawei Cloud' },
  'AS45102': { name:'Alibaba',      type:'CLOUD',    risk:5, label:'🟡 Alibaba Cloud' },
  'AS4134':  { name:'ChinaNet',     type:'ISP',      risk:3, label:'🟢 ChinaNet' },
  'AS9808':  { name:'China Mobile', type:'MOBILE',   risk:2, label:'📱 China Mobile' },
};
const BAD_ASNS = new Set(['AS9009','AS60068','AS212238','AS44901','AS202425','AS62240','AS19318','AS35913']);

function lookupASN(org) { if(!org)return null; return VPN_PROVIDERS[org.split(' ')[0]]||null; }
function getRiskColor(risk) { if(risk>=8)return'#ff3344'; if(risk>=6)return'#ff6600'; if(risk>=4)return'#ffaa00'; if(risk>=2)return'#88cc44'; return'#00cc66'; }
function getRiskLabel(risk) { if(risk>=8)return'HIGH RISK'; if(risk>=6)return'MEDIUM'; if(risk>=4)return'LOW RISK'; if(risk>=2)return'CLEAN'; return'RESIDENTIAL'; }

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

function renderStars(score) {
  const colors={1:'#ff3344',2:'#ff6600',3:'#ffaa00',4:'#88cc44',5:'#00cc66'};
  return`<span style="color:${colors[score]||'#888'};letter-spacing:2px;">${'★'.repeat(score)}${'☆'.repeat(5-score)}</span>`;
}

function getSubnet24(ip) { if(isIPv6(ip))return null; const p=ip.split('.'); if(p.length!==4)return null; return`${p[0]}.${p[1]}.${p[2]}.0/24`; }
function trackSubnet(ip,d) {
  const s=getSubnet24(ip);if(!s)return null;
  if(!subnetMap.has(s))subnetMap.set(s,{subnet:s,ips:[],firstSeen:new Date().toLocaleTimeString()});
  const e=subnetMap.get(s);
  if(!e.ips.find(x=>x.ip===ip))e.ips.push({ip,city:d.city,country:d.country,time:new Date().toLocaleTimeString()});
  return e;
}

// ---- Payment Blocker ----
function enablePaymentBlocker() {
  if(paymentObserver)return;
  const KEYS=['go premium','upgrade to premium','pay $','pay to unban','loading secure checkout','$4.99','$9.99','non-refundable','1-hour access','instant unban','⚡ go premium','skip speed slowed'];
  function scan() {
    document.querySelectorAll('div,section,aside,article').forEach(el=>{
      const text=(el.innerText||'').toLowerCase();
      const isPayment=KEYS.some(k=>text.includes(k));
      const style=getComputedStyle(el);
      const isOverlay=style.position==='fixed'||style.position==='absolute';
      if(isPayment&&isOverlay&&el.children.length<25)el.style.setProperty('display','none','important');
    });
    document.querySelectorAll('*').forEach(el=>{
      if(!el.children.length&&(el.innerText||'').toLowerCase().includes('skip speed slowed')){
        const p=el.closest('div')||el.parentElement;if(p)p.style.setProperty('display','none','important');
      }
    });
  }
  scan();
  paymentObserver=new MutationObserver(scan);
  paymentObserver.observe(document.body,{childList:true,subtree:true});
  logEvent('success','💳 Payment blocker enabled');
}
function disablePaymentBlocker() {
  if(paymentObserver){paymentObserver.disconnect();paymentObserver=null;}
  logEvent('info','💳 Payment blocker disabled');
}

// ---- Storage ----
function saveCookies() {
  const data={};Object.keys(settings).forEach(k=>data[k]=settings[k].val);
  data.theme=Object.keys(themes).find(k=>themes[k]===currentTheme)||'midnight';
  data.targetCountry=targetCountry;data.autoSkip=autoSkipEnabled;data.disablePaymentPopups=disablePaymentPopups;
  document.cookie=`frostSettings=${encodeURIComponent(JSON.stringify(data))};max-age=31536000;path=/`;
}
function loadCookies() {
  const match=document.cookie.match(/frostSettings=([^;]+)/);if(!match)return;
  try{const data=JSON.parse(decodeURIComponent(match[1]));Object.keys(settings).forEach(k=>{if(data[k]!==undefined)settings[k].val=data[k];});if(data.theme&&themes[data.theme])currentTheme=themes[data.theme];if(data.targetCountry)targetCountry=data.targetCountry;if(data.autoSkip!==undefined)autoSkipEnabled=data.autoSkip;if(data.disablePaymentPopups!==undefined)disablePaymentPopups=data.disablePaymentPopups;}catch(e){}
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
const themes = {
  midnight: { bg:'#0d0d1a', border:'#7b68ee', text:'#c8b8ff', sub:'#9988cc', dim:'#443366', header:'#0a0520', name:'🌙 Midnight', gradient:'linear-gradient(135deg,#0a0520,#1a1040)', site:{body:'#080612',chat:'#0d0820',input:'#120830',border:'#2a1a4a',text:'#c8b8ff',accent:'#7b68ee'} },
  matrix:   { bg:'#0a0a0a', border:'#00ff88', text:'#00ff88', sub:'#aaffcc', dim:'#446644', header:'#001a00', name:'💚 Matrix',   gradient:'linear-gradient(135deg,#001a00,#002a00)', site:{body:'#050a05',chat:'#081008',input:'#0a1a0a',border:'#1a4a1a',text:'#00ff88',accent:'#00ff88'} },
  blood:    { bg:'#0a0000', border:'#ff2222', text:'#ff6666', sub:'#cc4444', dim:'#441111', header:'#1a0000', name:'🔴 Blood',    gradient:'linear-gradient(135deg,#1a0000,#2a0000)', site:{body:'#080000',chat:'#120000',input:'#1a0000',border:'#4a0000',text:'#ff6666',accent:'#ff2222'} },
  ice:      { bg:'#0a0f1a', border:'#00bfff', text:'#aaddff', sub:'#88bbdd', dim:'#224466', header:'#001133', name:'🧊 Ice',      gradient:'linear-gradient(135deg,#001133,#002244)', site:{body:'#050810',chat:'#080f1a',input:'#0a1428',border:'#1a3a5a',text:'#aaddff',accent:'#00bfff'} },
  gold:     { bg:'#0f0a00', border:'#ffaa00', text:'#ffdd88', sub:'#ccaa44', dim:'#443300', header:'#1a0f00', name:'👑 Gold',     gradient:'linear-gradient(135deg,#1a0f00,#2a1a00)', site:{body:'#080500',chat:'#120a00',input:'#1a0f00',border:'#4a2a00',text:'#ffdd88',accent:'#ffaa00'} },
  rose:     { bg:'#0f0a0d', border:'#ff69b4', text:'#ffb6d9', sub:'#cc88aa', dim:'#553344', header:'#1a0010', name:'🌸 Rose',     gradient:'linear-gradient(135deg,#1a0010,#2a0020)', site:{body:'#080005',chat:'#12000a',input:'#1a0010',border:'#4a0030',text:'#ffb6d9',accent:'#ff69b4'} },
  cyber:    { bg:'#050510', border:'#00ffff', text:'#00ffff', sub:'#88ffff', dim:'#224444', header:'#001a1a', name:'⚡ Cyber',    gradient:'linear-gradient(135deg,#001a1a,#002828)', site:{body:'#020810',chat:'#05101a',input:'#001818',border:'#004444',text:'#00ffff',accent:'#00ffff'} },
  ember:    { bg:'#100800', border:'#ff6600', text:'#ffaa44', sub:'#cc7722', dim:'#442200', header:'#1a0800', name:'🔥 Ember',    gradient:'linear-gradient(135deg,#1a0800,#2a1000)', site:{body:'#080400',chat:'#120600',input:'#1a0800',border:'#4a1a00',text:'#ffaa44',accent:'#ff6600'} },
};
let currentTheme=themes.midnight;

// ---- Settings ----
const settings = {
  showAll:         {val:false, label:'📋 Show All Peers',       desc:'Keep all peers. Off = clear on new peer.'},
  notifications:   {val:true,  label:'🔔 Notifications',        desc:'Browser popup when peer connects.'},
  soundAlert:      {val:false, label:'🔊 Sound Alert',          desc:'Audio ping on new peer.'},
  autoScroll:      {val:true,  label:'⬇️ Auto Scroll',          desc:'Scroll to latest peer.'},
  showCloudflare:  {val:false, label:'☁️ Show Cloudflare IPs',  desc:'Show Cloudflare relays.'},
  showIPv6:        {val:true,  label:'🔵 Show IPv6',            desc:'Include IPv6 addresses.'},
  compactMode:     {val:false, label:'📦 Compact Mode',         desc:'Minimal one-line per peer.'},
  showTimestamp:   {val:true,  label:'🕐 Timestamp',            desc:'Show time connected.'},
  showCoords:      {val:true,  label:'🌐 Coordinates',          desc:'Show lat/lon.'},
  showPostal:      {val:true,  label:'📮 Postal Code',          desc:'Show zip/postal.'},
  highlightVPN:    {val:true,  label:'🔴 Highlight VPN/DC',    desc:'Flag VPN IPs in red.'},
  showPort:        {val:true,  label:'🔌 Show Port',            desc:'Show port number.'},
  showCandType:    {val:true,  label:'📡 Candidate Type',       desc:'Show srflx/relay/host.'},
  autoCopyNew:     {val:false, label:'📎 Auto-Copy New IP',     desc:'Auto copies each IP.'},
  darkOverlay:     {val:false, label:'🌑 Page Dim Overlay',     desc:'Dims page behind panel.'},
  showRepeat:      {val:true,  label:'🔁 Repeat Peer Alert',    desc:'Flag IPs seen before.'},
  showTor:         {val:true,  label:'🧅 Tor Detection',        desc:'Flag Tor exit nodes.'},
  showPrivacy:     {val:true,  label:'🛡️ Privacy/Proxy Score',  desc:'Show proxy score.'},
  showDuration:    {val:true,  label:'⏱️ Connection Duration',  desc:'Track connection time.'},
  showTimeline:    {val:true,  label:'📈 Timeline Bar',         desc:'Visual timeline per peer.'},
  snapToEdge:      {val:false, label:'📌 Snap to Edge',         desc:'Snap to right edge.'},
  autoSkipVPN:     {val:false, label:'🚫 Auto-Skip VPN Peers',  desc:'Auto skip VPN peers.'},
  embedDarkMode:   {val:true,  label:'🌑 Embed Dark Mode',      desc:'Apply dark mode to site.'},
  siteMods:        {val:true,  label:'🔧 Site Modifications',   desc:'Apply UI improvements.'},
  keyboardShorts:  {val:true,  label:'⌨️ Keyboard Shortcuts',   desc:'Space=skip, M=mute, F=full.'},
  autoFocusChat:   {val:true,  label:'💬 Auto-Focus Chat',      desc:'Auto focus chat box.'},
  showQualityScore:{val:true,  label:'⭐ Quality Score',        desc:'Rate each peer 1-5 stars.'},
  showASNInfo:     {val:true,  label:'🏢 ASN Intelligence',     desc:'Show VPN provider details.'},
  showSubnetAlert: {val:true,  label:'🕸️ Subnet Clustering',    desc:'Alert on /24 clusters.'},
  showBadASN:      {val:true,  label:'⚠️ Bad ASN Alert',        desc:'Highlight known bad ASNs.'},
  pipMode:         {val:false, label:'📺 Picture-in-Picture',   desc:'Enable PiP for video.'},
};
loadCookies();

// ---- Countries ----
const COUNTRIES = {
  'US':'🇺🇸 United States','GB':'🇬🇧 United Kingdom','CA':'🇨🇦 Canada','AU':'🇦🇺 Australia',
  'DE':'🇩🇪 Germany','FR':'🇫🇷 France','IN':'🇮🇳 India','BR':'🇧🇷 Brazil','MX':'🇲🇽 Mexico',
  'JP':'🇯🇵 Japan','KR':'🇰 South Korea','RU':'🇷🇺 Russia','CN':'🇨🇳 China','IT':'🇮🇹 Italy',
  'ES':'🇪🇸 Spain','NL':'🇳🇱 Netherlands','SE':'🇸🇪 Sweden','NO':'🇳🇴 Norway','PL':'🇵 Poland',
  'TR':'🇹🇷 Turkey','AR':'🇦🇷 Argentina','CO':'🇨🇴 Colombia','PH':'🇵🇭 Philippines','NG':'🇳🇬 Nigeria',
  'ZA':'🇿🇦 South Africa','EG':'🇪🇬 Egypt','SA':'🇸🇦 Saudi Arabia','AE':'🇦🇪 UAE','SG':'🇸🇬 Singapore',
  'TH':'🇹🇭 Thailand','ID':'🇮🇩 Indonesia','MY':'🇲🇾 Malaysia','VN':'🇻🇳 Vietnam','PK':'🇵🇰 Pakistan',
  'UA':'🇺🇦 Ukraine','RO':'🇷🇴 Romania','CZ':'🇨 Czech Republic','HU':'🇭🇺 Hungary','PT':'🇵🇹 Portugal',
  'GR':'🇬🇷 Greece','FI':'🇫 Finland','DK':'🇩🇰 Denmark','CH':'🇨🇭 Switzerland','AT':'🇦🇹 Austria',
  'BE':'🇧🇪 Belgium','IL':'🇮🇱 Israel','NZ':'🇳🇿 New Zealand','IE':'🇮🇪 Ireland','CL':'🇨🇱 Chile',
};

// ---- Styles ----
const styleTag=document.createElement('style');
styleTag.id='frostStyles';
styleTag.textContent=`
  @keyframes dragonPulse{from{transform:scale(1) rotate(-5deg);filter:drop-shadow(0 0 8px #7b68ee)}to{transform:scale(1.18) rotate(5deg);filter:drop-shadow(0 0 22px #7b68ee)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeInScale{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
  @keyframes barShimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
  @keyframes loaderFadeOut{from{opacity:1}to{opacity:0}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
  @keyframes matchPulse{0%{transform:scale(1)}50%{transform:scale(1.01)}100%{transform:scale(1)}}
  @keyframes badASN{0%,100%{box-shadow:0 0 6px #ff334488}50%{box-shadow:0 0 18px #ff334488,0 0 32px #ff334433}}
  @keyframes subnetAlert{0%,100%{border-color:#ffaa0033}50%{border-color:#ffaa0099}}
  @keyframes embedSlideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
  @keyframes mapFlyIn{from{opacity:0}to{opacity:1}}

  #peerFloatPanel *{box-sizing:border-box;}
  #peerFloatPanel button:active{opacity:0.65;transform:scale(0.97);}
  .frostToggle{transition:background 0.25s;}
  .frostToggle .frostKnob{transition:left 0.25s;}
  .themeBtn{transition:transform 0.15s,opacity 0.15s,box-shadow 0.15s;}
  .themeBtn:hover{opacity:1!important;transform:translateY(-2px)!important;}
  .tabBtn,.netSubBtn{transition:all 0.2s;}
  .peerEntry{animation:fadeIn 0.2s ease;}
  .liveDot{animation:pulse 1.5s infinite;}
  .eventEntry{animation:slideIn 0.15s ease;}
  .frost-country-match{animation:matchPulse 0.5s ease;}
  .frost-bad-asn{animation:badASN 1.5s ease infinite;}
  .frost-subnet-alert{animation:subnetAlert 1.5s ease infinite;}

  #ppBody::-webkit-scrollbar,#tabSettings::-webkit-scrollbar,#tabStats::-webkit-scrollbar,
  #tabEvents::-webkit-scrollbar,#netContent::-webkit-scrollbar{width:4px;}
  #ppBody::-webkit-scrollbar-track,#tabSettings::-webkit-scrollbar-track{background:transparent;}
  #ppBody::-webkit-scrollbar-thumb,#tabSettings::-webkit-scrollbar-thumb,
  #tabStats::-webkit-scrollbar-thumb,#tabEvents::-webkit-scrollbar-thumb,
  #netContent::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:4px;}

  #frostResizeHandle{position:absolute;bottom:0;right:0;width:18px;height:18px;cursor:se-resize;z-index:10;opacity:0.3;display:flex;align-items:flex-end;justify-content:flex-end;padding:3px;color:#666;font-size:11px;}
  #frostResizeHandle:hover{opacity:0.8;}
  .peerNote{width:100%;background:#0a0818;border:1px solid #2a1a4a;color:#9988cc;border-radius:6px;padding:5px 8px;font-family:inherit;font-size:10px;margin-top:6px;resize:none;outline:none;transition:border-color 0.2s;}
  .peerNote:focus{border-color:#7b68ee;}
  .peerNote::placeholder{color:#443366;}
  .leaflet-popup-content-wrapper{background:#0d0d1a!important;border:1px solid #2a1a4a!important;color:#c8b8ff!important;border-radius:10px!important;box-shadow:0 8px 24px rgba(0,0,0,0.6)!important;}
  .leaflet-popup-tip{background:#0d0d1a!important;}
  .frost-badge{display:inline-flex;align-items:center;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:600;border:1px solid;}
  .frost-select{background:#0a0818;border:1px solid #2a1a4a;color:#c8b8ff;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12px;outline:none;width:100%;cursor:pointer;transition:border-color 0.2s;}
  .frost-select:focus{border-color:#7b68ee;}
  .quality-stars{letter-spacing:2px;}
  .asn-badge{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:3px 8px;font-size:10px;border:1px solid;margin-top:4px;font-weight:500;}
  .frostStatBar{height:4px;background:#1a1a2e;border-radius:2px;overflow:hidden;margin-top:4px;}
  .frostStatBarFill{height:100%;border-radius:2px;transition:width 0.6s ease;}

  /* ---- Embed Styles ---- */
  #frostEmbedWrapper{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
    box-sizing:border-box;
    animation:fadeInScale 0.3s ease;
  }
  #frostEmbedWrapper *{box-sizing:border-box;}
  #frostEmbedWrapper::-webkit-scrollbar{width:4px;}
  #frostEmbedWrapper::-webkit-scrollbar-thumb{background:#2a1a4a;border-radius:4px;}

  .embed-peer-card{
    animation:embedSlideIn 0.25s ease;
    transition:transform 0.15s,box-shadow 0.15s;
  }
  .embed-peer-card:hover{transform:translateY(-1px);}

  .embed-tab-btn{
    transition:all 0.2s;
    cursor:pointer;
    border:none;
    background:none;
    font-family:inherit;
  }
  .embed-tab-btn:hover{opacity:1!important;}

  .embed-stat-pill{
    transition:transform 0.2s;
  }
  .embed-stat-pill:hover{transform:translateY(-1px);}

  #embedMapContainer .leaflet-container{
    border-radius:0;
    background:#050510!important;
  }
  #embedMapContainer .leaflet-tile-pane{filter:brightness(0.85) saturate(0.9);}

  .embed-badge{
    display:inline-flex;align-items:center;gap:2px;
    border-radius:4px;padding:1px 6px;
    font-size:9px;font-weight:700;
    border:1px solid;letter-spacing:0.3px;
  }
`;
document.head.appendChild(styleTag);

// ---- Overlay ----
const overlay=document.createElement('div');
overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999990;display:none;pointer-events:none;backdrop-filter:blur(2px);';
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
loader.style.cssText='position:fixed;inset:0;background:linear-gradient(160deg,#050508 0%,#0a0814 100%);z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
loader.innerHTML=`
  <div style="font-size:clamp(40px,10vw,64px);animation:dragonPulse 1.2s infinite alternate;margin-bottom:24px;">🐉</div>
  <div style="font-size:clamp(20px,4vw,28px);font-weight:700;color:#c8b8ff;letter-spacing:3px;margin-bottom:6px;">Frosts Tools</div>
  <div style="font-size:12px;color:#443366;letter-spacing:2px;margin-bottom:40px;">VERSION 0.2.3</div>
  <div style="width:clamp(180px,40vw,240px);margin-bottom:12px;">
    <div style="width:100%;height:3px;background:#1a1025;border-radius:2px;overflow:hidden;">
      <div id="frostBar" style="width:0%;height:100%;border-radius:2px;background:linear-gradient(90deg,#7b68ee,#c8b8ff,#7b68ee);background-size:200px 100%;animation:barShimmer 1.5s infinite linear;transition:width 0.3s ease;"></div>
    </div>
  </div>
  <div id="frostLoadTxt" style="font-size:11px;color:#443366;letter-spacing:1px;height:16px;margin-bottom:36px;">INITIALIZING...</div>
  <div style="padding:10px 24px;border:1px solid #2a1a4a;border-radius:20px;background:#0d0a1a;font-size:12px;color:#443366;">💡 Tip: Join Discord for updates!</div>
`;
document.body.appendChild(loader);
const steps=['HOOKING WEBRTC...','LOADING TOR LIST...','LOADING ASN DATABASE...','BUILDING UI...','RESTORING SETTINGS...','READY 🐉'];
let _step=0;
const _bar=document.getElementById('frostBar'),_txt=document.getElementById('frostLoadTxt');
const _li=setInterval(()=>{_step++;_bar.style.width=((_step/steps.length)*100)+'%';_txt.textContent=steps[_step-1]||'';if(_step>=steps.length){clearInterval(_li);setTimeout(()=>{loader.style.animation='loaderFadeOut 0.5s ease forwards';setTimeout(()=>loader.remove(),500);},400);}},380);

// ---- Dragon ----
const dragon=document.createElement('div');
dragon.innerHTML='🐉';
dragon.style.cssText='position:fixed;bottom:28px;right:28px;font-size:36px;cursor:pointer;z-index:999998;display:none;filter:drop-shadow(0 0 10px #7b68ee);transition:filter 0.3s,transform 0.2s;user-select:none;touch-action:none;';
document.body.appendChild(dragon);
dragon.addEventListener('mouseenter',()=>{dragon.style.transform='scale(1.2) rotate(8deg)';dragon.style.filter=`drop-shadow(0 0 18px ${currentTheme.border})`;});
dragon.addEventListener('mouseleave',()=>{dragon.style.transform='scale(1) rotate(0)';dragon.style.filter=`drop-shadow(0 0 10px ${currentTheme.border})`;});
let _dd=false,_dox=0,_doy=0,_dm=false;
dragon.addEventListener('mousedown',e=>{_dd=true;_dm=false;_dox=e.clientX-dragon.offsetLeft;_doy=e.clientY-dragon.offsetTop;});
document.addEventListener('mousemove',e=>{if(!_dd)return;_dm=true;dragon.style.left=Math.max(0,e.clientX-_dox)+'px';dragon.style.top=Math.max(0,e.clientY-_doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto';});
document.addEventListener('mouseup',()=>{if(_dd&&!_dm)openPanel();_dd=false;});
dragon.addEventListener('touchstart',e=>{const t=e.touches[0];_dd=true;_dm=false;_dox=t.clientX-dragon.offsetLeft;_doy=t.clientY-dragon.offsetTop;},{passive:true});
document.addEventListener('touchmove',e=>{if(!_dd)return;_dm=true;const t=e.touches[0];dragon.style.left=Math.max(0,t.clientX-_dox)+'px';dragon.style.top=Math.max(0,t.clientY-_doy)+'px';dragon.style.right='auto';dragon.style.bottom='auto';},{passive:true});
document.addEventListener('touchend',()=>{if(_dd&&!_dm)openPanel();_dd=false;});

// ---- Toggle builder ----
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
    ${Object.entries(themes).map(([key,t])=>`<button class="themeBtn" data-theme="${key}" style="background:${t.gradient};border:1.5px solid ${themes[key]===currentTheme?t.border:t.border+'44'};color:${t.text};border-radius:10px;padding:9px 11px;cursor:pointer;font-size:11px;font-weight:600;text-align:left;opacity:${themes[key]===currentTheme?'1':'0.6'};font-family:inherit;box-shadow:${themes[key]===currentTheme?`0 0 14px ${t.border}44`:''}">${t.name}</button>`).join('')}
  </div>`;
}

function buildCountryTargetHTML(){
  return`<div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">🎯 Country Selection</div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;margin-bottom:6px;">
    <select class="frost-select" id="targetCountrySelect" style="margin-bottom:10px;">
      <option value="">🌍 No target (show all)</option>
      ${Object.entries(COUNTRIES).map(([code,name])=>`<option value="${code}" ${targetCountry===code?'selected':''}>${name}</option>`).join('')}
    </select>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0;">
      <div id="autoSkipToggle" style="width:42px;height:23px;border-radius:12px;flex-shrink:0;background:${autoSkipEnabled?currentTheme.border:'#1e1e2e'};border:1px solid ${autoSkipEnabled?currentTheme.border:'rgba(255,255,255,0.1)'};position:relative;cursor:pointer;">
        <div class="frostKnob" style="position:absolute;top:3px;left:${autoSkipEnabled?'20px':'3px'};width:15px;height:15px;border-radius:50%;background:${autoSkipEnabled?'#fff':'#555'};"></div>
      </div>
      <span style="font-size:11px;color:${currentTheme.sub};">Auto-skip non-target countries</span>
    </label>
    <div id="targetCountryDisplay" style="margin-top:10px;font-size:11px;color:${currentTheme.border};font-weight:500;">${targetCountry?`🎯 Targeting: ${COUNTRIES[targetCountry]||targetCountry}`:'🌍 No target set'}</div>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;margin-bottom:20px;">
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
      <div id="paymentPopupToggle" style="width:42px;height:23px;border-radius:12px;flex-shrink:0;background:${disablePaymentPopups?currentTheme.border:'#1e1e2e'};border:1px solid ${disablePaymentPopups?currentTheme.border:'rgba(255,255,255,0.1)'};position:relative;cursor:pointer;">
        <div class="frostKnob" style="position:absolute;top:3px;left:${disablePaymentPopups?'20px':'3px'};width:15px;height:15px;border-radius:50%;background:${disablePaymentPopups?'#fff':'#555'};"></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:500;color:${currentTheme.text};">🚫 Disable Payment Popups</div>
        <div style="font-size:10px;color:${currentTheme.dim};margin-top:2px;">Hides premium, unban, and checkout modals.</div>
      </div>
    </label>
  </div>`;
}

function buildCollectionHTML(){
  const col=getCollection();
  return`<div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:10px;text-transform:uppercase;">📦 Saved Collection</div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;margin-bottom:14px;">
    ${getCollection().length===0
      ?`<div style="color:${currentTheme.dim};text-align:center;padding:16px 0;font-size:11px;line-height:1.6;">No saved peers yet.<br>Tap 📌 on any peer to save.</div>`
      :getCollection().map((c,i)=>`<div style="border-bottom:1px solid rgba(255,255,255,0.04);padding:10px 0;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <b style="color:${currentTheme.text};font-size:12px;">${c.ip}</b>
          <button onclick="removeFromCollection(${i})" style="background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);color:#ff6666;cursor:pointer;font-size:10px;padding:2px 8px;border-radius:5px;font-family:inherit;">Remove</button>
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
// MODIFIED: Increased clamp width from 460px to 520px and min width from 320 to 350
panel.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:clamp(350px,92vw,520px);background:#0d0d1a;border:1px solid #7b68ee;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:13px;color:#c8b8ff;z-index:999999;box-shadow:0 0 0 1px rgba(123,104,238,0.15),0 24px 48px rgba(0,0,0,0.8),0 0 80px rgba(123,104,238,0.1);display:flex;flex-direction:column;overflow:hidden;max-height:clamp(520px,90vh,820px);animation:fadeIn 0.3s ease;';

panel.innerHTML=`
  <!-- Header -->
  <div id="pph" style="padding:14px 16px;background:linear-gradient(135deg,#0a0520,#120830);border-bottom:1px solid rgba(123,104,238,0.2);display:flex;justify-content:space-between;align-items:center;cursor:grab;user-select:none;flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:22px;">🐉</span>
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:700;font-size:15px;color:#c8b8ff;letter-spacing:0.3px;">Frosts Tools</span>
          <span style="font-size:9px;background:rgba(123,104,238,0.2);border:1px solid rgba(123,104,238,0.4);color:#7b68ee;padding:2px 7px;border-radius:10px;font-weight:600;">v0.2.3</span>
        </div>
        <div style="font-size:10px;color:#443366;margin-top:2px;">WebRTC Inspector + ASN Intelligence</div>
      </div>
    </div>
    <div style="display:flex;gap:5px;align-items:center;">
      <button id="ppEmbedBtn" style="background:linear-gradient(135deg,rgba(123,104,238,0.2),rgba(123,104,238,0.35));border:1px solid rgba(123,104,238,0.5);color:#c8b8ff;cursor:pointer;font-size:11px;padding:6px 10px;border-radius:8px;font-family:inherit;font-weight:600;white-space:nowrap;">🔗 Embed</button>
      <button id="ppCopyAll" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;" title="Copy all">📋</button>
      <button id="ppExportBtn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;" title="Export JSON">💾</button>
      <button id="ppSnapBtn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;" title="Snap to edge">📌</button>
      <button id="ppClose" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#c8b8ff;cursor:pointer;font-size:14px;padding:6px 9px;border-radius:8px;" title="Minimize">🐉</button>
    </div>
  </div>

  <!-- Tabs -->
  <div id="ppTabs" style="display:flex;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;overflow-x:auto;-webkit-overflow-scrolling:touch;">
    <button class="tabBtn" data-tab="peers" style="flex:1;min-width:58px;padding:10px 4px;background:rgba(123,104,238,0.15);border:none;border-bottom:2px solid #7b68ee;color:#c8b8ff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">👥 Peers</button>
    <button class="tabBtn" data-tab="map" style="flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">🗺️ Map</button>
    <button class="tabBtn" data-tab="network" style="flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📡 Net</button>
    <button class="tabBtn" data-tab="stats" style="flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📊 Stats</button>
    <button class="tabBtn" data-tab="events" style="flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📋 Events</button>
    <button class="tabBtn" data-tab="collection" style="flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">📦 Saved</button>
    <button class="tabBtn" data-tab="settings" style="flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">⚙️ Settings</button>
    <button class="tabBtn" data-tab="about" style="flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#443366;cursor:pointer;font-family:inherit;font-size:11px;font-weight:500;white-space:nowrap;">ℹ️ About</button>
  </div>

  <!-- Peers Tab -->
  <div id="tabPeers" style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;">
    <div id="ppBody" style="overflow-y:auto;padding:10px;flex:1;">
      <div id="ppEmpty" style="color:#443366;text-align:center;padding:50px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div style="font-size:40px;opacity:0.15;">🐉</div>
        <div style="font-size:13px;color:#553366;">Waiting for peer connection...</div>
        <div style="font-size:11px;color:#2a1a4a;line-height:1.5;">Run before starting a call</div>
      </div>
    </div>
    <div style="padding:8px 14px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="ppCount" style="font-size:11px;color:#443366;font-weight:500;">Peers: 0</span>
        <span id="targetDisplay" style="font-size:10px;color:${currentTheme.border};background:${currentTheme.border}18;padding:2px 8px;border-radius:10px;border:1px solid ${currentTheme.border}33;display:${targetCountry?'block':'none'};">🎯 ${COUNTRIES[targetCountry]||''}</span>
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
    <div id="statsContent"><div style="color:#443366;text-align:center;padding:30px 0;font-size:12px;">No data yet.</div></div>
  </div>

  <!-- Events Tab -->
  <div id="tabEvents" style="display:none;overflow-y:auto;padding:10px;flex:1;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <span style="font-size:11px;color:#443366;font-weight:600;letter-spacing:0.5px;">EVENT LOG</span>
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
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:8px;text-transform:uppercase;">Display</div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showAll','compactMode','showTimestamp','showCoords','showPostal','showPort','showCandType','highlightVPN','darkOverlay','showTimeline'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:8px;text-transform:uppercase;">Filtering</div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showCloudflare','showIPv6','autoSkipVPN'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:8px;text-transform:uppercase;">ASN Intelligence</div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showQualityScore','showASNInfo','showSubnetAlert','showBadASN'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:8px;text-transform:uppercase;">Intelligence</div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['showRepeat','showTor','showPrivacy','showDuration'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:8px;text-transform:uppercase;">Site Mods (Embed)</div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['embedDarkMode','siteMods','keyboardShorts','autoFocusChat','pipMode'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:8px;text-transform:uppercase;">Alerts</div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['notifications','soundAlert','autoCopyNew'].map(buildToggleHTML).join('')}
    </div>
    <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;color:${currentTheme.dim};margin-bottom:8px;text-transform:uppercase;">Behaviour</div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0 12px;margin-bottom:14px;">
      ${['autoScroll','snapToEdge'].map(buildToggleHTML).join('')}
    </div>
    <div style="height:16px;"></div>
  </div>

  <!-- About Tab -->
  <div id="tabAbout" style="display:none;padding:20px 18px;flex:1;overflow-y:auto;">
    <div style="text-align:center;margin-bottom:22px;">
      <div style="font-size:48px;margin-bottom:12px;">🐉</div>
      <div style="font-size:18px;font-weight:700;color:#c8b8ff;letter-spacing:1px;">Frosts Tools</div>
      <div style="font-size:10px;color:#443366;margin-top:6px;letter-spacing:1px;">v0.2.3 — Embed Redesign</div>
    </div>
    <div style="font-size:11px;color:#9988cc;line-height:1.8;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:16px;">
      Full WebRTC peer inspector with ASN reputation database, VPN provider identification, quality scoring, subnet clustering, country targeting, payment popup blocker, network monitoring, and site embedding.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
      <a href="https://discord.gg" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:rgba(123,104,238,0.1);border:1px solid rgba(123,104,238,0.25);color:#7b68ee;text-decoration:none;font-size:12px;">
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
      <div style="border:1px solid ${t.border}18;border-left:3px solid ${c.color};border-radius:10px;padding:10px 12px;margin-bottom:6px;background:rgba(255,255,255,0.02);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="color:${t.text};font-size:12px;">${c.remote}</b>
          <span style="color:${c.color};font-size:9px;font-weight:700;background:${c.color}15;padding:2px 7px;border-radius:8px;border:1px solid ${c.color}33;">${c.protocol}</span>
        </div>
        <div style="color:${t.sub};font-size:11px;">Pkts: ${c.packets} • ${formatBytes(c.bytes)} • Port: ${c.port}</div>
        <div style="color:${t.dim};font-size:10px;margin-top:2px;">Last seen: ${c.lastSeen}</div>
      </div>`).join('');
  }else if(activeNetSubTab==='protocols'){
    const total=Object.values(protocolCounts).reduce((a,b)=>a+b,0)||1;
    const colors={TCP:'#00bfff',UDP:'#ffaa00',STUN:'#00ff88',WebRTC:'#ff69b4',DNS:'#aaffcc',HTTPS:'#7b68ee',Other:'#666'};
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;">
      ${Object.entries(protocolCounts).map(([proto,count])=>`
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="color:${colors[proto]||'#888'};font-weight:600;font-size:12px;">${proto}</span>
            <span style="color:${t.dim};font-size:11px;">${count} (${Math.round(count/total*100)}%)</span>
          </div>
          <div class="frostStatBar"><div class="frostStatBarFill" style="width:${Math.round(count/total*100)}%;background:${colors[proto]||'#888'};"></div></div>
        </div>`).join('')}
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;">
        <div style="font-size:11px;color:${t.text};">Total Packets: <b>${totalPackets}</b></div>
        <div style="font-size:11px;color:${t.sub};margin-top:4px;">Total Bytes: <b>${formatBytes(totalBytes)}</b></div>
      </div>
    </div>`;
  }else if(activeNetSubTab==='live'){
    const maxPPS=Math.max(...ppsHistory,1);
    const bars=ppsHistory.map(p=>`<div style="flex:1;background:${t.border};border-radius:2px 2px 0 0;height:${Math.round((p/maxPPS)*60)}px;min-height:2px;opacity:0.8;"></div>`).join('');
    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        ${[['PPS',ppsHistory[ppsHistory.length-1]||0,t.border],['Packets',totalPackets,'#00bfff'],['Bytes',formatBytes(totalBytes),'#ffaa00'],['Connections',netConnections.size,'#00cc66']].map(([l,v,c])=>`<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;"><div style="font-size:10px;color:${t.dim};margin-bottom:4px;">${l}</div><div style="font-size:18px;font-weight:700;color:${c};">${v}</div></div>`).join('')}
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;">
        <div style="font-size:10px;color:${t.dim};margin-bottom:8px;font-weight:500;">PACKETS/SEC (30s)</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:64px;">${bars}</div>
      </div>`;
  }else if(activeNetSubTab==='webrtc'){
    const s=webrtcStats;
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:${t.dim};margin-bottom:6px;font-weight:500;">STATE</div>
        <div style="font-size:16px;font-weight:700;color:${s.state==='Connected'?'#00cc66':t.border};">${s.state}</div>
      </div>
      ${[['🏠 Local Candidate',s.localCand],['🌐 Remote Candidate',s.remoteCand],['📶 Round Trip Time',s.rtt],['🎵 Audio Jitter',s.jitter],['⬆️ Bytes Sent',formatBytes(s.bytesSent)],['⬇️ Bytes Received',formatBytes(s.bytesReceived)]].map(([l,v])=>`<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:11px 12px;"><div style="font-size:10px;color:${t.dim};margin-bottom:3px;">${l}</div><div style="font-size:11px;color:${t.text};word-break:break-all;">${v}</div></div>`).join('')}
    </div>`;
  }
}

// ---- Event log ----
function updateEventLog(){
  const el=document.getElementById('eventContent');if(!el)return;
  if(eventLog.length===0){el.innerHTML='<div style="color:#443366;text-align:center;padding:20px 0;font-size:11px;">No events yet.</div>';return;}
  const colors={info:'#7b68ee',success:'#00cc66',warning:'#ffaa00',danger:'#ff3344'};
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
      ${[['Total Peers',sessionStats.total,'#c8b8ff'],['Skips',sessionStats.skips,'#ffaa00'],['VPN/DC',sessionStats.vpn,'#ff3344'],['Residential',sessionStats.residential,'#7b68ee'],['Mobile',sessionStats.mobile,'#00bfff'],['Tor',sessionStats.tor,'#ff8800']].map(([l,v,c])=>`<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;"><div style="font-size:10px;color:${t.dim};margin-bottom:4px;">${l}</div><div style="font-size:20px;font-weight:700;color:${c};">${v}</div></div>`).join('')}
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;letter-spacing:0.5px;margin-bottom:10px;">SESSION</div>
      ${[['⏱️ Session Time',formatDuration(Date.now()-sessionStartTime)],['🌍 Countries Seen',Object.keys(sessionStats.countries).length],['💬 Messages',sessionStats.messages]].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;"><span style="color:${t.dim};">${l}</span><span style="color:${t.text};font-weight:600;">${v}</span></div>`).join('')}
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;margin-bottom:10px;">TYPE BREAKDOWN</div>
      ${[['🔴 VPN/DC',Math.round(sessionStats.vpn/total*100),'#ff3344'],['🟢 Residential',Math.round(sessionStats.residential/total*100),'#7b68ee'],['📱 Mobile',Math.round(sessionStats.mobile/total*100),'#00bfff'],['🟡 Hosting',Math.round(sessionStats.hosting/total*100),'#ffaa00'],['🧅 Tor',Math.round(sessionStats.tor/total*100),'#ff8800']].map(([l,p,c])=>`<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span style="color:${t.sub};">${l}</span><span style="color:${c};font-weight:600;">${p}%</span></div>${bar(p,c)}</div>`).join('')}
    </div>
    ${topC.length>0?`<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;margin-bottom:10px;">TOP COUNTRIES</div>
      ${topC.map(([c,n])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;"><span style="color:${t.sub};">${COUNTRIES[c]||c}</span><span style="color:${t.border};font-weight:700;">${n}</span></div>`).join('')}
    </div>`:''}`;
}

// ---- Tab switching ----
document.querySelectorAll('.tabBtn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    activeTab=btn.dataset.tab;
    document.querySelectorAll('.tabBtn').forEach(b=>{
      const a=b.dataset.tab===activeTab;
      b.style.background=a?`${currentTheme.border}22`:'none';
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
  if(e.target.id==='paymentPopupToggle'||e.target.closest('#paymentPopupToggle')){
    disablePaymentPopups=!disablePaymentPopups;
    const tog=document.getElementById('paymentPopupToggle');
    if(tog){tog.style.background=disablePaymentPopups?currentTheme.border:'#1e1e2e';tog.style.borderColor=disablePaymentPopups?currentTheme.border:'rgba(255,255,255,0.1)';const k=tog.querySelector('.frostKnob');if(k){k.style.left=disablePaymentPopups?'20px':'3px';k.style.background=disablePaymentPopups?'#fff':'#555';}}
    if(disablePaymentPopups)enablePaymentBlocker();else disablePaymentBlocker();
    saveCookies();
  }
  // Embed tab clicks
  if(e.target.classList.contains('embed-tab-btn')){
    const tab=e.target.dataset.etab;
    if(!tab)return;
    embedActiveTab=tab;
    document.querySelectorAll('.embed-tab-btn').forEach(b=>{
      const a=b.dataset.etab===embedActiveTab;
      b.style.color=a?currentTheme.text:currentTheme.dim;
      b.style.borderBottom=a?`2px solid ${currentTheme.border}`:'2px solid transparent';
      b.style.background=a?`${currentTheme.border}18`:'transparent';
    });
    ['embedTabPeers','embedTabMap','embedTabStats'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
    const target=document.getElementById(`embedTab${tab.charAt(0).toUpperCase()+tab.slice(1)}`);
    if(target)target.style.display='block';
    if(tab==='map'&&embedLeafletMap)setTimeout(()=>embedLeafletMap.invalidateSize(),100);
    if(tab==='stats')updateEmbedStats();
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
  if(wrap.id==='autoSkipToggle'||wrap.id==='paymentPopupToggle')return;
  wrap.addEventListener('click',()=>{
    const key=wrap.dataset.key;if(!key||!settings[key])return;
    settings[key].val=!settings[key].val;
    const on=settings[key].val;
    wrap.style.background=on?currentTheme.border:'#1e1e2e';
    wrap.style.borderColor=on?currentTheme.border:'rgba(255,255,255,0.1)';
    const knob=wrap.querySelector('.frostKnob');if(knob){knob.style.left=on?'20px':'3px';knob.style.background=on?'#fff':'#555';}
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
  const asn=org?.split(' ')[0];const known=VPN_PROVIDERS[asn];
  if(known){if(known.type==='VPN'||known.type==='VPN_HOST')return'🔴 VPN/DC';if(known.type==='CLOUD')return'🟡 Hosting';if(known.type==='MOBILE')return'📱 Mobile';if(known.type==='ISP')return'🟢 Residential';}
  if(org?.toLowerCase().includes('vpn'))return'🔴 VPN';
  if(org?.toLowerCase().includes('hosting'))return'🟡 Hosting';
  if(org?.toLowerCase().includes('wireless')||org?.toLowerCase().includes('mobile'))return'📱 Mobile';
  return'🟢 Residential';
}
function getMarkerColor(p){if(p.type?.includes('🧅'))return'#ff8800';if(p.type?.includes('🔴'))return'#ff3344';if(p.type?.includes('🟡'))return'#ffaa00';if(p.type?.includes('📱'))return'#00bfff';return currentTheme.border;}

// ---- Float panel map ----
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
  m.bindPopup(`<div style="font-family:system-ui,sans-serif;font-size:11px;min-width:160px;line-height:1.6;"><b style="color:#c8b8ff;font-size:12px;">${p.ip}</b><br><span style="color:#9988cc;">${p.city}, ${p.region}</span><br>${p.country}<br><span style="color:#7b68ee;">${p.org}</span><br><span style="color:${color};font-weight:600;">${p.type}</span></div>`);
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
document.addEventListener('mousemove',e=>{if(!resizing)return;panel.style.width=Math.max(350,rw+(e.clientX-rox))+'px';panel.style.maxHeight=Math.max(400,rh+(e.clientY-roy))+'px';});
document.addEventListener('mouseup',()=>resizing=false);

// ---- Open/Close ----
function closePanel(){panel.style.display='none';dragon.style.display='block';overlay.style.display='none';}
function openPanel(){dragon.style.display='none';panel.style.display='flex';if(!settings.snapToEdge.val){panel.style.top='50%';panel.style.left='50%';panel.style.right='auto';panel.style.transform='translate(-50%,-50%)';}else applySnap();if(settings.darkOverlay.val)overlay.style.display='block';}
document.getElementById('ppClose').addEventListener('click',closePanel);

// ---- Copy/Export ----
document.getElementById('ppCopyAll').addEventListener('click',()=>{
  const text=peerLog.map((p,i)=>{const asn=lookupASN(p.org);const{score,reasons}=scoreConnection(p,asn);return[`--- Peer #${i+1} ---`,`IP:      ${p.ip}`,`Type:    ${p.label} ${p.type}`,`ASN:     ${asn?.name||'?'} — ${asn?.label||'?'} — Risk ${asn?.risk||0}/10`,`Quality: ${score}/5 (${reasons.join(', ')||'none'})`,`City:    ${p.city}, ${p.region}`,`Country: ${p.country}`,`ISP:     ${p.org}`,`Time:    ${p.time}`].join('\n');}).join('\n\n');
  navigator.clipboard.writeText(text||'No peers yet').then(()=>{const btn=document.getElementById('ppCopyAll');btn.textContent='✅';setTimeout(()=>btn.textContent='📋',1500);});
});
document.getElementById('ppExportBtn').addEventListener('click',()=>{
  const data={version:'0.2.3',peers:peerLog.map(p=>{const asn=lookupASN(p.org);const q=scoreConnection(p,asn);return{...p,asnInfo:asn,qualityScore:q.score,qualityReasons:q.reasons};}),events:eventLog,stats:sessionStats,connections:[...netConnections.values()],subnets:[...subnetMap.values()],protocols:protocolCounts,collection:getCollection()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`frosts_v023_${Date.now()}.json`;a.click();
  logEvent('info','Session exported');
});
document.getElementById('ppClear').addEventListener('click',()=>{
  document.getElementById('ppBody').innerHTML=`<div id="ppEmpty" style="color:#443366;text-align:center;padding:50px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;"><div style="font-size:40px;opacity:0.15;">🐉</div><div style="font-size:13px;color:#553366;">Waiting for peer connection...</div></div>`;
  seenIPs.clear();peerLog.length=0;peerCountFloat=0;activePeers.clear();subnetMap.clear();
  sessionStats={total:0,vpn:0,residential:0,mobile:0,hosting:0,tor:0,countries:{},totalTime:0,messages:0,skips:0,matches:0,longestConvo:0};
  document.getElementById('ppCount').textContent='Peers: 0';
  mapMarkers.forEach(m=>leafletMap&&leafletMap.removeLayer(m));mapMarkers.length=0;currentMapMarker=null;
  if(leafletMap)leafletMap.setView([20,0],2);
  clearEmbedContent();logEvent('info','Session cleared');
});
document.getElementById('ppClearHistory').addEventListener('click',()=>{try{localStorage.removeItem('frostPeerHistory');}catch(e){}const btn=document.getElementById('ppClearHistory');btn.textContent='✅ Cleared';setTimeout(()=>btn.textContent='🗑 History',1500);});

// ---- Add peer to float panel ----
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
  const vpnColor=settings.highlightVPN.val&&(p.type?.includes('🔴')||isTor)?'#ff3344':currentTheme.text;
  const t=currentTheme;

  const entry=document.createElement('div');
  entry.className='peerEntry';
  if(isBadASN&&settings.showBadASN.val)entry.classList.add('frost-bad-asn');
  if(isSubnetCluster&&settings.showSubnetAlert.val)entry.classList.add('frost-subnet-alert');
  if(isTarget)entry.classList.add('frost-country-match');
  entry.style.cssText=`border:1px solid ${color}22;border-left:3px solid ${color};border-radius:12px;padding:12px 14px;margin-bottom:8px;background:rgba(255,255,255,0.02);`;

  const badges=[];
  if(isTor&&settings.showTor.val)badges.push(`<span class="frost-badge" style="background:#ff880018;border-color:#ff880055;color:#ff8800;">🧅 TOR</span>`);
  if(seenCount>0&&settings.showRepeat.val)badges.push(`<span class="frost-badge" style="background:#ffaa0018;border-color:#ffaa0055;color:#ffaa00;">🔁 ${seenCount}x</span>`);
  if(p.privacyScore&&settings.showPrivacy.val)badges.push(`<span class="frost-badge" style="background:#ff334418;border-color:#ff334455;color:#ff6677;">🛡️ PROXY</span>`);
  if(isBadASN&&settings.showBadASN.val)badges.push(`<span class="frost-badge" style="background:#ff000018;border-color:#ff000055;color:#ff4455;">⚠️ BAD ASN</span>`);
  if(isSubnetCluster&&settings.showSubnetAlert.val)badges.push(`<span class="frost-badge" style="background:#ffaa0018;border-color:#ffaa0055;color:#ffaa00;">🕸️ CLUSTER</span>`);
  if(isTarget)badges.push(`<span class="frost-badge" style="background:#00cc6618;border-color:#00cc6655;color:#00cc66;">🎯 MATCH</span>`);

  let html=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0;flex-wrap:wrap;">
        ${p.flag?`<img src="${p.flag}" style="width:18px;height:13px;border-radius:3px;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.4);">`:''}
        <b style="color:${t.text};font-size:13px;word-break:break-all;">${p.label} ${p.ip}${settings.showPort.val&&p.port?`<span style="color:${t.dim};font-size:11px;font-weight:400;">:${p.port}</span>`:''}</b>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">
        <button onclick="addToCollection('${p.ip}',${JSON.stringify({city:p.city,region:p.region,country:p.country,org:p.org,type:p.type}).replace(/"/g,"'")})" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:${t.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:4px 8px;" title="Save to collection">📌</button>
        <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅');setTimeout(()=>this.textContent='📋',1500)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:${t.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:4px 8px;" title="Copy IP">📋</button>
      </div>
    </div>
    ${badges.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">${badges.join('')}</div>`:''}
    <div style="color:${vpnColor};font-size:11px;font-weight:500;margin-bottom:5px;">${isTor?'🧅 Tor Exit Node':p.type}${settings.showCandType.val?` <span style="color:${t.dim};font-weight:400;">• ${p.candType}</span>`:''}</div>
  `;

  if(!settings.compactMode.val){
    html+=`<div style="color:${t.sub};font-size:12px;">📍 ${p.city}, ${p.region} ${p.country}</div>`;
    html+=`<div style="color:${t.sub};font-size:12px;margin-top:3px;">🏢 ${p.org}</div>`;
    if(settings.showASNInfo.val&&asnInfo){
      html+=`<div class="asn-badge" style="background:${riskColor}18;border-color:${riskColor}44;color:${riskColor};margin-top:6px;">🏢 ${asnInfo.name} • ${asnInfo.label} • Risk ${asnInfo.risk}/10</div>`;
    }
    if(settings.showQualityScore.val){
      html+=`<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span class="quality-stars" style="color:${riskColor};font-size:13px;">${'★'.repeat(score)}${'☆'.repeat(5-score)}</span>
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
    html+=`<textarea class="peerNote" placeholder="Add a note..." rows="1" onfocus="this.rows=3" onblur="this.rows=1"></textarea>`;
  }else{
    html+=`<div style="color:${t.sub};font-size:11px;">📍 ${p.city}, ${p.country} • 🏢 ${p.org}</div>`;
    if(settings.showQualityScore.val)html+=`<span class="quality-stars" style="color:${riskColor};font-size:11px;margin-top:3px;display:block;">${'★'.repeat(score)}${'☆'.repeat(5-score)}</span>`;
  }

  entry.innerHTML=html;body.appendChild(entry);
  if(settings.autoScroll.val)body.scrollTop=body.scrollHeight;
  peerCountFloat++;document.getElementById('ppCount').textContent=`Peers: ${peerCountFloat}`;

  if(settings.showDuration.val){
    const startTime=Date.now();const durId=`dur_${p.ip.replace(/[:.]/g,'_')}`;const tlId=`tl_${p.ip.replace(/[:.]/g,'_')}`;
    const timer=setInterval(()=>{const el=document.getElementById(durId);const tl=document.getElementById(tlId);if(!el){clearInterval(timer);return;}const secs=Math.floor((Date.now()-startTime)/1000);const mins=Math.floor(secs/60);el.innerHTML=`⏱️ ${mins>0?mins+'m ':''}${secs%60}s <span class="liveDot" style="color:${color};">●</span>`;if(tl)tl.style.width=Math.min(100,(secs/300)*100)+'%';},1000);
    activePeers.set(p.ip,{timer,startTime});
  }
  if(leafletMap)addMapMarker(p,true);
  if(activeTab==='stats')updateStats();
}

// ---- WebRTC Stats ----
setInterval(()=>{if(!activePC)return;try{activePC.getStats().then(stats=>{stats.forEach(r=>{if(r.type==='candidate-pair'&&r.state==='succeeded'&&r.nominated){webrtcStats.rtt=r.currentRoundTripTime?(r.currentRoundTripTime*1000).toFixed(0)+'ms':'N/A';webrtcStats.bytesSent=r.bytesSent||0;webrtcStats.bytesReceived=r.bytesReceived||0;webrtcStats.state='Connected';const rem=stats.get(r.remoteCandidateId);const loc=stats.get(r.localCandidateId);if(rem)webrtcStats.remoteCand=`${rem.address}:${rem.port} (${rem.candidateType})`;if(loc)webrtcStats.localCand=`${loc.address}:${loc.port} (${loc.candidateType})`;}if(r.type==='inbound-rtp'&&r.kind==='audio')webrtcStats.jitter=r.jitter?(r.jitter*1000).toFixed(1)+'ms':'N/A';});});}catch(e){}},2000);
setInterval(()=>{ppsHistory.push(ppsCount);if(ppsHistory.length>30)ppsHistory.shift();ppsCount=0;if(activeNetSubTab==='live'&&activeTab==='network')updateNetContent();},1000);

// ---- Site theme ----
function applySiteTheme(t){
  let s=document.getElementById('frostSiteTheme');if(!s){s=document.createElement('style');s.id='frostSiteTheme';document.head.appendChild(s);}
  if(!settings.embedDarkMode.val){s.textContent='';return;}
  const c=t.site;
  s.textContent=`body{background:${c.body}!important;color:${c.text}!important;transition:background 0.3s,color 0.3s;}.main,.mainContent,.videoGrid{background:${c.body}!important;}.chatWindow{background:${c.chat}!important;}.rightBox,.outlined{border-color:${c.border}!important;background:${c.chat}!important;}.messageInput{background:${c.input}!important;color:${c.text}!important;border-color:${c.border}!important;}.sb{color:${c.accent}!important;}header,.header{background:${c.body}!important;border-color:${c.border}!important;}*{scrollbar-color:${c.accent} ${c.body};}::-webkit-scrollbar-track{background:${c.body}!important;}::-webkit-scrollbar-thumb{background:${c.accent}!important;border-radius:4px;}`;
}

// ---- Apply theme ----
function applyTheme(t){
  currentTheme=t;
  panel.style.borderColor=t.border;
  panel.style.boxShadow=`0 0 0 1px ${t.border}18,0 24px 48px rgba(0,0,0,0.8),0 0 80px ${t.border}10`;
  panel.style.color=t.text;panel.style.background=t.bg;
  dragon.style.filter=`drop-shadow(0 0 10px ${t.border})`;
  document.getElementById('pph').style.background=t.gradient;
  document.getElementById('ppTabs').style.background='rgba(0,0,0,0.3)';
  document.querySelectorAll('.frostToggle').forEach(w=>{if(w.id==='autoSkipToggle'||w.id==='paymentPopupToggle')return;const key=w.dataset.key;if(!key||!settings[key])return;const on=settings[key].val;w.style.background=on?t.border:'#1e1e2e';w.style.borderColor=on?t.border:'rgba(255,255,255,0.1)';const k=w.querySelector('.frostKnob');if(k){k.style.left=on?'20px':'3px';k.style.background=on?'#fff':'#555';}});
  document.querySelectorAll('.tabBtn').forEach(b=>{const a=b.dataset.tab===activeTab;b.style.color=a?t.text:t.dim;b.style.borderBottom=a?`2px solid ${t.border}`:'2px solid transparent';b.style.background=a?`${t.border}22`:'none';});
  document.querySelectorAll('.themeBtn').forEach(b=>{const active=themes[b.dataset.theme]===t;b.style.opacity=active?'1':'0.6';b.style.border=`1.5px solid ${themes[b.dataset.theme].border}${active?'':'44'}`;b.style.boxShadow=active?`0 0 14px ${themes[b.dataset.theme].border}44`:''});
  document.querySelectorAll('.netSubBtn').forEach(b=>{const a=b.dataset.net===activeNetSubTab;b.style.color=a?t.text:t.dim;b.style.borderBottom=a?`2px solid ${t.border}`:'2px solid transparent';b.style.background=a?'rgba(123,104,238,0.15)':'none';});
  if(embeddedMode){applySiteTheme(t);updateEmbedTheme(t);}
  saveCookies();
}

// ================================================================
//  ---- EMBED MODE — Fully Redesigned ----
// ================================================================

function buildEmbedUI(){
  const t=currentTheme;

  // Remove any existing embed
  const existing=document.getElementById('frostEmbedWrapper');if(existing)existing.remove();

  const wrap=document.createElement('div');
  wrap.id='frostEmbedWrapper';
  wrap.style.cssText=`
    width:100%;
    background:${t.bg};
    border-top:2px solid ${t.border};
    border-bottom:1px solid ${t.border}33;
    display:flex;
    flex-direction:column;
    overflow:hidden;
    transition:background 0.3s,border-color 0.3s;
    max-height:520px;
  `;

  wrap.innerHTML=`
    <!-- Top Bar -->
    <div id="embedTopBar" style="
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 16px;
      background:${t.gradient};
      border-bottom:1px solid ${t.border}22;
      flex-shrink:0;
    ">
      <!-- Left: branding + stats -->
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="display:flex;align-items:center;gap:7px;">
          <span style="font-size:18px;line-height:1;">🐉</span>
          <div>
            <div style="font-weight:700;font-size:13px;color:${t.text};letter-spacing:0.3px;line-height:1.2;">Frosts Tools</div>
            <div style="font-size:9px;color:${t.dim};letter-spacing:0.8px;">v0.2.3 • EMBEDDED</div>
          </div>
        </div>
        <!-- Stat pills -->
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <div class="embed-stat-pill" style="background:rgba(0,0,0,0.3);border:1px solid ${t.border}22;border-radius:8px;padding:3px 10px;font-size:10px;color:${t.dim};display:flex;align-items:center;gap:4px;">
            👥 <b id="eStatPeers" style="color:${t.text};">0</b>
          </div>
          <div class="embed-stat-pill" style="background:rgba(0,0,0,0.3);border:1px solid ${t.border}22;border-radius:8px;padding:3px 10px;font-size:10px;color:${t.dim};display:flex;align-items:center;gap:4px;">
            ⏱️ <span id="eStatTimer" style="color:${t.text};">0s</span>
          </div>
          <div class="embed-stat-pill" style="background:rgba(0,0,0,0.3);border:1px solid ${t.border}22;border-radius:8px;padding:3px 10px;font-size:10px;color:${t.dim};display:flex;align-items:center;gap:4px;">
            🌍 <span id="eStatCountries" style="color:${t.text};">0</span>
          </div>
          ${targetCountry?`<div class="embed-stat-pill" style="background:${t.border}18;border:1px solid ${t.border}44;border-radius:8px;padding:3px 10px;font-size:10px;color:${t.border};font-weight:600;">🎯 ${COUNTRIES[targetCountry]?.split(' ').slice(1).join(' ')||targetCountry}</div>`:''}
        </div>
      </div>
      <!-- Right: actions -->
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="eCopyAll" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:${t.text};cursor:pointer;font-size:11px;padding:5px 12px;border-radius:7px;font-family:inherit;font-weight:500;transition:background 0.15s;">📋 Copy</button>
        <button id="eClose" style="background:rgba(255,68,68,0.15);border:1px solid rgba(255,68,68,0.3);color:#ff7788;cursor:pointer;font-size:11px;padding:5px 12px;border-radius:7px;font-family:inherit;font-weight:500;transition:background 0.15s;">✕ Close</button>
      </div>
    </div>

    <!-- Tab Bar -->
    <div id="embedTabBar" style="
      display:flex;
      background:rgba(0,0,0,0.25);
      border-bottom:1px solid rgba(255,255,255,0.05);
      flex-shrink:0;
    ">
      <button class="embed-tab-btn" data-etab="peers" style="flex:1;padding:9px 8px;color:${t.text};border-bottom:2px solid ${t.border};background:${t.border}18;font-size:11px;font-weight:500;text-align:center;">👥 Peers</button>
      <button class="embed-tab-btn" data-etab="map" style="flex:1;padding:9px 8px;color:${t.dim};border-bottom:2px solid transparent;background:transparent;font-size:11px;font-weight:500;text-align:center;">🗺️ Map</button>
      <button class="embed-tab-btn" data-etab="stats" style="flex:1;padding:9px 8px;color:${t.dim};border-bottom:2px solid transparent;background:transparent;font-size:11px;font-weight:500;text-align:center;">📊 Stats</button>
    </div>

    <!-- Content area -->
    <div style="flex:1;overflow:hidden;position:relative;min-height:200px;max-height:400px;">

      <!-- Peers Tab -->
      <div id="embedTabPeers" style="height:100%;overflow-y:auto;padding:10px 12px;display:block;">
        <div id="embedPeerArea">
          <div id="embedEmpty" style="color:${t.dim};text-align:center;padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;">
            <span style="font-size:32px;opacity:0.2;">🐉</span>
            <span style="font-size:12px;">Waiting for peer connection...</span>
            <span style="font-size:10px;color:${t.dim};opacity:0.6;">Start a call — peer info appears here</span>
          </div>
        </div>
      </div>

      <!-- Map Tab -->
      <div id="embedTabMap" style="height:100%;display:none;position:relative;">
        <div id="embedMapContainer" style="width:100%;height:100%;min-height:200px;background:${t.header};"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:5px 10px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);font-size:9px;color:${t.dim};display:flex;gap:10px;z-index:1000;">
          <span>🟣 Residential</span><span>🔴 VPN/DC</span><span>🟡 Hosting</span><span>📱 Mobile</span><span>🧅 Tor</span>
        </div>
      </div>

      <!-- Stats Tab -->
      <div id="embedTabStats" style="height:100%;overflow-y:auto;padding:10px 12px;display:none;">
        <div id="embedStatsContent"><div style="color:${t.dim};text-align:center;padding:20px;font-size:12px;">No data yet.</div></div>
      </div>

    </div>
  `;

  return wrap;
}

function updateEmbedTheme(t){
  const wrap=document.getElementById('frostEmbedWrapper');if(!wrap)return;
  wrap.style.background=t.bg;wrap.style.borderTopColor=t.border;
  const topBar=document.getElementById('embedTopBar');if(topBar)topBar.style.background=t.gradient;
  document.querySelectorAll('.embed-tab-btn').forEach(b=>{
    const a=b.dataset.etab===embedActiveTab;
    b.style.color=a?t.text:t.dim;b.style.borderBottom=a?`2px solid ${t.border}`:'2px solid transparent';b.style.background=a?`${t.border}18`:'transparent';
  });
}

function updateEmbedStats(){
  const el=document.getElementById('embedStatsContent');if(!el)return;
  const t=currentTheme;const total=peerLog.length;
  if(total===0){el.innerHTML=`<div style="color:${t.dim};text-align:center;padding:20px;font-size:12px;">No data yet.</div>`;return;}
  const bar=(pct,color)=>`<div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:3px;"><div style="width:${pct}%;height:100%;background:${color};border-radius:2px;transition:width 0.5s;"></div></div>`;
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">
      ${[['Total',total,'#c8b8ff'],['VPN/DC',sessionStats.vpn,'#ff3344'],['Residential',sessionStats.residential,'#7b68ee'],['Mobile',sessionStats.mobile,'#00bfff'],['Hosting',sessionStats.hosting,'#ffaa00'],['Tor',sessionStats.tor,'#ff8800']].map(([l,v,c])=>`<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:8px 10px;"><div style="font-size:9px;color:${t.dim};margin-bottom:2px;">${l}</div><div style="font-size:16px;font-weight:700;color:${c};">${v}</div></div>`).join('')}
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px;margin-bottom:8px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;margin-bottom:8px;">TYPE BREAKDOWN</div>
      ${[['🔴 VPN/DC',Math.round(sessionStats.vpn/total*100),'#ff3344'],['🟢 Residential',Math.round(sessionStats.residential/total*100),'#7b68ee'],['📱 Mobile',Math.round(sessionStats.mobile/total*100),'#00bfff'],['🟡 Hosting',Math.round(sessionStats.hosting/total*100),'#ffaa00']].map(([l,p,c])=>`<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span style="color:${t.sub};">${l}</span><span style="color:${c};font-weight:600;">${p}%</span></div>${bar(p,c)}</div>`).join('')}
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px;">
      <div style="font-size:10px;color:${t.dim};font-weight:600;margin-bottom:6px;">TIMELINE</div>
      <div style="display:flex;flex-direction:column;gap:3px;max-height:100px;overflow-y:auto;">
        ${peerLog.map(p=>`<div style="display:flex;align-items:center;gap:6px;font-size:10px;"><div style="width:5px;height:5px;border-radius:50%;background:${getMarkerColor(p)};flex-shrink:0;"></div><span style="color:${t.dim};">${p.time}</span><span style="color:${t.text};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.ip}</span><span style="color:${t.dim};">${p.city||'?'}</span></div>`).join('')}
      </div>
    </div>
  `;
}

function clearEmbedContent(){
  const area=document.getElementById('embedPeerArea');
  const t=currentTheme;
  if(area)area.innerHTML=`<div id="embedEmpty" style="color:${t.dim};text-align:center;padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;"><span style="font-size:32px;opacity:0.2;">🐉</span><span style="font-size:12px;">Waiting for peer connection...</span></div>`;
  const cnt=document.getElementById('eStatPeers');if(cnt)cnt.textContent='0';
  embedMapMarkers.forEach(m=>embedLeafletMap&&embedLeafletMap.removeLayer(m));
  embedMapMarkers.length=0;embedCurrentMarker=null;
  if(embedLeafletMap)embedLeafletMap.setView([20,0],2);
}

// ---- Embed map (lazy init on map tab click) ----
function initEmbedMap(){
  if(embedMapLoaded)return;
  embedMapLoaded=true;
  if(!document.querySelector('link[href*="leaflet"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
  if(window.L){setupEmbedMap();return;}
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=setupEmbedMap;document.head.appendChild(s);
}

function setupEmbedMap(){
  const container=document.getElementById('embedMapContainer');if(!container)return;
  container.style.height='100%';
  embedLeafletMap=L.map('embedMapContainer',{zoomControl:true,attributionControl:false,scrollWheelZoom:true}).setView([20,0],2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(embedLeafletMap);
  peerLog.forEach(p=>addEmbedMapMarker(p,false));
  if(peerLog.length>0)flyEmbedMap();
  setTimeout(()=>embedLeafletMap.invalidateSize(),100);
}

function addEmbedMapMarker(p,fly=true){
  if(!embedLeafletMap||!p.loc||p.loc==='?')return;
  const[lat,lon]=p.loc.split(',').map(Number);if(isNaN(lat)||isNaN(lon))return;
  const color=getMarkerColor(p);
  const icon=L.divIcon({className:'',html:`<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 8px ${color};"></div>`,iconSize:[12,12],iconAnchor:[6,6]});
  const m=L.marker([lat,lon],{icon}).addTo(embedLeafletMap);
  const asnInfo=lookupASN(p.org);const{score}=scoreConnection(p,asnInfo);
  m.bindPopup(`<div style="font-family:system-ui,sans-serif;font-size:11px;min-width:170px;line-height:1.7;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      ${p.flag?`<img src="${p.flag}" style="width:16px;height:12px;border-radius:2px;">`:''}
      <b style="color:#c8b8ff;font-size:12px;">${p.ip}</b>
    </div>
    <div style="color:#9988cc;">${p.city}, ${p.region}</div>
    <div style="color:#9988cc;">${p.country}</div>
    <div style="color:#7b68ee;font-size:10px;margin-top:2px;">${p.org}</div>
    <div style="color:${color};font-weight:600;margin-top:2px;">${p.type}</div>
    ${asnInfo?`<div style="color:${getRiskColor(asnInfo.risk)};font-size:10px;">🏢 ${asnInfo.name} • Risk ${asnInfo.risk}/10</div>`:''}
    <div style="color:#443366;font-size:10px;margin-top:2px;">⭐ ${score}/5 • 🕐 ${p.time}</div>
  </div>`);
  embedMapMarkers.push(m);embedCurrentMarker=m;
  if(fly)flyEmbedMap();
}

function flyEmbedMap(){
  if(!embedLeafletMap||!embedCurrentMarker)return;
  embedLeafletMap.flyTo(embedCurrentMarker.getLatLng(),7,{animate:true,duration:1.0});
  setTimeout(()=>{embedCurrentMarker.openPopup();},1100);
}

// ---- Add peer card to embed ----
function addEmbedPeerCard(p){
  const area=document.getElementById('embedPeerArea');if(!area)return;
  const empty=document.getElementById('embedEmpty');if(empty)empty.remove();
  if(!settings.showAll.val){
    area.innerHTML='';
    const cnt=document.getElementById('eStatPeers');if(cnt)cnt.textContent='0';
  }
  const t=currentTheme;
  const color=getMarkerColor(p);
  const isTor=torExits.has(p.ip);
  const seenCount=getSeenCount(p.ip);
  const asnInfo=lookupASN(p.org);
  const{score}=scoreConnection(p,asnInfo);
  const riskColor=asnInfo?getRiskColor(asnInfo.risk):'#666';
  const isMatch=targetCountry&&p.country===targetCountry;
  const isBadASN=asnInfo&&BAD_ASNS.has(p.org?.split(' ')[0]);

  const card=document.createElement('div');
  card.className='embed-peer-card';
  card.style.cssText=`
    background:rgba(255,255,255,0.03);
    border:1px solid ${isMatch?'rgba(0,204,102,0.3)':isBadASN?'rgba(255,51,68,0.25)':color+'22'};
    border-left:3px solid ${color};
    border-radius:10px;
    padding:12px 14px;
    margin-bottom:8px;
    ${isMatch?`box-shadow:0 0 12px rgba(0,204,102,0.15);`:''}
    ${isBadASN?`animation:badASN 1.5s ease infinite;`:''}
  `;

  const badges=[];
  if(isMatch)badges.push(`<span class="embed-badge" style="background:rgba(0,204,102,0.12);border-color:rgba(0,204,102,0.4);color:#00cc66;">🎯 MATCH</span>`);
  if(isBadASN)badges.push(`<span class="embed-badge" style="background:rgba(255,51,68,0.12);border-color:rgba(255,51,68,0.4);color:#ff5566;">⚠️ BAD ASN</span>`);
  if(isTor)badges.push(`<span class="embed-badge" style="background:rgba(255,136,0,0.12);border-color:rgba(255,136,0,0.4);color:#ff8800;">🧅 TOR</span>`);
  if(seenCount>0)badges.push(`<span class="embed-badge" style="background:rgba(255,170,0,0.12);border-color:rgba(255,170,0,0.4);color:#ffaa00;">🔁 ${seenCount}x</span>`);

  card.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0;">
        ${p.flag?`<img src="${p.flag}" style="width:18px;height:13px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.4);">`:''}
        <div>
          <div style="font-weight:700;color:${t.text};font-size:13px;word-break:break-all;">${p.label} ${p.ip}</div>
          <div style="color:${isTor?'#ff8800':color};font-size:11px;font-weight:500;margin-top:1px;">${isTor?'🧅 Tor Exit Node':p.type}</div>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">
        ${settings.showQualityScore.val?`<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 7px;font-size:10px;color:${riskColor};font-weight:700;">${score}/5</div>`:''}
        <button onclick="navigator.clipboard.writeText('${p.ip}').then(()=>this.textContent='✅');setTimeout(()=>this.textContent='📋',1500)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:${t.dim};cursor:pointer;font-size:11px;border-radius:6px;padding:3px 8px;" title="Copy IP">📋</button>
      </div>
    </div>

    ${badges.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">${badges.join('')}</div>`:''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:${t.sub};margin-bottom:5px;">
      <div>📍 ${p.city}, ${p.region}</div>
      <div>🌍 ${p.country}</div>
      <div style="grid-column:1/-1;">🏢 ${p.org}</div>
    </div>

    ${asnInfo&&settings.showASNInfo.val?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;padding:4px 8px;background:${riskColor}12;border:1px solid ${riskColor}33;border-radius:6px;">
      <span style="color:${riskColor};font-size:10px;font-weight:600;">🏢 ${asnInfo.name}</span>
      <span style="color:${t.dim};font-size:9px;">Risk ${asnInfo.risk}/10 — ${getRiskLabel(asnInfo.risk)}</span>
    </div>`:''}

    ${settings.showQualityScore.val?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
      <span style="color:${riskColor};font-size:12px;letter-spacing:2px;">${'★'.repeat(score)}${'☆'.repeat(5-score)}</span>
      <span style="font-size:10px;color:${t.dim};">${score}/5 quality score</span>
    </div>`:''}

    <div style="display:flex;gap:10px;font-size:10px;color:${t.dim};flex-wrap:wrap;">
      <span>🕐 ${p.time}</span>
      ${settings.showCoords.val&&p.loc!=='?'?`<span>🌐 ${p.loc}</span>`:''}
      ${settings.showPort.val&&p.port!=='?'?`<span>🔌 :${p.port}</span>`:''}
    </div>

    ${settings.showDuration.val?`
      <div style="margin-top:6px;display:flex;align-items:center;gap:6px;">
        <div id="edur_${p.ip.replace(/[:.]/g,'_')}" style="font-size:10px;color:${t.dim};">⏱️ 0s</div>
        <span class="liveDot" style="color:${color};font-size:8px;">●</span>
      </div>
      <div style="height:2px;background:rgba(255,255,255,0.05);border-radius:1px;margin-top:5px;overflow:hidden;">
        <div id="etl_${p.ip.replace(/[:.]/g,'_')}" style="height:100%;width:0%;background:${color};border-radius:1px;transition:width 0.5s;"></div>
      </div>
    `:''}
  `;

  area.appendChild(card);

  // Update peer count
  const cnt=document.getElementById('eStatPeers');
  if(cnt)cnt.textContent=parseInt(cnt.textContent||'0')+1;
  // Update countries
  const cntEl=document.getElementById('eStatCountries');
  if(cntEl)cntEl.textContent=countryCollection.size;

  // Duration timer
  if(settings.showDuration.val){
    const startTime=Date.now();
    const durId=`edur_${p.ip.replace(/[:.]/g,'_')}`;
    const tlId=`etl_${p.ip.replace(/[:.]/g,'_')}`;
    setInterval(()=>{
      const el=document.getElementById(durId);const tl=document.getElementById(tlId);if(!el)return;
      const secs=Math.floor((Date.now()-startTime)/1000);const mins=Math.floor(secs/60);
      el.textContent=`⏱️ ${mins>0?mins+'m ':''}${secs%60}s`;
      if(tl)tl.style.width=Math.min(100,(secs/300)*100)+'%';
    },1000);
  }

  // Auto scroll peer list
  const peerTab=document.getElementById('embedTabPeers');
  if(peerTab)peerTab.scrollTop=peerTab.scrollHeight;

  // Notify map
  addEmbedMapMarker(p,true);
  // Update stats if visible
  if(embedActiveTab==='stats')updateEmbedStats();
}

// Session timer for embed
setInterval(()=>{
  const el=document.getElementById('eStatTimer');
  if(el)el.textContent=formatDuration(Date.now()-sessionStartTime);
},1000);

function enableEmbedMode(){
  if(embeddedMode)return;
  const chatWindow=document.querySelector('.chatWindow');
  if(!chatWindow){alert('Could not find .chatWindow — make sure you\'re on umingle.com/video/');return;}
  embeddedMode=true;
  embedActiveTab='peers';
  const btn=document.getElementById('ppEmbedBtn');
  btn.textContent='✅ Embedded';
  btn.style.background='linear-gradient(135deg,rgba(0,204,102,0.2),rgba(0,204,102,0.35))';
  btn.style.borderColor='rgba(0,204,102,0.5)';

  const wrap=buildEmbedUI();
  chatWindow.insertBefore(wrap,chatWindow.firstChild);

  // Copy all button
  document.getElementById('eCopyAll').addEventListener('click',()=>{
    const text=peerLog.map((p,i)=>{const asn=lookupASN(p.org);const{score}=scoreConnection(p,asn);return[`--- Peer #${i+1} ---`,`IP: ${p.ip}`,`Type: ${p.type}`,`ASN: ${asn?.name||'?'} (Risk ${asn?.risk||0}/10)`,`Quality: ${score}/5`,`City: ${p.city}, ${p.country}`,`ISP: ${p.org}`,`Time: ${p.time}`].join('\n');}).join('\n\n');
    navigator.clipboard.writeText(text||'No peers yet').then(()=>{const b=document.getElementById('eCopyAll');b.textContent='✅ Copied';setTimeout(()=>b.textContent='📋 Copy',1500);});
  });

  // Close button
  document.getElementById('eClose').addEventListener('click',()=>{
    const el=document.getElementById('frostEmbedWrapper');if(el)el.remove();
    embeddedMode=false;embedMapLoaded=false;embedLeafletMap=null;
    embedMapMarkers.length=0;embedCurrentMarker=null;
    const btn=document.getElementById('ppEmbedBtn');
    btn.textContent='🔗 Embed';
    btn.style.background='linear-gradient(135deg,rgba(123,104,238,0.2),rgba(123,104,238,0.35))';
    btn.style.borderColor='rgba(123,104,238,0.5)';
    const s=document.getElementById('frostSiteTheme');if(s)s.textContent='';
  });

  // Apply site theme
  applySiteTheme(currentTheme);
  if(disablePaymentPopups)enablePaymentBlocker();

  // Restore any existing peers
  peerLog.forEach(p=>{addEmbedPeerCard(p);});

  logEvent('success','Embedded into site');
  closePanel();
}

// Override map tab click to init map lazily
const origClickHandler=document.onclick;
document.addEventListener('click',e=>{
  if(e.target.classList.contains('embed-tab-btn')&&e.target.dataset.etab==='map'){
    if(!embedMapLoaded)initEmbedMap();
  }
});

document.getElementById('ppEmbedBtn').addEventListener('click',enableEmbedMode);

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
  if(isPrivateIP(ip))return;
  if(!settings.showCloudflare.val&&isCloudflare(ip))return;
  if(!settings.showIPv6.val&&isIPv6(ip))return;
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
    if(embeddedMode)addEmbedPeerCard(p);

    const{score}=scoreConnection(p,asnInfo);
    logEvent('success',`Peer: ${ip} — ${p.city}, ${p.country} | ${p.type} | ⭐${score}/5`);

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

// ---- Hook ----
window.RTCPeerConnection=function(...args){
  const pc=new origPC(...args);activePC=pc;
  pc.addEventListener('connectionstatechange',()=>{
    webrtcStats.state=pc.connectionState;logEvent('info',`WebRTC: ${pc.connectionState}`);
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
      if(ip&&!isPrivateIP(ip)){const key=`${ip}:${port}`;if(!netConnections.has(key))netConnections.set(key,{remote:ip,port,protocol:e.candidate.protocol?.toUpperCase()||'UDP',packets:0,bytes:0,duration:0,started:Date.now(),lastSeen:new Date().toLocaleTimeString(),color:currentTheme.border});const conn=netConnections.get(key);conn.packets++;conn.bytes+=100;conn.lastSeen=new Date().toLocaleTimeString();conn.duration=Date.now()-conn.started;}
    }
  });
  setInterval(async()=>{
    const stats=await pc.getStats();
    stats.forEach(r=>{
      if(r.type==='remote-candidate'&&r.address&&!seenIPs.has(r.address)){
        if(isPrivateIP(r.address))return;
        if(r.candidateType==='host'&&!r.address.includes(':'))return;
        seenIPs.add(r.address);geoIP(r.address,r.port,r.candidateType);
      }
      if(r.type==='inbound-rtp'||r.type==='outbound-rtp'){totalPackets++;ppsCount++;totalBytes+=r.bytesReceived||r.bytesSent||0;}
    });
  },2000);
  return pc;
};

if(disablePaymentPopups)enablePaymentBlocker();
applyTheme(currentTheme);
if(settings.snapToEdge.val)applySnap();
logEvent('success','Frosts Tools v0.2.3 ready');
console.log('%c[🐉 Frosts Tools v0.2.3 — Embed Redesign]','color:#7b68ee;font-weight:bold;font-size:14px;');
