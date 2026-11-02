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

### Core Game Rules (`SHA-86` & `SHA-85`)
1. **Stamina & Rations Survival Loop**: Every turn drains Stamina. Hungry agents (`<62% Stamina`) walk across the bridges to the **GCOIN Market** to buy and eat a **Staple Food Ration (1 GCOIN)** for `+42% Stamina`.
2. **Role Production & District Upgrades (`Lv.1 → Lv.5`)**:
   - **Farmers (Farmstead)**: Harvest Staple Food Rations + earn Farmer Wage.
   - **Engineers (Workshop)**: Craft Storage FIFO & Irrigation Blueprints + earn Engineer Wage.
   - **Managers (Town Hall Clubhouse)**: Boost **Society Harmony (%)** + coordinate pilots.
3. **10,000-Token Generational Handover**: When an agent's context reaches `10,000 tokens`, they walk to the **Lineage Archive**, retire, and spawn a **Gen +1 Heir** who inherits 100% of Wallet GCOIN, Inventory, and `+10% Dynasty Wage Mastery`.
4. **Archon Power & Playable Charter Laws**: `Power = Wallet + (Completed Sales × 2) + Gen Bonus`. The `#1 Power` agent wears the **Archon Crown** and can enact/repeal **6 Charter Laws** that dynamically alter game mechanics.

### Running Locally
- **Zero-Server (Direct File)**: Open `public/index.html` directly in any browser.
- **Optional Local Server**: Run `npm start` (`http://localhost:4186`).
