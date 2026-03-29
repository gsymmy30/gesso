# Gesso — Claude Code Instructions

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Project
Gesso is a CLI tool that generates brand identity from code analysis.
See `docs/designs/gesso-brand-engine.md` for the full plan.
See `TODOS.md` for deferred work items.

<!-- gesso:brand-start -->
<!-- gesso:brand-start -->
## gesso-cli Brand Guidelines

**Product**: CLI tool that generates brand identity matching your codebase in one command

**Voice**: Terse, matter-of-fact, code-aware. Assume users understand their projects and need efficient brand asset generation.

### Writing Style

**Commands & Descriptions**: Under 10 words when possible
**Error Messages**: Direct, actionable, reference actual file paths
**Documentation**: Lead with functionality, use repo terminology naturally

### Language Patterns

**Good**: 
- "Analyzes TypeScript interfaces for color palette"
- "Reads package.json dependencies for tech stack icons"
- "Outputs SVG logos to ./brand/logos/"

**Avoid**:
- Marketing language about brand journeys
- Qualifiers like "simply" or "just"
- Apologizing for limitations
- Explaining why branding matters

### Naming Conventions

- Use kebab-case for CLI flags: `--dry-run`, `--output-dir`
- Reference actual file extensions: `.ts`, `.json`, `.md`
- Use standard directory names: `src/`, `dist/`, `brand/`

**Banned Terms**: seamless, unlock, reimagine, empower, next-generation, cutting-edge, revolutionize, robust, leverage, supercharge, game-changing, disruptive, effortless, magical, intelligent, smart, automagically
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
