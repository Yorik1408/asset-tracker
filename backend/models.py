# models.py
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Date, Text
from sqlalchemy.orm import relationship
from database import Base
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    is_admin = Column(Boolean, default=False)

    # Связь с историей активов (если нужно отслеживать, кто что менял)
    # asset_histories = relationship("AssetHistory", back_populates="changed_by_user")

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

class AssetHistory(Base):
    __tablename__ = "asset_history"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    field = Column(String)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    changed_at = Column(Date)
    changed_by = Column(String, nullable=True) # Имя пользователя, внесшего изменения

    # Связь с активом
    asset = relationship("Asset", back_populates="history")
    # Связь с пользователем (если нужно)
    # changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # changed_by_user = relationship("User", back_populates="asset_histories")

