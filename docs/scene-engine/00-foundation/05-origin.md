---
covers: Where the project came from — the impulse, the gap in tooling, and what it grew into.
concepts: [origin, melee, game-menus, fixed-viewport, figma, unity]
---

# Origin

This project started as an attempt to recreate the Super Smash Bros. Melee home screen in CSS and HTML — just to see if it could be a website. But the work kept compounding. Getting the layering right, trying different colors, adjusting blend modes, tweaking animations — every change meant hand-editing code and refreshing. The iteration loop was too slow for visual composition work.

Unity handles this well for game design. You place assets in a scene, adjust properties in an inspector, and see the result immediately. Figma handles it well for web design, but for flat, scrolling layouts — not for the kind of fixed-viewport, layered, cinematic screens that game menus are.

There's nothing that sits in the gap between them. No tool that blends Figma's web-native output with Unity's scene-composition model, specifically aimed at building websites that feel like video game screens.

---

## The Gap

Game menus have a specific feel:

- **One viewport, no scrolling.** Everything is composed within a fixed frame.
- **Layered composition.** Backgrounds, effects, UI elements, text — all stacked and blended at specific depths.
- **Interactive but contained.** You navigate with selections and transitions, not by scrolling a document.
- **Cinematic polish.** Animations, sound, lighting effects — the menu IS the experience.

Traditional web tools don't target this. They're built for documents, dashboards, or marketing pages. Game engines target it but don't output web pages. Nothing exists for someone who wants to make a website that feels like a character select screen.

## What It Grew Into

What started as a Melee recreation became a broader tool: an editor and composition engine for building fixed-viewport, game-menu-style websites. The name **Main Menu** captures what this is — a tool for making main menus. Not game engines, not scrolling websites. The specific experience of a game's main menu, delivered as a web page.
