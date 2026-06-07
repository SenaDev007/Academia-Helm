#!/bin/bin/bash
# ============================================================================
# SYNC SCRIPT - Keeps Academia-Helm and apps in sync with GitHub
# ============================================================================
# Usage: ./sync-repo.sh [commit-message]
#
# This script ensures both local repos are synced before committing.
# ALWAYS use this script instead of manual git commands.
# ============================================================================

set -e

APPS_DIR="/home/z/my-project/apps"
DEPLOY_DIR="/home/z/my-project/Academia-Helm"
MSG="${1:-auto: sync}"

echo "🔄 Sync Script - Single Source of Truth"
echo "========================================"

# 1. Pull latest from GitHub in both repos
echo ""
echo "📥 Step 1: Fetching latest from GitHub..."
cd "$DEPLOY_DIR" && git fetch origin && git reset --hard origin/main
echo "   ✅ Academia-Helm synced to origin/main"

cd "$APPS_DIR" && git fetch origin
# Rebase local commits on top of origin/main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    git pull --rebase origin main || { echo "⚠️  Rebase conflict! Resolve manually in apps/"; exit 1; }
fi
echo "   ✅ Apps synced to origin/main"

# 2. Compare file content (not git history)
echo ""
echo "📂 Step 2: Checking for file differences..."
DIFF_COUNT=$(diff -rq "$APPS_DIR/api-server/src" "$DEPLOY_DIR/api-server/src" 2>/dev/null | wc -l)
DIFF_COUNT=$((DIFF_COUNT + $(diff -rq "$APPS_DIR/web-app/src" "$DEPLOY_DIR/web-app/src" 2>/dev/null | wc -l)))

if [ "$DIFF_COUNT" -gt 0 ]; then
    echo "   ⚠️  Found $DIFF_COUNT file differences — copying from apps/ to Academia-Helm/"
    # Copy changed files from apps to Academia-Helm
    rsync -av --delete \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude '.next' \
      --exclude 'dist' \
      "$APPS_DIR/api-server/" "$DEPLOY_DIR/api-server/"
    rsync -av --delete \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude '.next' \
      --exclude 'dist' \
      "$APPS_DIR/web-app/" "$DEPLOY_DIR/web-app/"
    echo "   ✅ Files synced"
else
    echo "   ✅ No file differences"
fi

# 3. Commit and push from Academia-Helm (the deployment repo)
echo ""
echo "📤 Step 3: Committing and pushing from Academia-Helm..."
cd "$DEPLOY_DIR"
if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "$MSG"
    git push origin main
    echo "   ✅ Pushed to GitHub"
else
    echo "   ℹ️  No changes to commit"
fi

# 4. Sync apps/ back to the same HEAD
echo ""
echo "📥 Step 4: Syncing apps/ to same HEAD..."
cd "$APPS_DIR"
git fetch origin
git reset --hard origin/main
echo "   ✅ Apps/ synced"

echo ""
echo "✅ Both repos are now perfectly synced!"
echo "   HEAD: $(cd $DEPLOY_DIR && git rev-parse --short HEAD)"
