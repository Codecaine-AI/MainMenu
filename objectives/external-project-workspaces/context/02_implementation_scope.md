<implementation_scope>
    <owned_surfaces>
        - Workspace/project discovery:
          - `apps/scene-engine/app/_engine/lib/scenes.ts`
          - new `apps/scene-engine/app/_engine/lib/workspace-catalog.ts`
          - new `apps/scene-engine/app/_engine/lib/project-paths.ts`
          - committed workspace catalog example/config docs.
        - Project-aware data access:
          - scene APIs under `apps/scene-engine/app/api/scenes/`
          - asset APIs under `apps/scene-engine/app/api/assets/`
          - asset-library APIs under `apps/scene-engine/app/api/asset-library/`
          - upload route `apps/scene-engine/app/api/upload/route.ts`
          - registry route `apps/scene-engine/app/api/registry/[id]/route.ts`
          - font discovery and font APIs.
        - Renderer/editor dev loading:
          - `apps/scene-engine/app/_engine/renderer/asset-registry.js`
          - `apps/scene-engine/app/_engine/renderer/runtime-url.js`
          - editor/project/dashboard pages that pass active project identity.
        - Export:
          - `apps/scene-engine/app/api/export/route.ts`
          - export reachability/path rewriting helpers
          - `apps/scene-engine/app/_engine/export/*`
        - Desktop packaging/runtime:
          - desktop runtime seed preparation that currently copies app-local `public` and `projects`.
        - Documentation/objective state:
          - scene-engine docs that describe project model, asset registry, authoring surfaces, export output, and running workflow.
          - this objective bundle and artifacts.
    </owned_surfaces>

    <data_migration_scope>
        - Migrate current Codecaine project manifest and scenes into the external folder contract.
        - Migrate current Codecaine media from `apps/scene-engine/public/assets` into `Assets/Media`.
        - Migrate current Codecaine component/effect modules from `apps/scene-engine/public/modules` into `Assets/Modules`.
        - Migrate fonts used by Codecaine into `Assets/Fonts`.
        - Migrate `assets/registry.json` and `modules/registry.json` into project settings registries, updating file/path fields to the new logical layout.
        - Generate a migration inventory artifact that maps old path to new path for every moved file.
    </data_migration_scope>

    <out_of_scope_surfaces>
        - Do not redesign Codecaine visual composition beyond path/schema updates.
        - Do not create a cloud service, user account system, marketplace, plugin manager, package resolver, or remote asset CDN.
        - Do not rework the asset extraction pipeline unless needed only to point its output at the new project layout.
        - Do not remove unrelated dirty work or rewrite prior objective artifacts.
    </out_of_scope_surfaces>

    <interfaces_to_preserve>
        - Browser routes should continue to support dashboard, project page, scene preview, editor, upload, asset library, and export flows.
        - `POST /api/export?project=<project-id>` should keep working, even if internally `<project-id>` resolves through the workspace catalog.
        - Existing scene ids, asset ids, module ids, entry scene, and navigation behavior should remain stable unless a migration note explains the change.
        - Exported bundles should continue to expose `window.MELEE_navigate`, use `project.json`, and load scenes/assets/modules/fonts from bundle-relative URLs.
    </interfaces_to_preserve>
</implementation_scope>
