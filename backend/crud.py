# crud.py
import models
from models import AssetHistory
import schemas
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
from datetime import date, datetime
from typing import Optional, List
import json

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
    """
    Вспомогательная функция для логирования изменений в истории.
    Сравнивает только те поля, которые присутствуют в new_values.
    Считает None и пустую строку эквивалентными.
    """
    if exclude_fields is None:
        exclude_fields = {'id'} # Не логируем ID

    # --- ИТЕРИРУЕМСЯ ТОЛЬКО ПО ИЗМЕНЕННЫМ ПОЛЯМ ---
    # new_values содержит только те поля, которые нужно проверить
    for field_name, new_value in new_values.items():
        # -----------------------------------------
        if field_name in exclude_fields:
            continue
            
        # Получаем старое значение для этого конкретного поля
        old_value = old_values.get(field_name)

        # --- УЛУЧШЕННАЯ ЛОГИКА СРАВНЕНИЯ ---
        def values_are_equal(v1, v2):
            """Считаем None и пустую строку эквивалентными."""
            # Приводим оба значения к строке для сравнения, считая None == ""
            s1 = str(v1) if v1 is not None else ""
            s2 = str(v2) if v2 is not None else ""
            return s1 == s2

        # Сравниваем с учетом None/""
        if not values_are_equal(old_value, new_value):
            # Преобразуем значения для сохранения в БД
            # Сохраняем как строки, None -> None
            stored_old_value = str(old_value) if old_value is not None else None
            stored_new_value = str(new_value) if new_value is not None else None

            history_entry = models.AssetHistory(
                asset_id=asset_id,
                field=field_name, # <-- Имя поля
                old_value=stored_old_value, # <-- Старое значение (строка или None)
                new_value=stored_new_value, # <-- Новое значение (строка или None)
                changed_at=date.today(),
                changed_by=changed_by_username
            )
            db.add(history_entry)

def update_asset(db: Session, asset_id: int, asset_update: schemas.AssetUpdate, changed_by_username: str):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        return None

    # 1. Сохраняем ВСЕ старые значения для потенциальной истории
    old_values = {}
    for column in models.Asset.__table__.columns:
        old_values[column.name] = getattr(db_asset, column.name)

    # 2. Получаем только те данные, которые нужно обновить (исключая неустановленные)
    update_data = asset_update.dict(exclude_unset=True)

    # 3. Применяем изменения к объекту SQLAlchemy (но еще не коммитим)
    for key, value in update_data.items():
        setattr(db_asset, key, value)

    try:
        # 4. Коммитим изменения в БД
        db.commit()
        db.refresh(db_asset) # Обновляем объект из БД

        # 5. --- ИСПРАВЛЕНИЕ ---
        # Вместо того чтобы передавать все old_values и каким-то образом вычислять "новые" значения,
        # мы передаем ТОЛЬКО те пары (поле, новое_значение), которые действительно изменились.
        # update_data уже содержит именно эти пары!
        # _log_changes теперь знает, что нужно записывать историю ТОЛЬКО для полей из update_data.
        _log_changes(db, db_asset.id, old_values, update_data, changed_by_username)
        # --------------------

        # 6. Финальный коммит для записей истории (если _log_changes их добавил через db.add)
        db.commit()

        return db_asset
    except IntegrityError as e:
        db.rollback()
        # Логируем или обрабатываем ошибку уникальности
        print(f"IntegrityError in update_asset: {e}") # Для отладки
        if "inventory_number" in str(e.orig):
            # Можно вернуть специальную ошибку или просто None
            return None # Указывает, что обновление не удалось из-за дубликата инв. номера
        else:
            # Если другая ошибка уникальности, пробрасываем её
            raise e
    except Exception as e:
        # Ловим любые другие ошибки, откатываем транзакцию и логируем
        db.rollback()
        print(f"Unexpected error in update_asset: {e}") # Для отладки
        raise e # Пробрасываем, чтобы вызывающая сторона могла обработать

# --- Функции для работы с журналом удалений ---
def log_deletion(db: Session, entity_type: str, entity_id: int, deleted_by: str, entity_data: dict = None, reason: str = None):
    """
    Записывает информацию об удалении в журнал.

    Args:
        db: Сессия SQLAlchemy.
        entity_type: Тип удаляемой сущности (например, "Asset", "User").
        entity_id: ID удаляемой сущности.
        deleted_by: Имя пользователя, выполнившего удаление.
        entity_data: (Опционально) Словарь с данными сущности на момент удаления.
        reason: (Опционально) Причина удаления.
    """
    # Преобразуем entity_data в JSON-строку, если она передана
    serialized_data = json.dumps(entity_data, ensure_ascii=False, default=str) if entity_data else None

    db_log = models.DeletionLog(
        entity_type=entity_type,
        entity_id=entity_id,
        entity_data=serialized_data, # Может быть None
        deleted_by=deleted_by,
        deleted_at=datetime.utcnow(),
        reason=reason # Может быть None
    )
    db.add(db_log)
    # Не коммитим здесь, пусть вызывающая функция делает это
    # Это позволяет включить запись в лог в ту же транзакцию, что и само удаление


def get_deletion_logs(db: Session, skip: int = 0, limit: int = 100, entity_type: str = None):
    """
    Получает записи из журнала удалений.

    Args:
        db: Сессия SQLAlchemy.
        skip: Сколько записей пропустить (для пагинации).
        limit: Максимальное количество записей для получения.
        entity_type: (Опционально) Фильтр по типу сущности.

    Returns:
        Список записей models.DeletionLog.
    """
    query = db.query(models.DeletionLog)
    if entity_type:
        query = query.filter(models.DeletionLog.entity_type == entity_type)
    # Сортируем по времени удаления, от новых к старым
    return query.order_by(models.DeletionLog.deleted_at.desc()).offset(skip).limit(limit).all()

# ---------------------------------------------
def delete_asset(db: Session, asset_id: int, changed_by_username: str): # Убедитесь, что аргумент есть
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if db_asset:
        # --- Подготовка данных для лога ---
        # Создаем копию данных актива перед удалением
        asset_data_to_log = {
            "id": db_asset.id,
            "inventory_number": db_asset.inventory_number,
            "serial_number": db_asset.serial_number,
            "model": db_asset.model,
            "type": db_asset.type,
            "status": db_asset.status,
            "location": db_asset.location,
            "user_name": db_asset.user_name,
        }
        # -------------------------------

        # --- УДАЛЕНИЕ АКТИВА ---
        db.delete(db_asset)
        # ----------------------

        # --- ЗАПИСЬ В ЖУРНАЛ УДАЛЕНИЙ ---
        # Передаем данные актива в функцию логирования
        log_deletion(
            db,
            entity_type=db_asset.type,
            entity_id=asset_id,
            deleted_by=changed_by_username,
            entity_data=asset_data_to_log, # Передаем данные
            reason=None # Или добавьте поле reason в UI и передавайте сюда
        )
        # --------------------------------

        db.commit()
        return db_asset # Возвращаем удаленный актив (данные все еще доступны в объекте)
    return None

# --- Функции для работы с записями о ремонте ---
def get_repair_records(db: Session, asset_id: int) -> List[models.RepairRecord]:
    return db.query(models.RepairRecord).filter(models.RepairRecord.asset_id == asset_id).all()

def get_repair_record(db: Session, record_id: int) -> Optional[models.RepairRecord]:
    return db.query(models.RepairRecord).filter(models.RepairRecord.id == record_id).first()

def create_repair_record(db: Session, asset_id: int, record: schemas.RepairRecordCreate) -> models.RepairRecord:
    db_record = models.RepairRecord(
        asset_id=asset_id,
        **record.dict()
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

def update_repair_record(db: Session, record_id: int, record_update: schemas.RepairRecordUpdate) -> Optional[models.RepairRecord]:
    db_record = get_repair_record(db, record_id)
    if not db_record:
        return None
    update_data = record_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_record, key, value)
    db.commit()
    db.refresh(db_record)
    return db_record

def delete_repair_record(db: Session, record_id: int) -> bool:
    db_record = get_repair_record(db, record_id)
    if db_record:
        db.delete(db_record)
        db.commit()
        return True
    return False



