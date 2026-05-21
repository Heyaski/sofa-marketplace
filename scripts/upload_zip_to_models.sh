#!/usr/bin/env bash
# Распаковать ZIP локально и залить на SFTP только файлы моделей/превью (не сам .zip).

set -euo pipefail

ZIP_PATH="${1:-}"
if [[ -z "${ZIP_PATH}" ]] || [[ ! -f "${ZIP_PATH}" ]]; then
  echo "Usage: $0 path/to/models.zip"
  exit 1
fi

SERVER_HOST="${SFTP_HOST:-45.12.74.57}"
PORT="${SFTP_PORT:-22}"
USER_NAME="${SFTP_USER:-upload3d}"
REMOTE_DIR="${REMOTE_DIR:-/models}"
KEY_PATH="${SFTP_KEY:-$HOME/.ssh/upload3d_ed25519}"

if [[ ! -f "${KEY_PATH}" ]]; then
  echo "SSH key not found: ${KEY_PATH}"
  echo "Override with SFTP_KEY=/path/to/key"
  exit 1
fi

EXTRACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/models_zip_XXXXXX")"
BATCH=""
cleanup_all() {
  rm -rf "${EXTRACT_DIR}"
  [[ -n "${BATCH}" ]] && rm -f "${BATCH}"
}
trap cleanup_all EXIT

echo "Extracting: ${ZIP_PATH}"
unzip -q -o "${ZIP_PATH}" -d "${EXTRACT_DIR}"

MAPFILE=()
while IFS= read -r -d '' f; do
  ext="${f##*.}"
  ext_lc="$(printf '%s' "${ext}" | tr '[:upper:]' '[:lower:]')"
  case "${ext_lc}" in
    glb|rfa|ifc|png|jpg|jpeg) MAPFILE+=("$f") ;;
  esac
done < <(find "${EXTRACT_DIR}" -type f -print0)

if [[ ${#MAPFILE[@]} -eq 0 ]]; then
  echo "No supported files (.glb, .rfa, .ifc, .png, .jpg, .jpeg) inside ZIP."
  exit 1
fi

BATCH="$(mktemp "${TMPDIR:-/tmp}/sftp_batch_XXXXXX")"
{
  printf 'mkdir "%s"\n' "${REMOTE_DIR}"
  printf 'cd "%s"\n' "${REMOTE_DIR}"
  for f in "${MAPFILE[@]}"; do
    printf 'put "%s"\n' "${f}"
  done
} > "${BATCH}"

echo "Uploading ${#MAPFILE[@]} file(s) to ${USER_NAME}@${SERVER_HOST}:${REMOTE_DIR} ..."
sftp -q -i "${KEY_PATH}" -P "${PORT}" -b "${BATCH}" "${USER_NAME}@${SERVER_HOST}"
echo "Done."
