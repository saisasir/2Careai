"""001_initial_schema — Create all tables for CareAI.

Revision ID: 001_initial
Revises: None
Create Date: 2026-03-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Doctors ──────────────────────────────────────────
    op.create_table(
        "doctors",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("specialty", sa.String(100), nullable=False),
        sa.Column("languages", sa.ARRAY(sa.String(50)), server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    # ── Doctor Schedule ──────────────────────────────────
    op.create_table(
        "doctor_schedule",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "doctor_id",
            sa.Integer,
            sa.ForeignKey("doctors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day_of_week", sa.Integer, nullable=False),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("slot_duration", sa.Integer, server_default="30"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.CheckConstraint("day_of_week BETWEEN 0 AND 6", name="valid_day"),
    )

    # ── Patients ─────────────────────────────────────────
    op.create_table(
        "patients",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100)),
        sa.Column("phone", sa.String(20), unique=True),
        sa.Column("email", sa.String(100)),
        sa.Column("preferred_lang", sa.String(5), server_default="'en'"),
        sa.Column(
            "preferred_doctor_id",
            sa.Integer,
            sa.ForeignKey("doctors.id"),
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    # ── Appointments ─────────────────────────────────────
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("patient_id", sa.Integer, sa.ForeignKey("patients.id")),
        sa.Column("doctor_id", sa.Integer, sa.ForeignKey("doctors.id")),
        sa.Column("appointment_date", sa.Date, nullable=False),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("status", sa.String(20), server_default="'booked'"),
        sa.Column("reason", sa.Text),
        sa.Column("language_used", sa.String(5), server_default="'en'"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "status IN ('booked','cancelled','completed','rescheduled','no_show')",
            name="valid_status",
        ),
    )

    # ── Patient History ──────────────────────────────────
    op.create_table(
        "patient_history",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("patient_id", sa.Integer, sa.ForeignKey("patients.id")),
        sa.Column("interaction_type", sa.String(30), nullable=False),
        sa.Column("details", sa.JSON),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("patient_history")
    op.drop_table("appointments")
    op.drop_table("patients")
    op.drop_table("doctor_schedule")
    op.drop_table("doctors")
