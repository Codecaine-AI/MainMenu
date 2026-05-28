<current_state>
<last_updated>2026-05-24</last_updated>

<status>
    - Corrected the misunderstood PI Object/object-workspace implementation.
    - The editor left sidebar now has a classical `Pi Agent` chat panel pinned to the bottom.
    - Follow-up UI polish applied: left sidebar width now matches the right inspector, chat controls have bottom clearance, and the Next dev indicator is hidden.
    - Chat requests route through `window.mainMenu.agent` to Electron main, where the Pi SDK session is created and owned.
    - Development and packaged Electron validation passed.
</status>

<completed>
    - Removed the visible `PI Object` component workflow and component-scaffold preload bridge.
    - Added `apps/scene-engine/app/editor/_components/PiAgentChatPanel.tsx`.
    - Updated `HierarchyPanel.tsx` so the hierarchy remains the upper scrollable sidebar area and the chat panel stays docked below it.
    - Added typed bridge methods: `getState`, `sendMessage`, `abort`, `reset`, and `onEvent`.
    - Added Electron main Pi session orchestration with `createAgentSession()` and `SessionManager.create(...)`.
    - Each prompt includes project id, scene id, selected path, selected layer name, and selected layer type.
    - Added `@mariozechner/pi-coding-agent@0.73.1` because it loads under the current Electron 30 Node 20 runtime; the newer `@earendil-works` package requires Node `>=22.19.0`.
    - Set editor grid columns to `440px minmax(0, 1fr) 440px`.
    - Added chat panel bottom padding and disabled the Next.js dev indicator.
    - Verified renderer Node access remains unavailable and the Pi SDK is not imported in React.
    - Rewrote objective docs/artifacts to reflect the corrected chat-panel requirement.
</completed>

<validation>
    - `cd apps/scene-engine && npm run desktop:compile && npx tsc --noEmit` passed.
    - `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e "import('@mariozechner/pi-coding-agent')..."` passed under Electron Node 20.16.0.
    - Dev Electron smoke passed: `Pi Agent` visible, `Message Pi` input visible, `PI Object` absent, `window.mainMenu.agent` present, `window.mainMenu.project` absent, `typeof window.require === "undefined"`.
    - `cd apps/scene-engine && npm run desktop:pack:mac` passed.
    - Packaged Electron smoke passed without external localhost; packaged `Main Menu.app` showed the chat panel and no object panel.
    - Packaged `app.asar` SDK import check passed.
    - Browser visual smoke confirmed both sidebars are 440px, `Send` has 20.5px bottom clearance at 1440x932, and the Next portal display is `none`.
</validation>

<next_actions>
    - Add a review/diff UI before high-risk agent edits are applied.
    - Add explicit model/auth setup affordances if the Pi SDK returns missing-credentials errors.
    - Consider upgrading Electron later if the app should move to the current `@earendil-works/pi-coding-agent` package.
</next_actions>

<risks_or_open_questions>
    - I did not send a live model prompt during validation to avoid consuming credentials/tokens or making unreviewed edits.
    - The chat currently reports streamed text and tool start/end status, not structured file diffs.
    - The package uses the deprecated `@mariozechner` scope for Electron Node compatibility.
</risks_or_open_questions>

<important_paths>
    - `apps/scene-engine/app/editor/_components/PiAgentChatPanel.tsx`
    - `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx`
    - `apps/scene-engine/desktop/main/index.ts`
    - `apps/scene-engine/desktop/preload/index.ts`
    - `apps/scene-engine/desktop/types/main-menu.ts`
    - `apps/scene-engine/package.json`
    - `objectives/main-menu-pi-object-sidebar/report.md`
    - `objectives/main-menu-pi-object-sidebar/artifacts/chat_bridge_contract.md`
    - `objectives/main-menu-pi-object-sidebar/artifacts/pi_sdk_runtime_evidence.md`
    - `objectives/main-menu-pi-object-sidebar/artifacts/run_summary.json`
    - `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/dev_pi_agent_chat_panel.png`
    - `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/packaged_pi_agent_chat_panel.png`
    - `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/sidebar_width_padding_check.png`
</important_paths>
</current_state>
