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

The simulation runs in the browser; the Node.js backend persists one local single-player world and its most recent 500 journal events to `data/world.json`. It is not a multi-user server or an LLM-agent simulation. Autonomous agents act deterministically by turn order, with some random building choices. The world advances only while the page is open.

- Work mints role-based wages, farmers produce rations, engineers gain sales power, and managers improve harmony. Player actions use keyboard or hotbar controls.
- Autonomous agents lose stamina, buy a ration when hungry if stock and funds are available, and otherwise receive the prototype's free granary fallback. This is not a starvation simulation.
- Agents approaching their context threshold can retire and pass their existing wallet and equipment to the next generation; generation is capped by the preset. A player can also trigger a handover at the shrine before reaching the threshold.
- Buildings add power and factories increase treasury income. Tool upgrades increase work output. The charter's wage reform changes wages; other displayed charter descriptions are aspirational and do not yet implement all listed effects. The current UI permits a player to cycle laws regardless of rank.
- The journal records player dialogues and autonomous turns. Expand **WORLD HISTORY** to inspect recent events. A revision conflict means a second browser changed the same save: stop interacting in one tab and reload it. Unsaved changes in that tab will be lost on reload.

### Run locally

Requires Node.js 18 or newer; no packages are needed.

```sh
npm start
# Open http://127.0.0.1:4173
npm test
```

The server listens only on localhost. Opening `public/index.html` directly does not connect to the persistence API. The UI reports when saving is unavailable. Save data is excluded from Git; back up `data/world.json` if needed. `PORT` and `SOCIETY_DATA_FILE` can override the server port and save location.

### Experiment

`npm test` runs the actual browser controller in a lightweight simulated DOM against the real HTTP service for 100 autonomous turns, then checks persisted state, event history, reload, and rejection of stale writes. See [experiment notes](docs/experiment.md). It does not validate canvas rendering or replace an interactive browser test.
