#!/bin/sh

set -eu

APP_DIR="${APP_DIR:-cdtm-map}"
DEPLOY_PATH="${OSGILIATH_DEPLOY_PATH:-/srv/cdtm-map}"
SSH_HOST="${OSGILIATH_SSH_HOST:?OSGILIATH_SSH_HOST is required}"
SSH_PORT="${OSGILIATH_SSH_PORT:-22}"
SSH_USER="${OSGILIATH_SSH_USER:?OSGILIATH_SSH_USER is required}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
REMOTE="${SSH_USER}@${SSH_HOST}"
SSH_STRICT_OPTION="${SSH_STRICT_OPTION:--o StrictHostKeyChecking=yes}"
SSH_OPTS="-p ${SSH_PORT} -o BatchMode=yes ${SSH_STRICT_OPTION}"
REMOTE_ENV_FILE="${DEPLOY_PATH}/.env"
RSYNC_RSH="ssh -p ${SSH_PORT} -o BatchMode=yes ${SSH_STRICT_OPTION}"
SYNC_EXCLUDES="--exclude=.git --exclude=.forgejo --exclude=node_modules --exclude=.next --exclude=coverage --exclude=dist --exclude=build --exclude=data/exports --exclude=*.log --exclude=.env --exclude=.env.*"

if [ ! -d "${APP_DIR}" ]; then
  echo "Deploy directory not found: ${APP_DIR}" >&2
  exit 1
fi

echo "Syncing ${APP_DIR} to ${REMOTE}:${DEPLOY_PATH}"
ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p '${DEPLOY_PATH}'"

if command -v rsync >/dev/null 2>&1 && ssh ${SSH_OPTS} "${REMOTE}" "command -v rsync >/dev/null 2>&1"; then
  # Prefer rsync for idempotent updates and cleaner exclusions.
  rsync -az --delete ${SYNC_EXCLUDES} -e "${RSYNC_RSH}" "${APP_DIR}/" "${REMOTE}:${DEPLOY_PATH}/"
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
    . | ssh ${SSH_OPTS} "${REMOTE}" "tar -xzf - -C '${DEPLOY_PATH}'"
fi

echo "Checking remote environment file"
ssh ${SSH_OPTS} "${REMOTE}" "chmod 600 '${REMOTE_ENV_FILE}' && [ -f '${REMOTE_ENV_FILE}' ]"

echo "Starting Docker Compose on ${REMOTE}"
ssh ${SSH_OPTS} "${REMOTE}" \
  "set -eu; \
  cd '${DEPLOY_PATH}'; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' pull || true; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' build; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' up -d; \
  docker compose --env-file '${REMOTE_ENV_FILE}' -f '${COMPOSE_FILE}' ps"

echo "Running health check"
ssh ${SSH_OPTS} "${REMOTE}" "DEPLOY_PATH='${DEPLOY_PATH}' COMPOSE_FILE='${COMPOSE_FILE}' REMOTE_ENV_FILE='${REMOTE_ENV_FILE}' sh -s" <<'EOF'
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
exit 1
EOF

echo "Deployment completed successfully"
