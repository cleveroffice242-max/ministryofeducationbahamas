-- Remove the unrelated "17 Year Old Boy Drowns" link that was attached to a story by mistake.
DELETE FROM "story_links" WHERE "url" LIKE 'https://wp.me/p9pfSX-DFV%';
--> statement-breakpoint
-- Remove the story that was saved with a copied story link as its headline and no outlet.
DELETE FROM "stories" WHERE "slug" = 'https-ministryofeducationbahamas-netlify-app-stories-html-br-mux0ylli';
--> statement-breakpoint
-- Remove the starter sample stories, whose source links point to outlet homepages instead of real articles.
-- Their related links are removed by cascade; Ministry Data records are kept and simply unlinked.
DELETE FROM "stories" WHERE "slug" IN (
  'breakfast-program-expansion',
  'gov-high-ac-repairs',
  'bgcse-bjc-stem-registration',
  'but-consultative-meeting',
  'bhsd-graduation-rate',
  'btvi-exuma-upgrades',
  'digital-literacy-curriculum'
);
