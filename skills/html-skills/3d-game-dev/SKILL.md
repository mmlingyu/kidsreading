---
name: 3d-game-dev
description: Build a small walkable 3D scene through a Blender gateway, then iterate its visual fidelity against an approved target image.
whenToUse: Use for game DIY requests involving a bounded 3D location, player movement, one landmark interaction and visual iteration.
user-invocable: true
---

# 3D Game Development

Orchestrate Blender scene construction and visual iteration. Do not invent a Three.js or Unity path unless the project explicitly requests a web-engine output.

## Hard preflight

Before building:

1. Call the configured Blender gateway capability check. It must prove a live Blender connection by reading the scene, creating a temporary red cube, capturing a viewport image, saving a test `.blend`, and rendering it.
2. Confirm image generation and image inspection capabilities.
3. Work only in this project's workspace. Keep an editable `.blend`.

If the Blender gateway is absent, stop with `blocked` status and explain how the deployment operator must configure it. Do not claim a runnable game was produced.

## Workflow

1. Limit scope to one bridge, street, courtyard or similarly bounded region. Record in/out of scope.
2. Generate or select a colored, dimensional, screenshot-like target image. Save it under `outputs/target.png`.
3. Stop and request human approval of the target image before any modeling.
4. In Blender, block major masses first, then implement player movement and camera. Launch and verify movement.
5. Add one landmark interaction and make it reliable before duplicating the pattern.
6. Perform three visual iterations. Each compares a live screenshot to the approved target, names the single largest visual problem, fixes it, and rechecks movement and interaction.
7. Request a human playtest.

## Required outputs

- editable `outputs/scene.blend`
- approved target and per-round screenshots
- runnable launch instructions
- `outputs/report.md` with scope, interaction, visual differences and playtest status
- a Studio-generated `outputs/preview.html` delivery summary for safe sharing

Never skip the target-approval or human-playtest gates.
