# Release Instructions

Use editor without downloading HERE: https://saveeditors.github.io/minecraft-dungeons-save-editor/

## Deployment Notes + Default Save Locations
- Repo: `minecraft-dungeons-save-editor`
- Deployment target: GitHub Pages from `main` branch root (`/`).
- Steam default save root (Windows): `%USERPROFILE%\Saved Games\Mojang Studios\Dungeons\<account-id>\Characters`
- Game Pass / Microsoft Store default save root (Windows): `%USERPROFILE%\Saved Games\Mojang Studios\Dungeons\<account-id>\Characters`
- Expected primary cloud save file name: character `*.dat` in `Characters` folder.
- Cloud variants to account for during support/testing:
  - active local synced file,
  - cloud conflict/duplicate copy,
  - local backup (`.bak` or renamed `.dat`).

## Release Checklist
1. Verify `index.html` works at repo root.
2. Validate open/edit/export for both `.dat` and `.json`.
3. Confirm README links and screenshot/header assets are present.
4. Create release ZIP including:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `assets/`
   - `README.md`
   - `RELEASE_INSTRUCTIONS.md`
5. Tag and publish:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

6. Create GitHub release and upload ZIP asset.
