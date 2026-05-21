<goal>
    - Make the Codecaine project export from `apps/scene-engine` produce a runnable standalone build.
    - The exported artifact must unzip, serve over plain static HTTP, load `index.html`, render the `title` entry scene, and render/navigate to the exported `menu/` scene without depending on Next routes, Next chunks, or the dev-server origin.
    - Own the export endpoint, standalone boot runtime, copied renderer/data files, asset/module/font path rewriting, and validation artifacts needed to prove the exported build renders.
</goal>

<context_refresh>
    <required_files>
        - objectives/run-exported-codecaine-build/goal.md
        - objectives/run-exported-codecaine-build/current_state.md
        - objectives/run-exported-codecaine-build/context/00_problem.md
        - objectives/run-exported-codecaine-build/context/01_constraints.md
        - objectives/run-exported-codecaine-build/context/02_implementation_scope.md
        - objectives/run-exported-codecaine-build/context/03_working_plan.md
        - objectives/run-exported-codecaine-build/context/04_validation_and_handoff.md
    </required_files>

    <instruction>
        - At objective start and after compaction/resume, reread the required
          files and treat this bundle as the authority for this objective.
    </instruction>
</context_refresh>

<working_strategy>
    - Reproduce the current failing zip from `http://localhost:3000`; start/restart the dev server only if a light health check fails.
    - Treat the zip as the unit under test: unzip it into objective artifacts, serve that folder statically, and debug with browser console/network evidence.
    - Fix the smallest export/runtime surface that makes the artifact self-contained. Prefer path, copy-list, module format, registry, and boot fixes over unrelated editor or scene changes.
    - After each meaningful fix, regenerate the export and validate the fresh extraction.
</working_strategy>

<success_metrics>
    - `POST /api/export?project=codecaine` returns a zip containing the HTML, `boot.js`, `renderer/`, project/scenes, assets, modules, and fonts needed by Codecaine.
    - A clean extraction served from `objectives/run-exported-codecaine-build/artifacts/extracted/` loads in Chromium with no fatal console errors or failed required requests.
    - Exported `index.html` renders `title`; exported `menu/index.html` renders `menu`; navigation resolves to exported page URLs.
</success_metrics>

<non_goals>
    - Do not redesign Codecaine scenes, editor UI, asset pipeline, or renderer architecture beyond exported runtime correctness.
    - Do not count the Next dev route `/scenes/...` rendering as success; this objective is about the standalone exported artifact.
    - Do not accept cache-only, dev-origin-only, or hand-edited-extraction fixes.
    - Do not run `npm run build` for routine scene edits; use it only for production-compilation proof or explicit user request.
</non_goals>

<completion_criteria>
    - A fresh Codecaine export zip from `apps/scene-engine` unzips, serves statically, and renders both exported scenes in browser validation.
    - Root cause and fix are recorded with changed paths and rationale.
    - Validation artifacts under `artifacts/` include zip/manifest, extraction path, server log, screenshots, and console/network summary.
    - `current_state.md` is updated with final status, changes, validation commands, residual risks, and follow-up work.
</completion_criteria>
