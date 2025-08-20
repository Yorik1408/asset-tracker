# models.py
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Date, Text, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    is_admin = Column(Boolean, default=False)

    def set_password(self, password: str):
        self.password_hash = pwd_context.hash(password)

    def check_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.password_hash)

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    inventory_number = Column(String, unique=True, index=True)
    serial_number = Column(String, index=True, nullable=True)
    model = Column(String, nullable=True)
    type = Column(String) # Монитор, Компьютер, Ноутбук, Прочее
    status = Column(String, default="в эксплуатации") # в эксплуатации, на ремонте, списано
    location = Column(String)
    user_name = Column(String, nullable=True)
    issue_date = Column(Date, nullable=True) # Дата выдачи (для ноутбуков)
    purchase_date = Column(Date, nullable=True)
    warranty_until = Column(Date, nullable=True)
    motherboard = Column(String, nullable=True) # Материнская плата
    processor = Column(String, nullable=True) # Процессор
    ram = Column(String, nullable=True) # ОЗУ
    comment = Column(Text, nullable=True)
    windows_key = Column(String, nullable=True) # Ключ Windows
    os_type = Column(String, nullable=True) # Тип ОС

    # Связь с историей изменений
    history = relationship("AssetHistory", back_populates="asset", cascade="all, delete-orphan")
    repairs = relationship("RepairRecord", back_populates="asset", cascade="all, delete-orphan")

class AssetHistory(Base):
    __tablename__ = "asset_history"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    field = Column(String, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    changed_at = Column(Date)
    changed_by = Column(String, nullable=True) # Имя пользователя, внесшего изменения

    # Связь с активом
    asset = relationship("Asset", back_populates="history")

class RepairRecord(Base):
    __tablename__ = "repair_records"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    # Дата ремонта
    repair_date = Column(Date, nullable=False)
    # Описание выполненных работ
    description = Column(Text, nullable=False)
    # Стоимость ремонта (опционально)
    cost = Column(String, nullable=True) # Или Numeric, если нужна точность
    # Кто выполнил ремонт (опционально)
    performed_by = Column(String, nullable=True)
    # Время создания записи (для аудита)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связь с активом
    asset = relationship("Asset", back_populates="repairs")

class DeletionLog(Base):
    """
    Модель для хранения журнала операций удаления.
    """
    __tablename__ = "deletion_logs"

    id = Column(Integer, primary_key=True, index=True)
    # Тип удаляемой сущности (например, "Asset", "User", "RepairRecord")
    entity_type = Column(String, nullable=False, index=True)
    # ID удаляемой сущности
    entity_id = Column(Integer, nullable=False, index=True)
    # JSON-сериализованные данные удаляемой сущности на момент удаления (опционально)
    # Это позволяет видеть, *что* было удалено
    entity_data = Column(JSON, nullable=True)
    # Имя пользователя, выполнившего удаление
    deleted_by = Column(String, nullable=False, index=True)
    # Время удаления
    deleted_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    # Причина удаления (опционально, можно добавить в UI)
    reason = Column(String, nullable=True)
