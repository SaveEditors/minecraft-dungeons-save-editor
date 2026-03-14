# Minecraft Dungeons - Save Editor

![Minecraft Dungeons - Save Editor Header](assets/readme-header.svg)
<p align="center">
  <img src="./GithubHeader.png" alt="Header" />
</p>

A browser-first save editor for Minecraft Dungeons focused on local `.dat` and `.json` editing.

Use editor without downloading [HERE](https://saveeditors.github.io/minecraft-dungeons-save-editor/)

All editors homepage: [`https://saveeditors.github.io/`](https://saveeditors.github.io/)


## What You Can Edit Right Now

- Character progression values including XP-backed level and gear power.
- Currency values such as emeralds, gold, and eyes of ender.
- Inventory, storage chest, and equipped slot payloads.
- Item metadata fields, enchantment tiers, and gilded/netherite fields.
- Raw JSON fallback edits for advanced troubleshooting.

## Not Confirmed / Not Exposed Yet

- Full parity for every game-pak driven icon/name localization path.
- Automated mapping for every unknown field outside current editor surfaces.
- Future game-update fields that are not yet observed in current save samples.

## Quick Start (PowerShell)

Run from this folder:

- `python -m http.server 8080`

Then open `http://127.0.0.1:8080` and load your save.

## Save Paths (Windows)

- Typical character save root: `%USERPROFILE%\Saved Games\Mojang Studios\Dungeons\<account-id>\Characters`
- Main save file pattern: `*.dat`
- Cloud variants to check before editing:
  - active locally synced save file
  - cloud conflict/duplicate copy
  - local backup copy (`.bak` or renamed `.dat`)

## Notes

- Keep backup creation enabled before writing edits.
- Close the game/cloud sync before editing and relaunch after save.
- Export supports encrypted `.dat` and readable `.json` workflows.

What this does not do yet: it does not auto-map every unknown field from every possible game build.




