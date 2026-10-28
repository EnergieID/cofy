import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

const link = z.object({ label: z.string(), href: z.string() });
const point = z.object({ title: z.string(), text: z.string() });

export const collections = {
  // The documentation, rendered by Starlight under /docs/.
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),

  // The home page, one file per language: its sections in the frontmatter, and the closing
  // "who's behind Cofy" story as the body.
  home: defineCollection({
    loader: glob({ pattern: "*.md", base: "./src/content/home" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      hero: z.object({ title: z.string(), tagline: z.string(), primary: link, secondary: link }),
      features: z.object({
        title: z.string(),
        // Each feature sits beside a mockup of it; `visual` picks which.
        items: z.array(
          point.extend({
            visual: z.enum(["billing", "directives", "api"]),
            link: link.optional(),
          }),
        ),
        directive: z.object({ label: z.string(), caption: z.string() }),
      }),
      customers: z.object({
        title: z.string(),
        items: z.array(
          z.object({ name: z.string(), text: z.string(), href: z.string(), country: z.enum(["be", "fr", "nl"]) }),
        ),
      }),
      independence: z.object({
        title: z.string(),
        intro: z.string(),
        pillars: z.array(z.object({ icon: z.string(), title: z.string(), points: z.array(z.string()) })),
      }),
      ways: z.object({
        title: z.string(),
        intro: z.string(),
        items: z.array(point.extend({ icon: z.string(), action: link })),
      }),
      cta: z.object({ title: z.string(), action: link }),
    }),
  }),

  // The other marketing pages, one Markdown file per page and language, e.g. en/vision.mdx.
  pages: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }),
    schema: z.object({ title: z.string(), description: z.string() }),
  }),
};
