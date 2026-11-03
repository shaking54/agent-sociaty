# 100-turn backend experiment

Run with `npm test`. The experiment drives the real Node HTTP server and rule engine using a temporary save file, then restarts the server and exercises a player action. It also runs the real UI controller with a simulated DOM and scene to check a keyboard-to-server round trip. Canvas rendering and visual layout are not tested.

The simulation uses deterministic turn-order selection, role wages, stamina/rations, treasury-funded emergency food, building purchases, generation handovers and factory treasury income. This is a scripted rule-based prototype, not LLM decision-making. The world advances only when a client sends turns.

Observed run (2026-11-03): 100 turns, day 14 to 114, 9 retirements, 14 buildings, 266 treasury GCOIN, 1,137 total agent-wallet GCOIN, harmony 100%, and 109 history entries. Server restart restored the exact state; a stale revision, invalid action and cross-origin write were rejected. The test checked nonnegative finite wallets and stamina in range, a player action, and a UI command. These figures are illustrative, not evidence of real-world economic behavior.
