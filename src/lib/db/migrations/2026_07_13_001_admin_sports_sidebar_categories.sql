ALTER TABLE sports_menu_items
  ADD COLUMN IF NOT EXISTS sidebar_category BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sidebar_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sidebar_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sidebar_sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sports_menu_items_sidebar_categories
  ON sports_menu_items (sidebar_category, sidebar_enabled, sidebar_featured, sidebar_sort_order);

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
  ('group-tennis-12-link-wimbledon-sports-wimbledon-games', 'link', 'Wimbledon', '/sports/wimbledon/games', '/images/sports/menu/wimbledon.svg', 'group-tennis-12', 'wimbledon', 'Wimbledon', '["Wimbledon"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 1, TRUE),
  ('group-soccer-11-link-australia-cup-sports-auc-games', 'link', 'Australia Cup', '/sports/auc/games', '/images/sports/menu/full/group-soccer.svg', 'group-soccer-11', 'auc', 'Australia Cup', '["Australia Cup"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 10, TRUE),
  ('group-soccer-11-link-nwsl-sports-nwsl-games', 'link', 'NWSL', '/sports/nwsl/games', '/images/sports/menu/full/group-soccer.svg', 'group-soccer-11', 'nwsl', 'NWSL', '["NWSL"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 16, TRUE),
  ('group-soccer-11-link-guatemala-sports-gtm-games', 'link', 'Liga Nacional Guatemala', '/sports/gtm/games', '/images/sports/menu/full/group-soccer.svg', 'group-soccer-11', 'gtm', 'Liga Nacional Guatemala', '["Liga Nacional Guatemala"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 22, TRUE),
  ('group-soccer-11-link-nike-liga-sports-svk1-games', 'link', 'Nike Liga', '/sports/svk1/games', '/images/sports/menu/full/group-soccer.svg', 'group-soccer-11', 'svk1', 'Nike Liga', '["Nike Liga"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 29, TRUE),
  ('group-soccer-11-link-ofb-cup-sports-atc-games', 'link', 'ÖFB Cup', '/sports/atc/games', '/images/sports/menu/full/group-soccer.svg', 'group-soccer-11', 'atc', 'ÖFB Cup', '["ÖFB Cup"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 30, TRUE),
  ('group-cricket-16-link-shpageeza-sports-cricshpageeza-games', 'link', 'Shpageeza', '/sports/cricshpageeza/games', '/images/sports/menu/cricket.svg', 'top-link-cricket-sports-crint-games-16', 'cricshpageeza', 'Shpageeza', '["Shpageeza"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 2, TRUE),
  ('group-cricket-16-link-jcl-t20-sports-cricjcl-games', 'link', 'JCL T20', '/sports/cricjcl/games', '/images/sports/menu/cricket.svg', 'top-link-cricket-sports-crint-games-16', 'cricjcl', 'JCL T20', '["JCL T20"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 3, TRUE),
  ('group-cricket-16-link-maharaja-t20-sports-cricmaharaja-games', 'link', 'Maharaja T20', '/sports/cricmaharaja/games', '/images/sports/menu/cricket.svg', 'top-link-cricket-sports-crint-games-16', 'cricmaharaja', 'Maharaja T20', '["Maharaja T20"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 6, TRUE),
  ('group-cricket-16-link-telangana-t20-sports-crictelangana-games', 'link', 'Telangana T20', '/sports/crictelangana/games', '/images/sports/menu/cricket.svg', 'top-link-cricket-sports-crint-games-16', 'crictelangana', 'Telangana T20', '["Telangana T20"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 7, TRUE),
  ('group-basketball-10-link-nba-summer-league-sports-nbasl-games', 'link', 'NBA Summer League', '/sports/nbasl/games', '/images/sports/menu/full/group-basketball.svg', 'group-basketball-10', 'nbasl', 'NBA Summer League', '["NBA Summer League"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 2, TRUE),
  ('group-baseball-14-link-cpbl-sports-cpbl-games', 'link', 'CPBL', '/sports/cpbl/games', '/images/sports/menu/full/group-baseball.svg', 'group-baseball-14', 'cpbl', 'CPBL', '["CPBL"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 3, TRUE),
  ('group-baseball-14-link-npb-sports-npb-games', 'link', 'NPB', '/sports/npb/games', '/images/sports/menu/full/group-baseball.svg', 'group-baseball-14', 'npb', 'NPB', '["NPB"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 4, TRUE),
  ('sports-top-link-volleyball', 'link', 'Volleyball', '/sports/vbvnl/games', '/images/sports/menu/volleyball.svg', NULL, 'vbvnl', 'Volleyball', '["Volleyball","VNL"]'::jsonb, '[]'::jsonb, TRUE, FALSE, 14, TRUE)
ON CONFLICT (id) DO UPDATE
SET
  label = EXCLUDED.label,
  href = EXCLUDED.href,
  icon_url = EXCLUDED.icon_url,
  parent_id = EXCLUDED.parent_id,
  menu_slug = EXCLUDED.menu_slug,
  h1_title = EXCLUDED.h1_title,
  mapped_tags = EXCLUDED.mapped_tags,
  games_enabled = EXCLUDED.games_enabled,
  props_enabled = EXCLUDED.props_enabled,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

UPDATE sports_menu_items
SET
  sidebar_category = FALSE,
  sidebar_enabled = FALSE,
  sidebar_featured = FALSE,
  sidebar_sort_order = 0,
  updated_at = NOW();

UPDATE sports_menu_items
SET
  sidebar_category = TRUE,
  sidebar_enabled = TRUE,
  sidebar_featured = TRUE,
  sidebar_sort_order = CASE id
    WHEN 'group-soccer-11-link-world-cup-sports-world-cup-games' THEN 0
    WHEN 'group-tennis-12-link-wimbledon-sports-wimbledon-games' THEN 1
    WHEN 'group-baseball-14-link-mlb-sports-mlb-games-0' THEN 2
    WHEN 'group-ufc-7-link-ufc-sports-ufc-games-0' THEN 3
  END,
  updated_at = NOW()
WHERE id IN (
  'group-soccer-11-link-world-cup-sports-world-cup-games',
  'group-tennis-12-link-wimbledon-sports-wimbledon-games',
  'group-baseball-14-link-mlb-sports-mlb-games-0',
  'group-ufc-7-link-ufc-sports-ufc-games-0'
);

UPDATE sports_menu_items
SET
  href = '/sports/world-cup',
  updated_at = NOW()
WHERE id = 'group-soccer-11-link-world-cup-sports-world-cup-games';

UPDATE sports_menu_items
SET
  sidebar_category = TRUE,
  sidebar_enabled = TRUE,
  sidebar_sort_order = CASE id
    WHEN 'group-soccer-11' THEN 0
    WHEN 'group-tennis-12' THEN 1
    WHEN 'top-link-cricket-sports-crint-games-16' THEN 2
    WHEN 'group-basketball-10' THEN 3
    WHEN 'group-baseball-14' THEN 4
    WHEN 'group-football-9' THEN 5
    WHEN 'top-link-nhl-sports-nhl-games-6' THEN 6
    WHEN 'top-link-golf-sports-golf-props-19' THEN 7
    WHEN 'group-ufc-7' THEN 8
    WHEN 'top-link-formula-1-sports-f1-props-20' THEN 9
    WHEN 'top-link-chess-sports-chess-props-21' THEN 10
    WHEN 'top-link-pickleball-sports-pickleball-props-23' THEN 11
    WHEN 'group-lacrosse-24' THEN 12
    WHEN 'sports-top-link-volleyball' THEN 13
    WHEN 'sports-top-link-esports' THEN 14
  END,
  updated_at = NOW()
WHERE id IN (
  'group-soccer-11',
  'group-tennis-12',
  'top-link-cricket-sports-crint-games-16',
  'group-basketball-10',
  'group-baseball-14',
  'group-football-9',
  'top-link-nhl-sports-nhl-games-6',
  'top-link-golf-sports-golf-props-19',
  'group-ufc-7',
  'top-link-formula-1-sports-f1-props-20',
  'top-link-chess-sports-chess-props-21',
  'top-link-pickleball-sports-pickleball-props-23',
  'group-lacrosse-24',
  'sports-top-link-volleyball',
  'sports-top-link-esports'
);

UPDATE sports_menu_items
SET
  label = 'Hockey',
  h1_title = 'Hockey',
  updated_at = NOW()
WHERE id = 'top-link-nhl-sports-nhl-games-6';

UPDATE sports_menu_items
SET
  label = 'Combat',
  menu_slug = 'mma',
  h1_title = 'Combat',
  updated_at = NOW()
WHERE id = 'group-ufc-7';

UPDATE sports_menu_items
SET
  menu_slug = CASE id
    WHEN 'group-soccer-11' THEN 'soccer'
    WHEN 'group-tennis-12' THEN 'tennis'
    WHEN 'top-link-cricket-sports-crint-games-16' THEN 'cricket'
    WHEN 'group-basketball-10' THEN 'basketball'
    WHEN 'group-baseball-14' THEN 'baseball'
    WHEN 'group-football-9' THEN 'football'
    WHEN 'group-lacrosse-24' THEN 'lacrosse'
    WHEN 'sports-top-link-esports' THEN 'esports'
  END,
  h1_title = COALESCE(h1_title, label),
  updated_at = NOW()
WHERE id IN (
  'group-soccer-11',
  'group-tennis-12',
  'top-link-cricket-sports-crint-games-16',
  'group-basketball-10',
  'group-baseball-14',
  'group-football-9',
  'group-lacrosse-24',
  'sports-top-link-esports'
);

UPDATE sports_menu_items
SET
  href = '/sports/chess/games',
  games_enabled = TRUE,
  props_enabled = FALSE,
  updated_at = NOW()
WHERE id = 'top-link-chess-sports-chess-props-21';

UPDATE sports_menu_items
SET
  href = '/sports/nfl/games',
  games_enabled = TRUE,
  props_enabled = FALSE,
  updated_at = NOW()
WHERE id = 'group-football-9-link-nfl-sports-nfl-props-0';

UPDATE sports_menu_items
SET
  parent_id = 'group-ufc-7',
  sort_order = 3,
  sidebar_category = FALSE,
  updated_at = NOW()
WHERE id = 'top-link-boxing-sports-boxing-props-22';

WITH desired_children(parent_id, slugs) AS (
  VALUES
    ('group-soccer-11', ARRAY['soccer','world-cup','bol1','swe','mls','nor','csl','bra2','ucl','uel','ucol','auc','rou1','bra','kor','per1','mex','nwsl','trsk','ja2','sud','chi1','cze1','gtm','epl','laliga','bundesliga','ligue-1','sea','arg','svk1','atc','por','den','spl','col1']::text[]),
    ('group-tennis-12', ARRAY['tennis','wimbledon','atp','wta','itf','atp-doubles','wta-doubles']::text[]),
    ('top-link-cricket-sports-crint-games-16', ARRAY['cricket','crint','cricshpageeza','cricjcl','crict20blast','cricmlc','cricmaharaja','crictelangana']::text[]),
    ('group-basketball-10', ARRAY['basketball','wnba','nbasl','nba','bkbsn']::text[]),
    ('group-baseball-14', ARRAY['baseball','mlb','kbo','cpbl','npb']::text[]),
    ('group-football-9', ARRAY['football','cfl','nfl','cfb']::text[]),
    ('group-ufc-7', ARRAY['mma','ufc','powerslap','boxing']::text[]),
    ('group-lacrosse-24', ARRAY['lacrosse','pll','wll']::text[])
)
UPDATE sports_menu_items AS item
SET
  sidebar_enabled = TRUE,
  sort_order = array_position(desired_children.slugs, item.menu_slug) - 1,
  updated_at = NOW()
FROM desired_children
WHERE item.parent_id = desired_children.parent_id
  AND item.menu_slug = ANY(desired_children.slugs);
