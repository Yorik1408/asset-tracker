from sqlalchemy.orm import Session
from models import Asset, User, AssetHistory  # Добавлена AssetHistory
from passlib.context import CryptContext
from schemas import AssetCreate, AssetUpdate, UserCreate
from datetime import date
from pydantic import BaseModel
from datetime import date
from typing import Optional, List
from enum import Enum
from sqlalchemy import func
from fastapi import HTTPException

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Существующие функции ---
def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = User(
        username=user.username,
        password_hash=hashed_password,
        is_admin=user.is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_asset(db: Session, asset_id: int):
    return db.query(Asset).filter(Asset.id == asset_id).first()

def get_asset_by_inventory_number(db: Session, inventory_number: str):
    return db.query(Asset).filter(func.lower(Asset.inventory_number) == func.lower(inventory_number)).first()

def get_assets(db: Session, skip: int = 0, limit: int = 5000):
    return db.query(Asset).offset(skip).limit(limit).all()

# --- История изменений ---
# Измените сигнатуру функции, добавив changed_by
def log_asset_change(db: Session, asset_id: int, field: str, old_value: str, new_value: str, changed_by: str = None):
    HISTORY_FIELD_LABELS = {
        "inventory_number": "Инвентарный номер",
        "serial_number": "Серийный номер",
        "location": "Расположение",
        "user_name": "ФИО пользователя",
        "status": "Статус",
        "model": "Модель",
        "type": "Тип",
        "motherboard": "Материнская плата",
        "processor": "Процессор",
        "ram": "ОЗУ",
        "os_type": "Тип ОС",
        "windows_key": "Ключ Windows",
    }
    if old_value == new_value:
        return
    history_record = AssetHistory(
        asset_id=asset_id,
        field=field,
        old_value=old_value,
        new_value=new_value,
        changed_at=date.today(),
        # --- Новое поле ---
        changed_by=changed_by # Сохраняем имя пользователя
        # ------------------
    )
    db.add(history_record)
    db.commit()
    db.refresh(history_record)

# --- Основные CRUD операции ---
def create_asset(db: Session, asset: AssetCreate, changed_by_username: str = None):
    if get_asset_by_inventory_number(db, asset.inventory_number):
        raise HTTPException(status_code=400, detail="Актив с таким инвентарным номером уже существует")
    
    db_asset = Asset(**asset.dict())
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    
    # Логируем создание актива
    log_asset_change(db, db_asset.id, "created", None, f"Актив создан: {asset.inventory_number}", changed_by_username)
    
    return db_asset

def update_asset(db: Session, asset_id: int, asset_update: AssetUpdate, changed_by_username: str = None):
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return False

    # Проверка на изменение серийного номера
    if asset_update.inventory_number and asset_update.inventory_number != db_asset.inventory_number:
        if get_asset_by_inventory_number(db, asset_update.inventory_number):
            raise HTTPException(status_code=400, detail="Инвентарный номер уже используется")

    # Логируем изменения важных полей
    log_asset_change(db, asset_id, "inventory_number", db_asset.inventory_number, asset_update.inventory_number, changed_by_username)
    log_asset_change(db, asset_id, "serial_number", db_asset.serial_number, asset_update.serial_number, changed_by_username)
    log_asset_change(db, asset_id, "location", db_asset.location, asset_update.location, changed_by_username)
    log_asset_change(db, asset_id, "user_name", db_asset.user_name, asset_update.user_name, changed_by_username)
    log_asset_change(db, asset_id, "status", db_asset.status, asset_update.status, changed_by_username)
    log_asset_change(db, asset_id, "model", db_asset.model, asset_update.model, changed_by_username)
    log_asset_change(db, asset_id, "type", db_asset.type, asset_update.type, changed_by_username)
    log_asset_change(db, asset_id, "motherboard", db_asset.motherboard, asset_update.motherboard, changed_by_username)
    log_asset_change(db, asset_id, "processor", db_asset.processor, asset_update.processor, changed_by_username)
    log_asset_change(db, asset_id, "ram", db_asset.ram, asset_update.ram, changed_by_username)
    log_asset_change(db, asset_id, "os_type", db_asset.os_type, asset_update.os_type, changed_by_username)
    log_asset_change(db, asset_id, "windows_key", db_asset.windows_key, asset_update.windows_key, changed_by_username)
    log_asset_change(db, asset_id, "comment", db_asset.comment, asset_update.comment, changed_by_username)
    log_asset_change(db, asset_id, "purchase_date", str(db_asset.purchase_date) if db_asset.purchase_date else None, str(asset_update.purchase_date) if asset_update.purchase_date else None, changed_by_username)
    log_asset_change(db, asset_id, "warranty_until", str(db_asset.warranty_until) if db_asset.warranty_until else None, str(asset_update.warranty_until) if asset_update.warranty_until else None, changed_by_username)
    log_asset_change(db, asset_id, "issue_date", str(db_asset.issue_date) if db_asset.issue_date else None, str(asset_update.issue_date) if asset_update.issue_date else None, changed_by_username)

    for key, value in asset_update.dict(exclude_unset=True).items():
        setattr(db_asset, key, value)
    
    db.commit()
    db.refresh(db_asset)
    return db_asset

def delete_asset(db: Session, asset_id: int, changed_by_username: str = None):
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return False
    
    # Логируем удаление
    log_asset_change(db, asset_id, "deleted", f"Актив удален: {db_asset.inventory_number}", None, changed_by_username)
    
    db.query(AssetHistory).filter(AssetHistory.asset_id == asset_id).delete()
    db.delete(db_asset)
    db.commit()
    return True

# --- Существующие модели и схемы (скопированы из schemas.py для поддержания контекста) ---
class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(UserLogin):
    is_admin: bool = False

class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool

    class Config:
        from_attributes = True

class AssetStatus(str, Enum):
    in_use = "в эксплуатации"
    repair = "на ремонте"
    retired = "списано"

class AssetType(str, Enum):
    monitor = "Монитор"
    computer = "Компьютер"
    laptop = "Ноутбук"
    other = "Прочее"

class AssetBase(BaseModel):
    inventory_number: str
    serial_number: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[date] = None
    warranty_until: Optional[date] = None
    status: Optional[AssetStatus] = None
    location: str
    user_name: Optional[str] = None
    motherboard: Optional[str] = None
    processor: Optional[str] = None
    ram: Optional[str] = None
    comment: Optional[str] = None
    type: Optional[AssetType] = None

class AssetCreate(AssetBase):
    pass

class AssetUpdate(AssetBase):
    pass

class AssetResponse(AssetBase):
    id: int

    class Config:
        from_attributes = True

