# TODOS

## P1 — Must resolve before v1 launch

### CI/CD publish pipeline
**What:** GitHub Actions workflow: run vitest on PR, build with tsup, publish to npm with provenance on git tag (e.g., `v1.0.0`).
**Why:** Without this, publishing is manual and error-prone. `npx gesso-cli` requires a published package.
**Effort:** S (human: ~half day / CC: ~15 min)
**Depends on:** tsup config, vitest config

### Archetype library curation
**What:** Create 6 archetype JSON files (cli-tool, sdk-library, api-service, data-infra, web-app, devtool) with 3 palettes and 2 font pairings each. CC drafts initial versions, human reviews color choices for quality.
**Why:** Generators select colors/fonts from archetypes. Without these files, the visual generation step has nothing to select from. This is the design quality gate.
**Effort:** M (human: ~1 day for review / CC: ~20 min for drafts)
**Depends on:** Nothing (can start immediately)

### Font bundling + text-to-outline for logo SVG
**What:** Bundle curated fonts (Inter, Space Grotesk, JetBrains Mono, IBM Plex) as .woff2 files. Convert text to SVG path outlines in logo generation so the logo renders correctly regardless of viewer's installed fonts. Satori handles font loading for OG images.
**Why:** A text SVG that depends on the viewer having the font is not a real asset. Codex outside voice flagged this as a credibility issue.
**Effort:** M (human: ~2 days / CC: ~20 min)
**Depends on:** Archetype library (font pairing selection determines which fonts to bundle)

## P2 — Important but not blocking launch

### Monorepo support (`--path` flag)
**What:** Add `--path` flag to scope analysis to a subdirectory within a monorepo. Change the root passed to repo-reader.
**Why:** "Analyze the repo" is meaningless when one repo contains multiple packages/products. Codex flagged this gap.
**Effort:** S (human: ~half day / CC: ~10 min)
**Depends on:** Nothing

### Content-hash caching for analysis results
**What:** Hash the sampled file contents, cache the analysis result to disk (~/.gesso/cache/). Skip the analysis LLM call on re-runs if the hash matches.
**Why:** Regenerate, diff mode, compare, and re-runs all repeat the same expensive analysis. Saves one LLM call + 3-5s and ~$0.02 per cached re-run.
**Effort:** S (human: ~half day / CC: ~15 min)
**Depends on:** Nothing

