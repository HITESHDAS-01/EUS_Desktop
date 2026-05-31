# EUS Desktop — Phase 1 MVP

EUS cooperative society admin dashboard, packaged as an **offline Windows desktop app**
using **Tauri 2 + React + SQLite**.

This is the desktop port of the `eus/` web app. Phase 1 covers:

- Single-admin login (first-run sets the password)
- Local SQLite database (in your Windows AppData folder)
- Members tab — add / edit / delete / search / filter / sort / bulk delete
- Member photo upload (saved locally as files, not in the DB)

Other tabs (Transactions, Loans, Reports, Product EMI, Settings) are visible in the
sidebar as **"soon"** placeholders and will land in Phase 2+.

---

## One-time setup on your Windows PC

You need **3 things installed** before this app will run. Do these in order.

### 1. Node.js (probably already installed)

Open PowerShell and run:

```powershell
node --version
npm --version
```

If you see version numbers (e.g. `v24.14.1` and `11.11.0`), skip ahead. Otherwise
install Node 20+ from [nodejs.org](https://nodejs.org/) (LTS installer is fine).

### 2. Microsoft C++ Build Tools

Tauri compiles native code, so you need MSVC. The smallest option:

1. Download the **Build Tools for Visual Studio 2022** installer from
   <https://visualstudio.microsoft.com/visual-cpp-build-tools/>
2. In the installer, tick **"Desktop development with C++"**
3. Click Install (this is the biggest download — ~6 GB)
4. Reboot when it asks

### 3. Rust toolchain

The official one-liner:

1. Download `rustup-init.exe` from <https://www.rust-lang.org/tools/install>
2. Run it, accept the defaults (Press `1` then `Enter`)
3. Close and reopen PowerShell, then verify:

```powershell
rustc --version
cargo --version
```

Both should print versions. If `rustc` is not found, log out and back in (or
reboot) and try again — PATH needs to refresh.

---

## Running the app (every time)

Open PowerShell, `cd` into this folder, and the first time only:

```powershell
cd "C:\Users\PRAN\Documents\EUS WEB\eus-desktop"
npm install
```

Then to launch the app in dev mode (with hot-reload):

```powershell
npm run tauri:dev
```

The first launch will be **slow** (5–10 min) — Rust compiles the entire Tauri
runtime from source. Subsequent launches take ~10 seconds.

A native window will pop up. You'll see the **first-run setup screen** asking
you to choose an admin password. Pick anything (min 6 chars) — **write it down**,
there is no password reset yet. After you click "Create Admin Account", you go
straight into the Members tab.

### Quitting

Just close the window — the SQLite file is fsync'd on every write, so nothing
is ever in-flight.

---

## Where is my data?

The SQLite database and member photos live in your Windows AppData folder:

```
C:\Users\PRAN\AppData\Roaming\in.eus.desktop\
├── eus.db          (your SQLite database — all member data)
└── photos\          (member profile pictures, one file per upload)
```

To **back up your data**, just copy this whole folder somewhere safe (USB stick,
OneDrive, etc.). To **start over**, delete `eus.db` and relaunch the app — you'll
get the first-run setup again.

A proper "Backup Now" button arrives in Phase 4.

---

## What if something goes wrong?

| Symptom | Likely cause | Fix |
|---|---|---|
| `cargo: command not found` | Rust not on PATH | Reboot PowerShell or your PC |
| Build fails with `link.exe not found` | MSVC missing | Install Build Tools (step 2 above) |
| Window opens blank / white | Vite dev server not running | Quit and re-run `npm run tauri:dev` |
| Locked out (forgot password) | No recovery flow in Phase 1 | Delete `eus.db` from AppData, start over |
| App icon missing during build | `src-tauri/icons/` empty | See `src-tauri/icons/README.md` |

---

## Building the installer

You have two options.

### Option A — GitHub Actions (recommended on a low-spec machine)

Every push to `main` triggers a Windows build on GitHub's runners. To download
the installer:

1. Go to the [Actions tab](https://github.com/HITESHDAS-01/EUS_Desktop/actions)
2. Click the latest successful run
3. Scroll to **Artifacts** → download `eus-desktop-msi` (or `eus-desktop-nsis`)
4. Unzip → run the `.msi` to install

To **trigger a build manually** without pushing: Actions tab → "Build Windows
installer" → "Run workflow".

To **cut a release** (creates a tagged GitHub Release with installers attached):

```powershell
git tag v0.1.0
git push origin v0.1.0
```

The first CI build takes ~15 min (Rust crates compile from scratch). Subsequent
builds hit the cache and finish in ~5 min.

### Option B — local build

If you have the Rust toolchain installed (see setup above), you can build locally:

```powershell
npm run tauri:build
```

Output ends up in `src-tauri/target/release/bundle/`.

App icons are generated automatically in CI from `src-tauri/app-icon.png`. For a
local build, run `npx tauri icon ./src-tauri/app-icon.png` once before the first
build to populate `src-tauri/icons/`. Replace `app-icon.png` with your real logo
(square, ≥1024×1024) when you have one — it propagates to all icon sizes.

---

## Project layout (for the curious)

```
eus-desktop/
├── src/                  React frontend
│   ├── components/ui/    Button, Input, Label primitives
│   ├── lib/
│   │   ├── api.ts        Tauri invoke wrappers — your "Supabase replacement"
│   │   ├── AuthContext.tsx
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Login.tsx     First-run setup + login screen
│   │   ├── AdminShell.tsx  Sidebar layout
│   │   └── Members.tsx   The Members tab
│   ├── types/db.ts       TypeScript types matching DB rows
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/            Rust backend
│   ├── src/
│   │   ├── main.rs       Entry — just calls lib::run()
│   │   ├── lib.rs        Wires up Tauri + DB + invoke handlers
│   │   ├── db.rs         SQLite schema + migrations + member_code generator
│   │   ├── auth.rs       Argon2 password hashing
│   │   ├── commands.rs   All #[tauri::command] handlers (the "RPC layer")
│   │   ├── state.rs      AppState (shared DB connection + login flag)
│   │   └── error.rs      AppError type for command results
│   ├── capabilities/default.json   Tauri permission allowlist
│   ├── icons/            App icons (need to be added before bundling)
│   ├── tauri.conf.json   Tauri config (window size, bundle settings)
│   ├── Cargo.toml        Rust dependencies
│   └── build.rs
├── index.html
├── package.json
└── vite.config.ts
```
