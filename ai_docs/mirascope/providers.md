# Providers

Providers are the shared interface that Mirascope uses to connect with LLM APIs. When you specify a model like `"openai/gpt-5"`, Mirascope uses the provider registry to determine which provider handles the request, then translates your call into the appropriate API format.

## How Provider Routing Works

Mirascope uses a prefix-matching system to route model IDs to providers. When you call a model like `"anthropic/claude-sonnet-4-5"`, Mirascope:

1. Looks for registered scopes that match the model ID prefix
2. Selects the longest matching scope (most specific wins)
3. Uses the associated provider to make the API call

For common providers, this happens automatically—you don't need to register anything.

## Built-in Providers

Mirascope includes several built-in providers:

| Provider | Class | Default Scope | Environment Variable |
| --- | --- | --- | --- |
| Anthropic | `llm.providers.AnthropicProvider` | `anthropic/` | `ANTHROPIC_API_KEY` |
| Google | `llm.providers.GoogleProvider` | `google/` | `GOOGLE_API_KEY` |
| Mirascope | `llm.providers.MirascopeProvider` | `anthropic/`, `google/`, `openai/` | `MIRASCOPE_API_KEY` |
| MLX | `llm.providers.MLXProvider` | `mlx-community/` | — |
| Ollama | `llm.providers.OllamaProvider` | `ollama/` | `OLLAMA_BASE_URL` |
| OpenAI | `llm.providers.OpenAIProvider` | `openai/` | `OPENAI_API_KEY` |
| Together | `llm.providers.TogetherProvider` | `together/` | `TOGETHER_API_KEY` |

<Note title="Mirascope Provider">
The Mirascope provider uses Mirascope Router to route to multiple different providers using a single API key. When active, it has `anthropic/`, `google/` and `openai/` as default scopes, as it can route for any of these providers.
</Note>

<Note title="OpenAI API Modes" collapsible={true} defaultOpen={false}>
OpenAI offers two API modes: the [Responses API](https://platform.openai.com/docs/api-reference/responses) and the [Completions API](https://platform.openai.com/docs/api-reference/chat). By default, `OpenAIProvider` automatically selects the appropriate API based on the features you use.

If you need to force a specific API mode, Mirascope provides dedicated provider classes:

| Class | Description |
| --- | --- |
| `llm.providers.OpenAICompletionsProvider` | Forces the Chat Completions API |
| `llm.providers.OpenAIResponsesProvider` | Forces the Responses API |

You can register these using the provider IDs `"openai:completions"` or `"openai:responses"`, or by instantiating the classes directly.
</Note>

With the appropriate environment variable set, you can use any of these providers immediately—no registration required.

## Registering Providers

Use `llm.register_provider()` to customize how providers are configured or to route model IDs to different providers.

### Custom API Keys and Base URLs

Override the default API key or endpoint for a provider:

```python
from mirascope import llm

# Use a different API key for OpenAI
llm.register_provider("openai", api_key="sk-my-other-key")

# Or point to a different endpoint (e.g., a proxy)
llm.register_provider("openai", base_url="https://my-proxy.example.com/v1")

# Now all openai/ calls use the registered configuration
response = llm.use_model("openai/gpt-4o-mini").call("Say hello")
print(response.text())

```

<Note>
When you don't specify a `scope`, the provider registers with its default scope (shown in the table above). So `llm.register_provider("openai", api_key="...")` registers for all `openai/` models.
</Note>

### Routing Models to Different Providers

Many LLM services offer OpenAI-compatible APIs. You can route models through Mirascope's OpenAI provider by registering it with a custom scope and base URL.

For example, xAI provides an [OpenAI-compatible endpoint](https://docs.x.ai/docs/api-reference#openai-compatible-api) for Grok models. You can route Grok models through the OpenAI provider like this:

```python
import os

from mirascope import llm

# Route grok/ models through the OpenAI provider
# using xAI's OpenAI-compatible endpoint
llm.register_provider(
    "openai",
    scope="grok/",
    base_url="https://api.x.ai/v1",
    api_key=os.environ["XAI_API_KEY"],
)


@llm.call("grok/grok-4-latest")
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book("fantasy")
print(response.text())
print(response.provider_id)  # "openai" - routed through OpenAI provider

```

This pattern works with any OpenAI-compatible service—Together AI, Groq, Anthropic, and many others provide similar endpoints. (In fact, the Together AI provider itself is a pre-configured wrapper around calling the OpenAI endpoint.)

### Scope Matching

Scopes use prefix matching, and the longest match wins. This lets you set general defaults while overriding specific models:

```python
from mirascope import llm

# Register a general provider for all anthropic/ models
llm.register_provider("anthropic", api_key="default-key")

# Register a specific provider for one model (longest match wins)
llm.register_provider(
    "anthropic", scope="anthropic/claude-sonnet-4-5", api_key="sonnet-key"
)

# This uses "default-key"
haiku = llm.use_model("anthropic/claude-haiku-4-5")

# This uses "sonnet-key" (more specific scope wins)
sonnet = llm.use_model("anthropic/claude-sonnet-4-5")

```

## Provider Registration Reference

The `llm.register_provider()` function accepts these arguments:

| Argument | Type | Description |
| --- | --- | --- |
| `provider` | `str \| Provider` | Provider ID (e.g., `"openai"`) or a provider instance |
| `scope` | `str \| list[str] \| None` | Model ID prefix(es) to match. If `None`, uses the provider's default scope |
| `api_key` | `str \| None` | API key for authentication (only when `provider` is a string) |
| `base_url` | `str \| None` | Base URL for the API (only when `provider` is a string) |

### Provider IDs

These provider IDs are available:

| ID | Description |
| --- | --- |
| `"anthropic"` | Anthropic API |
| `"google"` | Google Generative AI API |
| `"mirascope"` | Use the Mirascope Router to access many providers seamlessly |
| `"mlx"` | MLX models on Apple Silicon |
| `"ollama"` | Ollama local server |
| `"openai:completions"` | Force OpenAI Completions API |
| `"openai:responses"` | Force OpenAI Responses API |
| `"openai"` | OpenAI API (auto-selects Responses or Completions API based on features used) |
| `"together"` | Together AI API |

## Resetting the Registry

Use `llm.reset_provider_registry()` to clear all registered providers and return to the default auto-registration behavior. This is primarily useful in tests:

```python
import llm

# Custom registrations...
llm.register_provider("openai", scope="custom/", base_url="...")

# Later, reset to defaults
llm.reset_provider_registry()
```

## Next Steps

- [Models](/docs/learn/llm/models) — Working with models directly
- [Errors](/docs/learn/llm/errors) — Unified error handling across providers
- [Local Models](/docs/learn/llm/local-models) — Using Ollama, MLX, and other local models
