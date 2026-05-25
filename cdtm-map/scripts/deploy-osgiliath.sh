#!/bin/sh

set -eu

APP_DIR="${APP_DIR:-cdtm-map}"
DEPLOY_PATH="${OSGILIATH_DEPLOY_PATH:-/srv/cdtm-map}"
SSH_HOST="${OSGILIATH_SSH_HOST:?OSGILIATH_SSH_HOST is required}"
SSH_PORT="${OSGILIATH_SSH_PORT:-22}"
SSH_USER="${OSGILIATH_SSH_USER:?OSGILIATH_SSH_USER is required}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
REMOTE="${SSH_USER}@${SSH_HOST}"
SSH_KEY_PATH="${DEPLOY_SSH_KEY_PATH:?DEPLOY_SSH_KEY_PATH is required}"
SSH_KNOWN_HOSTS_PATH="${DEPLOY_SSH_KNOWN_HOSTS_PATH:-${HOME}/.ssh/known_hosts}"
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-yes}"
REMOTE_ENV_FILE="${DEPLOY_PATH}/.env"
SYNC_EXCLUDES="--exclude=.git --exclude=.forgejo --exclude=node_modules --exclude=.next --exclude=coverage --exclude=dist --exclude=build --exclude=data/exports --exclude=*.log --exclude=.env --exclude=.env.*"

if [ ! -f "${SSH_KEY_PATH}" ]; then
  echo "SSH key not found: ${SSH_KEY_PATH}" >&2
  exit 1
fi

key_permissions="$(stat -c '%a' "${SSH_KEY_PATH}")"
if [ "${key_permissions}" != "600" ]; then
  echo "Unexpected SSH key permissions for ${SSH_KEY_PATH}: ${key_permissions}" >&2
  exit 1
fi

ssh-keygen -y -f "${SSH_KEY_PATH}" >/dev/null

ssh_cmd() {
  ssh \
    -i "${SSH_KEY_PATH}" \
    -p "${SSH_PORT}" \
    -o BatchMode=yes \
    -o IdentitiesOnly=yes \
    -o UserKnownHostsFile="${SSH_KNOWN_HOSTS_PATH}" \
    -o StrictHostKeyChecking="${SSH_STRICT_HOST_KEY_CHECKING}" \
    "$@"
}

scp_cmd() {
  scp \
    -i "${SSH_KEY_PATH}" \
    -P "${SSH_PORT}" \
    -o BatchMode=yes \
    -o IdentitiesOnly=yes \
    -o UserKnownHostsFile="${SSH_KNOWN_HOSTS_PATH}" \
    -o StrictHostKeyChecking="${SSH_STRICT_HOST_KEY_CHECKING}" \
    "$@"
}

rsync_ssh_cmd="ssh -i ${SSH_KEY_PATH} -p ${SSH_PORT} -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=${SSH_KNOWN_HOSTS_PATH} -o StrictHostKeyChecking=${SSH_STRICT_HOST_KEY_CHECKING}"

if [ ! -d "${APP_DIR}" ]; then
  echo "Deploy directory not found: ${APP_DIR}" >&2
  exit 1
fi

echo "Syncing ${APP_DIR} to ${REMOTE}:${DEPLOY_PATH}"
ssh_cmd "${REMOTE}" "mkdir -p '${DEPLOY_PATH}'"

if command -v rsync >/dev/null 2>&1 && ssh_cmd "${REMOTE}" "command -v rsync >/dev/null 2>&1"; then
  # Prefer rsync for idempotent updates and cleaner exclusions.
  rsync -az --delete ${SYNC_EXCLUDES} -e "${rsync_ssh_cmd}" "${APP_DIR}/" "${REMOTE}:${DEPLOY_PATH}/"
else
  echo "rsync not available on one side, falling back to tar over ssh"
  tar \
    --exclude='./.git' \
    --exclude='./.forgejo' \
    --exclude='./node_modules' \
    --exclude='./.next' \
    --exclude='./coverage' \
    --exclude='./dist' \
    --exclude='./build' \
    --exclude='./data/exports' \
    --exclude='./*.log' \
    --exclude='./.env' \
    --exclude='./.env.*' \
    -C "${APP_DIR}" \
    -czf - \
    . | ssh_cmd "${REMOTE}" "set -eu; \
      tmp_dir=\$(mktemp -d); \
      trap 'rm -rf \"\$tmp_dir\"' EXIT HUP INT TERM; \
      tar -xzf - -C \"\$tmp_dir\"; \
      find '${DEPLOY_PATH}' -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +; \
      cp -a \"\$tmp_dir\"/. '${DEPLOY_PATH}'/; \
      rm -rf \"\$tmp_dir\""
fi

echo "Checking remote environment file"
ssh_cmd "${REMOTE}" "chmod 600 '${REMOTE_ENV_FILE}' && [ -f '${REMOTE_ENV_FILE}' ]"

echo "Starting Docker Compose on ${REMOTE}"
ssh_cmd "${REMOTE}" \
  "set -eu; \
  cd '${DEPLOY_PATH}'; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' pull || true; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' build; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' up -d; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' ps"

echo "Running health check"
ssh_cmd "${REMOTE}" "DEPLOY_PATH='${DEPLOY_PATH}' COMPOSE_FILE='${COMPOSE_FILE}' REMOTE_ENV_FILE='${REMOTE_ENV_FILE}' sh -s" <<'EOF'
set -eu

APP_PORT="$(awk -F= '/^APP_PORT=/{print $2}' "${REMOTE_ENV_FILE}" | tail -n 1)"
if [ -z "${APP_PORT}" ]; then
  APP_PORT=3000
fi

attempt=1
max_attempts=10

while [ "$attempt" -le "$max_attempts" ]; do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
      exit 0
    fi
  else
    if wget -qO- "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
      exit 0
    fi
  fi

  sleep 3
  attempt=$((attempt + 1))
done

echo "Healthcheck failed after ${max_attempts} attempts" >&2
if command -v curl >/dev/null 2>&1; then
  echo "Last /api/health response:" >&2
  curl -sS "http://127.0.0.1:${APP_PORT}/api/health" >&2 || true
  echo >&2
else
  echo "Last /api/health response:" >&2
  wget -qO- "http://127.0.0.1:${APP_PORT}/api/health" >&2 || true
  echo >&2
fi
echo "Recent app logs:" >&2
docker compose --env-file "${REMOTE_ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail=200 cdtm-app >&2 || true
exit 1
EOF

echo "Deployment completed successfully"
