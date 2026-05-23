<implementation_scope>
    <owned_surfaces>
        - `apps/scene-engine/app/page.tsx`: dashboard root layout and navigation for Projects and Asset Library.
        - `apps/scene-engine/app/projects/[projectId]/page.tsx`: project overview, scenes, export, and asset usage summary.
        - `apps/scene-engine/app/upload/page.tsx`: fold upload into the asset-library workflow or redirect to the new library route.
        - `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`: replace global file-swap behavior with scene/project asset selection.
        - `apps/scene-engine/app/editor/_components/LayerForm.tsx`, `SlotsSection.tsx`, `AddLayerDialog.tsx`, and related editor components: update asset picker semantics.
        - `apps/scene-engine/app/_engine/store/editor-store.ts`: persist scene-local asset selection and library metadata as needed.
        - `apps/scene-engine/app/_engine/types/scene.ts`: add backwards-compatible types for asset library records, asset refs, project scope, module dependency metadata, and export graph summaries.
        - `apps/scene-engine/app/_engine/lib/scenes.ts`: load project/scene metadata needed for asset usage and export traversal.
        - `apps/scene-engine/app/_engine/lib/asset-types.ts`: extend asset typing if the library model needs richer labels or filters.
        - `apps/scene-engine/app/api/upload/route.ts`: create library assets with metadata and scope rather than opaque file-only entries.
        - `apps/scene-engine/app/api/assets/[type]/route.ts`, `app/api/registry/[id]/route.ts`, and new asset-library API routes: list, filter, gate, and update library records safely.
        - `apps/scene-engine/app/api/export/route.ts`: consume a reachability collector and write pruned standalone zips.
        - `apps/scene-engine/app/_engine/export/`: keep `boot.js`, `Makefile`, and `server.mjs` compatible with pruned registries.
        - `apps/scene-engine/app/_engine/renderer/asset-registry.js` and asset renderers: load pruned registries and scene-local asset refs without dev-origin assumptions.
        - `apps/scene-engine/public/assets/registry.json`: migrate or enrich library records while preserving current ids.
        - `apps/scene-engine/public/modules/registry.json` and `public/modules/**/manifest.json`: declare module dependencies and asset-ref property schemas.
        - `docs/scene-engine/**`: update docs if implementation changes public model or export behavior.
    </owned_surfaces>

    <read_only_references>
        - `objectives/run-exported-codecaine-build/`: read for standalone export validation pattern and `make run` expectations; do not rewrite that objective unless documenting a follow-up.
        - `apps/scene-engine/projects/codecaine/scenes/title/scene.json`: reference and migrate carefully; avoid visual changes unrelated to asset refs.
        - `apps/scene-engine/projects/codecaine/scenes/menu/scene.json`: reference and migrate carefully; existing dirty user edits may be present.
        - `docs/scene-engine/10-system-design/20-asset-registry.md`: read as current design history before changing docs.
        - `docs/scene-engine/10-system-design/50-build-output.md`: read for stale export assumptions that likely need updates.
    </read_only_references>

    <generated_outputs>
        - `objectives/asset-library-active-export/artifacts/baseline_export_summary.json`: baseline zip size, manifest counts, active dependency estimate, command, and timestamp.
        - `objectives/asset-library-active-export/artifacts/active_export_summary.json`: final zip size, included/excluded dependency counts, warnings, and size comparison.
        - `objectives/asset-library-active-export/artifacts/zip_manifest.txt`: final exported zip manifest.
        - `objectives/asset-library-active-export/artifacts/browser_summary.json`: URL checks, rendered scene ids/names, console count, network failure count, and navigation result.
        - `objectives/asset-library-active-export/artifacts/screenshots/`: dashboard, asset library, project page, editor asset picker, exported title, and exported menu screenshots when browser validation is run.
    </generated_outputs>

    <commands_and_entrypoints>
        - `git status --short`: run before edits and before final handoff to distinguish objective changes from unrelated worktree changes.
        - `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/asset-library-active-export/artifacts/codecaine.zip`: generate a fresh export from the running dev server.
        - `rm -rf objectives/asset-library-active-export/artifacts/extracted && mkdir -p objectives/asset-library-active-export/artifacts/extracted && unzip -q objectives/asset-library-active-export/artifacts/codecaine.zip -d objectives/asset-library-active-export/artifacts/extracted`: clean extraction for validation.
        - `cd objectives/asset-library-active-export/artifacts/extracted && make run`: serve exported artifact with the intended JS runtime.
        - `cd apps/scene-engine && npx tsc --noEmit`: typecheck TypeScript changes when objective implementation touches app/API/editor types.
        - Browser validation against `http://localhost:3000`, `http://127.0.0.1:<port>/`, and `http://127.0.0.1:<port>/menu/`: verify dashboard/editor flow and exported runtime.
    </commands_and_entrypoints>

    <adjacent_surfaces_requiring_caution>
        - `apps/scene-engine/public/modules/components/main-menu-system/**`: likely has unrelated dirty user edits; read before editing and avoid overwriting behavior unrelated to dependency declarations.
        - `apps/scene-engine/public/modules/components/menu-items/**`: likely has unrelated dirty user edits; preserve them.
        - `apps/scene-engine/public/assets/video/**`: large binary files; do not modify media files unless the user explicitly asks.
        - `apps/scene-engine/public/fonts/**`: large and shared; prefer manifest/registry pruning over moving font files.
        - `.gitignore`: only change if new objective artifacts need ignore coverage.
        - Git history and remote: do not commit/push unless explicitly requested.
    </adjacent_surfaces_requiring_caution>

    <out_of_scope>
        - External asset hosting, CDN uploads, auth, users, billing, and permission systems beyond simple project availability metadata.
        - Rebuilding Codecaine art, replacing menu design, or changing gameplay/content.
        - Replacing the Next app with a different framework.
        - Production deployment packaging beyond the standalone static export zip.
        - Browser support beyond the current Scene Engine target unless validation exposes a regression.
    </out_of_scope>
</implementation_scope>
