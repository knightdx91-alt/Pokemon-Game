# Access .onion links in Chrome on Android (cell data, no app)

> **Two ways to reach onion sites on this VPS — pick one:**
> 1. **This doc: the built-in Android IKEv2 VPN.** Turn on the VPN and `.onion`
>    addresses open in plain Chrome; everything else stays fast/un-torified.
> 2. **The Onion Reader gateway** (`onion-gateway/`, deploy guide in
>    `onion-gateway/DEPLOY.md`). A web page on the VPS (port 8888) where you paste
>    an onion link — no VPN toggle, works on any device/browser, and adds
>    bookmarks, a 🔄 New-IP button, live-chat WebSockets, and a headless-Chromium
>    render mode. This is the actively-developed path.
>
> Both run on the same Tor install and can coexist (the VPN torifies `.onion` at
> the network layer; the gateway fetches pages server-side and rewrites links).

Goal: open `.onion` links in **plain Chrome on Android over cell data**, with
**no app installed** on the phone, using your **Contabo Ubuntu VPS**.

This uses Android's **built-in** IKEv2 VPN client (part of Settings, not an app).
When the VPN is on, only `.onion` traffic is routed through Tor on the VPS;
everything else goes out normally at full speed.

```
Chrome (cell data)
  → Android built-in IKEv2 VPN
    → Contabo VPS (strongSwan)
      → *.onion ? ─yes→ Tor → onion service
                  └─no → normal internet (direct, fast)
```

## Why this design (and not a proxy)

- Android's **manual proxy** field only exists on **Wi-Fi**, not cell data — so a
  proxy is out for you.
- Android's **VPN** client works on cell data and is built in — so a VPN is the
  only no-app route that works on cellular.
- We torify **only** `.onion` so normal browsing stays fast and un-anonymized.

## 1. Run the setup on the VPS

SSH into the Contabo VPS as root and run:

```bash
sudo bash vps-onion-vpn-setup.sh
```

Optionally set your own credentials:

```bash
sudo VPN_USER=me VPN_PASS='a-strong-password' bash vps-onion-vpn-setup.sh
```

The script installs strongSwan + Tor + dnsmasq, generates a CA + server
certificate (with your VPS IP baked in), configures Tor's transparent proxy and
`.onion`-only routing, sets up NAT/firewall, and prints the exact phone settings
plus the generated username/password at the end.

What it configures:

| Piece | Role |
|-------|------|
| **strongSwan** | IKEv2 VPN server that terminates the phone's tunnel |
| **Tor** | `TransPort`/`DNSPort` + `VirtualAddrNetwork 10.192.0.0/10` for `.onion` |
| **dnsmasq** | split DNS: `.onion` → Tor, everything else → 1.1.1.1/8.8.8.8 |
| **iptables** | redirect `.onion` virtual IPs to Tor; NAT the rest straight out |

## 2. Install the CA certificate on the phone

The script saves the CA cert to `/root/onion-vpn-ca.pem`. Get it onto the phone
(email it to yourself and open the attachment is easiest):

```bash
cat /root/onion-vpn-ca.pem      # copy, or send the file to yourself
```

On the phone: **Settings → Security → Encryption & credentials → Install a
certificate → CA certificate**, then pick the `.pem`. (Wording varies by phone;
search settings for "Install a certificate".)

## 3. Add the VPN (built-in, no app)

**Settings → Network & internet → VPN → + (Add VPN)**

| Field | Value |
|-------|-------|
| Name | `Onion` |
| Type | **IKEv2/IPSec MSCHAPv2** |
| Server address | *your VPS public IP* |
| IPSec identifier | *(leave blank)* |
| IPSec CA certificate | the one you installed (or "Received from server") |
| Username | *from the script output* |
| Password | *from the script output* |

Save.

## 4. Use it

Toggle the **Onion** VPN on, open Chrome, and visit any `.onion`, e.g. the
DuckDuckGo onion:

```
https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion
```

## Verifying / troubleshooting

- **Prove Tor works on the VPS** (before touching the phone):
  ```bash
  curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/ | grep -i congrat
  ```
- **VPN connects but `.onion` won't load:** check services are up —
  `systemctl status tor dnsmasq strongswan-starter` — and that the phone's DNS is
  the VPS (`10.10.10.1`). `.onion` resolution depends on dnsmasq → Tor.
- **VPN won't connect at all:** confirm the CA cert is installed and UDP **500**
  and **4500** reach the VPS (Contabo panel firewall + the script's iptables
  rules). Check `journalctl -u strongswan-starter -f` while connecting.
- **Normal sites slow/broken with VPN on:** that shouldn't happen — only `.onion`
  is torified. If it does, verify the `MASQUERADE` rule targets your real WAN
  interface (the script auto-detects it; re-run if the interface name changed).

## Notes & caveats

- Toggle the VPN **on** only when you want onion access; Android can auto-reconnect
  it. With it off, the phone behaves normally.
- Onion sites see your **VPS's Tor exit**, which is how Tor is supposed to work.
- This is a personal, single-user gateway. Keep the VPS patched
  (`apt update && apt upgrade`). The VPN password is your only credential — keep it
  private.
- Contabo is fine for this; needs a public IPv4 (default) and root SSH.
