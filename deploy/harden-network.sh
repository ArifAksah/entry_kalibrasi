#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Containment jaringan production (temuan C3 / H5) — JALANKAN DI SERVER, ROOT.
#
# Tujuan:
#   - Studio (3000), Postgres/pooler (5432/6543), Kong (8000/8443),
#     MinIO (9000/9001), GoTrue (9999), Analytics (4000) tidak dapat diakses
#     dari jaringan user.
#   - Hanya Caddy (80/443) dan SSH (22) yang terbuka untuk pengguna.
#
# Catatan penting:
#   - Docker mem-publish port melalui chain FORWARD/DOCKER-USER, sehingga UFW
#     biasa TIDAK cukup. DOCKER-USER adalah kontrol yang efektif.
#   - Script ini idempoten: chain dibuat/di-flush lalu diisi ulang.
#   - Ini lapisan sementara/pertahanan tambahan. Kontrol utama tetap:
#     bind port Compose ke 127.0.0.1 dan proxy Supabase lewat Caddy.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
	echo "Jalankan sebagai root (sudo)." >&2
	exit 1
fi

CHAIN="SIMKAL-CONTAIN"

# Port backend yang hanya boleh diakses lokal/host (bukan segmen user).
#   3000 Studio | 4000 Analytics | 5432 Postgres | 6543 pooler
#   8000 Kong   | 8443 Kong TLS  | 9000/9001 MinIO | 9999 GoTrue
BLOCKED_PORTS=(3000 4000 5432 6543 8000 8443 9000 9001 9999)

# Subnet/IP admin yang tetap boleh mengakses backend (mis. VPN/jump host).
# WAJIB diisi bila operator perlu akses Studio/Postgres langsung.
# Contoh: ADMIN_ALLOW_CIDRS=("10.20.30.0/24" "192.168.15.10")
ADMIN_ALLOW_CIDRS=("${ADMIN_ALLOW_CIDRS[@]:-}")

# Hanya host/port publik yang boleh terbuka untuk segmen user.
# Daftar ini didokumentasikan, bukan di-allow oleh script (default-drop).
#   80/443 Caddy HTTPS, 22 SSH (batasi ke jump host bila mungkin)
ALLOWED_PUBLIC_PORTS=(80 443 22)

# H5: port backend PDF template service (docker) — bind ke loopback saja.
BACKEND_LOOPBACK_BIND=true

echo "[1/4] Menyiapkan chain ${CHAIN}"
iptables -N "${CHAIN}" 2>/dev/null || true
iptables -F "${CHAIN}"

# Izinkan balasan koneksi yang sudah terbentuk.
iptables -A "${CHAIN}" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN

# Izinkan akses dari loopback/host.
iptables -A "${CHAIN}" -i lo -j RETURN

# Izinkan admin yang dideklarasikan eksplisit.
for cidr in "${ADMIN_ALLOW_CIDRS[@]:-}"; do
	[[ -n "${cidr}" ]] && iptables -A "${CHAIN}" -s "${cidr}" -j RETURN
done

echo "[2/4] Menolak port backend dari jaringan lain"
# --ctorigdstport mencocokkan port host sebelum DNAT Docker, lebih aman di DOCKER-USER.
for port in "${BLOCKED_PORTS[@]}"; do
	iptables -A "${CHAIN}" -p tcp -m conntrack --ctstate NEW --ctorigdstport "${port}" -j DROP
done
iptables -A "${CHAIN}" -j RETURN

echo "[3/4] Memasang jump di DOCKER-USER"
if ! iptables -C DOCKER-USER -j "${CHAIN}" 2>/dev/null; then
	iptables -I DOCKER-USER 1 -j "${CHAIN}"
fi

echo "[4/6] Menolak port INPUT ke management plane (bukan hanya Docker)"
# Docker DNAT ditangani DOCKER-USER; port yang di-bind langsung ke host
# (Studio/Postgres pada instalasi non-Docker) ditangani INPUT.
for port in "${BLOCKED_PORTS[@]}"; do
	if ! iptables -C INPUT -p tcp --dport "${port}" -j DROP 2>/dev/null; then
		iptables -I INPUT -p tcp --dport "${port}" \
			-m comment --comment "simkal-backend-block" -j DROP
	fi
done

echo "[5/6] Pastikan hook dibersihkan saat reboot (persist)"
if command -v netfilter-persistent >/dev/null 2>&1; then
	netfilter-persistent save || true
else
	echo "  netfilter-persistent tidak ada; simpan manual (iptables-save > /etc/iptables/rules.v4)" >&2
fi

echo "[6/6] Status"
iptables -nvL DOCKER-USER --line-numbers | sed -n '1,20p'
echo
iptables -nvL INPUT --line-numbers | grep -E "simkal-backend-block|Chain INPUT" | sed -n '1,15p'
echo
echo "Chain backend yang diblokir: ${BLOCKED_PORTS[*]}"
echo "Port publik yang diizinkan: ${ALLOWED_PUBLIC_PORTS[*]}"
echo "Admin allowlist: ${ADMIN_ALLOW_CIDRS[*]:-(kosong)}"
if [[ "${BACKEND_LOOPBACK_BIND}" == "true" ]]; then
	echo
	echo "WAJIB: bind port Compose ke loopback, contoh:"
	echo "  127.0.0.1:8000:8000   (Kong)"
	echo "  127.0.0.1:3000:3000   (Studio)"
	echo "  127.0.0.1:5432:5432   (Postgres)"
fi
echo
echo "Untuk membatalkan containment:"
echo "  iptables -D DOCKER-USER -j ${CHAIN} && iptables -F ${CHAIN} && iptables -X ${CHAIN}"
echo "  iptables -D FORWARD -j ${CHAIN} 2>/dev/null || true"
