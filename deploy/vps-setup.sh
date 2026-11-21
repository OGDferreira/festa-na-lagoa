#!/usr/bin/env bash
# festa-na-lagoa :: setup no VPS Ubuntu 24.04 (Hostinger KVM)
# Sobe overlay + painel /admin 24/7 como servico systemd na porta 8080.
# Rodar como root. Idempotente: rode de novo pra atualizar o codigo.
#
# Senha propria (nao fica no repo):
#   curl -fsSL <url-deste-script> | ADMIN_PASSWORD='suasenha' bash
set -euo pipefail

REPO="https://github.com/OGDferreira/festa-na-lagoa"
BRANCH="claude/project-thread-rbxmuo"
DIR="/opt/festa-na-lagoa"
PORT="8080"
# Senha do painel /admin e /monitor (acesso de fora).
# Troque exportando ADMIN_PASSWORD antes de rodar; o padrao abaixo e publico.
ADMIN_PASSWORD="${ADMIN_PASSWORD:-festa-lagoa-2026}"

echo ">> instalando node 20 + git"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y git >/dev/null 2>&1 || true

echo ">> clonando/atualizando repo em $DIR (branch $BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" --depth 1
  git -C "$DIR" checkout -B deploy FETCH_HEAD
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
Environment=ADMIN_PASSWORD=$ADMIN_PASSWORD
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
echo " PRONTO."
echo "   Overlay (OBS/publico):  http://$IP:$PORT"
echo "   Painel admin:           http://$IP:$PORT/admin"
echo "   Monitor:                http://$IP:$PORT/monitor"
echo "   Usuario do painel: qualquer   Senha: $ADMIN_PASSWORD"
echo "=================================================="
