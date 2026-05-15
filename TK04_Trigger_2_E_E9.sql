-- ======================================================
-- TRIGGER 2.1: VENUE DUPLICATION (City & Name)
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.check_venue_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
    existing_venue_id UUID;
BEGIN
    SELECT venue_id INTO existing_venue_id
    FROM TIKTAKTUK.VENUE
    WHERE LOWER(venue_name) = LOWER(NEW.venue_name)
      AND LOWER(city) = LOWER(NEW.city)
      AND venue_id != NEW.venue_id;

    IF existing_venue_id IS NOT NULL THEN
        RAISE EXCEPTION 'ERROR: Venue "%" di kota "%" sudah terdaftar dengan ID %.',
            NEW.venue_name, NEW.city, existing_venue_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_venue_uniqueness
BEFORE INSERT OR UPDATE ON TIKTAKTUK.VENUE
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.check_venue_uniqueness();


-- ======================================================
-- TRIGGER 2.2: PREVENT VENUE DELETE (If has Events)
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.check_active_event_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Cek di tabel TIKTAKTUK.EVENT
    IF EXISTS (
        SELECT 1 FROM TIKTAKTUK.EVENT
        WHERE venue_id = OLD.venue_id
    ) THEN
        RAISE EXCEPTION 'ERROR: Venue "%" masih memiliki event aktif sehingga tidak dapat dihapus.', OLD.venue_name;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_venue_delete
BEFORE DELETE ON TIKTAKTUK.VENUE
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.check_active_event_before_delete();