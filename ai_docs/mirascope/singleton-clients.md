# Async Client Optimization: Singleton Patterns and Safe Cleanup in Mirascope

**Session**: async_client_optimization_20251211
**Generated**: 2025-12-11

---

## Executive Summary

This research addresses how to optimize async LLM calls in Mirascope by using singleton clients to maintain connections and minimize overhead, along with ensuring safe cleanup to avoid asyncio errors.

**Client Singleton Pattern**: Mirascope fully supports reusing pre-instantiated clients. By default, when no `client` parameter is provided, a NEW client instance (`AsyncOpenAI()`, `AsyncAnthropic()`, etc.) is created on EVERY call. This is inefficient for high-throughput applications because it wastes time establishing new connections. To enable client reuse, pass a pre-instantiated client via either (1) the `client` parameter in the call decorator, or (2) returning `{'client': my_client}` from the function via dynamic_config.

**Multi-Provider Clients**: Yes, if you are using different model providers (OpenAI, Anthropic, Groq, etc.), you need separate client instances. Each provider uses fundamentally different SDK clients with no shared connection infrastructure. OpenAI uses `openai.AsyncOpenAI`, Anthropic uses `anthropic.AsyncAnthropic`, etc. Connection pooling is handled internally by each SDK's httpx client, so reusing a single client instance per provider allows httpx to maintain persistent HTTP/2 connections.

**Safe Async Cleanup**: Mirascope streams do NOT implement async context manager protocol (`__aenter__`/`__aexit__`) and lack try/finally blocks in their `__aiter__` methods. If iteration is interrupted (canceled task, exception, early return), underlying async generators are not properly closed. For safe cleanup, you should: (1) consume streams fully, (2) wrap iteration in your own try/finally with manual cleanup, or (3) use asyncio patterns that ensure generators complete. The middleware factory module shows the correct pattern for cleanup in async iteration.

**asyncio.gather Pattern**: To use asyncio.gather with multiple providers, create futures while the appropriate context is active (context is captured at future creation time, not await time), then gather them together. This is validated in the test suite.

---

## Detailed Findings

### 1. Client Singleton and Connection Reuse

Mirascope creates a new SDK client on every call by default, which is inefficient. The key code is in each provider's `setup_call.py`:

**Key Locations**:
- `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/openai/_utils/_setup_call.py:148-154`
- `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/anthropic/_utils/_setup_call.py:143-145`

```python
# From openai/_utils/_setup_call.py lines 148-154
if client is None:
    client = AsyncOpenAI() if inspect.iscoroutinefunction(fn) else OpenAI()
create = (
    get_async_create_fn(client.chat.completions.create)
    if isinstance(client, AsyncOpenAI)
    else get_create_fn(client.chat.completions.create)
)
return create, prompt_template, messages, tool_types, call_kwargs
```

```python
# From anthropic/_utils/_setup_call.py lines 143-145
if client is None:
    client = AsyncAnthropic() if inspect.iscoroutinefunction(fn) else Anthropic()
create = client.messages.create
```

**Explanation**: If `client is None`, a brand new client is instantiated. This means every call opens a new connection. By passing a pre-instantiated client, you reuse the same connection pool.

### 2. Two Methods to Inject Singleton Clients

**Method 1: Decorator Parameter**

```python
from openai import AsyncOpenAI
from mirascope.core.openai import openai_call

# Create singleton client at module level
OPENAI_CLIENT = AsyncOpenAI()

@openai_call(model="gpt-4o-mini", client=OPENAI_CLIENT)
async def recommend_book(genre: str) -> str:
    return f"Recommend a {genre} book"
```

**Method 2: Dynamic Config**

The `_create.py` factory shows how dynamic_config can override clients at runtime:

```python
# From mirascope/core/base/_create.py lines 170-174
async def inner_async(*args: _P.args, **kwargs: _P.kwargs) -> TCallResponse | _ParsedOutputT:
    fn_args = get_fn_args(fn, args, kwargs)
    dynamic_config = await get_dynamic_configuration(fn, args, kwargs)
    nonlocal client
    if dynamic_config is not None:
        client = dynamic_config.get("client", None) or client
```

This allows runtime client injection:

```python
from openai import AsyncOpenAI
from mirascope.core.openai import openai_call, AsyncOpenAIDynamicConfig

OPENAI_CLIENT = AsyncOpenAI()

@openai_call(model="gpt-4o-mini")
async def recommend_book(genre: str) -> AsyncOpenAIDynamicConfig:
    return {
        "client": OPENAI_CLIENT,
        "messages": [{"role": "user", "content": f"Recommend a {genre} book"}],
    }
```

### 3. Multi-Provider Client Management

Each provider requires its own separate client. The providers cannot share connection pools because they use different SDK client classes:

**Key Location**: `/Users/Ford/Github Repos/opensource/mirascope/mirascope/llm/_call.py:54-88`

```python
def _get_local_provider_call(
    provider: LocalProvider,
    client: Any | None,
    is_async: bool,
) -> tuple[Callable, Any | None]:
    if provider == "ollama":
        from ..core.openai import openai_call

        if client:
            return openai_call, client  # Reuse provided client
        if is_async:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key="ollama", base_url="http://localhost:11434/v1")
        else:
            from openai import OpenAI
            client = OpenAI(api_key="ollama", base_url="http://localhost:11434/v1")
        return openai_call, client
```

**Recommended Pattern for Multiple Providers**:

```python
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from mirascope.llm import call

# Create singleton clients per provider at module initialization
CLIENTS = {
    "openai": AsyncOpenAI(),
    "anthropic": AsyncAnthropic(),
}

@call(provider="openai", model="gpt-4o-mini", client=CLIENTS["openai"])
async def openai_recommend(genre: str) -> str:
    return f"Recommend a {genre} book"

@call(provider="anthropic", model="claude-3-5-sonnet-latest", client=CLIENTS["anthropic"])
async def anthropic_recommend(genre: str) -> str:
    return f"Recommend a {genre} book"
```

### 4. Using asyncio.gather with Multiple Providers

The test suite validates the correct pattern for gathering async calls:

**Key Location**: `/Users/Ford/Github Repos/opensource/mirascope/tests/llm/test_call.py:504-586`

```python
# From tests/llm/test_call.py - Validated pattern
async def test_context_in_async_function_with_gather():
    @call(provider="openai", model="gpt-4o-mini")
    async def dummy_async_function():
        pass

    # Create the first future with default provider/model
    future1 = dummy_async_function()

    # Create the second future with a different context
    with context(provider="anthropic", model="claude-3-5-sonnet"):
        future2 = dummy_async_function()

    # Await both futures together
    await asyncio.gather(future1, future2)

    # First uses original model, second uses context-overridden model
```

**Critical Insight**: Context is captured when the future is CREATED (when you call the function), not when it's awaited. This means you can set up different contexts for different calls before gathering them.

### 5. Async Safety and Cleanup Concerns

**Current State**: Mirascope streams lack proper async cleanup mechanisms:

**Key Location**: `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/base/stream.py:161-185`

```python
# From mirascope/core/base/stream.py - Note: no try/finally, no aclose()
def __aiter__(self) -> AsyncGenerator[tuple[_BaseCallResponseChunkT, _BaseToolT | None], None]:
    """Iterates over the stream and stores useful information."""
    self.content = ""

    async def generator() -> AsyncGenerator[tuple[_BaseCallResponseChunkT, _BaseToolT | None], None]:
        assert isinstance(self.stream, AsyncGenerator), (
            "Stream must be an async generator for __aiter__"
        )
        tool_calls = []
        async for chunk, tool in self.stream:
            self._update_properties(chunk)
            if tool:
                tool_call = getattr(tool, "tool_call", _DEFAULT)
                if tool_call != _DEFAULT:
                    tool_calls.append(tool_call)
            yield chunk, tool
        self.message_param = self._construct_message_param(
            tool_calls or None, self.content
        )

    return generator()
```

Similarly, `handle_stream_async` has no cleanup:

```python
# From mirascope/core/openai/_utils/_handle_stream.py lines 110-138
async def handle_stream_async(
    stream: AsyncGenerator[ChatCompletionChunk, None],
    tool_types: list[type[OpenAITool]] | None,
    partial_tools: bool = False,
) -> AsyncGenerator[tuple[OpenAICallResponseChunk, OpenAITool | None], None]:
    """Async iterator over the stream and constructs tools as they are streamed."""
    # ... no try/finally wrapper ...
    async for chunk in stream:
        # ... yields chunks without cleanup handling ...
```

### 6. Correct Cleanup Patterns (Reference Implementations)

The middleware factory shows the correct pattern:

**Key Location**: `/Users/Ford/Github Repos/opensource/mirascope/mirascope/integrations/_middleware_factory.py:171-204`

```python
# From _middleware_factory.py - CORRECT pattern with try/finally
def new_stream_aiter(self: Any) -> AsyncGenerator[tuple[Any, Any | None], Any]:
    async def generator() -> AsyncGenerator[tuple[Any, Any | None], Any]:
        try:
            async for chunk, tool in original_aiter():
                yield chunk, tool
        except Exception as e:
            if handle_error_async:
                try:
                    await handle_error_async(e, fn, context)
                except Exception as new_e:
                    context_manager.__exit__(type(new_e), new_e, new_e.__traceback__)
                    raise
                else:
                    context_manager.__exit__(None, None, None)
                    return
            else:
                context_manager.__exit__(type(e), e, e.__traceback__)
                raise
        finally:
            if handle_stream_async is not None:
                await handle_stream_async(result, fn, context)
            context_manager.__exit__(None, None, None)

    return generator()
```

The MCP utilities show proper aclose() usage:

```python
# From mirascope/mcp/_utils.py lines 268-288
async def task() -> None:
    try:
        async with original_read:
            async for msg in original_read:
                if isinstance(msg, Exception):
                    if exception_handler:
                        exception_handler(msg)
                    continue
                await read_stream_writer.send(msg)
    finally:
        await read_stream_writer.aclose()  # Proper cleanup

async with create_task_group() as tg:
    tg.start_soon(task)
    try:
        yield filtered_read
    finally:
        await filtered_read.aclose()  # Cleanup on exit
        tg.cancel_scope.cancel()
```

---

## Architecture Overview

```
+------------------+     +------------------+     +------------------+
|  Your Code       |     |  Mirascope       |     |  Provider SDKs   |
+------------------+     +------------------+     +------------------+

  @call(client=X)  ----> setup_call()      ----> AsyncOpenAI()
        |                     |                       |
        |                if client is None:           |
        |                   client = AsyncOpenAI() <--+-- NEW per call
        |                else:                        |
        |                   use provided client  <----+-- REUSE connection
        |                     |
        +---- client=X -------+

Connection Pool Management:
+----------------------------------------------------------+
| AsyncOpenAI()                                             |
|   +-- httpx.AsyncClient (internal)                       |
|       +-- Connection Pool (HTTP/2 multiplexing)          |
|           +-- Persistent connections to api.openai.com   |
+----------------------------------------------------------+

Multi-Provider Setup:
+-------------+    +---------------+    +-------------+
| OPENAI_CLIENT|   | ANTHROPIC_CLIENT|  | GROQ_CLIENT |
+-------------+    +---------------+    +-------------+
      |                  |                    |
      v                  v                    v
  openai SDK        anthropic SDK         groq SDK
      |                  |                    |
      v                  v                    v
 api.openai.com   api.anthropic.com    api.groq.com
```

---

## Key Code Examples

### Complete Singleton Pattern Implementation

**File**: Example based on patterns from `/Users/Ford/Github Repos/opensource/mirascope/mirascope/llm/_call.py`

```python
import asyncio
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from mirascope.llm import call

# Module-level singleton clients - instantiate once
class LLMClients:
    _openai: AsyncOpenAI | None = None
    _anthropic: AsyncAnthropic | None = None

    @classmethod
    def openai(cls) -> AsyncOpenAI:
        if cls._openai is None:
            cls._openai = AsyncOpenAI()
        return cls._openai

    @classmethod
    def anthropic(cls) -> AsyncAnthropic:
        if cls._anthropic is None:
            cls._anthropic = AsyncAnthropic()
        return cls._anthropic


@call(provider="openai", model="gpt-4o-mini", client=LLMClients.openai())
async def openai_task(prompt: str) -> str:
    return prompt


@call(provider="anthropic", model="claude-3-5-sonnet-latest", client=LLMClients.anthropic())
async def anthropic_task(prompt: str) -> str:
    return prompt


async def main():
    # All these calls reuse the same client connections
    results = await asyncio.gather(
        openai_task("Hello from task 1"),
        openai_task("Hello from task 2"),
        anthropic_task("Hello from task 3"),
        anthropic_task("Hello from task 4"),
    )
    return results
```

### Safe Stream Consumption Pattern

```python
from mirascope.core.openai import openai_call

@openai_call(model="gpt-4o-mini", stream=True)
async def stream_response(prompt: str) -> str:
    return prompt


async def safe_stream_consumption():
    """Pattern to ensure streams are fully consumed."""
    stream = await stream_response("Tell me a story")

    collected_content = []
    try:
        async for chunk, tool in stream:
            collected_content.append(chunk.content)
            # If you need to exit early, the finally block handles cleanup
    except asyncio.CancelledError:
        # Handle cancellation gracefully
        raise
    except Exception as e:
        # Log error, handle as needed
        raise
    finally:
        # Note: Mirascope streams don't have aclose(), but if consuming
        # via an async generator wrapper, you should call aclose()
        pass

    return "".join(collected_content)
```

### Context-Aware Parallel Calls

**File**: Pattern validated in `/Users/Ford/Github Repos/opensource/mirascope/tests/llm/test_call.py:504-586`

```python
from mirascope.llm import call, context
import asyncio

@call(provider="openai", model="gpt-4o-mini")
async def recommend(genre: str) -> str:
    return f"Recommend a {genre} book"


async def parallel_multi_provider():
    """Use different providers in parallel with context."""

    # Future 1: Uses default provider (openai)
    future1 = recommend("fantasy")

    # Future 2: Override to anthropic (context captured at creation)
    with context(provider="anthropic", model="claude-3-5-sonnet-latest"):
        future2 = recommend("sci-fi")

    # Future 3: Override to different openai model
    with context(provider="openai", model="gpt-4o"):
        future3 = recommend("mystery")

    # All three run in parallel, each with their captured context
    results = await asyncio.gather(future1, future2, future3)
    return results
```

---

## File Reference

| File | Relevance | Key Content |
|------|-----------|-------------|
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/llm/_call.py` | Critical | Main call decorator, local provider handling, context capture |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/openai/_utils/_setup_call.py` | Critical | Shows client creation per call if None |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/anthropic/_utils/_setup_call.py` | Critical | Anthropic client creation pattern |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/base/_create.py` | High | Dynamic config client override logic |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/base/dynamic_config.py` | High | TypedDict definitions for client param |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/llm/_context.py` | High | Context manager for runtime overrides |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/base/stream.py` | High | Stream iteration without cleanup |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/integrations/_middleware_factory.py` | High | Correct cleanup pattern reference |
| `/Users/Ford/Github Repos/opensource/mirascope/mirascope/core/openai/_utils/_handle_stream.py` | Medium | Stream handling without try/finally |
| `/Users/Ford/Github Repos/opensource/mirascope/tests/llm/test_call.py` | Medium | Test validating asyncio.gather with context |

---

## Recommendations

### 1. Always Use Singleton Clients for High-Throughput Applications

Create client instances at module initialization time and pass them via the `client` parameter. This avoids the overhead of creating new connections for each call.

```python
# Do this once at module level
OPENAI_CLIENT = AsyncOpenAI()

# Reuse for all calls
@openai_call(model="gpt-4o-mini", client=OPENAI_CLIENT)
async def my_function(): ...
```

### 2. Create One Client Per Provider

Each provider (OpenAI, Anthropic, Groq, etc.) requires its own client. Maintain a dictionary or class with lazy initialization:

```python
CLIENTS = {}

def get_client(provider: str):
    if provider not in CLIENTS:
        if provider == "openai":
            CLIENTS[provider] = AsyncOpenAI()
        elif provider == "anthropic":
            CLIENTS[provider] = AsyncAnthropic()
    return CLIENTS[provider]
```

### 3. Capture Context Before Creating Futures for asyncio.gather

Context is captured when the async function is called, not when awaited:

```python
# CORRECT: Context captured at future creation
with context(provider="anthropic", model="claude-3-5-sonnet"):
    future = my_function()  # Context captured here

# INCORRECT assumption: Context is NOT applied at await time
await future  # Uses context from creation time
```

### 4. Consume Streams Fully or Use Middleware for Cleanup

Since Mirascope streams lack built-in cleanup, either:
- Consume streams completely in normal operation
- Use the middleware pattern from `_middleware_factory.py` for custom cleanup
- Wrap stream consumption in your own try/finally blocks

### 5. Consider Client Lifecycle for Long-Running Applications

For applications that run indefinitely, consider periodic client recreation to avoid potential connection staleness, or use the SDK's built-in connection health checks if available.

---

## Further Investigation

- **Client Health Monitoring**: Investigate whether OpenAI/Anthropic SDKs expose connection health metrics for proactive reconnection.
- **Stream Cleanup Enhancement**: The lack of `__aexit__` in Mirascope streams could be improved with proper async context manager implementation.
- **Connection Pool Tuning**: Both openai and anthropic SDKs use httpx internally; investigate httpx connection pool parameters (max_connections, keepalive_expiry) for optimization.

---

## Appendix: Research Methodology

### Queries Investigated

| ID | Title | Objective |
|----|-------|-----------|
| 001 | Client Singleton Patterns | Investigate how to use singleton/reusable clients with Mirascope to maintain connections and avoid connection overhead |
| 002 | Multi-Provider Client Management | Research whether different model providers require separate client instances |
| 003 | Async Safety and Cleanup | Research how to ensure async generations close safely without asyncio errors |

### Files Examined

17 files examined across 3 subagents.

| Subagent | Files | Key Contribution |
|----------|-------|------------------|
| 001 | 7 | Discovered client parameter flow through decorators and dynamic_config override mechanism |
| 002 | 7 | Confirmed each provider requires separate SDK client; validated asyncio.gather context pattern |
| 003 | 10 | Identified lack of cleanup in streams; found correct patterns in middleware_factory and mcp utils |
