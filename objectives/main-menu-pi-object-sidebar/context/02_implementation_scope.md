<implementation_scope>
    <owned_surfaces>
        - `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx`: left sidebar layout and bottom chat placement.
        - `apps/scene-engine/app/editor/_components/PiAgentChatPanel.tsx`: chat transcript/input UI.
        - `apps/scene-engine/desktop/types/main-menu.ts`: typed agent bridge contract.
        - `apps/scene-engine/desktop/preload/index.ts`: safe renderer bridge exposure.
        - `apps/scene-engine/desktop/main/index.ts`: Pi SDK session lifecycle, prompt routing, abort/reset, and event streaming.
        - `apps/scene-engine/package.json` and `package-lock.json`: Pi SDK dependency.
        - `objectives/main-menu-pi-object-sidebar/**`: corrected docs and validation artifacts.
    </owned_surfaces>

    <read_only_references>
        - `ai_docs/pi-agent/docs/sdk.md`
        - `ai_docs/pi-agent/examples-sdk/01-minimal.ts`
        - `ai_docs/pi-agent/examples-sdk/12-full-control.ts`
        - `objectives/main-menu-desktop-app/report.md`
    </read_only_references>

    <out_of_scope>
        - Object creation/scaffold UI.
        - Literal radial/pie control.
        - Renderer-native filesystem/shell access.
        - Electron major-version upgrade solely for the newest package scope.
    </out_of_scope>
</implementation_scope>
