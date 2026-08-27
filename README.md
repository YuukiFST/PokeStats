# PokeStats

Offline desktop app for competitive Pokemon on Cobbleverse / Cobblemon. Runs without internet as a single .exe.

## Problem it solves

Cobbleverse players need to check stats, types, Sets and build teams without relying on a browser or Smogon online. PokeStats V1 tried in Python Flet, but it treated Form as Species, mixed generations and even listed CAP fakemon that do not exist in the game. It was slow and the numbers could not be trusted.

PokeStats V2 is a full rewrite to match the game you actually play: Gen 9 engine, Legends: Z-A megas, correct Base Stats and types per generation, and no CAP.

## Features

- Pokedex with search, type and Form Kind filters (base, mega, gmax, regional and others) and ranking by any Base Stat or BST
- Side-by-side comparison of up to 4 Forms, collapses when BST ties
- Form detail with Base Stats, Defensive Profile (weaknesses, resistances, immunities) and Sets by Dex Generation and Format
- Smogon Sets with one-click Showdown Export
- Tier per Form and per generation
- Team Builder for up to 6 Forms with aggregated Defensive Profile and Offensive Coverage
- Threat Matchup with two modes: type math and Smart Counters (beta), which uses the opponent's movepool and Set EVs to suggest counters and sorts by BST
- Moves and Types browsing with details
- Local cached animated sprites
- Ctrl+K palette, Geist dark theme and EN / pt-BR language
- 100% offline. Dataset and sprites embedded in the binary, no runtime requests
