# Frosts Tools | Umingle

> A WebRTC peer inspection and UI reskin tool for [umingle.com/video](https://umingle.com/video/). Captures peer IP addresses from WebRTC ICE candidates, geolocates them, detects VPNs and Tor exit nodes, and reskins Umingle with a clean dark purple interface — all without breaking Umingle's functionality.

---

## What It Does

- **WebRTC Interception** — Hooks into `RTCPeerConnection` before Umingle's JavaScript runs, intercepting ICE candidates to extract the peer's real IP address
- **IP Geolocation** — Looks up country, city, and coordinates for each captured IP
- **ASN / ISP Detection** — Identifies the peer's internet provider
- **VPN Detection** — Flags IPs belonging to known VPN providers
- **Tor Exit Node Detection** — Identifies if the peer is routing through Tor
- **Live Map** — Leaflet.js map displaying the peer's approximate location
- **Data Export** — Export all collected peer data from the panel
- **UI Reskin** — Replaces Umingle's default styling with the Frosts Tools dark purple theme, removes all premium/payment upsells

---

## Installation

There are two ways to run Frosts Tools. Both work directly on `umingle.com/video/` — no extension or install required.

---

### Method 1 — Bookmarklet (Recommended)

A bookmarklet lets you run the tool on any visit with a single click from your bookmarks bar.

**Setup (one time):**

1. Copy the entire contents of `frosts-console.js`
2. In your browser, create a new bookmark (right-click the bookmarks bar → *Add page...* or *Add bookmark*)
3. Set the **Name** to anything you want, e.g. `Frosts Tools`
4. In the **URL field**, delete whatever is there and type `javascript:` followed immediately by pasting the entire script

   It should look like:
   ```
   javascript:(() => { /* ...entire script... */ })();
   ```
5. Save the bookmark

**Using it:**

1. Go to `https://umingle.com/video/`
2. Click the **Frosts Tools** bookmark in your bookmarks bar
3. The reskin and WebRTC sniffer panel will activate instantly

> **Note:** Some browsers (Firefox) may strip the `javascript:` prefix when you paste into the URL field. If that happens, type `javascript:` manually first, then paste the rest of the script after it.

---

### Method 2 — Browser Console

No setup needed. Works any time you have DevTools open.

**Steps:**

1. Go to `https://umingle.com/video/`
2. Open DevTools — press `F12` (Windows/Linux) or `Cmd + Option + I` (Mac)
3. Click the **Console** tab
4. Copy the entire contents of `frosts-console.js`
5. Paste into the console input at the bottom and press `Enter`
6. You'll see this confirmation message when it's working:

   ```
   ✅ Frosts Tools reskin applied
   ```

> **Tip:** You'll need to re-paste after each page reload. Use the bookmarklet method if you want one-click activation.

---

## Files

| File | Description |
|------|-------------|
| `frosts-console.js` | Main script — paste into console or use as bookmarklet |
| `frosts-umingle.html` | Standalone HTML preview of the Frosts UI design |

---

## Requirements

- A modern browser (Chrome, Edge, Firefox, Brave)
- No accounts, extensions, or API keys needed for basic use
- Some geolocation/ASN features may use a free IP lookup API — see the script header for details

---

## Notes

- Umingle's camera, microphone, Start, Skip, Stop, and chat all continue to work normally. Frosts Tools only observes WebRTC connections and reskins the UI — it does not interfere with Umingle's backend
- Payment and premium upsell elements are hidden automatically
- Re-run the script after skipping to a new stranger if ICE candidates are not being captured (Umingle reinitializes `RTCPeerConnection` on each skip)

---

## Disclaimer

This tool is built for educational and network research purposes. Use responsibly and in accordance with Umingle's terms of service and applicable laws.

---

*Built by [FrostsDev2](https://github.com/FrostsDev2)*
