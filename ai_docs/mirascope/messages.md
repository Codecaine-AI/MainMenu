# Messages

Messages are the fundamental building blocks of LLM interactions. You provide context to the LLM via messages, and it responds by generating messages of its own.

```python
from mirascope import llm

# Creating messages with shorthand functions
system_message = llm.messages.system("You are a helpful assistant.")
user_message = llm.messages.user("Hello, how are you?")

# Messages are used when calling LLMs
messages: list[llm.Message] = [system_message, user_message]

```

Each message has a `role` (system, user, or assistant) and `content`. Mirascope provides shorthand functions for creating messages: `llm.messages.system()`, `llm.messages.user()`, and `llm.messages.assistant()`.

## Message Roles

Every message is associated with one of three roles: "system", "user", or "assistant". These roles determine how the LLM interprets the message.

```python
from mirascope import llm

# System messages set context and instructions
system_message = llm.messages.system(
    "You are a friendly librarian who helps find books."
)

# User messages are input from the person using the LLM
user_message = llm.messages.user("Can you recommend a mystery novel?")

# Assistant messages represent LLM responses (usually from prior interactions)
assistant_message = llm.messages.assistant(
    "I'd recommend 'The Silent Patient' by Alex Michaelides!",
    model_id=None,
    provider_id=None,
)

```

### System Messages

System messages are instructions from the application developer and take priority over user messages. Use them to set the LLM's persona, provide specific directives, or include examples of intended behavior.

### User Messages

User messages represent input from the person interacting with the LLM—questions, requests, or any content the LLM should respond to.

### Assistant Messages

Assistant messages are responses from the LLM. You typically don't create these by hand; they come from LLM responses. However, you can construct them manually when building up a conversation history.

## Content Types

Messages can contain more than just text. Modern LLMs support multimodal content, allowing you to include images and audio.

### Text

Text is the most common content type. Plain strings are automatically wrapped as `llm.Text`:

```python
from mirascope import llm

# Plain strings are automatically converted to Text content
user_message = llm.messages.user("Hello!")

# You can also explicitly use llm.Text
user_message_explicit = llm.messages.user(llm.Text(text="Hello!"))

```

### Images

Images can be provided via URL (the provider downloads directly) or as base64-encoded data:

```python
from mirascope import llm

# Image from URL (provider downloads directly)
image_url = llm.Image.from_url("https://example.com/photo.jpg")

# Image from local file (base64 encoded)
image_file = llm.Image.from_file("photo.jpg")

# Image from raw bytes
image_bytes = llm.Image.from_bytes(b"...")

# Include image in a message
message = llm.messages.user(["What's in this image?", image_url])

```

### Audio

Audio content is useful for transcription or voice-based interactions:

```python
from mirascope import llm

# Audio from local file
audio = llm.Audio.from_file("recording.mp3")

# Audio from raw bytes
audio_bytes = llm.Audio.from_bytes(b"...")

# Include audio in a message
message = llm.messages.user(["Please transcribe this audio:", audio])

```

<Info title="Media Loading Methods" collapsible={true} defaultOpen={false}>
`Image` and `Audio` provide consistent class methods for loading:

| Method | Description |
| --- | --- |
| `from_url(url)` | Reference media by URL (provider downloads it). Image only. |
| `from_file(path)` | Load and encode media from a local file |
| `from_bytes(data)` | Create from raw bytes |
| `download(url)` | Download from URL and encode as base64 |

Note: `from_url` creates a URL reference without downloading. Use `download` if you need the data locally encoded.
</Info>

### Multimodal Messages

A single message can contain multiple content pieces of different types:

```python
from mirascope import llm

# Messages can contain multiple content pieces of different types
image = llm.Image.from_url("https://example.com/chart.png")

message = llm.messages.user(
    [
        "Here's the sales chart from Q3.",
        image,
        "Can you summarize the trends?",
    ]
)

```

## Content Type Reference

| Content Type | Description | Roles |
| --- | --- | --- |
| `Text` | Plain text content | System, User, Assistant |
| `Image` | Image data (base64 or URL) | User |
| `Audio` | Audio data (base64) | User |
| `ToolCall` | LLM's request to call a tool | Assistant |
| `ToolOutput` | Result from executing a tool | User |
| `Thought` | Model's reasoning process | Assistant |

<Note>
Provider support for content types varies. See the compatibility guide for details on which providers support which content types.
</Note>

## Next Steps

Now that you understand how to construct messages, see [Models](/docs/learn/llm/models) to learn how to use them to call an LLM.
