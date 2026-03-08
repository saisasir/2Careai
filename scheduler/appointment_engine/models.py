"""
SQLAlchemy ORM models for the scheduling engine.
"""

from sqlalchemy import (
    Column, Integer, String, Date, Time, Boolean, Text,
    ForeignKey, DateTime, CheckConstraint, JSON,
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator, ARRAY


class StringArray(TypeDecorator):
    """Cross-database array type: ARRAY on PostgreSQL, JSON on SQLite."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(String(50)))
        return dialect.type_descriptor(JSON())


class Base(DeclarativeBase):
    pass


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    specialty = Column(String(100), nullable=False)
    languages = Column(StringArray(), default=["en"])
    created_at = Column(DateTime, server_default=func.now())

    schedules = relationship("DoctorSchedule", back_populates="doctor", cascade="all,delete")
    appointments = relationship("Appointment", back_populates="doctor")

    def __repr__(self):
        return f"<Doctor {self.name} ({self.specialty})>"


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedule"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Mon, 6=Sun
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_duration = Column(Integer, default=30)  # minutes
    is_active = Column(Boolean, default=True)

    doctor = relationship("Doctor", back_populates="schedules")

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="valid_day"),
    )


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))
    phone = Column(String(20), unique=True)
    email = Column(String(100))
    preferred_lang = Column(String(5), default="en")
    preferred_doctor_id = Column(Integer, ForeignKey("doctors.id"))
    created_at = Column(DateTime, server_default=func.now())

    appointments = relationship("Appointment", back_populates="patient")
    history = relationship("PatientHistory", back_populates="patient")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    appointment_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    status = Column(String(20), default="booked")
    reason = Column(Text)
    language_used = Column(String(5), default="en")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")

    __table_args__ = (
        CheckConstraint(
            "status IN ('booked','cancelled','completed','rescheduled','no_show')",
            name="valid_status",
        ),
    )


class PatientHistory(Base):
    __tablename__ = "patient_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    interaction_type = Column(String(30), nullable=False)
    details = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

    patient = relationship("Patient", back_populates="history")
