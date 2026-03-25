export default {
  tags: "calendar",
  layout: "layouts/calendar-event.html",
  eleventyComputed: {
    permalink: (data) => `/calendar/${data.page.fileSlug}/index.html`,
  },
};
