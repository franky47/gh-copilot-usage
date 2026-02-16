> A GitHub CLI extension to display your GitHub Copilot premium request usage statistics

![Screenshot](./screenshot.png)

## Features

- 📊 Shows a summary of your usage for the current month
- 📅 Visual indicator of where you are in the billing cycle
- 🤖 Breakdown of usage per AI model
- 🎨 Color-coded progress bars (green → yellow → red)
- ⚙️ Flexible configuration options

The month indicator helps you pace your usage throughout the billing cycle:

- Usage left of the month indicator? Prompt away! 🤖
- Usage right of the month indicator? Go touch some grass. 🌿

## Installation

### Install as a gh extension (recommended)

```bash
gh extension install franky47/gh-copilot-usage
```

This will automatically download the appropriate precompiled binary for your platform. No additional dependencies required!

### Install from source (for development)

If you want to contribute or customize the extension:

```bash
# Clone the repository
git clone https://github.com/franky47/gh-copilot-usage
cd gh-copilot-usage

# Install dependencies
bun install

# Install as local extension
gh extension install .
```

**Requirements for source installation:**

- [Bun](https://bun.sh/) runtime
- [GitHub CLI](https://cli.github.com/) (`gh`)

## Usage

```bash
# Basic usage (uses default plan and limit)
gh copilot-usage

# Specify a plan (uses plan's default limit)
gh copilot-usage --plan pro+

# Specify a custom limit (overrides plan limit)
gh copilot-usage --limit 500

# Combine plan and custom limit (shows plan in UI, uses custom limit)
gh copilot-usage --plan enterprise --limit 2000

# Show help
gh copilot-usage --help

# Show version
gh copilot-usage --version
```

## Configuration

Both the plan and monthly premium request limit can be configured. The extension checks configuration sources in priority order for each setting independently.

### Plan Configuration

The plan determines which plan name appears in the UI and the default limit if no custom limit is set. The plan can be configured in the following priority order:

1. **CLI flag** (highest priority)

   ```bash
   gh copilot-usage --plan pro+
   ```

2. **Environment variable**

   ```bash
   export GH_COPILOT_PLAN=pro+
   gh copilot-usage
   ```

3. **gh config**

   ```bash
   gh config set copilot-usage.plan pro+
   gh copilot-usage
   ```

4. **Default value** (Pro)
   ```bash
   gh copilot-usage
   ```

### Limit Configuration

The monthly premium request limit can be configured separately and will override the plan's default limit. The limit uses the following priority order:

1. **CLI flag** (highest priority)

   ```bash
   gh copilot-usage --limit 500
   ```

2. **Environment variable**

   ```bash
   export GH_COPILOT_LIMIT=500
   gh copilot-usage
   ```

3. **gh config**

   ```bash
   gh config set copilot-usage.limit 500
   gh copilot-usage
   ```

4. **Plan's default limit** (based on selected plan)

### Available Plans

| Plan | Limit | Description |
|------|-------|-------------|
| `free` | 50 | GitHub Copilot Free tier |
| `pro` | 300 | GitHub Copilot Pro (default) |
| `pro+` | 1500 | GitHub Copilot Pro+ |
| `business` | 300 | GitHub Copilot Business |
| `enterprise` | 1000 | GitHub Copilot Enterprise |

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) must be installed and authenticated
- Your GitHub account must have a user scope for billing API access
  - If you see authentication errors, run: `gh auth refresh -s user`

## How it Works

The extension uses the GitHub API to fetch your premium request usage data and displays it in a beautiful terminal UI. It tracks:

- Total premium requests used vs. your monthly limit
- Current position in the billing cycle
- Per-model breakdown of usage
- Next reset date

## Upgrading

To upgrade to the latest version:

```bash
gh extension upgrade copilot-usage
```

Or upgrade all extensions:

```bash
gh extension upgrade --all
```

## Uninstalling

```bash
gh extension remove copilot-usage
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development

```bash
# Install dependencies
bun install

# Run locally
bun run src/index.ts

# Build for local platform
bun run build

# Build for all platforms
bun run build:all
```

### Creating a Release

Releases are automated via GitHub Actions. To create a new release:

1. Update the version in `package.json`
2. Commit your changes
3. Create and push a git tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. GitHub Actions will automatically:
   - Build binaries for all platforms (macOS, Linux, Windows)
   - Create a GitHub release
   - Attach the compiled binaries to the release

Users can then upgrade with: `gh extension upgrade copilot-usage`

## License

MIT - see [LICENSE](./LICENSE) for details

## Credits

Made with ❤️ by [François Best](https://github.com/franky47)
