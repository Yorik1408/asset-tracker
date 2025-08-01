from pydantic import BaseModel
from datetime import date
from typing import Optional, List
from enum import Enum

# Для входа
class UserLogin(BaseModel):
    username: str
    password: str

# Для регистрации
class UserCreate(UserLogin):
    is_admin: bool = False

# Ответ сервера
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

class AssetHistoryBase(BaseModel):
    asset_id: int
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_at: date
    # --- Новое поле ---
    changed_by: Optional[str] = None
    # ------------------

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

class AssetCreate(AssetBase):
    pass

class AssetUpdate(AssetBase):
    pass

class AssetResponse(AssetBase):
    id: int
    history: List[AssetHistoryResponse] = []

    class Config:
        from_attributes = True

