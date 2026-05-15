-- ======================================================
-- TRIGGER 4.1: VALIDASI PROMOTION SAAT DIGUNAKAN KE ORDER
-- Cek: promotion exists + usage_limit belum terlampaui
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.validate_order_promotion_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_promo_code VARCHAR(50);
    v_usage_limit INTEGER;
    v_used_count INTEGER;
BEGIN
    -- 1. Cek apakah Promotion terdaftar
    IF NOT EXISTS (
        SELECT 1 FROM TIKTAKTUK.PROMOTION
        WHERE promotion_id = NEW.promotion_id
    ) THEN
        RAISE EXCEPTION 'ERROR: Promotion dengan ID % tidak ditemukan.', NEW.promotion_id;
    END IF;

    -- 2. Ambil data promotion
    SELECT promo_code, usage_limit
    INTO v_promo_code, v_usage_limit
    FROM TIKTAKTUK.PROMOTION
    WHERE promotion_id = NEW.promotion_id;

    -- 3. Hitung jumlah penggunaan saat ini
    SELECT COUNT(*)::int INTO v_used_count
    FROM TIKTAKTUK.ORDER_PROMOTION
    WHERE promotion_id = NEW.promotion_id;

    -- 4. Cek apakah sudah mencapai batas
    IF v_used_count >= v_usage_limit THEN
        RAISE EXCEPTION 'ERROR: Promotion "%" telah mencapai batas maksimum penggunaan.', v_promo_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_order_promotion_usage ON TIKTAKTUK.ORDER_PROMOTION;
CREATE TRIGGER trigger_validate_order_promotion_usage
BEFORE INSERT ON TIKTAKTUK.ORDER_PROMOTION
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.validate_order_promotion_usage();


-- ======================================================
-- TRIGGER 4.2: VALIDASI PROMOTION BERDASARKAN TANGGAL EVENT
-- Cek: start_date <= event_datetime <= end_date
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.validate_order_promotion_date()
RETURNS TRIGGER AS $$
DECLARE
    v_promo_code VARCHAR(50);
    v_start_date DATE;
    v_end_date DATE;
    v_event_date DATE;
    v_event_id UUID;
BEGIN
    -- 1. Ambil data promotion
    SELECT promo_code, start_date, end_date
    INTO v_promo_code, v_start_date, v_end_date
    FROM TIKTAKTUK.PROMOTION
    WHERE promotion_id = NEW.promotion_id;

    -- 2. Ambil event_id dari TICKET dan TICKET_CATEGORY secara dinamis
    BEGIN
        EXECUTE 'SELECT tc.tevent_id FROM TIKTAKTUK.TICKET t JOIN TIKTAKTUK.TICKET_CATEGORY tc ON t.tcategory_id = tc.category_id WHERE t.torder_id = $1 LIMIT 1'
        INTO v_event_id
        USING NEW.order_id;
    EXCEPTION WHEN undefined_column THEN
        -- Fallback ke skema lokal (order_id, category_id)
        EXECUTE 'SELECT tc.tevent_id FROM TIKTAKTUK.TICKET t JOIN TIKTAKTUK.TICKET_CATEGORY tc ON t.category_id = tc.category_id WHERE t.order_id = $1 LIMIT 1'
        INTO v_event_id
        USING NEW.order_id;
    END;

    SELECT e.event_datetime::DATE INTO v_event_date
    FROM TIKTAKTUK.EVENT e
    WHERE e.event_id = v_event_id;

    -- 3. Cek apakah tanggal event dalam periode promo
    IF v_event_date < v_start_date OR v_event_date > v_end_date THEN
        RAISE EXCEPTION 'ERROR: Promotion "%" tidak berlaku untuk tanggal event ini.', v_promo_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_order_promotion_date ON TIKTAKTUK.ORDER_PROMOTION;
CREATE TRIGGER trigger_validate_order_promotion_date
BEFORE INSERT ON TIKTAKTUK.ORDER_PROMOTION
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.validate_order_promotion_date();
