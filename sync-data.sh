#!/bin/bash
# Syncs local career-ops data to GitHub (ipineirop/nacho-career-ops)
# Run after any CLI session: bash sync-data.sh

set -e

REPO_DIR="/tmp/nacho-career-ops-sync"
REMOTE="https://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@github.com/ipineirop/nacho-career-ops.git"
LOCAL="$(cd "$(dirname "$0")" && pwd)"

echo "→ Syncing career-ops data to GitHub..."

# Clone or pull
if [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR" && git pull --quiet
else
  rm -rf "$REPO_DIR"
  git clone --quiet "$REMOTE" "$REPO_DIR"
fi

# Copy data files
cp -r "$LOCAL/data" "$REPO_DIR/"
cp -r "$LOCAL/reports" "$REPO_DIR/"
mkdir -p "$REPO_DIR/config"
cp "$LOCAL/config/profile.yml" "$REPO_DIR/config/"

# Copy CV and templates (required by web app CV generator)
cp "$LOCAL/cv.md" "$REPO_DIR/cv.md"
mkdir -p "$REPO_DIR/templates"
cp "$LOCAL/templates/cv-template.html" "$REPO_DIR/templates/cv-template.html"
cp "$LOCAL/templates/states.yml" "$REPO_DIR/templates/states.yml"

# Copy modes (required by AI endpoints)
cp -r "$LOCAL/modes" "$REPO_DIR/"

cd "$REPO_DIR"

# Only commit if there are changes
if git diff --quiet && git diff --staged --quiet; then
  echo "✓ Nothing changed — dashboard is already up to date."
  exit 0
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
git add .
git commit -m "sync: data update ${TIMESTAMP}" --quiet
git push --quiet

echo "✓ Dashboard updated — refresh nacho-career-ops.vercel.app"
