-- ===========================================
-- 1. TABLE CREATION
-- ===========================================

-- Affiliate referral attribution table - tracks referral relationships
CREATE TABLE affiliate_referrals
(
  id                CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id           CHAR(26)    NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  affiliate_user_id CHAR(26)    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- 2. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE affiliate_referrals
  ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 3. POLICIES
-- ===========================================

CREATE POLICY "service_role_all_affiliate_referrals" ON "affiliate_referrals" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 4. FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION get_affiliate_stats(target_user_id CHAR(26))
  RETURNS TABLE
          (
            total_referrals  BIGINT,
            active_referrals BIGINT,
            volume           NUMERIC
          )
  LANGUAGE SQL
  STABLE
  SET search_path = public
AS
$$
SELECT COALESCE((SELECT COUNT(*) FROM affiliate_referrals ar WHERE ar.affiliate_user_id = target_user_id),
                0)                                               AS total_referrals,
       COALESCE((SELECT COUNT(DISTINCT o.user_id)
                 FROM orders o
                 WHERE o.affiliate_user_id = target_user_id), 0) AS active_referrals,
       COALESCE((SELECT SUM(o.maker_amount)
                 FROM orders o
                 WHERE o.affiliate_user_id = target_user_id), 0) AS volume;
$$;

CREATE OR REPLACE FUNCTION get_affiliate_overview()
  RETURNS TABLE
          (
            affiliate_user_id CHAR(26),
            total_referrals   BIGINT,
            volume            NUMERIC
          )
  LANGUAGE SQL
  STABLE
  SET search_path = public
AS
$$
SELECT u.id                            AS affiliate_user_id,
       COALESCE(ar.count_referrals, 0) AS total_referrals,
       COALESCE(ord.volume, 0)         AS volume
FROM users u
       LEFT JOIN (SELECT affiliate_user_id, COUNT(*) AS count_referrals
                  FROM affiliate_referrals
                  GROUP BY affiliate_user_id) ar ON ar.affiliate_user_id = u.id
       LEFT JOIN (SELECT affiliate_user_id,
                         SUM(maker_amount) AS volume
                  FROM orders
                  WHERE affiliate_user_id IS NOT NULL
                  GROUP BY affiliate_user_id) ord ON ord.affiliate_user_id = u.id
WHERE ar.count_referrals IS NOT NULL
   OR ord.volume IS NOT NULL
ORDER BY COALESCE(ord.volume, 0) DESC
LIMIT 100;
$$;
