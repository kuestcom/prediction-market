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
    'group-basketball-10-link-cwbb-sports-cwbb-games-11',
    'link',
    'CWBB',
    '/sports/cwbb/games',
    '/images/sports/menu/full/sub-basketball-ncaab-cbb-games.svg',
    'group-basketball-10',
    'cwbb',
    'CWBB',
    '["CWBB"]'::jsonb,
    '[]'::jsonb,
    TRUE,
    FALSE,
    11,
    TRUE
  ),
  (
    'group-cricket-16-link-legends-sports-criclcl-games-15',
    'link',
    'Legends',
    '/sports/criclcl/games',
    '/images/sports/menu/full/top-cricket-crint-games.svg',
    'top-link-cricket-sports-crint-games-16',
    'criclcl',
    'Legends',
    '["Legends","Legends Cricket League"]'::jsonb,
    '["legends-cricket-league"]'::jsonb,
    TRUE,
    FALSE,
    15,
    TRUE
  ),
  (
    'group-cricket-16-link-national-t20-cup-sports-cricpakt20cup-games-16',
    'link',
    'National T20 Cup',
    '/sports/cricpakt20cup/games',
    '/images/sports/menu/full/top-cricket-crint-games.svg',
    'top-link-cricket-sports-crint-games-16',
    'cricpakt20cup',
    'National T20 Cup',
    '["National T20 Cup"]'::jsonb,
    '[]'::jsonb,
    TRUE,
    FALSE,
    16,
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
  games_enabled = TRUE,
  props_enabled = FALSE,
  updated_at = NOW()
WHERE id = 'top-link-chess-sports-chess-props-21';
