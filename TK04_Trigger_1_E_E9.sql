-- ======================================================
-- TRIGGER 1: USER VALIDATION (Username & Special Char)
-- ======================================================

CREATE OR REPLACE FUNCTION TIKTAKTUK.check_username_validity()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Cek Karakter Spesial
    IF NEW.username !~ '^[a-zA-Z0-9]+$' THEN
        RAISE EXCEPTION 'ERROR: Username "%" hanya boleh mengandung huruf dan angka tanpa simbol atau spasi.', NEW.username;
    END IF;

    -- 2. Cek Duplikasi (Case-Insensitive)
    IF EXISTS (
        SELECT 1 FROM TIKTAKTUK.USER_ACCOUNT
        WHERE LOWER(username) = LOWER(NEW.username)
          AND user_id != NEW.user_id
    ) THEN
        RAISE EXCEPTION 'ERROR: Username "%" sudah terdaftar, gunakan username lain.', NEW.username;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_username
BEFORE INSERT OR UPDATE ON TIKTAKTUK.USER_ACCOUNT
FOR EACH ROW
EXECUTE FUNCTION TIKTAKTUK.check_username_validity();
