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

# --- История изменений (добавлено) ---
def log_asset_change(db: Session, asset_id: int, field: str, old_value: str, new_value: str):
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
        changed_at=date.today()
    )
    db.add(history_record)
    db.commit()
    db.refresh(history_record)

# --- Основные CRUD операции ---

def create_asset(db: Session, asset: AssetCreate):
    if get_asset_by_inventory_number(db, asset.inventory_number):
        raise HTTPException(status_code=400, detail="Актив с таким инвентарным номером уже существует")
    db_asset = Asset(**asset.dict())
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

def update_asset(db: Session, asset_id: int, asset_update: AssetUpdate):
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return False

    # Проверка на изменение серийного номера
    if asset_update.inventory_number and asset_update.inventory_number != db_asset.inventory_number:
        if get_asset_by_inventory_number(db, asset_update.inventory_number):
            raise HTTPException(status_code=400, detail="Инвентарный номер уже используется")

    # Логика перемещения (уже была)

    # Логируем изменения важных полей (добавлено)
    log_asset_change(db, asset_id, "inventory_number", db_asset.inventory_number, asset_update.inventory_number)
    log_asset_change(db, asset_id, "serial_number", db_asset.serial_number, asset_update.serial_number)
    log_asset_change(db, asset_id, "location", db_asset.location, asset_update.location)
    log_asset_change(db, asset_id, "user_name", db_asset.user_name, asset_update.user_name)

    for key, value in asset_update.dict(exclude_unset=True).items():
        setattr(db_asset, key, value)
    db.commit()
    db.refresh(db_asset)
    return db_asset

def delete_asset(db: Session, asset_id: int):
    db_asset = get_asset(db, asset_id)
    if not db_asset:
        return False
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

