#!/usr/bin/env bash
# festa-na-lagoa :: setup no VPS Ubuntu 24.04 (Hostinger KVM)
# Sobe o overlay 24/7 como servico systemd na porta 8080.
# Rodar como root. Idempotente: pode rodar de novo pra atualizar.
set -euo pipefail

REPO="https://github.com/OGDferreira/festa-na-lagoa"
BRANCH="prototipo-festa-na-lagoa"
DIR="/opt/festa-na-lagoa"
PORT="8080"

echo ">> instalando node 20 + git"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y git >/dev/null 2>&1 || true

echo ">> clonando/atualizando repo em $DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout "$BRANCH"
  git -C "$DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO" "$DIR"
fi

echo ">> npm install"
cd "$DIR"
npm install --omit=dev

echo ">> criando servico systemd"
cat > /etc/systemd/system/festa-na-lagoa.service <<UNIT
[Unit]
Description=festa-na-lagoa overlay
After=network.target

[Service]
Type=simple
WorkingDirectory=$DIR
Environment=MODE=demo
Environment=TIKTOK_USERNAME=seuusuario
Environment=PORT=$PORT
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable festa-na-lagoa
systemctl restart festa-na-lagoa

echo ">> abrindo porta $PORT no firewall (se ufw ativo)"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT"/tcp || true
fi

sleep 2
systemctl --no-pager status festa-na-lagoa | head -n 8 || true
IP=$(curl -s https://api.ipify.org || echo "SEU_IP")
echo ""
echo "=================================================="
echo " PRONTO. Abra no navegador:  http://$IP:$PORT"
echo "=================================================="
