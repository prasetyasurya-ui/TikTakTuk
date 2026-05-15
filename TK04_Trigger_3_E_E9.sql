-- ======================================================
-- TRIGGER 3.1: VALIDASI EVENT_ARTIST (Artist & Event)
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.validate_event_artist()
RETURNS TRIGGER AS $$
DECLARE
	v_artist_name VARCHAR(100);
	v_event_title VARCHAR(200);
BEGIN
	SELECT name INTO v_artist_name
	FROM TIKTAKTUK.ARTIST
	WHERE artist_id = NEW.artist_id;

	IF v_artist_name IS NULL THEN
		RAISE EXCEPTION 'ERROR: Artist dengan ID % tidak ditemukan.', NEW.artist_id;
	END IF;

	SELECT event_title INTO v_event_title
	FROM TIKTAKTUK.EVENT
	WHERE event_id = NEW.event_id;

	IF v_event_title IS NULL THEN
		RAISE EXCEPTION 'ERROR: Event dengan ID % tidak ditemukan.', NEW.event_id;
	END IF;

	IF TG_OP = 'INSERT' OR NEW.event_id <> OLD.event_id OR NEW.artist_id <> OLD.artist_id THEN
		IF EXISTS (
			SELECT 1
			FROM TIKTAKTUK.EVENT_ARTIST ea
			WHERE ea.event_id = NEW.event_id
			  AND ea.artist_id = NEW.artist_id
		) THEN
			RAISE EXCEPTION 'ERROR: Artist "%" sudah terdaftar pada event "%".', v_artist_name, v_event_title;
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_artist_validation
BEFORE INSERT OR UPDATE ON TIKTAKTUK.EVENT_ARTIST
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.validate_event_artist();


-- ======================================================
-- STORED PROCEDURE: SISA KUOTA TICKET CATEGORY PER EVENT
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.get_ticket_category_remaining(p_event_id UUID)
RETURNS TABLE (
	category_id UUID,
	category_name VARCHAR,
	quota INTEGER,
	tickets_sold INTEGER,
	remaining_quota INTEGER
) AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM TIKTAKTUK.EVENT
		WHERE event_id = p_event_id
	) THEN
		RAISE EXCEPTION 'ERROR: Event dengan ID % tidak ditemukan.', p_event_id;
	END IF;

	RETURN QUERY
	SELECT
		c.category_id,
		c.category_name,
		c.quota,
		COALESCE(t.sold, 0) AS tickets_sold,
		(c.quota - COALESCE(t.sold, 0)) AS remaining_quota
	FROM TIKTAKTUK.TICKET_CATEGORY c
	LEFT JOIN (
		SELECT category_id, COUNT(*)::int AS sold
		FROM TIKTAKTUK.TICKET
		GROUP BY category_id
	) t ON t.category_id = c.category_id
	WHERE c.tevent_id = p_event_id
	ORDER BY c.category_name ASC;
END;
$$ LANGUAGE plpgsql;
