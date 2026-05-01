---
covers: Foundation entry point — what the scene-engine is for, who uses it, and the principles that guide it.
type: overview
---

# Foundation

What the scene-engine is, why it exists, and the mental model behind it. Read this before changing behavior so changes align with intent rather than just current code.

---

## Contents

### [10-problem.md](10-problem.md)
The friction that motivated the scene-engine: hand-wired pages don't compose, and the asset library has outgrown the per-page approach.

### [20-vision.md](20-vision.md)
What success looks like — Unity-style scenes assembled from typed asset layers, authored from two surfaces (visual editor and AI agent) on the same data.

### [30-principles.md](30-principles.md)
Decisions and constraints that shape the system: scene = page, content separate from composition, dual-surface authoring as a first-class pattern.
