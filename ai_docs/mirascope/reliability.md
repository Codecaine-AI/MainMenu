# Reliability

LLM API calls can fail for many reasons: rate limits, server errors, network issues, or timeouts. Mirascope provides built-in retry logic with exponential backoff and fallback models to handle these failures gracefully.

## Basic Usage

Use the `@llm.retry` decorator, or `llm.retry_model`, to add automatic retry logic to your calls and prompts:

<TabbedSection>
<Tab value="Call">
```python
from mirascope import llm


@llm.retry()
@llm.call("openai/gpt-4o-mini")
def recommend_book(genre: str) -> str:
    return f"Recommend a {genre} book"


response = recommend_book("fantasy")
print(response.text())
# > The Name of the Wind by Patrick Rothfuss

```
</Tab>
<Tab value="Prompt">
```python
from mirascope import llm


@llm.retry()
@llm.prompt
def recommend_book(genre: str) -> str:
    return f"Recommend a {genre} book"


response = recommend_book("openai/gpt-4o-mini", "fantasy")
print(response.text())
# > The Name of the Wind by Patrick Rothfuss

```
</Tab>
<Tab value="Model">
```python
from mirascope import llm

model = llm.retry_model("openai/gpt-4o-mini")
response = model.call("Recommend a fantasy book")
print(response.text())
# > The Name of the Wind by Patrick Rothfuss

```
</Tab>
</TabbedSection>

In each of the above examples, if the provider emits a transient error, Mirascope will automatically retry the request.

By default, `@llm.retry` and `llm.retry_model()`:
- Retry up to 3 times after the initial attempt fails
- Use exponential backoff starting at 0.5 seconds
- Retry on `ConnectionError`, `RateLimitError`, `ServerError`, and `TimeoutError`

The response is a `RetryResponse` (or `RetryStreamResponse` for streaming), which inherits from the standard response types but includes retry metadata.

## Fallback Models

Specify fallback models to try if the primary model fails. Each model gets its own full retry budget:

<TabbedSection>
<Tab value="Call">
```python
from mirascope import llm


@llm.retry(
    fallback_models=[
        "anthropic/claude-3-5-haiku-latest",
        "google/gemini-2.0-flash",
    ]
)
@llm.call("openai/gpt-4o-mini")
def recommend_book(genre: str) -> str:
    return f"Recommend a {genre} book"


response = recommend_book("fantasy")
print(response.text())
# > The Name of the Wind by Patrick Rothfuss

```
</Tab>
<Tab value="Prompt">
```python
from mirascope import llm


@llm.retry(
    fallback_models=[
        "anthropic/claude-3-5-haiku-latest",
        "google/gemini-2.0-flash",
    ]
)
@llm.prompt
def recommend_book(genre: str) -> str:
    return f"Recommend a {genre} book"


response = recommend_book("openai/gpt-4o-mini", "fantasy")
print(response.text())
# > The Name of the Wind by Patrick Rothfuss

```
</Tab>
<Tab value="Model">
```python
from mirascope import llm

model = llm.retry_model(
    "openai/gpt-4o-mini",
    fallback_models=[
        "anthropic/claude-3-5-haiku-latest",
        "google/gemini-2.0-flash",
    ],
)
response = model.call("Recommend a fantasy book")
print(response.text())
# > The Name of the Wind by Patrick Rothfuss

```
</Tab>
</TabbedSection>

When a fallback model succeeds, `response.resume()` will continue using that model. This preserves provider-specific benefits like cached context and reasoning traces.

<Note>
Fallback model IDs inherit parameters (temperature, max_tokens, etc.) from the primary model. Pass `llm.Model` instances instead of strings if you need different parameters per model.
</Note>

## Configuring Retry Behavior

Customize the retry behavior with these options:

```python
from mirascope import llm


@llm.retry(
    max_retries=5,
    initial_delay=1.0,
    max_delay=30.0,
    backoff_multiplier=2.0,
    jitter=0.1,
    retry_on=(llm.RateLimitError, llm.ServerError),
)
@llm.call("openai/gpt-4o-mini")
def recommend_book(genre: str) -> str:
    return f"Recommend a {genre} book"


response = recommend_book("fantasy")
print(response.text())
# > The Name of the Wind by Patrick Rothfuss

```

### Configuration Options

| Option | Default | Description |
| --- | --- | --- |
| `max_retries` | `3` | Maximum retry attempts after the initial failure |
| `initial_delay` | `0.5` | Seconds to wait before the first retry |
| `max_delay` | `60.0` | Maximum delay between retries |
| `backoff_multiplier` | `2.0` | Multiply delay by this after each retry |
| `jitter` | `0.0` | Random variation (0.0–1.0) to prevent thundering herd |
| `retry_on` | See below | Tuple of exception types that trigger retries |
| `fallback_models` | `()` | Models (via `ModelId` or `Model`) to use, in order, if the primary model fails |

The default `retry_on` errors are transient failures that typically succeed on retry:
- `llm.ConnectionError` — Network issues, DNS failures
- `llm.RateLimitError` — Rate limits exceeded (429)
- `llm.ServerError` — Provider-side errors (500+)
- `llm.TimeoutError` — Request timeouts

See [Errors](/docs/learn/llm/errors) for the full exception hierarchy.

## Streaming with Retries

When streaming, retries work differently. If an error occurs mid-stream, the response raises `StreamRestarted` to signal that the stream has been reset. Catch this exception and re-iterate to continue:

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

The `StreamRestarted` exception gives you an opportunity to handle the restart (e.g., clear previous output) before the stream resumes from the beginning.

### Continuing Instead of Restarting

If you want to continue a stream from where it left off rather than restarting, use `response.resume()` manually. This tells the model what content it already generated, so it can pick up where it stopped:

```python
from mirascope import llm

# Use a `llm.Model` (not `llm.RetryModel`) for manual control when resuming the
# stream response.
model = llm.Model("openai/gpt-4o-mini")
response = model.stream("Tell me a story about a wizard")

max_retries = 3
for attempt in range(max_retries + 1):
    try:
        for chunk in response.text_stream():
            # Each chunk of text gets added to `response.content` as part
            # of the final final assistant message in `response.messages`.
            # This state accumulates even if the response is later interrupted.
            print(chunk, end="", flush=True)
        break  # Stream completed successfully
    except llm.Error:
        if attempt == max_retries:
            raise
        print("\n[Error occurred, continuing from where we left off...]\n")
        # Manually calling `response.resume` uses the partially-streamed text
        # content above, as well as any tool calls that fully streamed. (Partial
        # tool calls are discarded).
        # This differs from using a `RetryStreamResponse`, which would restart
        # the stream without persisting any partially streamed content.
        response = response.resume("Please continue from where you left off.")

```

This approach uses `response.resume()` which includes the accumulated content from `response.messages`, giving the model context about what it already said.

## Handling RetriesExhausted

When all retry attempts fail (including fallback models), Mirascope raises `RetriesExhausted`. This exception contains details about each failed attempt:

```python
from mirascope import llm

model = llm.retry_model(
    "openai/gpt-4o-mini",
    max_retries=2,
    fallback_models=["anthropic/claude-3-5-haiku-latest"],
)

try:
    response = model.call("Recommend a fantasy book")
    print(response.text())
except llm.RetriesExhausted as e:
    print(f"All {len(e.failures)} attempts failed:")
    for failure in e.failures:
        print(f"  {failure.model.model_id}: {type(failure.exception).__name__}")

```

Each `RetryFailure` in `e.failures` contains:
- `model` — The model that was tried
- `exception` — The exception that was raised

## Retry Metadata

Retry responses track failed attempts in the `retry_failures` property:

```python
response = recommend_book("fantasy")

if response.retry_failures:
    print(f"Succeeded after {len(response.retry_failures)} failed attempts")
    for failure in response.retry_failures:
        print(f"  {failure.model.model_id}: {failure.exception}")
```

If the first attempt succeeds, `retry_failures` is an empty list.

## Related Topics

For retrying on structured output validation errors, use `response.validate()` which automatically retries when parsing fails. Note that when calling `validate()` on a `RetryResponse`, it will use retry logic when needed.

See [Structured Output](/docs/learn/llm/structured-output#automatic-retry-with-validate).

For handling tool execution errors, see [Tools](/docs/learn/llm/tools). Mirascope automatically captures tool errors and passes them to the LLM so it can adapt.

## Next Steps

- [Errors](/docs/learn/llm/errors) — Unified error types across providers
- [Streaming](/docs/learn/llm/streaming) — Streaming patterns in depth
- [Structured Output](/docs/learn/llm/structured-output) — Validation and parsing
