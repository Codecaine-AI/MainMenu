# Spec

## Overview

{{INITIAL_UNDERSTANDING}}

## Problem Statement

*What problem are we solving? Why does it matter?*

## Goals

### High-Level Goals

*The north star - what does ultimate success look like? Include WHY this matters.*

### Mid-Level Goals

*Major capabilities or milestones needed to achieve high-level goals. Capture the reasoning behind each.*

### Detailed Goals

*Specific behaviors or features - added as conversation progresses. Note user's preferences and "taste".*

## Non-Goals

*What we are explicitly NOT building - prevents scope creep*

-

## Success Criteria

*How do we know we're done? Testable outcomes*

- [ ]

## Context & Background

*Relevant existing systems, prior art, stakeholder input. Include user's mental model and design philosophy when relevant.*

## Key Decisions

*Capture the WHY behind decisions, not just the WHAT. Include user's reasoning and preferences.*

<!-- Add decisions as they are made using this format:

### [Decision Title]
**Rationale**: [Why this decision was made]
**Made**: [YYYY-MM-DD]

-->

## Open Questions

- [ ] *Questions still needing answers*

## File Structure

*Show file tree when adding new files or restructuring. Prioritize this for any session that introduces new paths.*

### Example
```
project/
├── src/
│   ├── components/
│   │   ├── NewComponent.tsx    # new
│   │   └── ExistingOne.tsx     # modified
│   └── utils/
│       └── helper.ts           # new
├── tests/
│   └── NewComponent.test.tsx   # new
└── package.json                # modified
```

## Diagrams

*Use the appropriate diagram type for what you're communicating:*

### Entity & Flow Diagrams (ASCII)

*Use ```ascii fenced blocks for entity relationships and data flow. This enables post-processing and avoids rendering artifacts.*

#### Example
```ascii
┌──────────┐     1:N     ┌──────────┐
│  Project  │────────────▶│  Session  │
│           │             │           │
│ - name    │             │ - topic   │
│ - slug    │             │ - status  │
└──────────┘             └─────┬─────┘
                               │ 1:N
                               ▼
                         ┌──────────┐
                         │ Artifact │
                         │          │
                         │ - type   │
                         │ - path   │
                         └──────────┘
```

### Process Diagrams (Mermaid)

*Use mermaid for process flows, state machines, and sequence diagrams.*

#### Example
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B --> C[Path 1]
    B --> D[Path 2]
```

## Notes

*Working notes, ideas, considerations*

