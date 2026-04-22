# Structured Output

By default, LLMs output free-form text. Mirascope lets you constrain responses to structured data that matches a predefined type. Pass the type as the `format` parameter, then call `response.parse()` to get the result:

```python
from mirascope import llm


@llm.call("openai/gpt-4o-mini", format=dict[str, str])
def recommend_books(genres: list[str]):
    return f"Recommend a book for each of the following genres: {', '.join(genres)}"


recommendations = recommend_books(["scifi", "fantasy", "romantasy"]).parse()
print(recommendations)
# {'scifi': 'Dune', 'fantasy': 'The Name of the Wind', 'romantasy': 'A Court of Thorns and Roses'}

```

Supported types include `str`, `int`, `float`, `bool`, `list`, `dict`, `Enum`, `Literal`, and Pydantic `BaseModel` classes.

## Pydantic Models

For complex structures, define a Pydantic `BaseModel`:

```python
from pydantic import BaseModel

from mirascope import llm


class Book(BaseModel):
    title: str
    author: str


@llm.call("openai/gpt-4o-mini", format=Book)
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


book = recommend_book("fantasy").parse()
print(f"{book.title} by {book.author}")
# The Name of the Wind by Patrick Rothfuss

```

See the [Pydantic documentation](https://docs.pydantic.dev/latest/) for details on defining models, field types, and validators.

## Generic Collections

Generic collections like `list[Book]` and `dict[str, Book]` work with BaseModel classes:

```python
from pydantic import BaseModel

from mirascope import llm


class Book(BaseModel):
    title: str
    author: str


@llm.call("openai/gpt-4o-mini", format=list[Book])
def recommend_books(genre: str, count: int):
    return f"Recommend {count} {genre} books."


books = recommend_books("fantasy", 3).parse()
for book in books:
    print(f"{book.title} by {book.author}")
# The Name of the Wind by Patrick Rothfuss
# Mistborn: The Final Empire by Brandon Sanderson
# The Way of Kings by Brandon Sanderson

```

## Parse Errors

When the LLM returns invalid data, `parse()` raises `llm.ParseError`:

```python
try:
    book = response.parse()
except llm.ParseError as e:
    print(f"Invalid response: {e}")
```

### Manual Retry

To retry after a parse error, use `response.resume()` with the error's retry message:

```python
try:
    book = response.parse()
except llm.ParseError as e:
    response = response.resume(e.retry_message())
    book = response.parse()  # Try again
```

### Automatic Retry with `validate()`

For convenience, use `response.validate()` to automatically retry when parsing fails. This is useful for getting reliable structured outputs, especially when you have custom Pydantic validators with constraints the LLM doesn't know about:

```python
from pydantic import BaseModel, field_validator

from mirascope import llm


class BookRecommendation(BaseModel):
    title: str
    year: int

    @field_validator("year")
    @classmethod
    def must_be_recent(cls, v: int) -> int:
        if v < 2020:
            raise ValueError(f"Must be published after 2020, got {v}")
        return v


@llm.call("openai/gpt-4o-mini", format=BookRecommendation)
def recommend_book():
    return "Recommend a science fiction book."


response = recommend_book()
book, response = response.validate()  # Retries once if validation fails
print(f"{book.title} ({book.year})")

```

The `validate()` method returns a tuple of `(parsed_value, response)` — if retries were needed, `response` is the final successful response. You can customize the number of retries with `max_retries` (default is 1):

```python
book, response = response.validate(max_retries=3)
```

<Note>
When using async, `response.validate()` is async — see [Async](/docs/learn/llm/async). For context responses, pass the `ctx` argument — see [Context](/docs/learn/llm/context).
</Note>

<Note>
For API-level retries (rate limits, timeouts, server errors), use `@llm.retry`. See [Reliability](/docs/learn/llm/reliability).
</Note>

## Formatting Modes

Mirascope supports multiple strategies for extracting structured output. By default, it chooses strict mode if supported by your provider, or tool mode otherwise. Use `llm.format()` to force a specific mode:

```python
from pydantic import BaseModel

from mirascope import llm


class Book(BaseModel):
    title: str
    author: str


@llm.call("openai/gpt-5-mini", format=llm.format(Book, mode="strict"))
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book("fantasy")
book = response.parse()
print(f"{book.title} by {book.author}")

```

### Mode Reference

| Mode | Description |
| --- | --- |
| `"strict"` | Provider guarantees JSON matches schema. Most reliable, but not all providers support it. |
| `"tool"` | Uses a hidden tool call to extract structured data. Works with all providers that support tools. |
| `"json"` | Requests JSON output and modifies prompt with schema. No strict guarantees. |
| `"parser"` | Custom parsing with `@llm.output_parser`. For non-JSON formats like XML. |

<Note title="Mode Compatibility" collapsible={true} defaultOpen={false}>
- `"strict"` may raise `llm.FormattingModeNotSupportedError` if the provider doesn't support it
- `"strict"` + tools may raise `llm.FeatureNotSupportedError` for certain models (e.g. older Gemini models)
- `"tool"` mode works wherever tools are supported, by adding a hidden tool named `__mirascope_formatted_output_tool__`. Mirascope hides the tool and automatically converts the tool call into text output.
</Note>

## Structured Output with Tools

Structured output works alongside tool calling. The LLM can use tools, then return structured data as its final response:

```python
from pydantic import BaseModel

from mirascope import llm

BOOK_DB = {
    "978-0-7653-1178-8": "Title: Mistborn, Author: Brandon Sanderson, Pages: 544"
}


class BookSummary(BaseModel):
    title: str
    author: str
    pages: int


@llm.tool
def get_book_info(isbn: str) -> str:
    """Look up book information by ISBN."""
    return BOOK_DB.get(isbn, "Book not found")


@llm.call("openai/gpt-5-mini", tools=[get_book_info], format=BookSummary)
def analyze_book(isbn: str):
    return f"Look up the book with ISBN {isbn} and summarize it."


response = analyze_book("978-0-7653-1178-8")

while response.tool_calls:
    tool_outputs = response.execute_tools()
    response = response.resume(tool_outputs)

summary: BookSummary = response.parse()
print(f"{summary.title} by {summary.author} ({summary.pages} pages)")

```

<Note>
In `"tool"` mode, Mirascope distinguishes between your tools and the hidden format tool automatically.
</Note>

## Advanced Model Features

The class name, docstring, and field descriptions all become part of the schema sent to the LLM. Use these to guide the model's output:

```python
from pydantic import BaseModel, Field

from mirascope import llm


class Author(BaseModel):
    first_name: str
    last_name: str


class Book(BaseModel):
    """A book recommendation. The title should be in ALL CAPS."""

    title: str
    author: Author
    rating: int = Field(description="Rating from 1-10")


@llm.call("openai/gpt-5-mini", format=Book)
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book("fantasy")
book = response.parse()
print(f"{book.title} by {book.author.first_name} {book.author.last_name}")
# THE NAME OF THE WIND by Patrick Rothfuss
print(f"Rating: {book.rating}/10")
# Rating: 9/10

```

Models can also be nested, as shown with the `Author` class above.

## Custom Formatting Instructions

Add a `formatting_instructions` classmethod to your format class to control how Mirascope prompts the LLM:

```python
from pydantic import BaseModel

from mirascope import llm


class Book(BaseModel):
    title: str
    author: str
    rating: int

    @classmethod
    def formatting_instructions(cls) -> str:
        return (
            "Output the book as JSON. "
            "The title should be in ALL CAPS. "
            "The rating should always be the number 7."
        )


@llm.call("openai/gpt-5-mini", format=Book)
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book("fantasy")
book = response.parse()
print(f"{book.title} by {book.author}, rating: {book.rating}")
# THE NAME OF THE WIND by Patrick Rothfuss, rating: 7

```

<Note title="When Instructions Are Used" collapsible={true} defaultOpen={false}>
Mirascope auto-generates formatting instructions for `"tool"` and `"json"` modes. Custom instructions override this behavior. In `"strict"` mode, instructions are typically not needed since the provider enforces the schema.
</Note>

## Custom Output Parsers

For non-JSON formats (XML, CSV, custom text), use `@llm.output_parser` to define custom parsing logic:

```python
import re
import xml.etree.ElementTree as ET

from pydantic import BaseModel

from mirascope import llm


class Book(BaseModel):
    title: str
    rating: int


@llm.output_parser(
    formatting_instructions=(
        "Return the book as XML: <book><title>Book Title</title><rating>7</rating></book>"
    )
)
def parse_book_xml(response: llm.AnyResponse) -> Book:
    text = "".join(t.text for t in response.texts)
    # Strip markdown code fences if present
    xml_match = re.search(r"<book>.*</book>", text, re.DOTALL)
    xml_text = xml_match.group(0) if xml_match else text
    root = ET.fromstring(xml_text)
    return Book(
        title=root.findtext("title") or "",
        rating=int(root.findtext("rating") or "0"),
    )


@llm.call("openai/gpt-5-mini", format=parse_book_xml)
def recommend_book(genre: str):
    return f"Recommend a {genre} book."


response = recommend_book("fantasy")
book: Book = response.parse()
print(f"{book.title}, rating: {book.rating}")

```

The parser receives the full response and can extract data however you need. The `formatting_instructions` are added to the system prompt to guide the LLM.


## Next Steps

- [Streaming](/docs/learn/llm/streaming) — Stream responses with structured output
- [Reliability](/docs/learn/llm/reliability) — Retry on validation errors
- [Tools](/docs/learn/llm/tools) — Combine tools with structured output
