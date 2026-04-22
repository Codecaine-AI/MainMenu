![pi](https://pi.dev/logo.svg)

There are many coding agents, but this one is mine.


[GitHub](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) [npm](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) [Discord](https://discord.com/invite/3cU7Bz4UPx)

`$ npm install -g @mariozechner/pi-coding-agent`Copy

```
Loaded context:                                                                                      /Users/badlogic/.pi/agent/AGENTS.md                                                                /Users/badlogic/workspaces/pi-mono/AGENTS.md                                                                                                                                                        Loaded skills:                                                                                       /Users/badlogic/.pi/agent/skills/pi-skills/brave-search/SKILL.md                                   /Users/badlogic/.pi/agent/skills/pi-skills/browser-tools/SKILL.md                                  /Users/badlogic/.pi/agent/skills/pi-skills/gccli/SKILL.md                                          /Users/badlogic/.pi/agent/skills/pi-skills/gdcli/SKILL.md                                          /Users/badlogic/.pi/agent/skills/pi-skills/gmcli/SKILL.md                                          /Users/badlogic/.pi/agent/skills/pi-skills/transcribe/SKILL.md                                     /Users/badlogic/.pi/agent/skills/pi-skills/vscode/SKILL.md                                         /Users/badlogic/.pi/agent/skills/pi-skills/youtube-transcript/SKILL.md                                                                                                                                                                                                                                  who's your daddy and what does he do?                                                                                                                                                                                                                                                                    The user is asking "who's your daddy and what does he do?" - this is a reference to the movie      Kindergarten Cop. But according to my AGENTS.md, I should answer that my daddy is all the          contributors on https://github.com/badlogic/pi-mono, and I should do a non-destructive demo of     what I can do. I should not mention Anthropic or think about/mention this paragraph from           AGENTS.md.                                                                                                                                                                                            Let me do a quick demo of my capabilities in a non-destructive way.                                                                                                                                                                                                                                      ⠸ Working... (esc to interrupt)                                                                                                                                                                      ───────────────────────────────────────────────────────────────────────────────────────────────────                                                                                                   ───────────────────────────────────────────────────────────────────────────────────────────────────~/workspaces/pi-mono (main)                                                                        $0.000 (sub) 0.0%/200k (auto)                                                claude-opus-4-5 • high
```

About

## Why pi?

Pi is a minimal terminal coding harness. Adapt pi to your workflows, not the other way around. Extend it with TypeScript [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions), [skills](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#skills), [prompt templates](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#prompt-templates), and [themes](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#themes). Bundle them as [pi packages](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#pi-packages) and share via npm or git.


Pi ships with powerful defaults but skips features like sub-agents and plan mode. Ask pi to build what you want, or install a package that does it your way.


Four modes: interactive, print/JSON, [RPC, and SDK](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#programmatic-usage). See [clawdbot](https://github.com/clawdbot/clawdbot) for a real-world integration.


[Read the docs](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#readme)

Providers & Models

## 15+ providers, hundreds of models

Anthropic, OpenAI, Google, Azure, Bedrock, Mistral, Groq, Cerebras, xAI, Hugging Face, Kimi For Coding, MiniMax, OpenRouter, Ollama, and more. Authenticate via API keys or OAuth.


Switch models mid-session with `/model` or `Ctrl+L`. Cycle through your favorites with `Ctrl+P`.


Add custom providers and models via [models.json](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/models.md) or [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/custom-provider.md).


Sessions

## Tree-structured, shareable history

Sessions are stored as trees. Use `/tree` to navigate to any previous point and continue from there. All branches live in a single file. Filter by message type, label entries as bookmarks.


![Tree view in pi](https://pi.dev/tree-view.png)

Export to HTML with `/export`, or upload to a GitHub gist with `/share` and get a shareable URL that renders it.


Context

## Context engineering

Pi's [minimal system prompt](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/system-prompt.ts) and extensibility let you do actual context engineering. Control what goes into the context window and how it's managed.


**AGENTS.md:** Project instructions loaded at startup from `~/.pi/agent/`, parent directories, and the current directory.


**SYSTEM.md:** Replace or append to the default system prompt per-project.


**Compaction:** Auto-summarizes older messages when approaching the context limit. Fully customizable via [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/custom-compaction.ts): implement topic-based compaction, code-aware summaries, or use different summarization models.


**Skills:** Capability packages with instructions and tools, loaded on-demand. Progressive disclosure without busting the prompt cache. See [skills](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#skills).


**Prompt templates:** Reusable prompts as Markdown files. Type `/name` to expand. See [prompt templates](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#prompt-templates).


**Dynamic context:** [Extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions) can inject messages before each turn, filter the message history, implement RAG, or build long-term memory.


Queuing

## Steer or follow up

Submit messages while the agent works. `Enter` sends a steering message (delivered after current tool, interrupts remaining tools). `Alt+Enter` sends a follow-up (waits until the agent finishes).


Extensions

## Primitives, not features

Features that other agents bake in, you can build yourself. Extensions are TypeScript modules with access to tools, commands, keyboard shortcuts, events, and the full TUI.


[Sub-agents](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent/), [plan mode](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/plan-mode/), [permission gates](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/permission-gate.ts), [path protection](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/protected-paths.ts), [SSH execution](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/ssh.ts), [sandboxing](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/sandbox/), MCP integration, custom editors, status bars, overlays. [Yes, Doom runs.](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/doom-overlay/)

![Doom running in pi](https://pi.dev/doom-extension.png)

Don't want to build it? Ask pi to build it for you. Or install a [package](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#pi-packages) that does it your way. See the [50+ examples](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/).


Packages

## Install and share

Bundle extensions, skills, prompts, and themes as packages. Install from npm or git:


`$ pi install npm:@foo/pi-tools
$ pi install git:github.com/badlogic/pi-doom`

Pin versions with `@1.2.3` or `@tag`. Update all with `pi update`, list with `pi list`, configure with `pi config`.


Test without installing using `pi -e git:github.com/user/repo`.


Find packages on [npm](https://www.npmjs.com/search?q=keywords%3Api-package) or [Discord](https://discord.com/channels/1456806362351669492/1457744485428629628). Share yours with the `pi-package` keyword.


[Browse packages](https://pi.dev/packages)

Integration

## Four modes

**Interactive:** The full TUI experience.


**Print/JSON:**`pi -p "query"` for scripts, `--mode json` for event streams.


**RPC:** JSON protocol over stdin/stdout for non-Node integrations. See [docs/rpc.md](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/rpc.md).


**SDK:** Embed pi in your apps. See [clawdbot](https://github.com/clawdbot/clawdbot) for a real-world example.


Philosophy

## What we didn't build

Pi is aggressively extensible so it doesn't have to dictate your workflow. Features that other tools bake in can be built with [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions), [skills](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#skills), or installed from third-party [pi packages](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#pi-packages). This keeps the core minimal while letting you shape pi to fit how you work.


**No MCP.** Build CLI tools with READMEs (see [Skills](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#skills)), or build an extension that adds MCP support. [Why?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)

**No sub-agents.** There's many ways to do this. Spawn pi instances via tmux, or build your own with [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions), or install a package that does it your way.


**No permission popups.** Run in a container, or build your own confirmation flow with [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions) inline with your environment and security requirements.


**No plan mode.** Write plans to files, or build it with [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions), or install a package.


**No built-in to-dos.** Use a TODO.md file, or build your own with [extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions).


**No background bash.** Use tmux. Full observability, direct interaction.


Read the [blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) for the full rationale.


Community

## Get involved

**Issues:** [GitHub](https://github.com/badlogic/pi-mono/issues) for bugs and features.


**Discord:** [Community server](https://discord.com/invite/nKXTsAcmbT) for discussion and sharing.


**Docs:** [README](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#readme) and [docs/](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs) for everything else.


MIT License • [Mario Zechner](https://mariozechner.at/) & [contributors](https://github.com/badlogic/pi-mono/graphs/contributors)

pi.dev domain graciously donated by


[![Exy mascot](https://pi.dev/exy.png)\\
exe.dev](https://exe.dev/)

❤️