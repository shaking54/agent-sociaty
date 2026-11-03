# Agent Society: Pixel-Art 3D & 2.5D Dynasty Simulator Game (`SHA-86` / `SHA-85`)

An interactive **Pixel-Art 3D Floating-Island & 2.5D Isometric Voxel Simulator Game** implementing the **Agent Society** multi-generation economy, survival, and governance rules from Linear tickets **SHA-86** and **SHA-85**.

### Visual & Game Style
- **Pixel-Art 3D Floating-Island Diorama (`https://www.tripo3d.ai/3d-prompts/pixel-art-tennis-club-3d-game`)**:
  - **Nearest-Neighbor Pixel-Art 3D Shader Pass**: Toggle live between **🕹️ Pixel 3D (2×)**, **👾 Retro 8-Bit Scanline (3×)**, and **✨ HD Voxel (1×)** rendering.
  - **Dynamic Floating Sky Islands**: Stepped terracotta/slate rock undersides, hanging pixel vines, animated pixel waterfalls cascading into mist, drifting 16-bit pixel clouds, and a cozy red-roofed **Pixel-Art 3D Civic Clubhouse & Court** with white court boundary lines.
  - **Dynamic Weather & Time-of-Day Cycle**: Switch between **☀️ Sunny Sky**, **🌅 Golden Sunset**, **🌧️ Pixel Rainstorm**, and **🌙 Cyber Night**.
  - **Custom-Generated Pixel-Art & Voxel Sprites (`public/assets/sprites/`)**:
    - `pixel-farmer.png` / `farmer.png`: Farmer in straw hat carrying harvested grain crate
    - `pixel-engineer.png` / `engineer.png`: Engineer with cyan visor, wrench & glowing blueprint tablet
    - `pixel-manager.png` / `manager.png`: Manager in purple coat holding governance scroll
    - `pixel-archon.png` / `archon.png`: Reigning `#1 Power` Archon in royal cape and golden crown
    - `pixel-clubhouse.png`: Cozy red-roofed Pixel-Art 3D Clubhouse & Lawn Court
    - `pixel-castle.png` / `castle.png`: Stone Granary Keep
    - `pixel-workstation.png` / `workstation.png`: Dual-Monitor Code & CAD Rig
    - `pixel-bridge.png` / `bridge.png`: Red Suspension Market Bridge with Golden GCOIN Crates
    - `pixel-monolith.png` / `monolith.png`: Glowing Pink/Cyan Charter Crystal Monolith
    - `iso-world-map.jpg`: Optional full-board 2.5D Isometric Voxel Observatory Map (`🗺️ World Map` toggle)

### How this prototype works

The Node.js backend owns the rule-based simulation, validates and applies commands, and persists one local single-player world and its most recent 500 journal events to `data/world.json`. The browser renders the world and sends commands; it triggers autonomous turns on a timer while the page is open. It is not a multi-user server or an LLM-agent simulation.

- One non-player actor acts per turn; work mints role-based wages, farmers produce rations, engineers gain sales power, and managers improve harmony. Player actions use keyboard or hotbar controls.
- Hungry agents buy available rations from other agents. If they cannot buy, the emergency-granary law pays 1 treasury GCOIN for a ration; if the reserve cannot pay, no ration is provided.
- At 10,000 context tokens an agent retires and passes its wallet and assets to the next generation, up to the preset generation cap. A shrine handover requires the threshold.
- Buildings add power and factories increase treasury income. Tool upgrades increase work output. The highest-power Archon can toggle a wage-reform law; other legacy charter descriptions are not implemented.
- Expand **WORLD HISTORY** to inspect recent events. A revision conflict means another browser changed the world; reload the stopped tab. The service is intended for one local player and has no account authentication.

### Run locally

Requires Node.js 18 or newer; no packages are needed.

```sh
npm start
# Open http://127.0.0.1:4173
npm test
```

The server listens only on localhost. Opening `public/index.html` directly does not connect to the persistence API. The UI reports when saving is unavailable. Save data is excluded from Git; back up `data/world.json` if needed. `PORT` and `SOCIETY_DATA_FILE` can override the server port and save location.

### Experiment

`npm test` runs 100 actual backend turns over HTTP, checks persistence across server restart, player commands, invalid actions, stale writes and cross-origin rejection, and exercises a UI-controller command with a simulated DOM/scene. See [experiment notes](docs/experiment.md). It does not validate canvas rendering or replace an interactive browser test.

### Experimental OpenClaw runner

The optional runner asks OpenClaw to choose an action for one non-player character per turn. The backend validates and applies that action; characters can leave short messages for one another, and each character's short notes and inbox are saved with the world. Agent-mode server ticks are disabled so the model decisions, not the rule-based scheduler, drive these turns. Existing player controls still work. A revision conflict stops the runner rather than applying a decision to changed state.

```sh
SOCIETY_AGENT_MODE=openclaw npm start
# In another terminal, after configuring OpenClaw and a usable model login:
SOCIETY_TURNS=2 npm run experiment:openclaw
```

The runner only connects to a local server. `SOCIETY_URL` changes that local address and `SOCIETY_TURNS` sets the number of turns (1–100). Agent invocations consume model allowance or may incur provider charges. The runner copies the OpenClaw JSON config to a private temporary directory, removes channel configuration, denies all tools, and uses an empty workspace. It does not edit the existing OpenClaw configuration. The temporary copy is deleted after a normal run; avoid placing secrets directly in config. It requires an OpenClaw `agent exec` version supporting `--config`, and a model/login usable by that isolated command. JSON5 configuration files are not currently supported.

**Limitations:** Each decision currently runs as a fresh OpenClaw session. Character notes and messages persist in the game world, but native session history and generation handover are not yet implemented. Model failures, invalid JSON and revision conflicts stop the run without applying that decision. A simulated context counter still governs the game's retirement mechanic; it is not a measurement of real model context. This is a local prototype, not a secure multi-user deployment.
