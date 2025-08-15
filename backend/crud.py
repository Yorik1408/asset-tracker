# crud.py
import models
import schemas
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
from datetime import date
from typing import Optional, List

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

def _log_changes(db: Session, asset_id: int, old_values: dict, update_data: dict, changed_by: str):
    """
    Создает записи в истории изменений ТОЛЬКО для полей, присутствующих в update_data.

    Args:
        db: Сессия SQLAlchemy.
        asset_id: ID актива.
        old_values: Словарь {имя_поля: старое_значение} для ВСЕХ полей.
        update_data: Словарь {имя_поля: новое_значение} ТОЛЬКО для ИЗМЕНЕННЫХ полей.
        changed_by: Имя пользователя, внесшего изменения.
    """
    # Итерируемся ТОЛЬКО по измененным полям
    for field_name, new_value in update_data.items():
        # Получаем старое значение для этого поля
        old_value = old_values.get(field_name)

        # --- ЛОГИКА СРАВНЕНИЯ ---
        # Функция для "мягкого" сравнения значений, считая None и "" равными
        def values_are_equal(v1, v2):
            if (v1 is None or v1 == "") and (v2 is None or v2 == ""):
                return True
            # Для дат можно добавить: isinstance(v1, date) and isinstance(v2, date) and v1 == v2
            return v1 == v2
        # -----------------------

        # Проверяем, действительно ли значение изменилось
        if not values_are_equal(old_value, new_value):
            # Преобразуем значения в строки для хранения, если они не None
            # Это важно для согласованности и отображения в Excel/на фронте
            stored_old_value = str(old_value) if old_value is not None else None
            stored_new_value = str(new_value) if new_value is not None else None

            # Создаем и добавляем запись истории
            history_entry = models.AssetHistory(
                asset_id=asset_id,
                field=field_name,
                old_value=stored_old_value,
                new_value=stored_new_value,
                changed_at=date.today(), # Или datetime.utcnow().date()
                changed_by=changed_by
            )
            db.add(history_entry)
            print(f"[HISTORY LOGGED] Asset {asset_id}: {field_name} changed from '{stored_old_value}' to '{stored_new_value}' by '{changed_by}'") # Для отладки
        else:
            # Значения фактически не изменились, пропускаем
            print(f"[NO CHANGE SKIPPED] Asset {asset_id}: {field_name} was effectively unchanged ('{old_value}' == '{new_value}')") # Для отладки

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
# --------------------------------------------

