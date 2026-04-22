# Responses

When you call an LLM, you get back an `llm.Response`. This object contains everything about the interaction: the generated content, the full message history, token usage, and metadata about the model that produced it.

```python
from mirascope import llm

model = llm.model("openai/gpt-5-mini")
response: llm.Response = model.call("What is the capital of France?")

print(response.text())  # Prints the textual content of the response

```

## Accessing Content

The LLM's output is available through several properties:


### Content Properties

| Property | Type | Description |
| --- | --- | --- |
| `content` | `Sequence[llm.AssistantContentPart]` | All content parts in generation order |
| `texts` | `Sequence[llm.Text]` | Only the text portions of the response |
| `tool_calls` | `Sequence[llm.ToolCall]` | Tool calls the LLM wants executed  |
| `thoughts` | `Sequence[llm.Thought]` | Reasoning from the model's thinking process |
| `messages` | `Sequence[llm.Message]` | All of the messages in the response's history (including the final assistant message) |
| `usage` | `llm.Usage` | Token usage for this response |

It's often useful to combine a response's content into a single string. `response.text()` returns all text content joined together, ideal for displaying to users. 

`response.pretty()` includes stringified representations of all content types (text, thoughts, tool calls), which is helpful for debugging.

```python
from mirascope import llm

model = llm.model("openai/gpt-5")
response = model.call("Tell me a joke.")

# response.content contains all content parts: Text, ToolCall, Thought
for part in response.content:
    print(f"{type(part).__name__}: {part}")

# Filtered accessors for specific content types
for text in response.texts:
    print(f"Text: {text.text}")

for thought in response.thoughts:
    print(f"Thought: {thought.thought}")

for tool_call in response.tool_calls:
    print(f"Tool call: {tool_call.name}({tool_call.args})")

```

### Content Methods

| Method | Returns | Description |
| --- | --- | --- |
| `text(sep="\n")` | `str` | All text content joined by separator |
| `pretty()` | `str` | Human-readable representation of all content |

<Note>
`tool_calls` and `thoughts` are populated only when relevant. See [Tools](/docs/learn/llm/tools) and [Thinking](/docs/learn/llm/thinking) for details.
</Note>

## Continuing Conversations

The `messages` property contains the complete conversation history, including all input messages and the assistant's response. Use `response.resume()` to continue the conversation—it appends your new content to this history and calls the LLM again:

```python
from mirascope import llm

model = llm.Model("openai/gpt-4o")
response = model.call("What's the capital of France?")
print(response.text())

# Continue the conversation with the same model and message history
followup = response.resume("What's the population of that city?")
print(followup.text())

# Chain multiple turns
another = followup.resume("What famous landmarks are there?")
print(another.text())

```

The `resume()` method preserves the response's model, parameters, tools, and format settings. You can override the model at call time using `with llm.model(...)`:

```python
with llm.model("anthropic/claude-sonnet-4-5"):
    followup = response.resume("Please answer this follow-up question...")
```

## Response Metadata

Every response includes metadata about how it was generated:

```python
from mirascope import llm

model = llm.model("openai/gpt-5-mini")
response = model.call("Hello!")

# Response metadata
print(f"Provider: {response.provider_id}")
print(f"Model: {response.model_id}")
print(f"Params: {response.params}")

# Access the raw provider response if needed
print(f"Raw response type: {type(response.raw)}")

```

| Property | Type | Description |
| --- | --- | --- |
| `provider_id` | `llm.ProviderId` | The provider (e.g., `"openai"`, `"anthropic"`) |
| `model_id` | `llm.ModelId` | The full model identifier |
| `params` | `llm.Params` | Parameters used for generation |
| `model` | `llm.Model` | A `Model` instance that can be used for continuing from this response. (Respects the model context manager.) |
| `usage` | `llm.Usage` | Token usage of this response. |
| `finish_reason` | `llm.FinishReason | None` | Information on why the response finished. |
| `raw` | `Any` | The unprocessed provider response |

The `raw` property gives you access to the original response object from the provider's SDK, in case you want to peek below Mirascope's abstraction layer to the provider's raw output.

### Token Usage

Access token consumption through `response.usage`:

```python
from mirascope import llm

model = llm.use_model("openai/gpt-4o")
response = model.call("Write a haiku about programming.")

if response.usage:
    print(f"Input tokens: {response.usage.input_tokens}")
    print(f"Output tokens: {response.usage.output_tokens}")
    print(f"Total tokens: {response.usage.total_tokens}")

```

<Note title="Usage Properties" collapsible={true} defaultOpen={false}>
| Property | Type | Description |
| --- | --- | --- |
| `input_tokens` | `int` | Tokens in the prompt (includes cached tokens) |
| `output_tokens` | `int` | Tokens generated (includes reasoning tokens) |
| `total_tokens` | `int` | Sum of input and output tokens |
| `cache_read_tokens` | `int` | Tokens read from cache |
| `cache_write_tokens` | `int` | Tokens written to cache |
| `reasoning_tokens` | `int` | Tokens used for thinking/reasoning |

Not all providers report all usage fields. Unsupported fields default to 0.
</Note>

### Finish Reason

The `finish_reason` property indicates why the LLM stopped generating. It's `None` when the response completes normally:

```python
from mirascope import llm

model = llm.model("anthropic/claude-sonnet-4-5", max_tokens=40)
response = model.call("Write a long story about a bear.")

# finish_reason is None when the response completes normally
# It's set when the response was cut off or stopped abnormally
if response.finish_reason == llm.FinishReason.MAX_TOKENS:
    print("Response was truncated due to token limit")
elif response.finish_reason is None:
    print("Response completed normally")

```

| Finish Reason | Description |
| --- | --- |
| `None` | Response completed normally |
| `MAX_TOKENS` | Hit the token limit before completing |
| `REFUSAL` | Model refused to respond |
| `CONTEXT_LENGTH_EXCEEDED` | Input exceeded context window |

## Response Variants

Mirascope has several response types for different calling patterns:

**Standard:** `Response`, `AsyncResponse`

**Streaming:** `StreamResponse`, `AsyncStreamResponse`

**Context-aware:** `ContextResponse`, `AsyncContextResponse`, `ContextStreamResponse`, `AsyncContextStreamResponse`

All variants share the same core properties. Retrieving data via `response.content`, `response.messages`, etc. works the same for all of them.

- **Streaming:** The response content gets populated by iterating through the stream. See [Streaming](/docs/learn/llm/streaming).
- **Async:** Methods like `resume()` are async. See [Async](/docs/learn/llm/async).
- **Context:** Methods like `resume()` require a context argument. See [Context](/docs/learn/llm/context).

Sometimes you'll want to write a function that can accept any response, whether it is a regular `Response`, a `StreamResponse`, an `AsyncResponse`, et cetera. If so, you can use the type alias `llm.AnyResponse`, which will have all of the core properties shared by every response class.

## Structured Output

When the response was generated with a `format` parameter, use `response.parse()` to extract structured data. See [Structured Output](/docs/learn/llm/structured-output) for the full guide on structured output.

## Next Steps

Now that you understand responses, explore:

- [Streaming](/docs/learn/llm/streaming) — Process responses as they're generated
- [Tools](/docs/learn/llm/tools) — Let LLMs call your functions
- [Structured Output](/docs/learn/llm/structured-output) — Extract structured data from responses
