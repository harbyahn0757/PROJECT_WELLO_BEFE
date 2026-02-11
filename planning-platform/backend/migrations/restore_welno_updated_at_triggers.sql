-- Restore updated_at triggers on welno tables (removed when wello schema was dropped)
-- Run after: wello schema drop (wello_schema_backup plan)
-- Usage: psql -h ... -U peernine -d p9_mkt_biz -f migrations/restore_welno_updated_at_triggers.sql

CREATE OR REPLACE FUNCTION welno.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_welno_hospitals_updated_at ON welno.welno_hospitals;
CREATE TRIGGER update_welno_hospitals_updated_at
    BEFORE UPDATE ON welno.welno_hospitals
    FOR EACH ROW EXECUTE PROCEDURE welno.update_updated_at_column();

DROP TRIGGER IF EXISTS update_welno_patients_updated_at ON welno.welno_patients;
CREATE TRIGGER update_welno_patients_updated_at
    BEFORE UPDATE ON welno.welno_patients
    FOR EACH ROW EXECUTE PROCEDURE welno.update_updated_at_column();
