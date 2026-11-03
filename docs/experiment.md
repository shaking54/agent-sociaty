# 100-turn prototype experiment

Run with `npm test`. The harness executes the real browser game controller and initial dataset in a simulated DOM and uses the real HTTP server with a temporary save. The scene/canvas is stubbed; this is a simulation and persistence integration test, not visual browser verification. Building choice uses a fixed random value (0.75); movement and player actions are not simulated.

Rules under test are those implemented in `public/app.js`: one non-player actor per turn, role wages, stamina/rations with a free granary fallback, building purchases, generation handovers and factory treasury income. This is a scripted rule-based prototype, not autonomous LLM decision-making.

Observed run (2026-11-03): 100 turns, day 14 to 114, 9 retirements, 14 buildings, 254 treasury GCOIN, 1,076 total agent-wallet GCOIN, harmony 100%, and 110 history entries. Reload restored day 114; a stale revision was rejected with HTTP 409. The test also checked nonnegative finite wallets and stamina in range. Figures are illustrative, not evidence of real-world economic behavior. History includes initial creation and other messages, in addition to the 100 autonomous-turn entries.
