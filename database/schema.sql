-- ═══════════════════════════════════════════════════════
-- CareAI — PostgreSQL Schema
-- ═══════════════════════════════════════════════════════

-- ── Doctors ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    specialty       VARCHAR(100) NOT NULL,
    languages       VARCHAR(50)[] DEFAULT ARRAY['en'],
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Doctor Schedule (weekly availability) ────────────
CREATE TABLE IF NOT EXISTS doctor_schedule (
    id              SERIAL PRIMARY KEY,
    doctor_id       INT REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    slot_duration   INT DEFAULT 30,  -- minutes per slot
    is_active       BOOLEAN DEFAULT TRUE
);

-- ── Patients ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100),
    phone           VARCHAR(20) UNIQUE,
    email           VARCHAR(100),
    preferred_lang  VARCHAR(5) DEFAULT 'en',
    preferred_doctor_id INT REFERENCES doctors(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Appointments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
    id              SERIAL PRIMARY KEY,
    patient_id      INT REFERENCES patients(id),
    doctor_id       INT REFERENCES doctors(id),
    appointment_date DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    status          VARCHAR(20) DEFAULT 'booked'
                    CHECK (status IN ('booked', 'cancelled', 'completed', 'rescheduled', 'no_show')),
    reason          TEXT,
    language_used   VARCHAR(5) DEFAULT 'en',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ── Patient Interaction History ──────────────────────
CREATE TABLE IF NOT EXISTS patient_history (
    id              SERIAL PRIMARY KEY,
    patient_id      INT REFERENCES patients(id),
    interaction_type VARCHAR(30) NOT NULL,
    details         JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- Seed Data — 5 Doctors
-- ═══════════════════════════════════════════════════════

INSERT INTO doctors (name, specialty, languages) VALUES
    ('Dr. Priya Sharma',     'General Medicine',  ARRAY['en', 'hi']),
    ('Dr. Rajesh Kumar',     'Cardiology',        ARRAY['en', 'hi']),
    ('Dr. Lakshmi Venkat',   'Dermatology',       ARRAY['en', 'ta']),
    ('Dr. Arun Nair',        'Pediatrics',        ARRAY['en', 'hi', 'ta']),
    ('Dr. Meena Subramaniam','Orthopedics',       ARRAY['en', 'ta'])
ON CONFLICT DO NOTHING;

-- Weekly schedules (Mon=0 … Sun=6)
-- Dr. Priya Sharma — Mon-Fri 9AM-5PM
INSERT INTO doctor_schedule (doctor_id, day_of_week, start_time, end_time, slot_duration) VALUES
    (1, 0, '09:00', '17:00', 30),
    (1, 1, '09:00', '17:00', 30),
    (1, 2, '09:00', '17:00', 30),
    (1, 3, '09:00', '17:00', 30),
    (1, 4, '09:00', '17:00', 30);

-- Dr. Rajesh Kumar — Mon,Wed,Fri 10AM-4PM
INSERT INTO doctor_schedule (doctor_id, day_of_week, start_time, end_time, slot_duration) VALUES
    (2, 0, '10:00', '16:00', 30),
    (2, 2, '10:00', '16:00', 30),
    (2, 4, '10:00', '16:00', 30);

-- Dr. Lakshmi Venkat — Tue,Thu,Sat 9AM-1PM
INSERT INTO doctor_schedule (doctor_id, day_of_week, start_time, end_time, slot_duration) VALUES
    (3, 1, '09:00', '13:00', 30),
    (3, 3, '09:00', '13:00', 30),
    (3, 5, '09:00', '13:00', 30);

-- Dr. Arun Nair — Mon-Sat 8AM-2PM
INSERT INTO doctor_schedule (doctor_id, day_of_week, start_time, end_time, slot_duration) VALUES
    (4, 0, '08:00', '14:00', 30),
    (4, 1, '08:00', '14:00', 30),
    (4, 2, '08:00', '14:00', 30),
    (4, 3, '08:00', '14:00', 30),
    (4, 4, '08:00', '14:00', 30),
    (4, 5, '08:00', '14:00', 30);

-- Dr. Meena Subramaniam — Wed,Fri 11AM-6PM
INSERT INTO doctor_schedule (doctor_id, day_of_week, start_time, end_time, slot_duration) VALUES
    (5, 2, '11:00', '18:00', 30),
    (5, 4, '11:00', '18:00', 30);
