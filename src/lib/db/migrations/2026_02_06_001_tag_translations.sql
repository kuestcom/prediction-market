-- ===========================================
-- 1. TABLES
-- ===========================================

CREATE TABLE tag_translations
(
  tag_id     SMALLINT    NOT NULL REFERENCES tags (id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale     TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, locale),
  CHECK (locale <> 'en')
);

-- ===========================================
-- 2. INDEXES
-- ===========================================

CREATE INDEX idx_tag_translations_locale ON tag_translations (locale);

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE tag_translations
  ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. POLICIES
-- ===========================================

CREATE POLICY "service_role_all_tag_translations" ON "tag_translations" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 5. TRIGGERS
-- ===========================================

CREATE TRIGGER set_tag_translations_updated_at
  BEFORE UPDATE
  ON tag_translations
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ===========================================
-- 6. SEED
-- ===========================================

WITH defaults(slug, locale, name) AS (
  VALUES
    ('climate-science', 'de', 'Klima & Wissenschaft'),
    ('climate-science', 'es', 'Clima y Ciencia'),
    ('climate-science', 'pt', 'Clima e Ciência'),
    ('climate-science', 'fr', 'Climat et Science'),
    ('climate-science', 'zh', '气候与科学'),

    ('crypto', 'de', 'Krypto'),
    ('crypto', 'es', 'Cripto'),
    ('crypto', 'pt', 'Cripto'),
    ('crypto', 'fr', 'Crypto'),
    ('crypto', 'zh', '加密货币'),

    ('culture', 'de', 'Kultur'),
    ('culture', 'es', 'Cultura'),
    ('culture', 'pt', 'Cultura'),
    ('culture', 'fr', 'Culture'),
    ('culture', 'zh', '文化'),

    ('economy', 'de', 'Wirtschaft'),
    ('economy', 'es', 'Economía'),
    ('economy', 'pt', 'Economia'),
    ('economy', 'fr', 'Économie'),
    ('economy', 'zh', '经济'),

    ('earnings', 'de', 'Ergebnisse'),
    ('earnings', 'es', 'Resultados'),
    ('earnings', 'pt', 'Resultados'),
    ('earnings', 'fr', 'Résultats'),
    ('earnings', 'zh', '财报'),

    ('elections', 'de', 'Wahlen'),
    ('elections', 'es', 'Elecciones'),
    ('elections', 'pt', 'Eleições'),
    ('elections', 'fr', 'Élections'),
    ('elections', 'zh', '选举'),

    ('finance', 'de', 'Finanzen'),
    ('finance', 'es', 'Finanzas'),
    ('finance', 'pt', 'Finanças'),
    ('finance', 'fr', 'Finance'),
    ('finance', 'zh', '金融'),

    ('geopolitics', 'de', 'Geopolitik'),
    ('geopolitics', 'es', 'Geopolítica'),
    ('geopolitics', 'pt', 'Geopolítica'),
    ('geopolitics', 'fr', 'Géopolitique'),
    ('geopolitics', 'zh', '地缘政治'),

    ('mentions', 'de', 'Erwähnungen'),
    ('mentions', 'es', 'Menciones'),
    ('mentions', 'pt', 'Menções'),
    ('mentions', 'fr', 'Mentions'),
    ('mentions', 'zh', '提及'),

    ('politics', 'de', 'Politik'),
    ('politics', 'es', 'Política'),
    ('politics', 'pt', 'Política'),
    ('politics', 'fr', 'Politique'),
    ('politics', 'zh', '政治'),

    ('sports', 'de', 'Sport'),
    ('sports', 'es', 'Deportes'),
    ('sports', 'pt', 'Esportes'),
    ('sports', 'fr', 'Sports'),
    ('sports', 'zh', '体育'),

    ('tech', 'de', 'Technologie'),
    ('tech', 'es', 'Tecnología'),
    ('tech', 'pt', 'Tecnologia'),
    ('tech', 'fr', 'Technologie'),
    ('tech', 'zh', '科技'),

    ('world', 'de', 'Welt'),
    ('world', 'es', 'Mundo'),
    ('world', 'pt', 'Mundo'),
    ('world', 'fr', 'Monde'),
    ('world', 'zh', '世界')
)
INSERT INTO tag_translations (tag_id, locale, name)
SELECT t.id, d.locale, d.name
FROM defaults d
INNER JOIN tags t ON t.slug = d.slug
ON CONFLICT (tag_id, locale) DO NOTHING;
