from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Question(db.Model):
    """Der Pool aller Prüfungsfragen"""
    __tablename__ = 'questions'
    
    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)  # HTML erlaubt
    answer = Column(Text, nullable=False)  # Lösungshorizont
    category = Column(String(100))  # z.B. "GaLaBau", "Zierpflanzen"
    tags = Column(String(500))  # Kommagetrennt, z.B. "Botanik, Bodenkunde"
    difficulty = Column(Integer, default=3)  # 1-5
    active = Column(Boolean, default=True)  # Nur aktive Fragen werden vorgeschlagen
    date_created = Column(DateTime, default=datetime.utcnow)
    
    # Relationship zu ExamItems (nur für Rückverfolgung)
    exam_items = relationship("ExamItem", back_populates="original_question")


class Exam(db.Model):
    """Eine Prüfung/Klausur"""
    __tablename__ = 'exams'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)  # z.B. "Abschlussprüfung Sommer 2025"
    date_created = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="Draft")  # "Draft" oder "Final"
    
    # Relationship zu ExamItems
    items = relationship("ExamItem", back_populates="exam", cascade="all, delete-orphan", order_by="ExamItem.position")


class ExamItem(db.Model):
    """
    Die Verknüpfung zwischen Exam und Question - WICHTIG: Snapshot-Logik!
    Das ist keine reine Referenz! Wenn eine Frage in eine Prüfung kommt,
    kopieren wir den Inhalt als Snapshot.
    """
    __tablename__ = 'exam_items'
    
    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey('exams.id'), nullable=False)
    original_question_id = Column(Integer, ForeignKey('questions.id'), nullable=True)  # Verweis auf Ursprung
    snapshot_content = Column(Text, nullable=False)  # Kopie des Inhalts zum Zeitpunkt der Erstellung
    snapshot_answer = Column(Text, nullable=False)  # Kopie der Lösung
    points = Column(Integer, default=1)  # Punkte für diese spezifische Prüfung
    position = Column(Integer, default=0)  # Reihenfolge in der Prüfung
    
    # Relationships
    exam = relationship("Exam", back_populates="items")
    original_question = relationship("Question", back_populates="exam_items")
