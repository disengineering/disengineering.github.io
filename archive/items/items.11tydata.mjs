export default {
  tags: "archive",
  layout: "layouts/base.html",
  colorScheme: "high-contrast",
  eleventyComputed: {
    permalink: (data) => `/archive/${data.page.fileSlug}/index.html`,
  },
};
