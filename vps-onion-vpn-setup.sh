#!/usr/bin/env bash
#
# vps-onion-vpn-setup.sh
# ----------------------
# Turn a fresh Contabo Ubuntu VPS into a built-in-Android VPN that lets you open
# .onion links in plain Chrome over CELL DATA — with NO app installed on the phone.
#
# You configure the VPN once in Android's own Settings (Network > VPN > IKEv2/IPSec
# MSCHAPv2). When the VPN toggle is on:
#     - .onion addresses  -> routed through Tor (so they resolve & load)
#     - everything else    -> goes straight out the VPS at full speed (NOT torified)
#
# Flow:
#   Chrome (cell data)
#     -> Android built-in IKEv2 VPN tunnel
#       -> this VPS (strongSwan)
#         -> *.onion ? --yes--> Tor (DNSPort/TransPort) --> onion service
#                      --no---> normal internet (direct, fast)
#
# Requirements: Ubuntu 20.04/22.04/24.04, run as root, IPv4 public IP.
#
# Usage:
#   sudo bash vps-onion-vpn-setup.sh
#   (optionally: sudo VPN_USER=me VPN_PASS='mypassword' bash vps-onion-vpn-setup.sh)
#
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root:  sudo bash $0" >&2; exit 1
fi

# ---- config ----------------------------------------------------------------
VPN_USER="${VPN_USER:-onion}"
VPN_PASS="${VPN_PASS:-$(head -c12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c14)}"
VPN_POOL="10.10.10.0/24"            # internal IP range handed to phones
VPN_DNS="10.10.10.1"               # phones use the VPS itself for DNS
TOR_TRANS_PORT=9040
TOR_DNS_PORT=5353
ONION_NET="10.192.0.0/10"          # Tor's virtual address space for .onion

PUBLIC_IP="$(curl -fsS https://ifconfig.me || curl -fsS https://api.ipify.org)"
WAN_IF="$(ip route show default | awk '/default/ {print $5; exit}')"

echo "==> Public IP: ${PUBLIC_IP}    WAN interface: ${WAN_IF}"
[[ -n "$PUBLIC_IP" && -n "$WAN_IF" ]] || { echo "Could not detect IP/interface" >&2; exit 1; }

# ---- packages --------------------------------------------------------------
echo "==> Installing strongSwan, Tor, dnsmasq, iptables-persistent..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | debconf-set-selections
apt-get install -y strongswan strongswan-pki libcharon-extra-plugins \
                   libstrongswan-extra-plugins tor dnsmasq iptables-persistent curl

# ---- disable strongSwan's TPM plugin (fails to load libtss2 on many VPS) ----
mkdir -p /etc/strongswan.d/charon
printf 'tpm {\n    load = no\n}\n' > /etc/strongswan.d/charon/tpm.conf

# ---- certificates (server auth = cert, phone auth = username/password) ------
# Generated with OpenSSL (not `ipsec pki`) to avoid strongSwan plugin issues.
echo "==> Generating CA + server certificate (SAN = ${PUBLIC_IP})..."
mkdir -p /etc/ipsec.d/{cacerts,certs,private}
cd /etc/ipsec.d

# CA
openssl req -x509 -new -nodes -sha256 -days 3650 \
    -newkey rsa:4096 -keyout private/ca-key.pem \
    -subj "/CN=Onion VPN CA" -out cacerts/ca-cert.pem

# Server key + CSR
openssl req -new -nodes -sha256 \
    -newkey rsa:4096 -keyout private/server-key.pem \
    -subj "/CN=${PUBLIC_IP}" -out /tmp/server.csr

# Sign server cert with SAN = the VPS IP + serverAuth EKU
openssl x509 -req -sha256 -days 3650 \
    -in /tmp/server.csr \
    -CA cacerts/ca-cert.pem -CAkey private/ca-key.pem -CAcreateserial \
    -out certs/server-cert.pem \
    -extfile <(printf "subjectAltName=IP:%s\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n" "${PUBLIC_IP}")
rm -f /tmp/server.csr
chmod 600 private/*.pem

# ---- strongSwan config -----------------------------------------------------
echo "==> Writing /etc/ipsec.conf ..."
cat > /etc/ipsec.conf <<EOF
config setup
    uniqueids=no

conn ikev2-onion
    auto=add
    keyexchange=ikev2
    dpdaction=clear
    dpddelay=300s
    rekey=no
    fragmentation=yes
    left=%any
    leftid=${PUBLIC_IP}
    leftcert=server-cert.pem
    leftsendcert=always
    leftauth=pubkey
    leftsubnet=0.0.0.0/0
    right=%any
    rightid=%any
    rightauth=eap-mschapv2
    rightsourceip=${VPN_POOL}
    rightdns=${VPN_DNS}
    eap_identity=%identity
    ike=aes256-sha256-modp2048,aes256-sha1-modp1024,aes128-sha1-modp1024!
    esp=aes256-sha256,aes256-sha1,aes128-sha1!
EOF

cat > /etc/ipsec.secrets <<EOF
: RSA server-key.pem
${VPN_USER} : EAP "${VPN_PASS}"
EOF
chmod 600 /etc/ipsec.secrets

# ---- Tor: transparent proxy + onion DNS ------------------------------------
echo "==> Configuring Tor transparent proxy..."
if ! grep -q "onion VPN gateway" /etc/tor/torrc; then
cat >> /etc/tor/torrc <<EOF

## --- onion VPN gateway (added by vps-onion-vpn-setup.sh) ---
VirtualAddrNetwork ${ONION_NET}
AutomapHostsOnResolve 1
AutomapHostsSuffixes .onion,.exit
TransPort 127.0.0.1:${TOR_TRANS_PORT}
DNSPort 127.0.0.1:${TOR_DNS_PORT}
EOF
fi

# ---- gateway IP: the VPN's 10.10.10.1 must exist locally so dnsmasq can bind
echo "==> Creating VPN gateway IP ${VPN_DNS} (dummy interface, persistent)..."
cat > /etc/systemd/system/onion-gw-ip.service <<EOF
[Unit]
Description=Onion VPN gateway dummy IP
After=network.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'ip link add onion0 type dummy 2>/dev/null; ip addr add ${VPN_DNS}/24 dev onion0 2>/dev/null; ip link set onion0 up'
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now onion-gw-ip.service

# ---- dnsmasq: .onion -> Tor, everything else -> normal resolver ------------
echo "==> Configuring dnsmasq split DNS..."
# stop systemd-resolved squatting on port 53 if present
if systemctl is-active --quiet systemd-resolved; then
  mkdir -p /etc/systemd/resolved.conf.d
  printf '[Resolve]\nDNSStubListener=no\n' > /etc/systemd/resolved.conf.d/no-stub.conf
  systemctl restart systemd-resolved || true
fi
cat > /etc/dnsmasq.d/onion.conf <<EOF
# listen only where the VPN clients reach us
listen-address=127.0.0.1,${VPN_DNS}
bind-dynamic
no-resolv
# .onion queries go to Tor's DNSPort (returns a ${ONION_NET} virtual IP)
server=/onion/127.0.0.1#${TOR_DNS_PORT}
# everything else -> public resolvers
server=1.1.1.1
server=8.8.8.8
EOF

# ---- kernel forwarding -----------------------------------------------------
echo "==> Enabling IP forwarding..."
cat > /etc/sysctl.d/99-onion-vpn.conf <<EOF
net.ipv4.ip_forward=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
EOF
sysctl -p /etc/sysctl.d/99-onion-vpn.conf

# ---- firewall + NAT (iptables) ---------------------------------------------
echo "==> Applying iptables rules (IKE ports, NAT, onion redirect)..."
# Allow IKE/IPsec + established
iptables -C INPUT -p udp --dport 500 -j ACCEPT 2>/dev/null || iptables -A INPUT -p udp --dport 500 -j ACCEPT
iptables -C INPUT -p udp --dport 4500 -j ACCEPT 2>/dev/null || iptables -A INPUT -p udp --dport 4500 -j ACCEPT
iptables -C INPUT -p esp -j ACCEPT 2>/dev/null || iptables -A INPUT -p esp -j ACCEPT

# From VPN clients: send .onion virtual-range TCP into Tor's TransPort
iptables -t nat -C PREROUTING -s "${VPN_POOL}" -p tcp -d "${ONION_NET}" -j REDIRECT --to-ports "${TOR_TRANS_PORT}" 2>/dev/null \
  || iptables -t nat -A PREROUTING -s "${VPN_POOL}" -p tcp -d "${ONION_NET}" -j REDIRECT --to-ports "${TOR_TRANS_PORT}"

# DNS from VPN clients -> local dnsmasq
iptables -t nat -C PREROUTING -s "${VPN_POOL}" -p udp --dport 53 -j DNAT --to-destination "${VPN_DNS}:53" 2>/dev/null \
  || iptables -t nat -A PREROUTING -s "${VPN_POOL}" -p udp --dport 53 -j DNAT --to-destination "${VPN_DNS}:53"

# Everything else from VPN clients: normal NAT out (skip the onion virtual net)
iptables -t nat -C POSTROUTING -s "${VPN_POOL}" -o "${WAN_IF}" ! -d "${ONION_NET}" -j MASQUERADE 2>/dev/null \
  || iptables -t nat -A POSTROUTING -s "${VPN_POOL}" -o "${WAN_IF}" ! -d "${ONION_NET}" -j MASQUERADE

# Forward allow
iptables -C FORWARD -s "${VPN_POOL}" -j ACCEPT 2>/dev/null || iptables -A FORWARD -s "${VPN_POOL}" -j ACCEPT
iptables -C FORWARD -d "${VPN_POOL}" -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null \
  || iptables -A FORWARD -d "${VPN_POOL}" -m state --state ESTABLISHED,RELATED -j ACCEPT

netfilter-persistent save

# ---- start everything ------------------------------------------------------
echo "==> Restarting services..."
systemctl enable tor dnsmasq strongswan-starter 2>/dev/null || systemctl enable tor dnsmasq strongswan
systemctl restart tor
systemctl restart dnsmasq
systemctl restart strongswan-starter 2>/dev/null || systemctl restart strongswan
sleep 2
ipsec reload || true

# ---- export the CA cert for the phone --------------------------------------
cp /etc/ipsec.d/cacerts/ca-cert.pem /root/onion-vpn-ca.pem

cat <<EOF

============================================================================
 DONE — onion VPN gateway is live.
============================================================================
 SERVER (VPS):     ${PUBLIC_IP}
 VPN USERNAME:     ${VPN_USER}
 VPN PASSWORD:     ${VPN_PASS}
 CA CERTIFICATE:   /root/onion-vpn-ca.pem   (install this on the phone)

----------------------------------------------------------------------------
 STEP 1 — get the CA cert onto your phone
----------------------------------------------------------------------------
 Print it, then email it to yourself (open the .pem attachment on the phone),
 OR copy the text into a note. Show it now with:

     cat /root/onion-vpn-ca.pem

 On the phone: Settings > Security > Encryption & credentials >
   Install a certificate > CA certificate > pick the .pem file.
 (Menu wording varies by phone; search settings for "Install a certificate".)

----------------------------------------------------------------------------
 STEP 2 — add the VPN (built in, NO app)
----------------------------------------------------------------------------
 Settings > Network & internet > VPN > +  (Add VPN)
   Name:        Onion
   Type:        IKEv2/IPSec MSCHAPv2
   Server addr: ${PUBLIC_IP}
   IPSec identifier:  (leave blank)
   IPSec CA cert:     (select the one you installed, or "Received from server")
   Username:    ${VPN_USER}
   Password:    ${VPN_PASS}
   Save.

----------------------------------------------------------------------------
 STEP 3 — use it
----------------------------------------------------------------------------
 Toggle the "Onion" VPN ON. Open Chrome and visit any .onion, e.g.:
   https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion
 Normal sites keep working at full speed; only .onion goes through Tor.

 SERVER-SIDE TEST (proves Tor works before you touch the phone):
   curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/ | grep -i congrat
============================================================================
EOF
