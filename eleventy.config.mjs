import fs from "node:fs";
import path from "node:path";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function (eleventyConfig) {
  eleventyConfig.on("eleventy.after", ({ directories }) => {
    fs.writeFileSync(path.join(directories.output, ".nojekyll"), "");
  });
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp"],
    widths: ["auto"],
    htmlOptions: {
      imgAttributes: {
        loading: "lazy",
      },
    },
  });

  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");

  eleventyConfig.ignores.add("AGENTS.md");
  eleventyConfig.ignores.add("BOOTSTRAP.md");
  eleventyConfig.ignores.add("docs/**");

  function ordinalDay(n) {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return `${n}st`;
    if (j === 2 && k !== 12) return `${n}nd`;
    if (j === 3 && k !== 13) return `${n}rd`;
    return `${n}th`;
  }

  eleventyConfig.addFilter("formatEventDateLong", (iso, timezone = "America/New_York") => {
    if (!iso) return "";
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    }).format(new Date(iso));
  });

  eleventyConfig.addFilter("formatEventTimeRange", (startIso, endIso, timezone = "America/New_York") => {
    if (!startIso) return "";
    const d1 = new Date(startIso);
    const d2 = endIso ? new Date(endIso) : d1;
    const tf = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    });
    const tzf = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const tz =
      tzf
        .formatToParts(d1)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    if (d1.getTime() === d2.getTime()) {
      return `${tf.format(d1)} (${tz})`;
    }
    return `${tf.format(d1)} – ${tf.format(d2)} (${tz})`;
  });

  eleventyConfig.addFilter("eventDateParts", (iso, timezone = "America/New_York") => {
    if (!iso) return { weekday: "", month: "", dayOrdinal: "" };
    const d = new Date(iso);
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone }).format(d);
    const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: timezone }).format(d);
    const dayNum = parseInt(
      new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone }).format(d),
      10,
    );
    return { weekday, month, dayOrdinal: ordinalDay(dayNum) };
  });

  function eventCollections(collectionApi) {
    const now = new Date();
    const items = collectionApi.getFilteredByTag("event");
    const upcoming = items
      .filter((item) => new Date(item.data.date) >= now)
      .sort((a, b) => new Date(a.data.date) - new Date(b.data.date));
    const past = items
      .filter((item) => new Date(item.data.date) < now)
      .sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
    return { upcoming, past };
  }

  eleventyConfig.addCollection("eventsUpcoming", (collectionApi) => eventCollections(collectionApi).upcoming);

  eleventyConfig.addCollection("eventsPast", (collectionApi) => eventCollections(collectionApi).past);

  // Homepage sidebar: keep four cards visible, filling leftover slots with past events.
  const HOMEPAGE_SIDEBAR_EVENT_COUNT = 4;

  eleventyConfig.addCollection("eventsSidebarUpcoming", (collectionApi) => {
    const { upcoming } = eventCollections(collectionApi);
    return upcoming.slice(0, HOMEPAGE_SIDEBAR_EVENT_COUNT);
  });

  eleventyConfig.addCollection("eventsSidebarPast", (collectionApi) => {
    const { upcoming, past } = eventCollections(collectionApi);
    const pastSlots = Math.max(0, HOMEPAGE_SIDEBAR_EVENT_COUNT - Math.min(upcoming.length, HOMEPAGE_SIDEBAR_EVENT_COUNT));
    return past.slice(0, pastSlots);
  });

  eleventyConfig.addCollection("archiveProjects", (collectionApi) =>
    collectionApi.getFilteredByTag("archive").sort((a, b) => {
      const tA = a.data.title ?? "";
      const tB = b.data.title ?? "";
      return tA.localeCompare(tB, "en");
    }),
  );
}
