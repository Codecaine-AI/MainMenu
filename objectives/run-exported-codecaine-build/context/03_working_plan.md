<working_plan>
    <overview>
        1. baseline_reproduction - Generate a fresh Codecaine export, unzip it, serve it statically, and capture the actual browser failure.
        2. export_manifest_audit - Compare runtime requests against zip contents and identify missing or wrongly addressed files.
        3. targeted_fix - Patch the smallest export/runtime surface that explains the reproduced failure.
        4. full_export_validation - Regenerate and validate the fresh artifact across entry and menu scenes.
        5. handoff - Record cause, changed paths, validation evidence, residual risks, and next actions.
    </overview>

    <operating_principles>
        - Treat browser console and network failures as the source of truth for "doesn't load"; do not infer the cause from code inspection alone.
        - Keep each validation tied to a fresh zip so fixes are proven in the actual export path.
        - Prefer standalone relative URLs and copied local dependencies over any dependency on Next dev server paths.
    </operating_principles>

    <phase id="1" name="baseline_reproduction">
        <objective>
            - Reproduce the failing exported build and capture enough evidence to classify the failure.
        </objective>
        <inputs>
            - Running scene-engine dev server at `http://localhost:3000`.
            - `apps/scene-engine/projects/codecaine/project.json`.
            - Export endpoint `POST http://localhost:3000/api/export?project=codecaine`.
        </inputs>
        <process>
            - Health check the dev server with a lightweight request such as `curl -I http://localhost:3000`; start it from `apps/scene-engine` only if unavailable.
            - Create `objectives/run-exported-codecaine-build/artifacts/`.
            - Generate a fresh zip with `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/run-exported-codecaine-build/artifacts/codecaine.zip`.
            - Remove any old extracted directory, unzip the fresh artifact into `objectives/run-exported-codecaine-build/artifacts/extracted/`, and write a sorted zip listing to `zip_manifest.txt`.
            - Serve the extracted folder with a simple static server on an unused port, for example `python -m http.server 4173 --directory objectives/run-exported-codecaine-build/artifacts/extracted`.
            - Open the static URL in Chromium and capture console errors, failed network requests, DOM state for `#stage`, and screenshots for root and `menu/`.
        </process>
        <outputs>
            - `objectives/run-exported-codecaine-build/artifacts/codecaine.zip`: baseline export.
            - `objectives/run-exported-codecaine-build/artifacts/zip_manifest.txt`: zip contents.
            - `objectives/run-exported-codecaine-build/artifacts/extracted/`: baseline extracted export.
            - `objectives/run-exported-codecaine-build/artifacts/static_server.log`: static server output.
            - `objectives/run-exported-codecaine-build/artifacts/browser_console.json`: console capture.
            - `objectives/run-exported-codecaine-build/artifacts/network_failures.json`: failed request capture.
            - `objectives/run-exported-codecaine-build/artifacts/screenshots/baseline-title.png` and `baseline-menu.png`.
        </outputs>
        <gate>
            - The failure is reproduced or the exported artifact unexpectedly passes both scenes. If it passes, document the exact serving method and test whether the user's failure is `file://`-specific.
        </gate>
        <failure_handling>
            - If the export endpoint fails, capture the HTTP response body and server terminal error, then fix export generation before static runtime work.
            - If the dev server is unavailable and cannot be started, stop and record the blocker in `current_state.md`.
        </failure_handling>
    </phase>

    <phase id="2" name="export_manifest_audit">
        <objective>
            - Map each runtime failure to a concrete exported file, URL rewrite, import, registry, or browser protocol issue.
        </objective>
        <inputs>
            - Baseline console and network captures.
            - `zip_manifest.txt`.
            - `apps/scene-engine/app/api/export/route.ts`.
            - `apps/scene-engine/app/_engine/export/boot.js`.
            - `apps/scene-engine/app/_engine/renderer/`.
            - `apps/scene-engine/public/assets/registry.json`.
            - `apps/scene-engine/public/modules/registry.json`.
        </inputs>
        <process>
            - For each failed request, resolve the expected zip-relative path and check whether it exists in `zip_manifest.txt`.
            - For each console exception, identify the source module and whether it came from an import, fetch, DOM assumption, registry entry, or renderer dependency.
            - Inspect generated root and nested `index.html` files for `boot.js`, CSS, font, and asset prefixes.
            - Inspect copied renderer files in the extracted folder for imports or string paths that still assume app-root `/assets`, `/modules`, `/fonts`, aliases, or Next-only locations.
            - Produce a short diagnosis note in `current_state.md` before editing code.
        </process>
        <outputs>
            - Updated `current_state.md` with failure class, evidence paths, and intended fix surface.
            - Optional `objectives/run-exported-codecaine-build/artifacts/failure_matrix.md` listing `symptom`, `requested_url`, `expected_zip_path`, `exists`, `root_cause`, and `fix_surface`.
        </outputs>
        <gate>
            - At least one root cause is identified with enough evidence that a targeted code change can be made.
        </gate>
        <failure_handling>
            - If no root cause is obvious, reduce to a minimal scene or temporarily instrument `boot.js` in source, regenerate the zip, and capture more explicit diagnostics.
        </failure_handling>
    </phase>

    <phase id="3" name="targeted_fix">
        <objective>
            - Implement the smallest source change that makes the exported artifact self-contained and runnable.
        </objective>
        <inputs>
            - Diagnosis from phase 2.
            - Owned surfaces from `context/02_implementation_scope.md`.
        </inputs>
        <process>
            - Patch only the source files needed to address the proven failure.
            - If adding helper logic, keep it local to export generation or exported runtime unless the renderer itself has a standalone-incompatible assumption.
            - Avoid changing scene content unless a scene references an invalid asset or module id and the export/runtime code is correct.
            - Update `current_state.md` with changed paths and the rationale before full validation.
        </process>
        <outputs>
            - Source patch in the relevant owned surface.
            - Updated `current_state.md` summarizing the fix hypothesis.
        </outputs>
        <gate>
            - Code changes directly correspond to the reproduced failure and do not expand into unrelated scene/editor work.
        </gate>
        <failure_handling>
            - If the first fix exposes a later failure, keep the later failure in the same objective only when it blocks the exported artifact from rendering; otherwise record it as follow-up.
        </failure_handling>
    </phase>

    <phase id="4" name="full_export_validation">
        <objective>
            - Prove a freshly generated export renders from a static host after the fix.
        </objective>
        <inputs>
            - Patched source.
            - Export endpoint.
            - Static server and browser validation tooling.
        </inputs>
        <process>
            - Generate a new `codecaine.zip` from the endpoint.
            - Remove and recreate `artifacts/extracted/` from the new zip.
            - Serve the extracted folder from a static server.
            - Validate root `index.html` and `menu/index.html` in Chromium.
            - Capture screenshots, console summary, network failure summary, and DOM evidence for `#stage`.
            - Optionally test direct `file://` opening and record whether it is unsupported by browser restrictions or now works.
        </process>
        <outputs>
            - Updated `zip_manifest.txt`.
            - `objectives/run-exported-codecaine-build/artifacts/screenshots/final-title.png`.
            - `objectives/run-exported-codecaine-build/artifacts/screenshots/final-menu.png`.
            - Final `browser_console.json` and `network_failures.json`.
        </outputs>
        <gate>
            - Both exported scenes render from the static server with no fatal console errors and no failed required requests.
        </gate>
        <failure_handling>
            - If validation still fails, return to phase 2 with the new failure evidence rather than stacking speculative fixes.
        </failure_handling>
    </phase>

    <phase id="5" name="handoff">
        <objective>
            - Leave a durable record that another agent or user can replay.
        </objective>
        <inputs>
            - Final source diff.
            - Final validation artifacts.
            - `current_state.md`.
        </inputs>
        <process>
            - Update `current_state.md` with final status, cause, changed paths, validation commands, artifact paths, and residual risks.
            - In the final response, summarize what changed, how it was validated, where artifacts live, and whether `file://` is supported or out of scope.
        </process>
        <outputs>
            - Completed objective-local state.
            - Final user-facing summary.
        </outputs>
        <gate>
            - A fresh agent can reproduce the final validation from paths and commands in `current_state.md`.
        </gate>
        <failure_handling>
            - If the fix is incomplete, state the exact remaining blocker and preserve all evidence needed to continue.
        </failure_handling>
    </phase>
</working_plan>
