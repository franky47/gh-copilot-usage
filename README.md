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
# Basic usage (uses default or configured limit)
gh copilot-usage

# Specify a custom limit
gh copilot-usage --limit 500

# Show help
gh copilot-usage --help

# Show version
gh copilot-usage --version
```

## Configuration

The monthly premium request limit can be configured in multiple ways. The extension uses the following priority order:

1. **CLI flag** (highest priority)

   ```bash
   gh copilot-usage --limit 300
   ```

2. **Environment variable**

   ```bash
   export GH_COPILOT_LIMIT=300
   gh copilot-usage
   ```

3. **gh config**

   ```bash
   gh config set copilot-usage.limit 300
   gh copilot-usage
   ```

4. **Default value** (300 for GitHub Copilot Pro)
   ```bash
   gh copilot-usage
   ```

### Plan Limits

Configure based on your GitHub Copilot plan:

- **Copilot Pro**: 300 premium requests/month (default)
- **Copilot Business/Enterprise**: Contact your organization admin for your limit

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
