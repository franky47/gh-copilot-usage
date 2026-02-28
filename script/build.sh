#!/usr/bin/env bash
set -eo pipefail

# Fail the build if bun is not available
if ! command -v bun &> /dev/null; then
  echo "bun is not installed. Please install bun to continue."
  exit 1
fi

# Fail the build if jq is not available
if ! command -v jq &> /dev/null; then
  echo "jq is not installed. Please install jq to continue."
  exit 1
fi

# Set version from git tag (strip leading 'v')
if [[ -n "${TAG_NAME}" ]]; then
  version="${TAG_NAME#v}"
  echo "Setting package.json version to ${version}..."
  tmpfile="$(mktemp package.json.tmp.XXXXXX)"
  trap 'rm -f "$tmpfile"' EXIT
  jq --arg v "${version}" '.version = $v' package.json > "$tmpfile" && mv "$tmpfile" package.json
fi

# Install dependencies
echo "Installing dependencies..."
bun install

mkdir -p dist

# Build function to avoid Bash 4 associative array requirement
build_platform() {
  local platform=$1
  local target=$2
  local output="dist/gh-copilot-usage-${platform}"

  # Windows needs .exe extension
  if [[ "$platform" == windows-* ]]; then
    output="${output}.exe"
  fi

  echo "Building for ${platform} (${target})..."
  bun build src/main.ts --compile --target="${target}" --outfile="${output}"
}

# Build for all platforms
build_platform "darwin-arm64" "bun-darwin-arm64"
build_platform "darwin-amd64" "bun-darwin-x64"
build_platform "linux-amd64" "bun-linux-x64"
build_platform "linux-arm64" "bun-linux-arm64"
build_platform "windows-amd64" "bun-windows-x64"

echo "Build complete."
ls -lh dist/
