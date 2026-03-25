/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("css");

  eleventyConfig.ignores.add("AGENTS.md");
  eleventyConfig.ignores.add("BOOTSTRAP.md");
  eleventyConfig.ignores.add("SPEC/**");
}
