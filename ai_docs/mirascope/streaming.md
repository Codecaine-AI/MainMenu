# Streaming

Streaming lets you receive and process LLM responses as they're generated, rather than waiting for the complete response. Instead of a multi-second wait followed by a wall of text, users see content appear progressively. This creates a more responsive, interactive experience.

## Basic Usage

Call `.stream()` to get a `StreamResponse` instead of a `Response`. Then iterate with `text_stream()` to print content as it arrives:

<TabbedSection>
<Tab value="Call">
```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response: llm.StreamResponse = recommend_book.stream("fantasy")
for chunk in response.text_stream():
    print(chunk, end="", flush=True)

```
</Tab>
<Tab value="Prompt">
```python
from mirascope import llm


@llm.prompt
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response: llm.StreamResponse = recommend_book.stream("openai/gpt-5-mini", "fantasy")
for chunk in response.text_stream():
    print(chunk, end="", flush=True)

```
</Tab>
<Tab value="Model">
```python
from mirascope import llm

model = llm.Model("openai/gpt-5-mini")

response: llm.StreamResponse = model.stream("Recommend a fantasy book.")
for chunk in response.text_stream():
    print(chunk, end="", flush=True)

```
</Tab>
</TabbedSection>

The `text_stream()` method yields string chunks that you can print directly. Using `end=""` and `flush=True` ensures real-time display without line breaks.

## Stream Iterators

`StreamResponse` provides several ways to iterate over content:

| Method | Yields | Use Case |
| --- | --- | --- |
| `text_stream(sep="\n")` | `str` | Streaming text content to users |
| `pretty_stream()` | `str` | Debugging with all content types |
| `streams()` | `TextStream`, `ToolCallStream`, etc. | Processing distinct content parts separately |
| `structured_stream()` | `Partial[T]` | Streaming structured output fields as they arrive |
| `chunk_stream()` | `AssistantContentChunk` | Low-level access to raw chunks |

### text_stream

The `text_stream()` iterator yields only text content, ignoring thoughts, tool calls, and other content types. It's the streaming equivalent of `response.text()` and is ideal for displaying responses to users.

By default, it inserts a newline between multiple text parts. Pass a custom separator if needed: `text_stream(sep=" ")`.

### pretty_stream

The `pretty_stream()` iterator renders all content as human-readable chunks, including thoughts and tool calls. It is a streaming version of `response.pretty()` and is useful for debugging.

### streams

The `streams()` iterator groups chunks into substreams, which each contain one logical content piece. Each stream corresponds to one `Text`, `ToolCall`, or `Thought` in the final response.

The substreams will be `llm.TextStream`, `llm.ToolCallStream`, or `llm.ThoughtStream` (or Async variants). Each substream is an iterator that yields string deltas, and accumulates the partial content as a property. You can call `.collect()` to finish iteration and get the final content part (`llm.Text`, `llm.ToolCall`, or `llm.Thought`). 

If you want to skip processing a substream (for example, skipping tool call streams to let them accumulate naturally), you can do so and Mirascope will automatically handle it for you.

For example, you might use this to stream text and thoughts with different formatting, while silently accumulating tool calls to execute once the response is done:

```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


@llm.call(
    "anthropic/claude-sonnet-4-5",
    tools=[sqrt_tool],
    thinking={"level": "medium", "include_thoughts": True},
)
def math_assistant(query: str):
    return query


response = math_assistant.stream("What's the square root of 4242?")

# Create a loop for tool calling.
while True:
    # Stream text and thoughts; tool call streams complete silently
    for stream in response.streams():
        if stream.content_type == "text":
            for delta in stream:
                print(delta, end="", flush=True)
            print()
        elif stream.content_type == "thought":
            print("Thinking: ", end="")
            for delta in stream:
                print(delta, end="", flush=True)
            print()

    if response.tool_calls:
        response = response.resume(response.execute_tools())
    else:
        break

```

### chunk_stream

For low-level control, `chunk_stream()` yields typed chunk objects. Use pattern matching to handle different content types:

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book.stream("fantasy")
for chunk in response.chunk_stream():
    match chunk.type:
        case "text_chunk":
            print(chunk.delta, end="", flush=True)
        case _:
            pass
print()

```

<Note>
Some providers support interleaved tool calls, where chunks from multiple tool calls arrive mixed together. Each chunk includes an `id` field to track which tool call it belongs to. We recommend using `streams()` instead, which handles this complexity for you.
</Note>

<Note title="Chunk Types Reference" collapsible={true} defaultOpen={false}>

When using `chunk_stream()`, you'll encounter these chunk types:

| Chunk Type | `type` | Properties | Description |
| --- | --- | --- | --- |
| `TextStartChunk` | `"text_start_chunk"` | — | Marks start of text content |
| `TextChunk` | `"text_chunk"` | `delta` | Incremental text |
| `TextEndChunk` | `"text_end_chunk"` | — | Marks end of text content |
| `ThoughtStartChunk` | `"thought_start_chunk"` | — | Marks start of thinking |
| `ThoughtChunk` | `"thought_chunk"` | `delta` | Incremental reasoning text |
| `ThoughtEndChunk` | `"thought_end_chunk"` | — | Marks end of thinking |
| `ToolCallStartChunk` | `"tool_call_start_chunk"` | `id`, `name` | Marks start of tool call |
| `ToolCallChunk` | `"tool_call_chunk"` | `id`, `delta` | Incremental JSON args |
| `ToolCallEndChunk` | `"tool_call_end_chunk"` | `id` | Marks end of tool call |

When using the `streams()` api, the start and end chunks correspond to the start and end of each substream, and the substream properties will contain info that would be present on the start chunk (like tool id and name).
</Note>

## Accumulated Content

As you iterate through a stream, content accumulates on the response object. After streaming completes, you can access it just like a regular `Response`:

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book.stream("fantasy")

# Stream and display content
for chunk in response.text_stream():
    print(chunk, end="", flush=True)

# After streaming, access accumulated content like a regular Response
print(f"\nTexts: {len(response.texts)}")
print(f"Content parts: {len(response.content)}")
print(f"Messages in history: {len(response.messages)}")
print(f"Usage: {response.usage}")

```

Text content appears in `response.texts` immediately and updates in place as chunks arrive. Tool calls and thoughts only appear in their respective sequences once fully streamed—this prevents partial tool calls or incomplete thinking blocks from being used.

If you want to consume the entire stream without processing chunks individually, call `finish()`:

```python
stream_response.finish()  # Consume all remaining chunks
print(stream_response.pretty())  # Now fully populated
```

## Replaying Streams

Streams are replayable. Chunks are cached on the response as they're consumed, so calling `text_stream()`, `pretty_stream()`, `chunk_stream()`, or `streams()` again returns a fresh iterator that replays from the beginning:

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book.stream("fantasy")

# First iteration - consumes from LLM
print("First pass:")
for chunk in response.text_stream():
    print(chunk, end="", flush=True)

# Second iteration - replays from cache
# This will print everything immediately, and is approximately equivalent to calling
# print(stream_response.pretty())
print("Second pass (replay):")
for chunk in response.text_stream():
    print(chunk, end="", flush=True)

```

If a stream was only partially consumed, a new iterator will first replay cached chunks, then continue consuming fresh chunks from the LLM.

## Streaming with Tools

Tool calls stream just like text—you see argument fragments arrive progressively. The standard tool loop pattern works with streaming:

```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number."""
    return math.sqrt(number)


@llm.call("openai/gpt-5-mini", tools=[sqrt_tool])
def math_assistant(query: str):
    return query


response = math_assistant.stream("What's the square root of 4242?")

while True:  # Loop to ensure we execute all tool calls
    for chunk in response.pretty_stream():
        print(chunk, end="", flush=True)
    print()

    if not response.tool_calls:
        break

    tool_outputs = response.execute_tools()
    response = response.resume(tool_outputs)

```

Tool calls only appear in `response.tool_calls` once each tool call has fully streamed. This ensures that if you interrupt the stream and call `response.resume`, the history will not include incomplete tool calls.

In most cases it's simplest to wait until a response is fully streamed before executing its tool calls, however if you wish, you can execute tool calls immediately, and then resume the response before awaiting additional content.

## Streaming Structured Output

When using structured output, `structured_stream()` yields partial objects as fields are populated:

```python
from pydantic import BaseModel

from mirascope import llm


class Book(BaseModel):
    title: str
    author: str
    summary: str


@llm.call("openai/gpt-5-mini", format=Book)
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book.stream("fantasy")

# Stream partial objects as fields are populated
for partial in response.structured_stream():
    # partial is a Partial[Book] with all fields optional
    print(f"Partial: {partial}")

# Get the final validated object
book = response.parse()
print(f"\nFinal: {book.title} by {book.author}")

```

Each partial has all fields as optional—they're `None` until that portion of the response is received. After the stream completes, call `response.parse()` to get the final validated object.

You can also call `response.parse(partial=True)` at any point during or after streaming to get the current partial state:

```python
for chunk in response.chunk_stream():
    partial = response.parse(partial=True)
    if partial and partial.title:
        print(f"Title: {partial.title}")
```

<Note>
When using `tool` formatting mode, Mirascope automatically converts format tool call chunks into text chunks before presenting them through the streaming interface. This means you can use `structured_stream()` consistently regardless of the underlying formatting mode.
</Note>

<Note>
`structured_stream()` doesn't support `llm.output_parser` formats.
</Note>

## Async Streaming

For async code, `.stream()` on an async call returns an `AsyncStreamResponse`. Use `async for` with all iterators:

```python
import asyncio

from mirascope import llm


@llm.call("openai/gpt-5-mini")
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    response: llm.AsyncStreamResponse = await recommend_book.stream("fantasy")
    async for chunk in response.text_stream():
        print(chunk, end="", flush=True)


asyncio.run(main())

```

See [Async](/docs/learn/llm/async) for more on async patterns.

## Error Handling

Errors may not surface until you iterate—the initial `.stream()` call returns immediately, and actual LLM communication happens during iteration:

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book.stream("fantasy")

try:
    for chunk in response.text_stream():
        print(chunk, end="", flush=True)
except llm.RateLimitError as e:
    print(f"Rate limit exceeded: {e}")
except llm.ConnectionError as e:
    print(f"Connection error: {e}")
except llm.Error as e:
    print(f"Error during streaming: {e}")

```

When using `@llm.retry` or `llm.retry_model()` with streaming, errors are handled automatically. If a retryable error occurs mid-stream, the response raises `llm.StreamRestarted` to signal that the stream has been reset—catch this and re-iterate to continue:

```python
from mirascope import llm

model = llm.retry_model("openai/gpt-4o-mini")
response = model.stream("Tell me a story about a wizard")

while True:
    try:
        for chunk in response.text_stream():
            print(chunk, end="", flush=True)
        break  # Stream completed successfully
    except llm.StreamRestarted:
        print("\n[Stream restarted due to error, retrying...]\n")
        # Loop continues with the restarted stream

```

See [Reliability](/docs/learn/llm/reliability) for more on retry strategies and fallback patterns.

## Response Variants

Mirascope provides streaming response types for different calling patterns:

- `StreamResponse` — Synchronous streaming
- `AsyncStreamResponse` — Asynchronous streaming
- `ContextStreamResponse` — Synchronous with context injection
- `AsyncContextStreamResponse` — Asynchronous with context injection

All variants share the same core properties and iteration methods.

## Next Steps

- [Async](/docs/learn/llm/async) — Async patterns including async streaming
- [Tools](/docs/learn/llm/tools) — Tool calling in depth
- [Structured Output](/docs/learn/llm/structured-output) — Structured output parsing
- [Agents](/docs/learn/llm/agents) — Build agents with streaming responses
