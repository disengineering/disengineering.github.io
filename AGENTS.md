# AGENTS.md

## Framework

We are using a static site generator called Eleventy. The docs are available at https://www.11ty.dev/.

## CSS selectors

Use `id` selectors when the markup should have at most one instance of that element on the page (or in a given scope where the id is unique). Use `class` when you could reasonably expect multiple instances of the same pattern (repeated cards, list items, shared components, etc.).

Remove superfluous `class` and `id` attributes from HTML when nothing references them: no matching selectors in site CSS, no use in JavaScript, no same-site `href="#…"` fragment links, and no `aria-labelledby` / `aria-controls` / `for` (etc.) pairing. Keeping only referenced hooks keeps templates easier to maintain.

## Images and `eleventy:ignore`

The site uses [@11ty/eleventy-img](https://www.11ty.dev/docs/plugins/image/) with the HTML transform: raster images in `<img src="…">` are built to WebP by default.

Add `eleventy:ignore` on the `<img>` when the asset should stay as the original file (no WebP), for example:

- Header, footer, and navigation graphics (logos, banners, hover swaps).
- Illustrations, UI art, typography graphics, and brand marks where you want lossless or pixel-stable output.
- Pairs of images used together (e.g. base + hover) if you need identical encoding between them.

Omit `eleventy:ignore` for photographs and similar content where WebP compression is desired. See the [Image plugin docs](https://www.11ty.dev/docs/plugins/image/) for `eleventy:ignore` and other attributes.

## Vendored third-party scripts

Files checked in under paths like `js/vendor/` are **upstream copies** (or pinned releases) of external libraries. **Do not modify vendored files** for site-specific behavior.