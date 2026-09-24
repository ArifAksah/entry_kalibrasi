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
BLOCKED_PORTS=(3000 4000 5432 6543 8000 8443 9000 9001 9999)

# Subnet/IP admin yang tetap boleh mengakses backend (mis. VPN/jump host).
# Isi bila perlu, contoh: "192.168.15.0/24".
ADMIN_ALLOW_CIDRS=()

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

echo "[4/4] Status"
iptables -nvL DOCKER-USER --line-numbers | sed -n '1,20p'
echo
echo "Chain backend yang diblokir: ${BLOCKED_PORTS[*]}"
echo "Ingat: kontrol utama tetap bind Compose ke 127.0.0.1 dan proxy lewat Caddy."
echo
echo "Untuk membatalkan containment:"
echo "  iptables -D DOCKER-USER -j ${CHAIN} && iptables -F ${CHAIN} && iptables -X ${CHAIN}"
echo "  iptables -D FORWARD -j ${CHAIN} 2>/dev/null || true"
