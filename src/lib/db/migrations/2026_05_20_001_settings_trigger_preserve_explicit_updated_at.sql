CREATE OR REPLACE FUNCTION public.set_settings_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    RETURN NEW;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_settings_updated_at ON settings;

CREATE TRIGGER set_settings_updated_at
  BEFORE UPDATE
  ON settings
  FOR EACH ROW
EXECUTE FUNCTION set_settings_updated_at();
