INSERT INTO sports_menu_items (
  id,
  item_type,
  label,
  href,
  icon_url,
  parent_id,
  menu_slug,
  h1_title,
  mapped_tags,
  url_aliases,
  games_enabled,
  props_enabled,
  sort_order,
  enabled
)
VALUES
  (
    'group-esports-dota-2-props',
    'link',
    'Props',
    '/esports/dota-2/props',
    '/images/sports/menu/full/sub-esports-dota-2-dota-2-games.svg',
    'group-esports-dota-2',
    NULL,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    FALSE,
    FALSE,
    1,
    TRUE
  ),
  (
    'group-esports-mobile-legends-bang-bang-props',
    'link',
    'Props',
    '/esports/mobile-legends-bang-bang/props',
    '/images/sports/menu/full/sub-esports-mobile-legends-bang-bang-mobile-legends-bang-bang-games.svg',
    'group-esports-mobile-legends-bang-bang',
    NULL,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    FALSE,
    FALSE,
    1,
    TRUE
  ),
  (
    'group-esports-overwatch-props',
    'link',
    'Props',
    '/esports/overwatch/props',
    '/images/sports/menu/full/sub-esports-overwatch-overwatch-games.svg',
    'group-esports-overwatch',
    NULL,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    FALSE,
    FALSE,
    1,
    TRUE
  ),
  (
    'group-esports-rainbow-six-siege-props',
    'link',
    'Props',
    '/esports/rainbow-six-siege/props',
    '/images/sports/menu/full/sub-esports-rainbow-six-siege-rainbow-six-siege-games.svg',
    'group-esports-rainbow-six-siege',
    NULL,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    FALSE,
    FALSE,
    1,
    TRUE
  ),
  (
    'group-esports-honor-of-kings-props',
    'link',
    'Props',
    '/esports/honor-of-kings/props',
    '/images/sports/menu/full/sub-esports-honor-of-kings-honor-of-kings-games.svg',
    'group-esports-honor-of-kings',
    NULL,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    FALSE,
    FALSE,
    1,
    TRUE
  )
ON CONFLICT (id) DO UPDATE
SET
  item_type = EXCLUDED.item_type,
  label = EXCLUDED.label,
  href = EXCLUDED.href,
  icon_url = EXCLUDED.icon_url,
  parent_id = EXCLUDED.parent_id,
  menu_slug = EXCLUDED.menu_slug,
  h1_title = EXCLUDED.h1_title,
  mapped_tags = EXCLUDED.mapped_tags,
  url_aliases = EXCLUDED.url_aliases,
  games_enabled = EXCLUDED.games_enabled,
  props_enabled = EXCLUDED.props_enabled,
  sort_order = EXCLUDED.sort_order,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

UPDATE sports_menu_items
SET
  sort_order = CASE id
    WHEN 'group-esports-dota-2-european-pro-league' THEN 2
    WHEN 'group-esports-dota-2-the-international' THEN 3
    WHEN 'group-esports-mobile-legends-bang-bang-betboom-rise-of-legends' THEN 2
    WHEN 'group-esports-overwatch-ocs' THEN 2
    WHEN 'group-esports-rainbow-six-siege-asia-pacific-league' THEN 2
    WHEN 'group-esports-rainbow-six-siege-cn-league' THEN 3
    WHEN 'group-esports-rainbow-six-siege-north-america-league' THEN 4
    WHEN 'group-esports-rainbow-six-siege-south-america-league' THEN 5
    WHEN 'group-esports-honor-of-kings-arena-of-valor-premier-league' THEN 2
    WHEN 'group-esports-honor-of-kings-king-pro-league' THEN 3
    ELSE sort_order
  END,
  updated_at = NOW()
WHERE id IN (
  'group-esports-dota-2-european-pro-league',
  'group-esports-dota-2-the-international',
  'group-esports-mobile-legends-bang-bang-betboom-rise-of-legends',
  'group-esports-overwatch-ocs',
  'group-esports-rainbow-six-siege-asia-pacific-league',
  'group-esports-rainbow-six-siege-cn-league',
  'group-esports-rainbow-six-siege-north-america-league',
  'group-esports-rainbow-six-siege-south-america-league',
  'group-esports-honor-of-kings-arena-of-valor-premier-league',
  'group-esports-honor-of-kings-king-pro-league'
);
