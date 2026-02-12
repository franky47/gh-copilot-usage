#!/usr/bin/env bash
set -eo pipefail

# Install bun if not available
if ! command -v bun &> /dev/null; then
  echo "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
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
  bun build src/index.ts --compile --target="${target}" --outfile="${output}"
}

# Build for all platforms
build_platform "darwin-arm64" "bun-darwin-arm64"
build_platform "darwin-amd64" "bun-darwin-x64"
build_platform "linux-amd64" "bun-linux-x64"
build_platform "linux-arm64" "bun-linux-arm64"
build_platform "windows-amd64" "bun-windows-x64"

echo "Build complete."
ls -lh dist/
