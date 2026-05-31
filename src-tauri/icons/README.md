# App icons

For **dev mode** (`npm run tauri:dev`), icons are not required — Tauri will use a
default placeholder window icon.

For **bundling an installer** (`npm run tauri:build`), the following files MUST
exist in this folder, or the bundle step will fail:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.ico` (Windows app icon — multi-resolution `.ico`)
- `icon.icns` (macOS — not needed for Windows-only builds)

### Easy way

Once you have a single high-res square logo PNG (1024×1024 or larger), generate
all sizes in one shot with the Tauri CLI:

```powershell
npm run tauri icon path\to\your-logo.png
```

That populates this folder with everything in the right sizes/formats.

For Phase 1 (dev only) you can skip this step entirely.
