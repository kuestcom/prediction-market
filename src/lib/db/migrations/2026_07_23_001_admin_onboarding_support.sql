WITH existing_admin_configuration AS (
  SELECT EXISTS (
    SELECT 1
    FROM settings
    WHERE "group" = 'general'
      AND key IN ('site_name', 'site_logo_mode', 'site_logo_svg', 'site_logo_image_path')
      AND BTRIM(value) <> ''
  ) AS configured
)
INSERT INTO settings ("group", key, value)
SELECT 'admin_onboarding', task.key, CASE WHEN existing.configured THEN 'true' ELSE 'false' END
FROM existing_admin_configuration AS existing
CROSS JOIN (
  VALUES ('brand'), ('fee-wallet'), ('openrouter'), ('endpoints')
) AS task(key)
ON CONFLICT ("group", key) DO NOTHING;

INSERT INTO settings ("group", key, value)
VALUES ('integrations', 'kuest_support_enabled', 'true'),
       ('integrations', 'kuest_support_position', 'right'),
       ('admin_support', 'announcement_dismissed_at', '')
ON CONFLICT ("group", key) DO NOTHING;
