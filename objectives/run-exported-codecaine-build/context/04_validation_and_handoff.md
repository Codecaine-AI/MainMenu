<validation_and_handoff>
    <validation_ladder>
        - `dev_server_health`: `curl -I http://localhost:3000` returns a response. If it fails, start `npm run dev` from `apps/scene-engine` and record the server command.
        - `export_zip`: `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/run-exported-codecaine-build/artifacts/codecaine.zip` succeeds and writes a non-empty zip.
        - `zip_manifest`: the zip listing contains `index.html`, `boot.js`, `project.json`, `renderer/scene-renderer.js`, `renderer/asset-registry.js`, `scenes/title/scene.json`, `scenes/menu/scene.json`, `title/index.html`, `menu/index.html`, `assets/registry.json`, `modules/registry.json`, and `fonts/registry.json`.
        - `static_smoke`: a static server rooted at `objectives/run-exported-codecaine-build/artifacts/extracted/` serves root `index.html`, `boot.js`, `project.json`, and both scene JSON files with HTTP 200.
        - `browser_entry`: Chromium opens the static root URL, `#stage` contains rendered children, required assets/modules load, and the screenshot shows visible Codecaine title scene content.
        - `browser_menu`: Chromium opens the static `/menu/` URL, `#stage` contains rendered children, required assets/modules load, and the screenshot shows visible menu scene content.
        - `navigation`: exported runtime navigation from title to menu uses exported page URLs and does not request Next app routes.
    </validation_ladder>

    <artifact_contract>
        - `objectives/run-exported-codecaine-build/artifacts/codecaine.zip`: the exact zip generated for the latest validation.
        - `objectives/run-exported-codecaine-build/artifacts/zip_manifest.txt`: sorted zip contents with enough paths to audit missing files.
        - `objectives/run-exported-codecaine-build/artifacts/extracted/`: clean extraction of the latest validation zip.
        - `objectives/run-exported-codecaine-build/artifacts/static_server.log`: static server command output and port.
        - `objectives/run-exported-codecaine-build/artifacts/browser_console.json`: array of console entries with at least `page`, `type`, `text`, and `location` where available.
        - `objectives/run-exported-codecaine-build/artifacts/network_failures.json`: array of failed or non-2xx required requests with at least `page`, `url`, `status`, `resourceType`, and `failureText` where available.
        - `objectives/run-exported-codecaine-build/artifacts/screenshots/final-title.png`: final root scene screenshot.
        - `objectives/run-exported-codecaine-build/artifacts/screenshots/final-menu.png`: final menu scene screenshot.
    </artifact_contract>

    <acceptance_gates>
        - The final exported artifact is generated from source through the export endpoint, not hand-edited after unzip.
        - Root `index.html` and `menu/index.html` render from the static extracted folder in a browser.
        - No fatal console errors remain from `boot.js`, renderer modules, registry loading, scene JSON fetches, or required asset/module imports.
        - No required request escapes the extracted static server except intentionally remote resources documented as non-blocking.
        - `current_state.md` records the root cause and validation commands.
    </acceptance_gates>

    <report_contract>
        - Final report should summarize baseline failure, root cause, changed paths, validation commands, artifact paths, rejected routes, residual risks, and whether `file://` was tested.
    </report_contract>

    <current_state_update>
        - Update `objectives/run-exported-codecaine-build/current_state.md` at the start of implementation, after root cause diagnosis, after patching, and before final response.
        - Include changed file paths, artifact paths, exact static server URL/port, validation commands, browser pages tested, and whether `file://` opening was tested.
    </current_state_update>

    <blocked_or_failed_handoff>
        - If validation remains incomplete, preserve the latest zip, logs, screenshots, console/network captures, and the next concrete diagnostic action.
    </blocked_or_failed_handoff>
</validation_and_handoff>
