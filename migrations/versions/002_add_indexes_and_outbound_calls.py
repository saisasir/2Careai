"""002_add_indexes_and_outbound_calls — Performance indexes and outbound call tracking.

Revision ID: 002_indexes_outbound
Revises: 001_initial
Create Date: 2026-03-07

Changes:
  - Index on appointments(appointment_date, doctor_id) — availability queries
  - Index on appointments(patient_id, status)         — patient history queries
  - Index on appointments(status, appointment_date)    — dashboard/scheduler queries
  - Index on patients(phone)                           — lookup by caller phone (already UNIQUE, but explicit)
  - Index on doctor_schedule(doctor_id, day_of_week)  — schedule lookup
  - outbound_calls table                               — track Twilio outbound campaign calls
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_indexes_outbound"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Appointment query indexes ─────────────────────────
    # Used by checkAvailability: filter by date + doctor
    op.create_index(
        "ix_appointments_date_doctor",
        "appointments",
        ["appointment_date", "doctor_id"],
    )
    # Used by patient history lookup
    op.create_index(
        "ix_appointments_patient_status",
        "appointments",
        ["patient_id", "status"],
    )
    # Used by dashboard/outbound scheduler: pending appointments by date
    op.create_index(
        "ix_appointments_status_date",
        "appointments",
        ["status", "appointment_date"],
    )

    # ── Doctor schedule index ─────────────────────────────
    # Used by availability engine: schedule by doctor + day
    op.create_index(
        "ix_doctor_schedule_doctor_day",
        "doctor_schedule",
        ["doctor_id", "day_of_week"],
    )

    # ── Patient history index ─────────────────────────────
    op.create_index(
        "ix_patient_history_patient_id",
        "patient_history",
        ["patient_id"],
    )

    # ── Outbound calls tracking table ─────────────────────
    op.create_table(
        "outbound_calls",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "patient_id",
            sa.Integer,
            sa.ForeignKey("patients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "appointment_id",
            sa.Integer,
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("twilio_call_sid", sa.String(64), unique=True, nullable=True),
        sa.Column("phone_number", sa.String(20), nullable=False),
        sa.Column("language", sa.String(5), server_default="'en'"),
        # Status: initiated | ringing | in-progress | completed | failed | no-answer
        sa.Column("call_status", sa.String(20), server_default="'initiated'"),
        sa.Column("call_outcome", sa.String(30), nullable=True),  # confirmed | cancelled | rescheduled | no-answer
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("initiated_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.CheckConstraint(
            "call_status IN ('initiated','ringing','in-progress','completed','failed','no-answer','busy')",
            name="valid_call_status",
        ),
    )
    op.create_index(
        "ix_outbound_calls_patient_id",
        "outbound_calls",
        ["patient_id"],
    )
    op.create_index(
        "ix_outbound_calls_appointment_id",
        "outbound_calls",
        ["appointment_id"],
    )
    op.create_index(
        "ix_outbound_calls_status",
        "outbound_calls",
        ["call_status", "initiated_at"],
    )


def downgrade() -> None:
    op.drop_table("outbound_calls")
    op.drop_index("ix_patient_history_patient_id", table_name="patient_history")
    op.drop_index("ix_doctor_schedule_doctor_day", table_name="doctor_schedule")
    op.drop_index("ix_appointments_status_date", table_name="appointments")
    op.drop_index("ix_appointments_patient_status", table_name="appointments")
    op.drop_index("ix_appointments_date_doctor", table_name="appointments")
