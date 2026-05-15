-- ======================================================
-- TRIGGER 5.1: VALIDASI KETERIKATAN KURSI (SEAT) SEBELUM MENGHAPUS
-- Cek: Apakah seat sudah di-assign ke tiket (HAS_RELATIONSHIP)
-- Jika sudah terisi, tidak boleh dihapus
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.check_seat_assignment_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Cek apakah seat sudah di-assign ke tiket di tabel HAS_RELATIONSHIP
    IF EXISTS (
        SELECT 1 FROM TIKTAKTUK.HAS_RELATIONSHIP
        WHERE seat_id = OLD.seat_id
    ) THEN
        RAISE EXCEPTION 'ERROR: Kursi % - Baris % No. % tidak dapat dihapus karena sudah terisi.',
            OLD.section, OLD.row_number, OLD.seat_number;
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
BEGIN
    -- 1. Ambil data kategori tiket
    SELECT category_name, quota
    INTO v_category_name, v_quota
    FROM TIKTAKTUK.TICKET_CATEGORY
    WHERE category_id = NEW.category_id;

    -- 2. Hitung jumlah tiket yang sudah terjual pada kategori ini
    SELECT COUNT(*)::int INTO v_sold_count
    FROM TIKTAKTUK.TICKET
    WHERE category_id = NEW.category_id;

    -- 3. Cek apakah sudah mencapai/melebihi batas quota
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
