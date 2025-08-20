# schemas.py
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
from enum import Enum

# --- Схемы для пользователей ---
class UserBase(BaseModel):
    username: str
    is_admin: bool = False

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(UserBase):
    password: str # Пароль обязателен при создании

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None # Пароль опционален при обновлении
    is_admin: Optional[bool] = None

    class Config:
        # Позволяет игнорировать поля, которые не установлены (None)
        extra = "forbid"

class UserInDB(UserBase):
    id: int
    password_hash: str

    class Config:
        from_attributes = True

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

# --- Схемы для активов ---
class AssetStatus(str, Enum):
    in_use = "в эксплуатации"
    repair = "на ремонте"
    retired = "списано"

class AssetType(str, Enum):
    monitor = "Монитор"
    computer = "Компьютер"
    laptop = "Ноутбук"
    other = "Прочее"

class AssetHistoryBase(BaseModel):
    asset_id: int
    field: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_at: date
    changed_by: Optional[str] = None

class AssetHistoryCreate(AssetHistoryBase):
    pass

class AssetHistoryResponse(AssetHistoryBase):
    id: int

    class Config:
        from_attributes = True

class AssetBase(BaseModel):
    inventory_number: str
    serial_number: Optional[str] = None
    model: Optional[str] = None
    type: str
    status: str = "в эксплуатации"
    location: str
    user_name: Optional[str] = None
    issue_date: Optional[date] = None
    purchase_date: Optional[date] = None
    warranty_until: Optional[date] = None
    motherboard: Optional[str] = None
    processor: Optional[str] = None
    ram: Optional[str] = None
    comment: Optional[str] = None
    windows_key: Optional[str] = None
    os_type: Optional[str] = None

# --- Схемы для записей о ремонте ---
class RepairRecordBase(BaseModel):
    repair_date: date
    description: str
    cost: Optional[str] = None # Или float, если в модели Numeric
    performed_by: Optional[str] = None

class RepairRecordCreate(RepairRecordBase):
    pass

class RepairRecordUpdate(RepairRecordBase):
    pass

class RepairRecordResponse(RepairRecordBase):
    id: int
    asset_id: int
    created_at: datetime

    class Config:
        from_attributes = True
# -----------------------------------

class DeletionLogBase(BaseModel):
    entity_type: str
    entity_id: int
    # entity_data: Optional[dict] = None # Можно использовать dict, Pydantic v2 поддерживает
    entity_data: Optional[str] = None # Или передавать как строку JSON
    deleted_by: str
    deleted_at: datetime
    reason: Optional[str] = None

class DeletionLogCreate(DeletionLogBase):
    pass

class DeletionLogResponse(DeletionLogBase):
    id: int

    class Config:
        from_attributes = True # Для совместимости с ORM

class AssetCreate(AssetBase):
    pass

class AssetUpdate(AssetBase):
    pass

class AssetResponse(AssetBase):
    id: int
    history: List[AssetHistoryResponse] = []
    repairs: List[RepairRecordResponse] = []

    class Config:
        from_attributes = True

