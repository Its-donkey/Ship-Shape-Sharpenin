#scripts/clean-project.sh

#!/usr/bin/env zsh
# Ship Shape Sharpening — project cleanup helper
# Usage:
#   ./scripts/clean-project.sh                  # dry run (default)
#   ./scripts/clean-project.sh --force          # actually delete
#   ./scripts/clean-project.sh --deep           # include node_modules (dry run)
#   ./scripts/clean-project.sh --deep --force
#   ./scripts/clean-project.sh --deps           # run depcheck (reports only)
#   ./scripts/clean-project.sh --orphans        # run ts-prune & madge (reports only)
#   ./scripts/clean-project.sh --all            # deep + deps + orphans (dry run unless --force)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "→ Project root: $PROJECT_ROOT"

# ---- sanity checks -----------------------------------------------------------
if [[ ! -f package.json ]]; then
  echo "✗ package.json not found. Run this from the project root." >&2
  exit 1
fi

# ---- flags -------------------------------------------------------------------
DRY_RUN=1
DEEP=0
DO_DEPS=0
DO_ORPHANS=0
ALL=0

for arg in "$@"; do
  case "$arg" in
    --force) DRY_RUN=0 ;;
    --all) ALL=1 ;;
    --deep) DEEP=1 ;;
    --deps) DO_DEPS=1 ;;
    --orphans) DO_ORPHANS=1 ;;
    -h|--help)
      cat <<'USAGE'
Ship Shape Sharpening cleanup

Flags:
  --force     Perform deletions (default is dry run)
  --all       Perform all: --deep --deps --orphans (still dry run unless --force)
  --deep      Also remove node_modules and lock/caches
  --deps      Run depcheck to suggest unused dependencies
  --orphans   Run ts-prune & madge to find unused exports/files

Examples:
  ./scripts/clean-project.sh
  ./scripts/clean-project.sh --all
  ./scripts/clean-project.sh --force
  ./scripts/clean-project.sh --deep --force
  ./scripts/clean-project.sh --deps --orphans
USAGE
      exit 0
      ;;
  esac
done

# ---- targets -----------------------------------------------------------------
# Safe-to-regenerate targets
SAFE_DIRS=(
  "dist"
  ".turbo"
  ".next"
  "coverage"
  "server/.tsbuildinfo"
  "client/.tsbuildinfo"
)
SAFE_FILES_GLOBS=(
  "*.log"
  "npm-debug.log*"
  "yarn-error.log*"
  ".DS_Store"
)

# Deep clean (optional) targets
DEEP_DIRS=("node_modules")
DEEP_FILES=(
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
  ".eslintcache"
)

# ---- helpers -----------------------------------------------------------------
delete_path () {
  local p="$1"
  if [[ -e "$p" ]]; then
    if [[ $DRY_RUN -eq 1 ]]; then
      echo "DRY-RUN rm -rf \"$p\""
    else
      rm -rf "$p"
      echo "✓ removed $p"
    fi
  fi
}

delete_glob () {
  local pattern="$1"
  local -a matches
  set +e
  matches=(${~pattern}) 2>/dev/null
  set -e
  for m in "${matches[@]}"; do
    [[ -e "$m" ]] && delete_path "$m"
  done
}

print_done () {
  echo
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "✅ Dry run complete. Re-run with --force to apply."
  else
    echo "✅ Cleanup complete."
  fi
}

# ---- show largest items ------------------------------------------------------
echo
echo "→ Disk usage (top level):"
# include dot-dirs like .turbo
du -sh ./* ./.??* 2>/dev/null | sort -h || true

# ---- clean safe stuff --------------------------------------------------------
echo
echo "→ Cleaning build artifacts & caches:"
for d in "${SAFE_DIRS[@]}"; do delete_path "$d"; done
for g in "${SAFE_FILES_GLOBS[@]}"; do delete_glob "$g"; done

# ---- deep clean (optional) ---------------------------------------------------
if [[ $DEEP -eq 1 || $ALL -eq 1 ]]; then
  echo
  echo "→ Deep clean targets (node_modules, locks, caches):"
  for d in "${DEEP_DIRS[@]}"; do delete_path "$d"; done
  for f in "${DEEP_FILES[@]}"; do delete_path "$f"; done

  # npm cache
  print_done
fi

# ---- dependency analysis (optional) ------------------------------------------
if [[ $DO_DEPS -eq 1 || $ALL -eq 1 ]]; then
  echo
  echo "→ Running depcheck (tuned for Vite/TS/Tailwind; report only):"
  npx --yes depcheck \
    --specials=tsconfig,eslint,webpack,vite \
    --ignores="tailwindcss,postcss,autoprefixer,vite-plugin-svgr" || true
fi

# ---- orphan exports/files analysis (optional) --------------------------------
if [[ $DO_ORPHANS -eq 1 || $ALL -eq 1 ]]; then
  echo
  echo "→ Running ts-prune (unused exports):"
  if [[ -f "tsconfig.json" ]]; then
    npx --yes ts-prune --project tsconfig.json || true
  else
    npx --yes ts-prune || true
  fi

  echo
  echo "→ Running madge for orphan files:"
  # Check common code roots
  if [[ -d "src" ]]; then
    npx --yes madge src --extensions ts,tsx,js,jsx --orphans || true
  fi
  if [[ -d "server" ]]; then
    npx --yes madge server --extensions ts,tsx,js,jsx --orphans || true
  fi
  if [[ ! -d "src" && ! -d "server" ]]; then
    echo "No src/ or server/ folder found, skipping madge."
  fi
fi

# ---- git ignored sweep (prompted) -------------------------------------------
echo
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "→ Git detected."
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "Tip: preview removing ignored files with: git clean -fdX -n"
  else
    echo "Tip: actually remove ignored files with: git clean -fdX"
  fi
fi

print_done
