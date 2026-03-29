<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".gesso/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".gesso/logo-light.svg">
    <img src=".gesso/logo-light.svg" alt="gesso-cli" width="280">
  </picture>
</p>

# gesso-cli

Brand assets that read your code first

[![Build Status](https://img.shields.io/github/actions/workflow/status/gsymmy30/gesso/ci.yml?branch=main)](https://github.com/gsymmy30/gesso/actions)
[![npm version](https://img.shields.io/npm/v/gesso-cli)](https://www.npmjs.com/package/gesso-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Generate logos and colors by analyzing your actual codebase - FastAPI projects get API-focused branding, Rust CLIs get different treatment than React apps.

## Why

Most brand generators start with generic templates that ignore what you actually built. Your CLI tool ends up with the same logo as a meditation app because they don't read your code first. gesso-cli analyzes your repository structure, detects dependencies, and identifies frameworks before generating brand assets that match your specific project type.

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

# Generate with brand scoring analysis
gesso generate --score

# Analyze repository without generating assets
gesso analyze

# Export brand data as JSON
gesso export --format json
```

## Features

- **Repository analysis** — Parses package.json, Cargo.toml, requirements.txt to detect tech stack and dependencies
- **AI-powered contextual logo generation** — Creates SVG logos using Satori based on project type and architecture
- **Brand-consistent color palettes** — Generates colors that reflect your codebase characteristics
- **Multiple AI model support** — Works with Anthropic Claude and OpenAI models
- **Structured JSON brand data export** — Outputs brand data for programmatic reuse across platforms
- **Brand scoring system** — Evaluates brand consistency using custom heuristics
- **Interactive CLI options** — Built with Commander.js for flexible command-line interaction
- **Tech stack detection** — Identifies frameworks, languages, and project patterns from file structure

## Configuration

Create `.gesso/config.json` in your project root:

```json
{
  "model": "claude-3-5-sonnet",
  "output": ".gesso",
  "analysis": {
    "includeTests": false,
    "maxFiles": 100
  },
  "brand": {
    "scoring": true,
    "colorCount": 5
  },
  "ai": {
    "apiKey": "your-api-key",
    "maxTokens": 4000
  }
}
```

Environment variables:
```bash
export ANTHROPIC_API_KEY=your-claude-key
export OPENAI_API_KEY=your-openai-key
```

## How it works

gesso-cli combines repository file analysis with AI-powered brand generation. It detects your tech stack by parsing package.json, Cargo.toml, requirements.txt and other dependency files, analyzes project structure, then uses multiple AI models with custom scoring algorithms to generate contextual brand assets. A FastAPI project gets API-focused branding, while a Rust CLI gets different treatment than a React app.

The tool uses Satori for SVG generation, Zod for data validation, and p-limit for concurrent processing. Brand scoring evaluates existing assets and repository signals to maintain consistency.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT