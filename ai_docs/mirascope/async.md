# Async

Asynchronous programming is important when building LLM applications. LLM API calls are I/O-bound operations—your code spends most of its time waiting for network responses. Async lets you use that waiting time productively by running multiple operations concurrently, improving both responsiveness and throughput.

## Basic Async Calls

Make any prompt function async by adding the `async` keyword:

<TabbedSection>
<Tab value="Call">
```python
import asyncio

from mirascope import llm


@llm.call("openai/gpt-5-mini")
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    response = await recommend_book("fantasy")
    print(response.text())


asyncio.run(main())

```
</Tab>
<Tab value="Prompt">
```python
import asyncio

from mirascope import llm


@llm.prompt
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    response: llm.AsyncResponse = await recommend_book("openai/gpt-5-mini", "fantasy")
    print(response.text())


asyncio.run(main())

```
</Tab>
<Tab value="Model">
```python
import asyncio

from mirascope import llm

model = llm.Model("openai/gpt-5-mini")


async def main():
    response: llm.AsyncResponse = await model.call_async("Recommend a fantasy book.")
    print(response.text())


asyncio.run(main())

```
</Tab>
</TabbedSection>

The changes from synchronous code are:
1. Use an async prompt function (for prompts and calls), or use `model.call_async`/`model.stream_async` for `llm.Model`
2. Use `await` when generating the response
3. Run inside an async context (like `asyncio.run()`)

## Parallel Calls

One benefit of async is that you can run multiple calls concurrently. Use `asyncio.gather()` to run calls in parallel:

```python
import asyncio

from mirascope import llm


@llm.call("openai/gpt-5-mini")
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    genres = ["fantasy", "mystery", "romance"]
    responses = await asyncio.gather(*[recommend_book(genre) for genre in genres])

    for genre, response in zip(genres, responses, strict=False):
        print(f"[{genre}]: {response.pretty()}\n")


asyncio.run(main())

```

All three book recommendations run simultaneously—the total time is roughly the time of the slowest call, not the sum of all three.

## Async Tools

When your tools perform I/O operations (API calls, database queries, file operations), make them async:

```python
import asyncio

from mirascope import llm


@llm.tool
async def fetch_weather(city: str) -> str:
    """Fetch current weather for a city."""
    await asyncio.sleep(0.1)  # Simulate async API call
    return f"72°F and sunny in {city}"


@llm.call("openai/gpt-5-mini", tools=[fetch_weather])
async def weather_assistant(query: str):
    return query


async def main():
    response = await weather_assistant("What's the weather in Tokyo?")

    while response.tool_calls:
        tool_outputs = await response.execute_tools()
        response = await response.resume(tool_outputs)

    print(response.pretty())


asyncio.run(main())

```

When you call `response.execute_tools`, it will automatically use `asyncio.gather()` to ensure that all tools are executed concurrently.

<Note>
If any tool in the toolkit is async, all tools must be async and the call must be async. To convert sync tools or prompts, just change `def` to `async def`.

Tools from [MCP](/docs/learn/llm/mcp) servers are always async, so you'll need to use async when working with MCP.
</Note>

## Async Streaming

Streaming works the same way in async, just use `async for`:

```python
import asyncio

from mirascope import llm


@llm.call("openai/gpt-5-mini")
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    response = await recommend_book.stream("fantasy")
    async for chunk in response.text_stream():
        print(chunk, end="", flush=True)


asyncio.run(main())

```

All stream iterators (`pretty_stream()`, `streams()`, `chunk_stream()`, `structured_stream()`) support async iteration.

## Response Types

Mirascope provides async variants of response types:

| Sync | Async |
| --- | --- |
| `Response` | `AsyncResponse` |
| `StreamResponse` | `AsyncStreamResponse` |
| `ContextResponse` | `AsyncContextResponse` |
| `ContextStreamResponse` | `AsyncContextStreamResponse` |

Async and sync responses are the same with respect to properties and how they accumulate content. The major differences are that methods `resume` and `execute_tools` need to be awaited in async responses, and that an async responses's toolkit contains async tools.

## Best Practices

<Note title="Best Practices" collapsible={true} defaultOpen={false}>
- **Avoid blocking operations**: Don't use blocking I/O (like `time.sleep()` or synchronous HTTP clients) inside async functions—this blocks the entire event loop
- **Be mindful of rate limits**: Async makes it easy to send many concurrent requests, but providers have rate limits. Implement throttling if needed
</Note>

## When to Use Async

Async is most beneficial when:
- Making multiple LLM calls that can run in parallel
- Your tools perform network requests or database queries
- Interacting with [MCP](/docs/learn/llm/mcp) servers
- Building web applications (most frameworks are async-native)

For simple scripts with single sequential calls, sync code is simpler and equally performant.

## Next Steps

- [Streaming](/docs/learn/llm/streaming) — Stream responses in real-time
- [Tools](/docs/learn/llm/tools) — Learn more about tool calling
- [Agents](/docs/learn/llm/agents) — Build agents with async patterns
