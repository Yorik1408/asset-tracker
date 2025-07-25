from sqlalchemy import Column, Integer, String, Boolean, Date, Enum as SQLAlchemyEnum, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import enum

class AssetStatus(str, enum.Enum):
    in_use = "в эксплуатации"
    repair = "на ремонте"
    retired = "списано"


class AssetType(str, enum.Enum):
    monitor = "Монитор"
    computer = "Компьютер"
    laptop = "Ноутбук"
    other = "Прочее"


class AssetHistory(Base):
    __tablename__ = "asset_history"

    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    field = Column(String, nullable=False)  # например: serial_number, location, user_name
    old_value = Column(String)
    new_value = Column(String)
    changed_at = Column(Date, nullable=False)
    asset = relationship("Asset", back_populates="history")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True)
    inventory_number = Column(String, nullable=False)
    serial_number = Column(String, nullable=True)
    model = Column(String)
    purchase_date = Column(Date)
    warranty_until = Column(Date)
    status = Column(String)
    location = Column(String, nullable=False)
    user_name = Column(String)
    motherboard = Column(String)
    processor = Column(String)
    ram = Column(String)
    comment = Column(String)
    type = Column(String)
    issue_date = Column(Date)

    # Дополнительные поля
    windows_key = Column(String, nullable=True)
    os_type = Column(String, nullable=True)

    # Связи
    history = relationship("AssetHistory", back_populates="asset", cascade="all, delete")
Asset.history = relationship("AssetHistory", back_populates="asset")

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)

