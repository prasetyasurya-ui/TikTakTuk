-- ======================================================
-- TRIGGER 5.1: VALIDASI KETERIKATAN KURSI (SEAT) SEBELUM MENGHAPUS
-- Cek: Apakah seat sudah di-assign ke tiket (HAS_RELATIONSHIP)
-- Jika sudah terisi, tidak boleh dihapus
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.check_seat_assignment_before_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_section TEXT;
    v_row_number TEXT;
    v_seat_number TEXT;
    v_has_section BOOLEAN;
    v_has_row_number BOOLEAN;
BEGIN
    -- Cek apakah seat sudah di-assign ke tiket di tabel HAS_RELATIONSHIP
    IF EXISTS (
        SELECT 1 FROM TIKTAKTUK.HAS_RELATIONSHIP
        WHERE seat_id = OLD.seat_id
    ) THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'tiktaktuk'
              AND table_name = 'seat'
              AND column_name = 'section'
        ), EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'tiktaktuk'
              AND table_name = 'seat'
              AND column_name = 'row_number'
        ) INTO v_has_section, v_has_row_number;

        IF v_has_section AND v_has_row_number THEN
            EXECUTE 'SELECT section::text, row_number::text, seat_number::text FROM TIKTAKTUK.SEAT WHERE seat_id = $1'
            INTO v_section, v_row_number, v_seat_number
            USING OLD.seat_id;
        ELSE
            EXECUTE 'SELECT zone::text, seat_number::text, seat_number::text FROM TIKTAKTUK.SEAT WHERE seat_id = $1'
            INTO v_section, v_row_number, v_seat_number
            USING OLD.seat_id;
        END IF;

        RAISE EXCEPTION 'ERROR: Kursi % - Baris % No. % tidak dapat dihapus karena sudah terisi.',
            COALESCE(v_section, '-'), COALESCE(v_row_number, '-'), COALESCE(v_seat_number, '-');
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_seat_assignment_before_delete ON TIKTAKTUK.SEAT;
CREATE TRIGGER trigger_check_seat_assignment_before_delete
BEFORE DELETE ON TIKTAKTUK.SEAT
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.check_seat_assignment_before_delete();


-- ======================================================
-- TRIGGER 5.2: VALIDASI KUOTA KATEGORI TIKET SAAT MEMBUAT TIKET
-- Cek: Apakah jumlah tiket yang sudah terjual pada kategori
-- tersebut sudah mencapai/melebihi batas quota
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.check_ticket_category_quota()
RETURNS TRIGGER AS $$
DECLARE
    v_category_name VARCHAR(100);
    v_quota INTEGER;
    v_sold_count INTEGER;
    v_category_id UUID;
    v_category_col TEXT;
    v_has_category_id BOOLEAN;
BEGIN
    -- 1. Deteksi nama kolom kategori pada tabel TICKET
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'tiktaktuk'
          AND table_name = 'ticket'
          AND column_name = 'category_id'
    ) INTO v_has_category_id;

    IF v_has_category_id THEN
        v_category_id := NEW.category_id;
        v_category_col := 'category_id';
    ELSE
        v_category_id := NEW.tcategory_id;
        v_category_col := 'tcategory_id';
    END IF;

    -- 2. Ambil data kategori tiket
    SELECT category_name, quota
    INTO v_category_name, v_quota
    FROM TIKTAKTUK.TICKET_CATEGORY
    WHERE category_id = v_category_id;

    -- 3. Hitung jumlah tiket yang sudah terjual pada kategori ini
    EXECUTE format('SELECT COUNT(*)::int FROM TIKTAKTUK.TICKET WHERE %I = $1', v_category_col)
    INTO v_sold_count
    USING v_category_id;

    -- 4. Cek apakah sudah mencapai/melebihi batas quota
    IF v_sold_count >= v_quota THEN
        RAISE EXCEPTION 'ERROR: Kuota kategori tiket "%" sudah penuh. Tidak dapat membuat tiket baru.', v_category_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_ticket_category_quota ON TIKTAKTUK.TICKET;
CREATE TRIGGER trigger_check_ticket_category_quota
BEFORE INSERT ON TIKTAKTUK.TICKET
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.check_ticket_category_quota();
