# Puzzle Source Policy

This document defines how puzzles in Mingdeng Miju (明灯迷局) should be created, selected, and recorded.

## Source Rule

All built-in campaign puzzles and generated infinite-mode puzzles should be produced by the project's own generation and validation pipeline.

Do not import, scrape, copy, trace, or manually reproduce puzzle grids from:

- Nikoli publications or websites.
- Third-party Light Up / Akari puzzle websites.
- Mobile apps or screenshots.
- Books, magazines, PDFs, videos, or shared puzzle packs without explicit permission.

## Fixed Campaign Levels

Campaign levels should follow this pipeline:

1. Generate candidate puzzles with the internal generator.
2. Verify uniqueness with the internal solver.
3. Review difficulty and visual quality.
4. Add selected puzzles to `src/data/puzzles.ts`.
5. Keep tests passing with `src/data/puzzles.test.ts`.

The campaign level list is intended to be a curated set generated for this project, not a collection copied from third-party sources.

## Infinite Mode

Infinite mode should generate puzzles at runtime or from internal generation tools. Generated puzzles must pass the uniqueness check before being presented as playable puzzles.

## Difficulty Labels

Difficulty labels such as easy, medium, hard, and expert are internal product labels. They should be based on board size, clue density, constraint structure, and solver/generator metrics, not copied from third-party puzzle collections.

## Record Keeping

When the fixed puzzle library is expanded or regenerated, record the generation method in commit messages or project notes. This helps demonstrate independent creation if the project is later published commercially.
