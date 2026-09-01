# Items, Types, and Natures catalogs

Date: 2026-08-31

## Problem

PokeStats has a per-type hub and item/nature fields on Sets, but no place to browse the full item dex, study dual-type defense, or learn the 25 natures.

## Goal

Three sidebar destinations — Types, Items, Natures — using existing Geist tokens, Showdown data, and the type chart already in the domain.

## Out of scope

- Abilities hub
- Changing which Moves are stored
- Persisting workspace tabs
- New art beyond the vendored itemicons sheet

## Behavior

### Items

- `/items` lists every held item from Showdown `items.js` (not only Set-referenced names).
- Search by name or effect. Filter by `kind` and by “used in Sets”.
- `/items/$itemId` (slug) shows icon, effect, and Sets that hold it (waits for `extrasReady`).

### Types

- `/types` is the entry: 18 type tiles (1–2 selected), defensive matchup bands (4× / 2× / ½× / ¼× / 0×, omit 1×), toggle to an 18×18 chart.
- URL: `?t=Fire` or `?t=Fire,Water` and `?view=chart`.
- `/types/$typeId` keeps the existing hub, using the same band UI.

### Natures

- `/natures` is a 5×5 plus×minus grid (no HP). Diagonal = Hardy / Docile / Bashful / Quirky / Serious.
- `?n=Timid` selects a cell. Side panel shows +/− and Sets that use it.

### Shell and palette

- Sidebar group after Moves: Types, Items, Natures.
- Ctrl+K also finds items and natures.

## Data

`ItemInfo` gains `desc`, `gen`, `kind`, `isNonstandard`. Kinds: mega, zcrystal, berry, choice, plate, memory, drive, utility — derived at build from Showdown flags.
