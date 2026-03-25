export default {
  tags: "calendar",
  layout: "layouts/calendar-event.njk",
  eleventyComputed: {
    permalink: (data) => `/calendar/${data.page.fileSlug}/index.html`,
  },
};
