# Context

Mirascope's Context system lets you inject dependencies into prompts and tools at call time. This is useful when tools need access to shared resources like database connections, API clients, or configuration that you don't want to hardcode or store as globals.

<TabbedSection>
<Tab value="Call">
```python
from dataclasses import dataclass

from mirascope import llm


@dataclass
class Library:
    books: dict[str, str]  # title -> author


@llm.tool
def get_author(ctx: llm.Context[Library], title: str) -> str:
    """Get the author of a book."""
    return ctx.deps.books.get(title, "Book not found")


@llm.call("openai/gpt-5-mini", tools=[get_author])
def librarian(ctx: llm.Context[Library], query: str):
    return query


library = Library(books={"Dune": "Frank Herbert", "Neuromancer": "William Gibson"})
ctx = llm.Context(deps=library)
response = librarian(ctx, "Who wrote Dune?")

while response.tool_calls:
    tool_outputs = response.execute_tools(ctx)
    response = response.resume(ctx, tool_outputs)

print(response.pretty())
# Dune was written by Frank Herbert.

```
</Tab>
<Tab value="Prompt">
```python
from dataclasses import dataclass

from mirascope import llm


@dataclass
class Library:
    books: dict[str, str]  # title -> author


@llm.tool
def get_author(ctx: llm.Context[Library], title: str) -> str:
    """Get the author of a book."""
    return ctx.deps.books.get(title, "Book not found")


@llm.prompt(tools=[get_author])
def librarian(ctx: llm.Context[Library], query: str):
    return query


library = Library(books={"Dune": "Frank Herbert", "Neuromancer": "William Gibson"})
ctx = llm.Context(deps=library)
model = llm.use_model("openai/gpt-5-mini")
response = librarian.call(model, ctx, "Who wrote Dune?")

while response.tool_calls:
    tool_outputs = response.execute_tools(ctx)
    response = response.resume(ctx, tool_outputs)

print(response.pretty())
# Dune was written by Frank Herbert.

```
</Tab>
<Tab value="Model">
```python
from dataclasses import dataclass

from mirascope import llm


@dataclass
class Library:
    books: dict[str, str]  # title -> author


@llm.tool
def get_author(ctx: llm.Context[Library], title: str) -> str:
    """Get the author of a book."""
    return ctx.deps.books.get(title, "Book not found")


library = Library(books={"Dune": "Frank Herbert", "Neuromancer": "William Gibson"})
ctx = llm.Context(deps=library)
model = llm.use_model("openai/gpt-5-mini")
response = model.context_call(
    "Who wrote Dune?",
    ctx=ctx,
    tools=[get_author],
)

while response.tool_calls:
    tool_outputs = response.execute_tools(ctx)
    response = response.resume(ctx, tool_outputs)

print(response.pretty())
# Dune was written by Frank Herbert.

```
</Tab>
</TabbedSection>

The tool accesses the library through `ctx.deps`. When you call `execute_tools(ctx)`, Mirascope passes the context to each tool that needs it.

## How It Works

1. Define your dependency class (here, `Library`)
2. Add `ctx: llm.Context[DepsType]` as the first parameter to tools and prompts that need it
3. Wrap your dependency in `llm.Context(deps=...)`
4. Pass the context when calling, and to `execute_tools()` and `resume()`

<Info>
For Mirascope to know that a prompt or tool is using context, the first argument must be named `ctx`, and it must be typed as `llm.Context`, or a subclass of `llm.Context`.
</Info>

## Context Tools

A tool becomes context-aware when its first parameter is `ctx: llm.Context[DepsType]`:

```python
@llm.tool
def get_author(ctx: llm.Context[Library], title: str) -> str:
    """Get the author of a book."""
    return ctx.deps.books.get(title, "Book not found")
```

The function name, docstring, and other parameters work exactly like regular tools. Mirascope handles the `ctx` parameter automatically—it doesn't become part of the tool schema the LLM sees. Thus, the LLM won't try to generate a `ctx` argument.

You can mix context tools with regular tools in the same call. 

## Context Prompts

When using context tools, the prompt function must take `ctx` as its first parameter:

```python
@llm.call("openai/gpt-5-mini", tools=[get_author])
def librarian(ctx: llm.Context[Library], query: str):
    return query
```

The prompt can also use the context directly if needed—for example, to include information from the dependency in the system message.

## Response Types

Context calls return context-aware response types:

| Call Pattern | Response Type |
| --- | --- |
| Sync | `ContextResponse[DepsT, FormatT]` |
| Async | `AsyncContextResponse[DepsT, FormatT]` |
| Stream | `ContextStreamResponse[DepsT, FormatT]` |
| Async Stream | `AsyncContextStreamResponse[DepsT, FormatT]` |

These work like their non-context counterparts, but `resume()` and `execute_tools()` require the context argument.

## Async Context

Context works with async prompts and tools. Use `await` with `execute_tools()` and `resume()`:

```python
import asyncio
from dataclasses import dataclass

from mirascope import llm


@dataclass
class Library:
    books: dict[str, str]  # title -> author


@llm.tool
async def get_author(ctx: llm.Context[Library], title: str) -> str:
    """Get the author of a book."""
    return ctx.deps.books.get(title, "Book not found")


@llm.call("openai/gpt-5-mini", tools=[get_author])
async def librarian(ctx: llm.Context[Library], query: str):
    return query


async def main():
    library = Library(books={"Dune": "Frank Herbert", "Neuromancer": "William Gibson"})
    ctx = llm.Context(deps=library)
    response = await librarian(ctx, "Who wrote Dune?")

    while response.tool_calls:
        tool_outputs = await response.execute_tools(ctx)
        response = await response.resume(ctx, tool_outputs)

    print(response.pretty())
    # Dune was written by Frank Herbert.


asyncio.run(main())

```

If any context tool is async, all tools must be async and the prompt must be async.

## Type Safety

The context system is type-safe. Your type checker will catch mismatches between:

- The context type tools expect and what you pass to `execute_tools()`
- Different tools expecting different dependency types

If you accidentally pass the wrong context type, you'll get a type error at development time.

<Note>
All context tools in a call must agree on the dependency type. If different tools need different dependencies, combine them into a single wrapper class.
</Note>

## Next Steps

- [Tools](/docs/learn/llm/tools) — Learn more about tool calling
- [Agents](/docs/learn/llm/agents) — Build agents that use context for state management
- [Async](/docs/learn/llm/async) — Async patterns with context
