export default {
  tags: "archive",
  layout: "layouts/base.html",
  colorScheme: "hyperblue",
  eleventyComputed: {
    permalink: (data) => `/archive/${data.page.fileSlug}/index.html`,
  },
};
