<implementation_scope>
    <owned_surfaces>
        - `apps/scene-engine/app/api/export/route.ts`: export zip contents, path rewriting, copied directories/files, generated HTML, per-scene pages, content disposition, and export error handling.
        - `apps/scene-engine/app/_engine/export/boot.js`: standalone runtime boot, bundle-root calculation, JSON fetches, registry loading, scene switching, and exported navigation behavior.
        - `apps/scene-engine/app/_engine/renderer/`: renderer modules may be adjusted only when a dependency or path assumption prevents standalone execution.
        - `apps/scene-engine/public/assets/registry.json`: registry entries may be corrected if they point at invalid exported paths.
        - `apps/scene-engine/public/modules/registry.json`: module entries may be corrected if they point at invalid exported paths.
        - `apps/scene-engine/projects/codecaine/scenes/*/scene.json`: edit only if the scene references missing or invalid project assets and the export/runtime path is otherwise correct.
        - `objectives/run-exported-codecaine-build/artifacts/`: store generated zips, extracted exports, logs, screenshots, and trace summaries.
    </owned_surfaces>

    <read_only_references>
        - `apps/scene-engine/projects/codecaine/project.json`: read to confirm project id, entry scene, scene list, and stage size; avoid changing project identity unless proven wrong.
        - `apps/scene-engine/agents.md`: repo-local dev-server and build guidance.
        - `apps/scene-engine/CLAUDE.md`: renderer/export architecture notes.
        - `apps/scene-engine/app/scenes/[id]/page.tsx`: use only as a reference for how the app runtime renders scenes, not as the exported runtime target.
    </read_only_references>

    <generated_outputs>
        - `objectives/run-exported-codecaine-build/artifacts/codecaine.zip`: fresh export zip generated from the endpoint.
        - `objectives/run-exported-codecaine-build/artifacts/zip_manifest.txt`: sorted listing of zip contents for missing-file diagnosis.
        - `objectives/run-exported-codecaine-build/artifacts/extracted/`: clean extraction of the latest zip for static serving.
        - `objectives/run-exported-codecaine-build/artifacts/static_server.log`: log from the static server used to serve the extracted bundle.
        - `objectives/run-exported-codecaine-build/artifacts/browser_console.json`: fatal console errors and warnings captured during validation.
        - `objectives/run-exported-codecaine-build/artifacts/network_failures.json`: failed required browser requests captured during validation.
        - `objectives/run-exported-codecaine-build/artifacts/screenshots/`: screenshots of root `title` and `menu` exported pages.
    </generated_outputs>

    <commands_and_entrypoints>
        - `curl -I http://localhost:3000`: health check the assumed dev server before starting a new one.
        - `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/run-exported-codecaine-build/artifacts/codecaine.zip`: generate the export zip.
        - `python -m http.server 4173 --directory objectives/run-exported-codecaine-build/artifacts/extracted`: serve the extracted export from a plain static host.
        - Browser validation against `http://localhost:4173/` and `http://localhost:4173/menu/`: prove rendered exported scenes.
    </commands_and_entrypoints>

    <adjacent_surfaces_requiring_caution>
        - `apps/scene-engine/next.config.ts`: avoid changing Next build configuration unless the export endpoint or production build behavior requires it.
        - `apps/scene-engine/package.json`: avoid adding dependencies or scripts unless they directly support repeatable export validation.
        - `.next/` and `node_modules/`: generated/vendor directories; do not edit.
    </adjacent_surfaces_requiring_caution>

    <out_of_scope>
        - Rebuilding the scene editor UX or adding new export UI affordances.
        - Reorganizing the whole renderer or asset pipeline when a targeted standalone-path fix is sufficient.
        - Optimizing bundle size, compression, or performance unless performance prevents the exported build from loading.
        - Creating a production deployment flow beyond proving the exported artifact serves from a static folder.
    </out_of_scope>
</implementation_scope>
