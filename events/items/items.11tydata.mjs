export default {
  tags: "event",
  layout: "layouts/event.html",
  colorScheme: "bsod",
  eleventyComputed: {
    permalink: (data) => `/events/${data.page.fileSlug}/index.html`,
    /** Same shape as collection items so `event-card` can be shared on detail pages. */
    eventForCard: (data) => ({
      data,
      url: data.page.url,
    }),
  },
};
