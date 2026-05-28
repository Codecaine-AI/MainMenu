# External Project Workspaces

Use this objective bundle for the Scene Engine restructure that moves projects
out of `apps/scene-engine/` and into external, Unity-inspired project
workspaces. The engine should load project roots from a file-backed workspace
catalog, then treat each project repo as the owner of its scenes, media,
fonts, registries, and authored modules/effects.

The first target project is Codecaine. For v1, there is no shared
asset/module library: anything visual or authored that Codecaine uses belongs
inside the Codecaine project workspace. The engine keeps only core renderer,
editor, API, and export logic.

## Objective Files

- `goal.md` - outcome, strategy, success metrics, non-goals, and completion
  criteria.
- `current_state.md` - compact local handoff state for active work.
- `context/00_problem.md` - current coupling and why the external workspace
  boundary matters.
- `context/01_constraints.md` - folder contract, catalog rules, path safety,
  and non-negotiable boundaries.
- `context/02_implementation_scope.md` - owned code/data surfaces and expected
  migration shape.
- `context/03_working_plan.md` - phase-gated execution plan.
- `context/04_validation_and_handoff.md` - required checks and final handoff
  artifacts.
- `examples/` - example workspace catalog and project layout notes.
- `artifacts/` - migration inventories, screenshots, export zips, manifests,
  and validation summaries produced during the work.

Objective path: `objectives/external-project-workspaces/`
