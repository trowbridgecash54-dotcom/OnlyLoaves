-- OnlyLoafs — starting rows
-- ---------------------------------------------------------------------
-- The initial Club plan from the brief, and the three sample loaves.
-- Everything here is editable from the owner dashboard afterwards.
-- No prices, ingredients or allergens are set: those are the owner's to
-- enter. Safe to run more than once.

insert into public.subscription_plans
  (slug, name, price_cents, loaves_per_period, closed_message)
values
  ('onlyloafs-club', 'OnlyLoafs Club', 5000, 3,
   'The Club isn''t taking new members right now. Send us a message and we''ll let you know when a spot opens.')
on conflict (slug) do nothing;

insert into public.products (slug, name, description, image_alt, featured, sort_order)
values
  ('classic-sourdough', 'Classic Sourdough', 'Our plain sourdough loaf.', 'Illustration of a round sourdough loaf', true, 10),
  ('rosemary-garlic', 'Rosemary & Garlic', 'Sourdough baked with rosemary and garlic.', 'Illustration of a sourdough loaf with rosemary', true, 20),
  ('cinnamon-sourdough', 'Cinnamon Sourdough', 'Sourdough baked with cinnamon.', 'Illustration of an oval cinnamon sourdough loaf', true, 30)
on conflict (slug) do nothing;
