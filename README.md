<p align="center"><img src=".gesso/logo.svg" alt="gesso-cli" width="280"></p>

# gesso-cli

Branding that reads your code first

[![Build Status](https://img.shields.io/github/actions/workflow/status/gsymmy30/gesso/ci.yml?branch=main)](https://github.com/gsymmy30/gesso/actions)
[![npm version](https://img.shields.io/npm/v/gesso-cli)](https://www.npmjs.com/package/gesso-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Generate complete brand identity from your codebase in one command.

## Why

Most brand generators start with generic templates. Your CLI tool ends up with the same logo as a meditation app. gesso-cli reads your actual code first - parsing file structures, detecting dependencies, identifying frameworks - then generates brand assets that match what you actually built.

## Install

```bash
npm install -g gesso-cli
```

## Usage

```bash
# Generate brand assets for current repository
gesso generate

# Specify custom output directory
gesso generate --output ./brand

# Use specific AI model
gesso generate --model claude-3-5-sonnet
```

## Features

- **Repository analysis** — Parses file structure, dependencies, and tech stack
- **Contextual logo generation** — Creates SVG logos that reflect your project type
- **Brand-consistent colors** — Generates color palettes based on codebase analysis
- **Copy generation** — Writes taglines and descriptions that match your tech stack
- **Multiple AI models** — Supports Anthropic Claude and OpenAI models
- **Structured output** — Exports JSON brand data for reuse across platforms

## Configuration

Create `.gesso/config.json` in your project root:

```json
{
  "model": "claude-3-5-sonnet",
  "output": ".gesso",
  "analysis": {
    "includeTests": false,
    "maxFiles": 100
  }
}
```

## How it works

gesso-cli combines repository file analysis with AI-powered brand generation. It detects your tech stack, analyzes project structure, then uses multiple AI models with custom scoring algorithms to generate contextual brand assets. Full documentation at [gesso.dev](https://gesso.dev).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
