<validation_and_handoff>
    <validation_ladder>
        - `cd apps/scene-engine && npm run desktop:compile`
        - `cd apps/scene-engine && npx tsc --noEmit`
        - Electron runtime import check for `@mariozechner/pi-coding-agent`
        - Dev Electron smoke: verify `Pi Agent`, `Message Pi`, `window.mainMenu.agent`, no `PI Object`, and `typeof window.require === "undefined"`.
        - Packaged Electron smoke: verify app launches without external localhost and shows the same chat panel.
    </validation_ladder>

    <artifact_contract>
        - `objectives/main-menu-pi-object-sidebar/artifacts/chat_bridge_contract.md`
        - `objectives/main-menu-pi-object-sidebar/artifacts/pi_sdk_runtime_evidence.md`
        - `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/dev_pi_agent_chat_panel.png`
        - `objectives/main-menu-pi-object-sidebar/artifacts/run_summary.json`
        - `objectives/main-menu-pi-object-sidebar/report.md`
    </artifact_contract>

    <report_contract>
        - State clearly that the previous object-workspace implementation was corrected.
        - State which SDK package is used and why.
        - State validation commands and remaining risks.
    </report_contract>
</validation_and_handoff>
