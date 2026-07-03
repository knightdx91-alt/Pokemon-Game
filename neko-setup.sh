#!/usr/bin/env bash
#
# One-shot neko installer for the Contabo VPS behind neko.postpeleos.com.
# Run it ON the server (root):
#   curl -fsSL https://retro.postpeleos.com/neko-setup.sh -o neko.sh && bash neko.sh
#
set -e

IP="144.126.132.69"
DOMAIN="neko.postpeleos.com"

echo "=============================================="
echo "  Neko installer  (server: $IP  /  $DOMAIN)"
echo "=============================================="
echo

# Ask for a login password (typed here, never stored in this public script).
read -rp "Choose a password for logging into neko: " NEKO_PW </dev/tty
while [ -z "$NEKO_PW" ]; do
  read -rp "Password can't be empty — choose one: " NEKO_PW </dev/tty
done

echo
echo ">> Installing Docker (this takes a minute)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo ">> Writing config..."
mkdir -p /root/neko
cd /root/neko

cat > docker-compose.yml <<EOF
services:
  neko:
    image: "ghcr.io/m1k1o/neko/tor-browser:latest"
    restart: "unless-stopped"
    shm_size: "2gb"
    ports:
      - "8080:8080"
      - "52000-52100:52000-52100/udp"
    environment:
      NEKO_DESKTOP_SCREEN: "1280x720@30"
      NEKO_MEMBER_MULTIUSER_USER_PASSWORD: "${NEKO_PW}"
      NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD: "${NEKO_PW}"
      NEKO_WEBRTC_EPR: "52000-52100"
      NEKO_WEBRTC_ICELITE: "1"
      NEKO_WEBRTC_NAT1TO1: "${IP}"
    volumes:
      - neko-profile:/home/neko

  neko-desktop:
    image: "ghcr.io/m1k1o/neko/xfce:latest"
    restart: "unless-stopped"
    shm_size: "2gb"
    ports:
      - "8081:8080"
      - "52200-52300:52200-52300/udp"
    environment:
      NEKO_DESKTOP_SCREEN: "1280x720@30"
      NEKO_MEMBER_MULTIUSER_USER_PASSWORD: "${NEKO_PW}"
      NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD: "${NEKO_PW}"
      NEKO_WEBRTC_EPR: "52200-52300"
      NEKO_WEBRTC_ICELITE: "1"
      NEKO_WEBRTC_NAT1TO1: "${IP}"
    volumes:
      - neko-desktop:/home/neko

volumes:
  neko-profile:
  neko-desktop:
EOF

cat > Caddyfile <<EOF
${DOMAIN} {
    reverse_proxy localhost:8080
}
EOF

echo ">> Starting neko (pulling images — first run can take a few minutes)..."
docker compose up -d

echo ">> Starting HTTPS proxy (Caddy)..."
docker rm -f caddy >/dev/null 2>&1 || true
docker run -d --name caddy --restart unless-stopped --network host \
  -v /root/neko/Caddyfile:/etc/caddy/Caddyfile -v caddy_data:/data caddy

echo
echo "=============================================="
echo "  Done!"
echo "  Give it 1-2 minutes for the HTTPS certificate,"
echo "  then open:  https://${DOMAIN}"
echo "  Log in with the password you just chose."
echo "  (Full desktop is on http://${IP}:8081)"
echo "=============================================="
