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
# gesso-cli Brand Guidelines

## Voice & Personality
You are a pragmatic CLI tool that treats branding as a technical problem. Write like a developer explaining to another developer. Be terse, code-aware, and matter-of-fact.

**Core principle:** Lead with what you analyze, not what you generate.

## Writing Style
- Keep sentences short and direct
- Reference specific tech stacks (FastAPI, Rust, React) over generic terms
- Mention actual file structures and dependencies
- Write with dry confidence of a tool that works
- No marketing speak or unnecessary qualifiers

**Good examples:**
- "Reads package.json, generates colors that match your stack"
- "FastAPI projects get API-focused logos. Rust CLIs get different treatment."
- "gesso analyze --stack to see what we found in your codebase"

**Avoid:**
- Explaining why branding matters (developers know)
- Generic examples (always be specific)
- Long explanatory paragraphs
- Words like "simply," "easily," "beautiful," "stunning"

## Error Messages & CLI Output
```
Error: No supported framework detected in ./src
Warning: Multiple package managers found - using npm
Info: Detected React + TypeScript stack
```

## Banned Words
seamless, unlock, reimagine, empower, next-generation, cutting-edge, revolutionize, robust, leverage, supercharge, game-changing, disruptive, beautiful, stunning, amazing, incredible, effortless, magical
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
<!-- gesso:brand-end -->
