# Tools

Tools let LLMs request that you execute functions and return the results. Instead of just generating text, the model can ask for specific operations (like fetching data, performing calculations, interacting with external systems) and then use those results to formulate its response.

```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


@llm.tool
def sum_tool(numbers: list[float]) -> float:
    total = 0
    for number in numbers:
        total += number
    return total


@llm.call("openai/gpt-5-mini", tools=[sqrt_tool, sum_tool])
def math_assistant(query: str):
    return query


response = math_assistant("What's the sum of the square roots of 137, 4242, and 6900?")

while response.tool_calls:
    tool_outputs = response.execute_tools()
    response = response.resume(tool_outputs)

print(response.pretty())
# sqrt(137) + sqrt(4242) + sqrt(6900) ≈ 159.9015764916355

```

Use `@llm.tool` to create a tool from a function, pass it to your call via `tools=[...]`, then loop until the model stops requesting tool calls. The loop pattern handles any number of tool-use rounds automatically.

## Defining Tools

The `@llm.tool` decorator turns a function into a tool. The function's name, docstring, and type hints become part of the tool schema that the LLM sees:

```python
@llm.tool
def search_books(query: str, max_results: int = 5) -> list[str]:
    """Search the library catalog for books.

    Use this tool when the user wants to find books on a topic.
    Returns a list of matching book titles.
    """
```

In this example, the LLM knows it has a tool called `"search_books"` that takes a `query` string and optional `max_results` integer. The docstring becomes the tool's description, helping the LLM understand when to use it.

### Tool Parameters

Parameters are inferred from the function signature. Use type hints and docstrings to describe them:

```python
@llm.tool
def create_event(
    title: str,
    date: str,
    duration_minutes: int = 60,
    attendees: list[str] | None = None,
) -> str:
    """Create a calendar event.

    Args:
        title: The name of the event.
        date: Date in YYYY-MM-DD format.
        duration_minutes: How long the event lasts.
        attendees: List of email addresses to invite.
    """
```

Mirascope extracts parameter descriptions from the docstring and includes them in the tool schema. Google, NumPy, ReST, and Epydoc docstring formats are all supported. With this calendar tool, the LLM knows that dates should have `"YYYY-MM-DD"` format.

<Note>
Clear parameter descriptions help the LLM provide correct arguments. Include format requirements, valid ranges, or examples where helpful.
</Note>

### Strict Mode

The `@llm.tool` decorator accepts a `strict` parameter that controls whether the provider enforces the tool's JSON schema:

```python
from typing import Literal

@llm.tool(strict=True)
def get_current_temperature(
    location: str,
    units: Literal["fahrenheit", "celsius"],
) -> float:
    """Get the current temperature for a location."""
```

| Value | Behavior |
| --- | --- |
| `None` (default) | Uses strict if the provider supports it |
| `True` | Must use strict schema validation; raises `llm.FeatureNotSupportedError` if unsupported |
| `False` | Disables strict mode even if the provider supports it |

When strict mode is enabled, the provider guarantees the LLM's tool call arguments will match the schema exactly.

## How Tool Calling Works

When an LLM wants to use a tool, it doesn't call the function directly—it returns a `ToolCall` asking you to execute it. You run the tool and pass the result back so the model can continue.

```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


@llm.call("openai/gpt-5-mini", tools=[sqrt_tool])
def math_assistant(query: str):
    return query


response = math_assistant("What's the square root of 4242?")
tool_call = response.tool_calls[0]
print(tool_call)
# ToolCall(type='tool_call', id='...', name='sqrt_tool', args='{"number":4242}')

# Looks up sqrt_tool by name and calls sqrt_tool.execute(tool_call)
tool_output = response.toolkit.execute(tool_call)
print(tool_output)
# ToolOutput(type='tool_output', id='...', name='sqrt_tool', value=65.13063795173512)

answer = response.resume(tool_output)
print(answer.pretty())
# The square root of 4242 is approximately 65.13063795173512.

```

Here's what happens step by step:

1. The model receives the prompt and sees `sqrt_tool` is available
2. Instead of guessing, it returns a `ToolCall` with `name="sqrt_tool"` and `args={"number": 4242}`
3. We execute via `response.toolkit.execute(tool_call)`, which looks up the tool by name and returns a `ToolOutput`
4. We pass the output back with `response.resume(tool_output)`
5. The model uses the result to formulate its final answer

### Parallel Tool Calls

LLMs can request multiple tools in a single response. Use `response.execute_tools()` to run them all:

```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


@llm.call("openai/gpt-5-mini", tools=[sqrt_tool])
def math_assistant(query: str):
    return query


response = math_assistant("What are the square roots of 3737, 4242, and 6464?")

tool_outputs = response.execute_tools()  # Execute all of the response's tool calls

answer = response.resume(tool_outputs)
print(answer.pretty())

# The square roots (approximate) are:
# - sqrt(3737) ≈ 61.1310068623117
# - sqrt(4242) ≈ 65.13063795173512
# - sqrt(6464) ≈ 80.39900496896712

```

This is more convenient than executing each tool manually, and it's what powers the loop pattern shown at the top of this page. For async tools, `execute_tools()` runs all tools concurrently using `asyncio.gather`.

### The Toolkit

Every response includes a `toolkit` property containing the tools that were available for that call. The toolkit provides methods to look up and execute tools by name:

```python
response = math_assistant("What's the square root of 4242?")

# Access the toolkit
toolkit = response.toolkit

# Look up a tool by name from a ToolCall
tool = toolkit.get(tool_call)  # Returns the Tool, or raises ToolNotFoundError

# Execute a tool call (looks up and runs the tool)
output = toolkit.execute(tool_call)  # Returns ToolOutput
```

The convenience method `response.execute_tools()` uses the toolkit internally to execute all tool calls in a response.

## Async Tools

For async operations like network requests or database queries, define async tool functions:

```python
import asyncio

from mirascope import llm


@llm.tool
async def fetch_user_data(user_id: int) -> dict[str, str | int]:
    """Fetch user data from the database."""
    await asyncio.sleep(0.1)  # Simulate async I/O
    return {"id": user_id, "name": "Alice", "email": "alice@example.com"}


@llm.call("openai/gpt-4o", tools=[fetch_user_data])
async def user_assistant(query: str) -> str:
    return query


async def main():
    response = await user_assistant("Get info for user 123")

    if response.tool_calls:
        tool_outputs = await response.execute_tools()
        response = await response.resume(tool_outputs)

    print(response.pretty())


asyncio.run(main())

```

When any tool is async, the call must be async too, and you use `await` with `execute_tools()` and `resume()`. See the [Async](/docs/learn/llm/async) guide for more details.

<Note>
If any tool in the toolkit is async, all tools must be async, and the entire call chain must use async/await.
</Note>

## Tools with Prompts and Models

The examples above use `@llm.call`. You can also pass tools to `@llm.prompt` or directly to a model:

<TabbedSection>
<Tab value="Call">
```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


@llm.call("openai/gpt-5-mini", tools=[sqrt_tool])
def math_assistant(query: str):
    return query


response = math_assistant("What's the square root of 4242?")

while response.tool_calls:
    tool_outputs = response.execute_tools()
    response = response.resume(tool_outputs)

print(response.text())

```
</Tab>
<Tab value="Prompt">
```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


@llm.prompt(tools=[sqrt_tool])
def math_assistant(query: str):
    return query


model = llm.Model("openai/gpt-5-mini")
response = math_assistant(model, "What's the square root of 4242?")

while response.tool_calls:
    tool_outputs = response.execute_tools()
    response = response.resume(tool_outputs)

print(response.text())

```
</Tab>
<Tab value="Model">
```python
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


model = llm.Model("openai/gpt-5-mini")
response = model.call("What's the square root of 4242?", tools=[sqrt_tool])

while response.tool_calls:
    tool_outputs = response.execute_tools()
    response = response.resume(tool_outputs)

print(response.text())

```
</Tab>
</TabbedSection>

All three approaches work the same way: you provide tools and handle tool calls identically regardless of how you make the call.

## Error Handling

When a tool throws an exception during execution, Mirascope captures the error in a `ToolOutput` and passes it back to the LLM. This lets the model adapt its approach—perhaps trying different arguments or using a different tool.

```python
@llm.tool
def divide(a: float, b: float) -> float:
    """Divide a by b."""
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
```

If the LLM calls `divide(10, 0)`, the error message is returned as the tool result. The model sees `"Cannot divide by zero"` and can respond appropriately—perhaps explaining the issue to the user or trying a different calculation.

Each `ToolOutput` has an `error` property you can check:

```python
outputs = response.execute_tools()
for output in outputs:
    if output.error:
        print(f"Tool {output.name} failed: {output.error}")
```

Mirascope uses two tool-related exceptions:
- `llm.ToolExecutionError` — Wrapped around any exception thrown during tool execution
- `llm.ToolNotFoundError` — Raised when the LLM requests a tool that doesn't exist in the toolkit

See [Errors](/docs/learn/llm/errors) for the full exception hierarchy.

## Provider Native Tools

Some providers offer native tool support, which are tools that the provider executes on your behalf, server-side. The classic example is a web search tool, which allows the LLM to search the web and retrieve up-to-date information on your behalf.

### Web Search

Use the web search tool by passing `llm.WebSearchTool()` into the `tools` array like any other tool:

```python
from mirascope import llm


@llm.call("anthropic/claude-sonnet-4-5", tools=[llm.WebSearchTool()])
def weather_assistant(query: str):
    return query


response = weather_assistant("What's the current weather in San Francisco?")
print(response.text())
# Today features intervals of clouds and sunshine with a couple of showers, with a high of 62°F
# Partly cloudy skies this morning will give way to occasional showers during the afternoon, with a high of 61°F and a 40% chance of rain

# Tonight, expect light rain transitioning to a few showers by morning, with a low of 51°F and a 60% chance of rain
# The air quality is poor and unhealthy for sensitive groups

```

The provider handles the web search automatically and returns the results as part of the response. Unlike regular tools where you execute the function and resume the conversation, native tools are executed server-side by the provider.

<Note>
Web search is currently supported by OpenAI (Responses API), Anthropic, and Google.
</Note>

## Next Steps

- [Structured Output](/docs/learn/llm/structured-output) — Parse responses into typed objects
- [Streaming](/docs/learn/llm/streaming) — Stream responses with tool calls
- [Context](/docs/learn/llm/context) — Inject dependencies into tools
- [Agents](/docs/learn/llm/agents) — Build autonomous agents with tools
