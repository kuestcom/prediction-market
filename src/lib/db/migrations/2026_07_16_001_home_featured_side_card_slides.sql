-- Preserve the existing side card as the first item in the new carousel model.
-- The application keeps reading the legacy keys as a fallback during rolling deploys.
INSERT INTO settings ("group", key, value)
SELECT
  'home_featured',
  'side_card_slides_v1',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'legacy',
      'enabled', TRUE,
      'type', CASE
        WHEN LOWER(TRIM(COALESCE(MAX(value) FILTER (WHERE key = 'side_card_use_image'), 'false'))) IN ('1', 'true', 'yes', 'on', 'enabled')
          THEN 'image'
        ELSE 'text'
      END,
      'title', COALESCE(MAX(value) FILTER (WHERE key = 'side_card_title'), 'Market pulse'),
      'text', COALESCE(MAX(value) FILTER (WHERE key = 'side_card_text'), 'Fast movers across active markets.'),
      'ctaLabel', COALESCE(MAX(value) FILTER (WHERE key = 'side_card_cta_label'), ''),
      'ctaHref', COALESCE(MAX(value) FILTER (WHERE key = 'side_card_cta_href'), ''),
      'icon', COALESCE(MAX(value) FILTER (WHERE key = 'side_card_icon'), 'trending-up'),
      'useAi', LOWER(TRIM(COALESCE(MAX(value) FILTER (WHERE key = 'side_card_use_ai'), 'false'))) IN ('1', 'true', 'yes', 'on', 'enabled'),
      'useImage', LOWER(TRIM(COALESCE(MAX(value) FILTER (WHERE key = 'side_card_use_image'), 'false'))) IN ('1', 'true', 'yes', 'on', 'enabled'),
      'imagePath', COALESCE(MAX(value) FILTER (WHERE key = 'side_card_image_path'), ''),
      'videoUrl', ''
    )
  )::TEXT
FROM settings
WHERE "group" = 'home_featured'
ON CONFLICT ("group", key) DO NOTHING;
