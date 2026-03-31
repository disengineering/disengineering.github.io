export default {
  tags: "archive",
  layout: "layouts/base.html",
  eleventyComputed: {
    permalink: (data) => `/archive/${data.page.fileSlug}/index.html`,
  },
};
