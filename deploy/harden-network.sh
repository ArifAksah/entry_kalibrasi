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
#
# Pemakaian:
#   # Lihat rencana tanpa mengubah apa pun:
#   sudo ADMIN_ALLOW_CIDRS="10.20.30.0/24,192.168.15.10" ./deploy/harden-network.sh --dry-run
#
#   # Terapkan (minta konfirmasi):
#   sudo ADMIN_ALLOW_CIDRS="10.20.30.0/24" ./deploy/harden-network.sh
#
#   # Terapkan tanpa prompt (otomasi):
#   sudo ADMIN_ALLOW_CIDRS="10.20.30.0/24" ./deploy/harden-network.sh --yes
#
# PENTING: isi ADMIN_ALLOW_CIDRS dengan IP/jump host Anda SEBELUM menjalankan,
# atau akses langsung ke Postgres/Studio dari luar akan terputus.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

DRY_RUN=false
ASSUME_YES=false
FORCE=false
for arg in "$@"; do
	case "${arg}" in
		--dry-run) DRY_RUN=true ;;
		--yes|-y) ASSUME_YES=true ;;
		--force) FORCE=true ;;
		--help|-h)
			sed -n '2,45p' "$0"
			exit 0
			;;
		*)
			echo "Opsi tidak dikenal: ${arg}" >&2
			exit 1
			;;
	esac
done

if [[ "${EUID}" -ne 0 ]]; then
	echo "Jalankan sebagai root (sudo)." >&2
	exit 1
fi

CHAIN="SIMKAL-CONTAIN"
INPUT_COMMENT="simkal-backend-block"

# Port backend yang hanya boleh diakses lokal/host (bukan segmen user).
#   3000 Studio | 4000 Analytics | 5432 Postgres | 6543 pooler
#   8000 Kong   | 8443 Kong TLS  | 9000/9001 MinIO | 9999 GoTrue
BLOCKED_PORTS=(3000 4000 5432 6543 8000 8443 9000 9001 9999)

# Hanya host/port publik yang boleh terbuka untuk segmen user.
#   80/443 Caddy HTTPS, 22 SSH (batasi ke jump host bila mungkin)
ALLOWED_PUBLIC_PORTS=(80 443 22)

# Port backend PDF template service (docker) — bind ke loopback saja.
BACKEND_LOOPBACK_BIND=true

# ---------------------------------------------------------------------------
# Parse allowlist: dukung koma dan/atau spasi.
# Env var `ADMIN_ALLOW_CIDRS` adalah string, jadi pecah manual.
# ---------------------------------------------------------------------------
parse_allow_cidrs() {
	local raw="${ADMIN_ALLOW_CIDRS:-}"
	local -a out=()
	# ganti koma dengan spasi, lalu pecah per whitespace
	local normalized="${raw//,/ }"
	# shellcheck disable=SC2206
	local parts=(${normalized})
	for p in "${parts[@]}"; do
		[[ -n "${p}" ]] && out+=("${p}")
	done
	printf '%s\n' "${out[@]:-}"
}

mapfile -t ALLOW_CIDRS < <(parse_allow_cidrs)

run() {
	if [[ "${DRY_RUN}" == "true" ]]; then
		echo "  [dry-run] $*"
	else
		"$@"
	fi
}

echo "═══════════════════════════════════════════════════════════════"
echo " SIMKAL network containment"
echo " Mode        : $([[ "${DRY_RUN}" == "true" ]] && echo 'DRY-RUN (tidak mengubah apa pun)' || echo 'APPLY')"
echo " Blocked     : ${BLOCKED_PORTS[*]}"
echo " Public ok   : ${ALLOWED_PUBLIC_PORTS[*]}"
echo " Admin allow : ${ALLOW_CIDRS[*]:-(kosong — akses manajemen dari luar akan tertutup)}"
echo "═══════════════════════════════════════════════════════════════"

if [[ "${DRY_RUN}" != "true" && "${ASSUME_YES}" != "true" ]]; then
	read -r -p "Lanjutkan menerapkan aturan firewall? [y/N] " answer
	case "${answer}" in
		y|Y|yes|YES) ;;
		*) echo "Dibatalkan."; exit 0 ;;
	esac
fi

# ---------------------------------------------------------------------------
# GUARD: jangan blokir port 8000 selama aplikasi masih menunjuk langsung ke
# Kong (bukan lewat reverse proxy). Kalau tidak, browser semua user kehilangan
# akses Supabase dan aplikasi rusak.
# ---------------------------------------------------------------------------
guard_direct_supabase_url() {
	local env_file
	for env_file in .env .env.local .env.production; do
		[[ -f "${env_file}" ]] || continue
		local current
		current="$(grep -E '^\s*NEXT_PUBLIC_SUPABASE_URL=' "${env_file}" | tail -1 | sed -E 's/^[^=]+=//; s/^["'\'']|["'\'']$//g' || true)"
		[[ -n "${current}" ]] || continue
		if [[ "${current}" =~ :8000(/|$) ]]; then
			echo "GUARD: ${env_file} menunjuk langsung ke Kong :8000" >&2
			echo "       NEXT_PUBLIC_SUPABASE_URL=${current}" >&2
			echo "       Pindahkan ke jalur reverse proxy lebih dulu, mis.:" >&2
			echo "         NEXT_PUBLIC_SUPABASE_URL=https://<domain>/supabase" >&2
			echo "       lalu rebuild + restart aplikasi." >&2
			if [[ "${FORCE}" == "true" ]]; then
				echo "       (--force diberikan, melanjutkan apa pun risikonya)" >&2
				return 0
			fi
			return 1
		fi
		return 0
	done
	return 0
}

if ! guard_direct_supabase_url && [[ "${DRY_RUN}" != "true" ]]; then
	echo "Dibatalkan demi mencegah aplikasi rusak. Gunakan --force untuk memaksa." >&2
	exit 1
fi

echo
echo "[1/6] Menyiapkan chain ${CHAIN}"
run iptables -N "${CHAIN}" 2>/dev/null || true
run iptables -F "${CHAIN}"

# Izinkan balasan koneksi yang sudah terbentuk.
run iptables -A "${CHAIN}" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN

# Izinkan akses dari loopback/host.
run iptables -A "${CHAIN}" -i lo -j RETURN

# Izinkan admin yang dideklarasikan eksplisit.
for cidr in "${ALLOW_CIDRS[@]:-}"; do
	[[ -n "${cidr}" ]] && run iptables -A "${CHAIN}" -s "${cidr}" -j RETURN
done

echo
echo "[2/6] Menolak port backend dari jaringan lain (Docker DOCKER-USER)"
# --ctorigdstport mencocokkan port host sebelum DNAT Docker, lebih aman di DOCKER-USER.
for port in "${BLOCKED_PORTS[@]}"; do
	run iptables -A "${CHAIN}" -p tcp -m conntrack --ctstate NEW --ctorigdstport "${port}" -j DROP
done
run iptables -A "${CHAIN}" -j RETURN

echo
echo "[3/6] Memasang jump di DOCKER-USER"
if ! iptables -C DOCKER-USER -j "${CHAIN}" 2>/dev/null; then
	run iptables -I DOCKER-USER 1 -j "${CHAIN}"
else
	echo "  jump sudah ada (skip)"
fi

echo
echo "[4/6] Menolak port INPUT ke management plane (instalasi non-Docker)"
# Docker DNAT ditangani DOCKER-USER; port yang di-bind langsung ke host
# ditangani INPUT. Cek memakai spesifikasi LENGKAP (termasuk comment) agar
# idempoten dan tidak menumpuk aturan duplikat.
for port in "${BLOCKED_PORTS[@]}"; do
	# `! -i lo` penting: tanpa ini, trafik dari server sendiri (mis. aplikasi
	# mengakses Supabase via IP host) ikut terblokir dan aplikasi rusak.
	if iptables -C INPUT ! -i lo -p tcp --dport "${port}" \
		-m comment --comment "${INPUT_COMMENT}" -j DROP 2>/dev/null; then
		echo "  INPUT ${port} sudah diblok (skip)"
	else
		run iptables -I INPUT ! -i lo -p tcp --dport "${port}" \
			-m comment --comment "${INPUT_COMMENT}" -j DROP
	fi
done

echo
echo "[5/6] Persist agar aturan bertahan setelah reboot"
if [[ "${DRY_RUN}" == "true" ]]; then
	echo "  [dry-run] netfilter-persistent save"
elif command -v netfilter-persistent >/dev/null 2>&1; then
	netfilter-persistent save || true
else
	echo "  netfilter-persistent tidak ada; simpan manual:" >&2
	echo "    iptables-save | sudo tee /etc/iptables/rules.v4" >&2
fi

echo
echo "[6/6] Status"
iptables -nvL DOCKER-USER --line-numbers | sed -n '1,20p'
echo
iptables -nvL INPUT --line-numbers | grep -E "${INPUT_COMMENT}|Chain INPUT" | sed -n '1,15p'
echo
if [[ "${BACKEND_LOOPBACK_BIND}" == "true" ]]; then
	echo "WAJIB: bind port Compose ke loopback (kontrol utama), contoh:"
	echo "  \"127.0.0.1:8000:8000\"   (Kong)"
	echo "  \"127.0.0.1:3000:3000\"   (Studio)"
	echo "  \"127.0.0.1:5432:5432\"   (Postgres)"
	echo
fi
echo "Untuk membatalkan containment:"
echo "  sudo iptables -D DOCKER-USER -j ${CHAIN} && sudo iptables -F ${CHAIN} && sudo iptables -X ${CHAIN}"
echo "  sudo iptables -S INPUT | grep ${INPUT_COMMENT}   # lalu -D satu per satu"
