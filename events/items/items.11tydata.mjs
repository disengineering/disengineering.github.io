export default {
  tags: "event",
  layout: "layouts/event.html",
  eleventyComputed: {
    permalink: (data) => `/events/${data.page.fileSlug}/index.html`,
  },
};
