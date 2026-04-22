# Calls

In the [Prompts](/docs/learn/llm/prompts) guide, we talked about how the `@llm.prompt` decorator streamlines writing LLM powered functions. 

The `@llm.call` decorator functions similarly to `@llm.prompt`, but bundles a specific model with your prompt function:

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Please recommend a book in {genre}."


response = recommend_book("fantasy")
print(response.text())

```

With `@llm.prompt`, you pass the model when calling. With `@llm.call`, the model is fixed at decoration time—you just call the function directly.

This means that `@llm.prompt` is a great fit for reusable library code, or when exploring different models, and `@llm.call` is great if you want to dial in with a specific chosen model.

## Prompt Function Return Types

Like `@llm.prompt`, you can return a string, a list of content parts, or a list of messages:

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return [
        llm.messages.system("Always recommend kid-friendly books."),
        llm.messages.user(f"Please recommend a book in {genre}."),
    ]


response = recommend_book("fantasy")
print(response.pretty())

```

## Runtime Model Overrides

Even though `@llm.call` bundles a model, you can override it at runtime using `with llm.model(...)`:

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Please recommend a book in {genre}."


# Override the model at runtime
with llm.model("anthropic/claude-sonnet-4-5", temperature=0.9):
    response = recommend_book("fantasy")
    print(response.pretty())

```

This is useful for A/B testing, switching providers in different environments, managing model fallbacks, or adjusting parameters dynamically.

<Note>
This override mechanism only works with `@llm.call`. The `@llm.prompt` decorator always uses the model you pass directly—it ignores context overrides.

`@llm.call` does this via `llm.use_model()`, which can be used to manually similar behavior. See [Models](/docs/learn/llm/models).
</Note>

## Decorator Arguments

The `@llm.call` decorator requires a model ID and accepts additional arguments:

| Argument | Description |
| --- | --- |
| `model_id` | Required. The model to use (e.g., `"openai/gpt-4o"`). |
| `temperature`, `max_tokens`, etc. | Model parameters. See [Models](/docs/learn/llm/models). |
| `tools` | List of tools the LLM can call. See [Tools](/docs/learn/llm/tools). |
| `format` | Response format for structured output. See [Structured Output](/docs/learn/llm/structured-output). |

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini", temperature=0.9)
def recommend_book(genre: str):
    return f"Please recommend a book in {genre}."


response = recommend_book("fantasy")
print(response.pretty())

```

## Accessing the Underlying Prompt

A `Call` is just a `Prompt` with a bundled model. You can access the underlying prompt and model via properties:

| Property | Description |
| --- | --- |
| `prompt` | The underlying `Prompt` |
| `default_model` | The model bundled at decoration time |
| `model` | The model that will be used (respects context overrides) |

Calling `my_call(...)` is equivalent to `my_call.prompt(my_call.model, ...)`.

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Please recommend a book in {genre}."


# A Call is just a Prompt + a bundled model
# recommend_book() is equivalent to:
# recommend_book.prompt(recommend_book.model, ...)

# Access Call properties
print(recommend_book.default_model)  # The bundled model
print(recommend_book.model)  # The model that will be used (respects context overrides)
print(recommend_book.prompt)  # The underlying Prompt

# Use the prompt directly with a different model
response = recommend_book.prompt("anthropic/claude-sonnet-4-5", "fantasy")
print(response.pretty())

```

## Next Steps

- [Thinking](/docs/learn/llm/thinking) — Use extended reasoning capabilities
- [Tools](/docs/learn/llm/tools) — Let LLMs call functions
- [Streaming](/docs/learn/llm/streaming) — Stream responses in real-time
