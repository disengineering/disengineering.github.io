# AGENTS.md

We are using a static site generator called Eleventy. The docs are available at https://www.11ty.dev/.

## CSS selectors

Use **id** selectors when the markup should have **at most one** instance of that element on the page (or in a given scope where the id is unique). Use **classes** when you could **reasonably expect multiple** instances of the same pattern (repeated cards, list items, shared components, etc.).