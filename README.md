# Pokémon Crater

A browser-based, catch-and-battle Pokémon RPG inspired by the classic
*Pokémon Crater*. Everything runs client-side — no server, no build step —
so it hosts directly on **GitHub Pages**.

## Play

Walk around Kanto, wander into tall grass, and battle & catch wild Pokémon.

- **Move:** Arrow keys / WASD, or the on-screen D-pad
- **Confirm:** `Z` / `Enter` / on-screen **A**
- **Cancel / Back:** `X` / `Backspace` / on-screen **B**
- **Menu:** `Space` (START)

On your first visit you choose a starter (Bulbasaur / Charmander / Squirtle),
then step into grass on any route to trigger wild encounters. Battles are
turn-based with the full type-effectiveness chart, STAB, criticals, catching
(Poké / Great / Ultra Balls), potions, switching, running, EXP and leveling.
Progress is saved automatically in your browser (`localStorage`).

## Hosting on GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and deploys
   on every push to `main`. Your game will be live at
   `https://<user>.github.io/<repo>/`.

`.nojekyll` is present so all asset folders are served as-is.

## Structure

```
index.html              Entry point
styles.css              Overworld + battle UI styles
src/
  engine/               Input, camera, tile map, renderer
  ui/                   Controls, HUD, start menu, starter picker
  data/                 Save, Pokédex, party/bag, wild encounters
  battle/               Moves + type chart, turn-based battle system
data/
  maps/ layouts/ tilesets/   Kanto overworld (extracted from decomp)
  pokedex.json               151 species: stats, types, catch rates
  encounters/                Wild encounter tables
  sprites/pokemon/           Gen-1 battle sprites (front/back)
```

## Credits

Overworld tiles and map data derived from the open-source
[pret](https://github.com/pret) Pokémon decompilations. Battle sprites from
the [PokéAPI/sprites](https://github.com/PokeAPI/sprites) project. This is a
non-commercial fan project; Pokémon is © Nintendo / Game Freak / The Pokémon
Company.
