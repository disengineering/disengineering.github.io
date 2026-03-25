export default {
  tags: "calendar",
  layout: "layouts/event.html",
  eleventyComputed: {
    permalink: (data) => `/events/${data.page.fileSlug}/index.html`,
  },
};
