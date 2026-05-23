<current_state>
<last_updated>2026-05-21</last_updated>

<status>
    - Objective is implemented and validated against a fresh exported Codecaine zip.
    - Fresh export from `POST http://localhost:3000/api/export?project=codecaine` generated `artifacts/codecaine.zip`; a clean extraction served from `http://localhost:4173` rendered both root `title` and `/menu/`.
    - Browser validation recorded zero console entries and zero failed network requests in the final run.
    - Required objective files were reread on 2026-05-21 before making changes.
    - Static validation server used for proof was stopped after validation; restart it with the command below when replaying artifacts.
</status>

<completed>
    - Created objective bundle at `objectives/run-exported-codecaine-build/`.
    - Identified the relevant export surface in `apps/scene-engine/app/api/export/route.ts` and the exported boot runtime in `apps/scene-engine/app/_engine/export/boot.js`.
    - Confirmed Codecaine project metadata at `apps/scene-engine/projects/codecaine/project.json`: project id `codecaine`, entry scene `title`, additional scene `menu`.
    - Baseline artifacts captured under `objectives/run-exported-codecaine-build/artifacts/`: fresh zip, extraction, zip manifest, static server log, `baseline_browser_console.json`, `baseline_network_failures.json`, and `screenshots/baseline-title.png` / `screenshots/baseline-menu.png`.
    - Baseline failure evidence: `baseline_browser_console.json` and `baseline_network_failures.json` show 404s for `/api/fonts`, `/favicon.ico`, `/generation/inputs/extras/test-fire.mp4`, and `/assets/image/codecaine-start-keycap.png`.
    - Diagnosis: the export endpoint copies registry assets but misses scene/module literal public asset paths such as the Codecaine keycap PNGs; exported renderer still probes the dev-only `/api/fonts`; generated HTML does not suppress favicon auto-fetch; exported SVG glyphs retain a legacy `/generation/inputs/extras/test-fire.mp4` URL even though the available public asset is `/assets/video/test-fire.mp4`.
    - Patched `apps/scene-engine/app/api/export/route.ts` to rewrite legacy text asset URLs, include scene/module-literal public asset references, and add a data favicon link in exported HTML.
    - Patched `apps/scene-engine/app/_engine/renderer/asset-registry.js` so exported bundles load `fonts/registry.json` without probing the Next-only `/api/fonts` route.
    - Regenerated `artifacts/codecaine.zip`, `artifacts/zip_manifest.txt`, and `artifacts/extracted/` from the patched export endpoint.
    - Final zip manifest includes `index.html`, `boot.js`, `project.json`, `renderer/scene-renderer.js`, `renderer/asset-registry.js`, `scenes/title/scene.json`, `scenes/menu/scene.json`, `title/index.html`, `menu/index.html`, `assets/registry.json`, `modules/registry.json`, `fonts/registry.json`, `assets/image/codecaine-start-keycap.png`, `assets/image/codecaine-start-keycap-normal.png`, and `assets/video/test-fire.mp4`.
    - Final browser validation saved `browser_console.json` as `[]`, `network_failures.json` as `[]`, `final_browser_summary.json`, and screenshots `screenshots/final-title.png`, `screenshots/final-menu.png`, and `screenshots/final-navigation-menu.png`.
    - Navigation proof: final summary shows title page `window.MELEE_navigate('menu')` resolved to `http://localhost:4173/menu/index.html` and rendered the Main Menu scene.
    - Grep audit of the extracted artifact found no `localhost:3000`, `http://localhost:3000`, or `/_next` references.
    - Follow-up export ergonomics: `apps/scene-engine/app/_engine/export/Makefile` and `apps/scene-engine/app/_engine/export/server.mjs` are now included at the zip root so an extracted export can run with `make run`.
    - `make run PORT=4174` was validated from `artifacts/extracted/`; root and `/menu/` rendered in Chromium with zero console entries and zero failed network requests. Summary saved at `artifacts/make_run_browser_summary.json`.
</completed>

<in_progress>
    - None.
</in_progress>

<next_actions>
    - Replay export: `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/run-exported-codecaine-build/artifacts/codecaine.zip`
    - Replay extraction: `rm -rf objectives/run-exported-codecaine-build/artifacts/extracted && mkdir -p objectives/run-exported-codecaine-build/artifacts/extracted && unzip -q objectives/run-exported-codecaine-build/artifacts/codecaine.zip -d objectives/run-exported-codecaine-build/artifacts/extracted`
    - Replay static serving from inside the extracted export: `cd objectives/run-exported-codecaine-build/artifacts/extracted && make run`
    - Open `http://127.0.0.1:4173/` and `http://127.0.0.1:4173/menu/`; final automated validation already proved root, menu, title-to-menu navigation, and the exported `make run` workflow.
</next_actions>

<risks_or_open_questions>
    - `file://` double-click loading was not tested; the objective acceptance target is plain static HTTP.
    - `static_server.log` includes a benign Python `BrokenPipeError` caused by headless Chrome closing a media/module request during teardown; Chromium's captured console and network failure artifacts are clean.
    - No production `npm run build` was run; the patched endpoint was exercised through the running Next dev server per objective constraints.
    - `artifacts/codecaine.zip` and `artifacts/extracted/` are local generated outputs and are ignored by Git because the zip is over GitHub's normal file-size limit; replay commands above recreate them.
    - Exported `make run` requires Node.js and `make`; users without `make` can run `node server.mjs` from the extracted export root.
</risks_or_open_questions>

<important_paths>
    - `objectives/run-exported-codecaine-build/goal.md`
    - `objectives/run-exported-codecaine-build/current_state.md`
    - `objectives/run-exported-codecaine-build/context/`
    - `objectives/run-exported-codecaine-build/artifacts/`
    - `objectives/run-exported-codecaine-build/artifacts/codecaine.zip`
    - `objectives/run-exported-codecaine-build/artifacts/zip_manifest.txt`
    - `objectives/run-exported-codecaine-build/artifacts/extracted/`
    - `objectives/run-exported-codecaine-build/artifacts/static_server.log`
    - `objectives/run-exported-codecaine-build/artifacts/baseline_browser_console.json`
    - `objectives/run-exported-codecaine-build/artifacts/baseline_network_failures.json`
    - `objectives/run-exported-codecaine-build/artifacts/final_browser_summary.json`
    - `objectives/run-exported-codecaine-build/artifacts/make_run_browser_summary.json`
    - `objectives/run-exported-codecaine-build/artifacts/browser_console.json`
    - `objectives/run-exported-codecaine-build/artifacts/network_failures.json`
    - `objectives/run-exported-codecaine-build/artifacts/screenshots/final-title.png`
    - `objectives/run-exported-codecaine-build/artifacts/screenshots/final-menu.png`
    - `objectives/run-exported-codecaine-build/artifacts/screenshots/final-navigation-menu.png`
    - `apps/scene-engine/app/api/export/route.ts`
    - `apps/scene-engine/app/_engine/export/boot.js`
    - `apps/scene-engine/app/_engine/export/Makefile`
    - `apps/scene-engine/app/_engine/export/server.mjs`
    - `apps/scene-engine/app/_engine/renderer/`
    - `apps/scene-engine/public/assets/registry.json`
    - `apps/scene-engine/public/modules/registry.json`
    - `apps/scene-engine/projects/codecaine/project.json`
    - `apps/scene-engine/projects/codecaine/scenes/title/scene.json`
    - `apps/scene-engine/projects/codecaine/scenes/menu/scene.json`
</important_paths>
</current_state>
