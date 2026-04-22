# Widget Ordering in pi TUI

## How Widget Order Works

Widgets are stored in **JavaScript Maps** (`extensionWidgetsAbove` and `extensionWidgetsBelow`) inside the interactive mode. Rendering iterates `.values()` which preserves **insertion order**.

- **Updating** an existing key (same key, new content) keeps the widget at its original position.
- **Removing** a key (`setWidget(key, undefined)`) then re-adding it moves it to the **end** (bottom).
- There is **no z-index, priority, or sort option**. Position is determined solely by insertion order.

## setWidget Signature

```typescript
setWidget(
  key: string,
  content: string[] | ((tui: TUI, theme: Theme) => Component) | undefined,
  options?: { placement?: "aboveEditor" | "belowEditor" }
): void;
```

## Placement Options

| Placement       | Position                          |
|-----------------|-----------------------------------|
| `"aboveEditor"` | Above the input editor (default)  |
| `"belowEditor"` | Below the input editor            |

Only two zones exist. Within each zone, widgets render in insertion order.

## Controlling Order

To move a widget to a specific position:

```typescript
// Move widget to END (bottom) by removing and re-adding
ctx.ui.setWidget("my-widget", undefined);      // Remove from Map
ctx.ui.setWidget("my-widget", myComponent);    // Re-add at end
```

To ensure Widget B always renders AFTER Widget A:
1. Register Widget A first
2. Register Widget B second
3. If Widget A is registered first but you want it below, remove + re-add after Widget B

## Sources

- pi-mono source: `packages/coding-agent/src/core/extensions/types.ts`
- Compiled: `@mariozechner/pi-coding-agent/dist/modes/interactive/interactive-mode.js`
- Render loop: `for (const component of widgets.values())` — Map insertion order
- Examples: `widget-placement.ts`, `subagent-widget.ts`, `plan-mode/index.ts`
