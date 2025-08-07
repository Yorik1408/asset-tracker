# crud.py
import models
import schemas
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
from datetime import date
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Функции для работы с пользователями ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(
        username=user.username,
        password_hash=hashed_password,
        is_admin=user.is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None

    update_data = user_update.dict(exclude_unset=True)

    # Если передан новый пароль, хэшируем его
    if 'password' in update_data and update_data['password']:
        update_data['password_hash'] = pwd_context.hash(update_data.pop('password'))
    elif 'password' in update_data:
        # Если пароль передан как пустая строка или None, удаляем его из обновления
        update_data.pop('password', None)

    for key, value in update_data.items():
        setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

# --- Функции для работы с активами ---
def get_asset(db: Session, asset_id: int):
    return db.query(models.Asset).filter(models.Asset.id == asset_id).first()

def get_assets(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Asset).offset(skip).limit(limit).all()

def create_asset(db: Session, asset: schemas.AssetCreate, changed_by_username: str):
    # Создаем актив
    db_asset = models.Asset(**asset.dict())
    db.add(db_asset)
    try:
        db.commit()
        db.refresh(db_asset)

        # Создаем фиктивную "историю" для поля "created"
        history_entry = models.AssetHistory(
            asset_id=db_asset.id,
            field="created",
            old_value=None,
            new_value="Актив создан",
            changed_at=date.today(),
            changed_by=changed_by_username
        )
        db.add(history_entry)
        db.commit()

        return db_asset
    except IntegrityError as e:
        db.rollback()
        if "inventory_number" in str(e.orig):
             return None
        else:
             raise e

def _log_changes(db: Session, asset_id: int, old_values: dict, new_values: dict, changed_by_username: str, exclude_fields=None):
    """Вспомогательная функция для логирования изменений в истории."""
    if exclude_fields is None:
        exclude_fields = {'id'} # Не логируем ID

    changed_fields = set(old_values.keys()) & set(new_values.keys())
    for field in changed_fields:
        if field in exclude_fields:
            continue
        old_val = old_values.get(field)
        new_val = new_values.get(field)
        # Преобразуем даты в строки для сравнения и логирования, если нужно
        # Это помогает избежать проблем с типами при сравнении
        if isinstance(old_val, date):
            old_val = old_val.isoformat() if old_val else None
        if isinstance(new_val, date):
            new_val = new_val.isoformat() if new_val else None

        if old_val != new_val:
            history_entry = models.AssetHistory(
                asset_id=asset_id,
                field=field,
                old_value=str(old_val) if old_val is not None else None,
                new_value=str(new_val) if new_val is not None else None,
                changed_at=date.today(),
                changed_by=changed_by_username
            )
            db.add(history_entry)

def update_asset(db: Session, asset_id: int, asset_update: schemas.AssetUpdate, changed_by_username: str):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        return None

    # Сохраняем старые значения для истории
    old_values = {}
    for column in models.Asset.__table__.columns:
        old_values[column.name] = getattr(db_asset, column.name)

    # Обновляем актив
    update_data = asset_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_asset, key, value)

    try:
        db.commit()
        db.refresh(db_asset)

        # Создаем записи в истории об изменениях
        new_values = update_data # Только измененные поля
        _log_changes(db, db_asset.id, old_values, new_values, changed_by_username)
        db.commit()

        return db_asset
    except IntegrityError as e:
        db.rollback()
        if "inventory_number" in str(e.orig):
             return None
        else:
             raise e

def delete_asset(db: Session, asset_id: int, changed_by_username: str):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if db_asset:
        # --- Создаем запись в истории об удалении ---
        history_entry = models.AssetHistory(
            asset_id=db_asset.id,
            field="deleted",
            old_value="Актив удален",
            new_value=None,
            changed_at=date.today(),
            changed_by=changed_by_username
        )
        db.add(history_entry)

        db.delete(db_asset)
        db.commit()

        # Коммитим историю после удаления актива
        db.commit()
        return db_asset
    return None

