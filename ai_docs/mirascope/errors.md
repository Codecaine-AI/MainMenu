# Errors

Mirascope provides a unified exception hierarchy that normalizes errors across all LLM providers. Instead of catching provider-specific exceptions, you can handle errors consistently regardless of which provider you're using.

```python
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


try:
    response = recommend_book("fantasy")
    print(response.pretty())
except llm.AuthenticationError as e:
    print(f"Invalid API key: {e}")
except llm.RateLimitError as e:
    print(f"Rate limit exceeded: {e}")
except llm.Error as e:
    print(f"LLM error: {e}")

```

## Error Reference

All exceptions inherit from `llm.Error`. Indentation shows the hierarchy:

| Exception | Description |
| --- | --- |
| `llm.Error` | Base exception for all Mirascope LLM errors |
| ↳ `llm.ProviderError` | Base class for errors originating from provider SDKs (has `provider`, `original_exception`) |
| &emsp;↳ `llm.APIError` | Base class for HTTP-level API errors (has `status_code` attribute) |
| &emsp;&emsp;↳ `llm.AuthenticationError` | Invalid or missing API key (401) |
| &emsp;&emsp;↳ `llm.PermissionError` | Valid key but insufficient permissions (403) |
| &emsp;&emsp;↳ `llm.BadRequestError` | Malformed request or invalid parameters (400, 422) |
| &emsp;&emsp;↳ `llm.NotFoundError` | Model or resource doesn't exist (404) |
| &emsp;&emsp;↳ `llm.RateLimitError` | Too many requests (429) |
| &emsp;&emsp;↳ `llm.ServerError` | Provider server issues (500+) |
| &emsp;↳ `llm.ConnectionError` | Network connectivity issues, DNS failures |
| &emsp;↳ `llm.TimeoutError` | Request exceeded the allowed time limit |
| &emsp;↳ `llm.ResponseValidationError` | API response failed validation |
| ↳ `llm.ToolError` | Base class for tool-related errors |
| &emsp;↳ `llm.ToolExecutionError` | Tool threw an exception during execution (has `tool_exception`) |
| &emsp;↳ `llm.ToolNotFoundError` | Tool call doesn't match any registered tool (has `tool_name`) |
| ↳ `llm.ParseError` | Failed to parse structured response (has `original_exception`) |
| ↳ `llm.FeatureNotSupportedError` | Feature not supported by provider/model (has `provider_id`, `model_id`, `feature`) |
| ↳ `llm.NoRegisteredProviderError` | Model ID has no registered provider |
| ↳ `llm.MissingAPIKeyError` | Required API key environment variable not set (has `provider_id`, `env_var`) |
| ↳ `llm.RetriesExhausted` | All retry attempts exhausted when using `@llm.retry` or `llm.retry_model` (has `failures`) |
| ↳ `llm.StreamRestarted` | Stream restarted due to a retryable error when using `@llm.retry` or `llm.retry_model` (has `failure`) |

## Next Steps

- [Reliability](/docs/learn/llm/reliability) — Retry strategies and fallback patterns
- [Providers](/docs/learn/llm/providers) — Provider-specific capabilities and limitations
