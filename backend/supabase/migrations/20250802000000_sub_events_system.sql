-- Sub-events / Multi-QR Attendance System Migration

-- Add columns to event table
ALTER TABLE event ADD COLUMN IF NOT EXISTS max_activity_pts INTEGER DEFAULT 0;
ALTER TABLE event ADD COLUMN IF NOT EXISTS vol_activity_pts INTEGER DEFAULT 0;
ALTER TABLE event ADD COLUMN IF NOT EXISTS min_part_scans INTEGER DEFAULT 1;
ALTER TABLE event ADD COLUMN IF NOT EXISTS min_voln_scans INTEGER DEFAULT 1;

-- Sub-event table
CREATE TABLE IF NOT EXISTS sub_event (
  seid SERIAL PRIMARY KEY,
  eid INTEGER NOT NULL REFERENCES event(eid) ON DELETE CASCADE,
  se_name VARCHAR(100) NOT NULL,
  se_details TEXT DEFAULT '',
  activity_pts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sub-event attendance table
CREATE TABLE IF NOT EXISTS sub_event_attendance (
  id SERIAL PRIMARY KEY,
  seid INTEGER NOT NULL REFERENCES sub_event(seid) ON DELETE CASCADE,
  eid INTEGER NOT NULL REFERENCES event(eid) ON DELETE CASCADE,
  usn VARCHAR(10) NOT NULL REFERENCES student(usn),
  role VARCHAR(20) NOT NULL CHECK (role IN ('participant', 'volunteer')),
  scanned_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sea_unique 
  ON sub_event_attendance(seid, usn, role);

CREATE INDEX IF NOT EXISTS idx_sea_eid ON sub_event_attendance(eid);
CREATE INDEX IF NOT EXISTS idx_sea_usn ON sub_event_attendance(usn);
CREATE INDEX IF NOT EXISTS idx_sea_seid ON sub_event_attendance(seid);
CREATE INDEX IF NOT EXISTS idx_se_eid ON sub_event(eid);

-- RLS
ALTER TABLE sub_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_event_attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone authenticated can read sub_events" ON sub_event;
DROP POLICY IF EXISTS "Organizers can manage sub_events" ON sub_event;
DROP POLICY IF EXISTS "Users can read own sub_event_attendance" ON sub_event_attendance;
DROP POLICY IF EXISTS "Users can insert own sub_event_attendance" ON sub_event_attendance;

-- New policies for sub_event
CREATE POLICY "Anyone authenticated can read sub_events"
  ON sub_event FOR SELECT TO authenticated USING (true);

CREATE POLICY "Organizers can insert sub_events"
  ON sub_event FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM event WHERE eid = sub_event.eid AND orgusn = auth.uid()::text));

CREATE POLICY "Organizers can update sub_events"
  ON sub_event FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM event WHERE eid = sub_event.eid AND orgusn = auth.uid()::text));

CREATE POLICY "Organizers can delete sub_events"
  ON sub_event FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM event WHERE eid = sub_event.eid AND orgusn = auth.uid()::text));

-- Policies for sub_event_attendance
CREATE POLICY "Users can read own sub_event_attendance"
  ON sub_event_attendance FOR SELECT TO authenticated
  USING (usn = auth.uid()::text OR EXISTS (
    SELECT 1 FROM event WHERE eid = sub_event_attendance.eid AND orgusn = auth.uid()::text
  ));

CREATE POLICY "Users can insert own sub_event_attendance"
  ON sub_event_attendance FOR INSERT TO authenticated
  WITH CHECK (usn = auth.uid()::text);
