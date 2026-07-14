UPDATE sports_menu_items
SET
  parent_id = NULL,
  href = CASE id
    WHEN 'group-esports-13-link-starcraft-ii-sports-starcraft-2-games-10' THEN '/esports/starcraft-2/games'
    WHEN 'group-esports-13-link-rocket-league-sports-rocket-league-games-5' THEN '/esports/rocket-league/games'
    WHEN 'group-esports-13-link-starcraft-brood-war-sports-starcraft-brood-war-props-11' THEN '/esports/starcraft-brood-war/props'
  END,
  updated_at = NOW()
WHERE id IN (
  'group-esports-13-link-starcraft-ii-sports-starcraft-2-games-10',
  'group-esports-13-link-rocket-league-sports-rocket-league-games-5',
  'group-esports-13-link-starcraft-brood-war-sports-starcraft-brood-war-props-11'
);

UPDATE sports_menu_items
SET
  sidebar_category = TRUE,
  sidebar_enabled = TRUE,
  sidebar_featured = FALSE,
  sidebar_sort_order = CASE id
    WHEN 'group-esports-league-of-legends' THEN 0
    WHEN 'group-esports-cs2' THEN 1
    WHEN 'group-esports-dota-2' THEN 2
    WHEN 'group-esports-valorant' THEN 3
    WHEN 'group-esports-mobile-legends-bang-bang' THEN 4
    WHEN 'group-esports-overwatch' THEN 5
    WHEN 'group-esports-rainbow-six-siege' THEN 6
    WHEN 'group-esports-call-of-duty' THEN 7
    WHEN 'group-esports-13-link-starcraft-ii-sports-starcraft-2-games-10' THEN 8
    WHEN 'group-esports-honor-of-kings' THEN 9
    WHEN 'group-esports-13-link-rocket-league-sports-rocket-league-games-5' THEN 10
    WHEN 'group-esports-13-link-starcraft-brood-war-sports-starcraft-brood-war-props-11' THEN 11
  END,
  updated_at = NOW()
WHERE id IN (
  'group-esports-league-of-legends',
  'group-esports-cs2',
  'group-esports-dota-2',
  'group-esports-valorant',
  'group-esports-mobile-legends-bang-bang',
  'group-esports-overwatch',
  'group-esports-rainbow-six-siege',
  'group-esports-call-of-duty',
  'group-esports-13-link-starcraft-ii-sports-starcraft-2-games-10',
  'group-esports-honor-of-kings',
  'group-esports-13-link-rocket-league-sports-rocket-league-games-5',
  'group-esports-13-link-starcraft-brood-war-sports-starcraft-brood-war-props-11'
);

UPDATE sports_menu_items
SET
  sidebar_category = TRUE,
  sidebar_enabled = TRUE,
  sidebar_featured = FALSE,
  updated_at = NOW()
WHERE parent_id IN (
  'group-esports-league-of-legends',
  'group-esports-cs2',
  'group-esports-dota-2',
  'group-esports-valorant',
  'group-esports-mobile-legends-bang-bang',
  'group-esports-overwatch',
  'group-esports-rainbow-six-siege',
  'group-esports-call-of-duty',
  'group-esports-honor-of-kings'
);
