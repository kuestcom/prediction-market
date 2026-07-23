INSERT INTO settings ("group", key, value)
VALUES ('admin_onboarding', 'brand', 'false'),
       ('admin_onboarding', 'fee-wallet', 'false'),
       ('admin_onboarding', 'openrouter', 'false'),
       ('admin_onboarding', 'endpoints', 'false')
ON CONFLICT ("group", key) DO NOTHING;

INSERT INTO settings ("group", key, value)
VALUES ('integrations', 'kuest_support_enabled', 'true'),
       ('integrations', 'kuest_support_position', 'right'),
       ('admin_support', 'announcement_dismissed_at', '')
ON CONFLICT ("group", key) DO NOTHING;
