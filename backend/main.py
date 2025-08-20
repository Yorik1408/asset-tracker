# main.py
from fastapi import FastAPI, Depends, HTTPException, status, Response, UploadFile, File, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
import numpy as np
import pandas as pd
from datetime import date, timedelta, datetime
from urllib.parse import quote
from io import BytesIO
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from typing import List, Optional
import models
from database import engine, SessionLocal
import schemas
from schemas import AssetResponse, AssetCreate, AssetUpdate, UserLogin, UserCreate, UserResponse, UserUpdate, RepairRecordCreate, RepairRecordUpdate, RepairRecordResponse
from crud import (
    get_asset, get_assets, create_asset, update_asset, delete_asset,
    get_user_by_username, create_user, get_user, get_users, update_user, delete_user,
    get_repair_records, create_repair_record, update_repair_record, delete_repair_record,
    get_deletion_logs
)
from passlib.context import CryptContext

# Создаем таблицы в БД
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Подключение CORS
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Схема OAuth2 для токена
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

# Контекст для хэширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Dependency для получения БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def clean_value(val):
    if pd.isna(val) or val is None:
        return None
    return str(val).strip()

# Функция для извлечения имени пользователя из токена
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token.startswith("token_"):
        raise HTTPException(status_code=401, detail="Неверный формат токена")
    username = token.replace("token_", "", 1)
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=401, detail="Неавторизован")
    return user

# Зависимости для проверки прав администратора
def get_current_active_user(current_user: models.User = Depends(get_current_user)):
    return current_user

def get_current_active_admin(current_user: models.User = Depends(get_current_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    return current_user

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user_by_username(db, form_data.username)
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"access_token": f"token_{form_data.username}", "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: models.User = Depends(get_current_active_user)):
    return UserResponse(id=current_user.id, username=current_user.username, is_admin=current_user.is_admin)

# Эндпоинты для управления пользователями
@app.get("/users/", response_model=List[UserResponse])
def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin) # Только для админов
):
    users = get_users(db, skip=skip, limit=limit)
    return users

@app.post("/users/", response_model=UserResponse, status_code=201)
def create_new_user(user: UserCreate, db: Session = Depends(get_db)):
    # Проверим, существует ли уже пользователь с таким именем
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")
    # Создаем пользователя через crud
    created_user = create_user(db=db, user=user)
    # Возвращаем созданного пользователя (без пароля!)
    return created_user

@app.put("/users/{user_id}", response_model=UserResponse)
def update_existing_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin) # Только для админов
):
    db_user = get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Проверка уникальности нового имени пользователя
    if user_update.username and user_update.username != db_user.username:
        existing_user = get_user_by_username(db, username=user_update.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")

    updated_user = update_user(db, user_id, user_update)
    return updated_user

@app.delete("/users/{user_id}")
def delete_existing_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin) # Только для админов
):
    db_user = get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    # Запретить удаление самого себя
    if db_user.id == current_user.id:
         raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    delete_user(db, user_id)
    return {"detail": "Пользователь удален"}

# Роуты для активов
@app.get("/assets/", response_model=List[AssetResponse])
def read_assets(skip: int = 0, limit: int = 5000, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)): # <-- Добавлен Depends для токена
    return get_assets(db, skip=skip, limit=limit)

@app.get("/assets/{asset_id}", response_model=AssetResponse)
def read_asset(asset_id: int, db: Session = Depends(get_db)):
    db_asset = get_asset(db, asset_id=asset_id)
    if not db_asset:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return db_asset

# олько админы могут создавать
@app.post("/assets/", response_model=AssetResponse, status_code=201)
def create_new_asset(asset: AssetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_admin)):
    # ... проверка прав ...

    # Передаем имя пользователя из зависимости current_user
    created_asset = create_asset(db=db, asset=asset, changed_by_username=current_user.username) 

    if created_asset is None:
        raise HTTPException(status_code=400, detail="Актив с таким инвентарным номером уже существует")

    return created_asset

# Только админы могут редактировать
@app.put("/assets/{asset_id}", response_model=AssetResponse)
def update_existing_asset(
    asset_id: int,
    asset_update: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
):
    updated = update_asset(db, asset_id, asset_update, changed_by_username=current_user.username)
    if not updated:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return updated

# Только админы могут удалять
@app.delete("/assets/{asset_id}")
def delete_existing_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
):
    deleted = delete_asset(db, asset_id, changed_by_username=current_user.username)
    if not deleted:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return {"detail": "Актив удален"}

@app.get("/admin/deletion-log/", response_model=List[schemas.DeletionLogResponse]) # Создайте схему DeletionLogResponse
def read_deletion_log(
    skip: int = 0,
    limit: int = 100,
    entity_type: Optional[str] = None, # Опциональный фильтр по типу
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin) # Только админы
):
    """
    Получает журнал удалений.

    Args:
        skip: Сколько записей пропустить.
        limit: Максимальное количество записей.
        entity_type: (Опционально) Фильтр по типу сущности (например, "Asset").
        db: Сессия БД.
        current_user: Текущий пользователь (должен быть админом).

    Returns:
        Список записей из журнала удалений.
    """
    logs = get_deletion_logs(db, skip=skip, limit=limit, entity_type=entity_type)
    return logs

# Экспорт в эксель
@app.get("/export/excel")
def export_to_excel(
    type: Optional[str] = None,
    q: Optional[str] = None,
    warranty_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Формируем запрос с фильтрацией
    # Используем joinedload для предварительной загрузки связанных данных (repairs, history)
    # Это уменьшает количество запросов к БД
    query = db.query(models.Asset).options(joinedload(models.Asset.repairs), joinedload(models.Asset.history))

    # Фильтр по типу
    if type and type in ["Монитор", "Компьютер", "Ноутбук", "Прочее"]:
        query = query.filter(models.Asset.type == type)

    # Поиск по тексту
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                models.Asset.inventory_number.ilike(search),
                models.Asset.serial_number.ilike(search),
                models.Asset.model.ilike(search),
                models.Asset.location.ilike(search),
                models.Asset.user_name.ilike(search),
                models.Asset.comment.ilike(search),
            )
        )

    # Логика фильтрации по гарантии
    if warranty_status:
        today = date.today()
        if warranty_status == "active":
            # На гарантии: дата окончания позже сегодня и поле не NULL
            query = query.filter(
                and_(
                    models.Asset.warranty_until.isnot(None),
                    models.Asset.warranty_until > today
                )
            )
        elif warranty_status == "expiring":
            # Гарантия заканчивается: дата окончания в ближайшие 30 дней (включая сегодня) и поле не NULL
            threshold = today + timedelta(days=30)
            query = query.filter(
                and_(
                    models.Asset.warranty_until.isnot(None),
                    models.Asset.warranty_until >= today,
                    models.Asset.warranty_until <= threshold
                )
            )

    # Выполняем запрос с предварительно загруженными данными
    assets = query.all()

    # Основные данные активов
    asset_data = []
    # Данные об истории изменений
    history_data = []
    # Данные о ремонтах
    repair_data = [] # <-- НОВОЕ

    for asset in assets:
        asset_data.append({
            "ID": asset.id,
            "Инвентарный номер": asset.inventory_number,
            "Серийный номер": asset.serial_number,
            "Модель": asset.model,
            "Тип": asset.type,
            "Статус": asset.status,
            "Расположение": asset.location,
            "ФИО пользователя": asset.user_name,
            "Дата выдачи": asset.issue_date,
            "Дата покупки": asset.purchase_date,
            "Гарантия до": asset.warranty_until,
            "Мат. плата": asset.motherboard,
            "Процессор": asset.processor,
            "ОЗУ": asset.ram,
            "Комментарий": asset.comment,
            "Ключ Windows": asset.windows_key,
            "Тип ОС": asset.os_type
        })
        # Добавляем историю изменений
        # Так как мы использовали joinedload, asset.history уже загружены
        for h in asset.history:
            history_data.append({
                "Asset ID": asset.id,
                "Инвентарный номер": asset.inventory_number,
                "Поле": h.field,
                "Старое значение": h.old_value,
                "Новое значение": h.new_value,
                "Дата изменения": h.changed_at,
                "Изменено пользователем": h.changed_by or "Неизвестно"
            })
        # Добавляем данные о ремонтах <-- НОВОЕ
        # Так как мы использовали joinedload, asset.repairs уже загружены
        for r in asset.repairs:
            repair_data.append({
                "Asset ID": asset.id,
                "Инвентарный номер": asset.inventory_number,
                "Дата ремонта": r.repair_date,
                "Описание работ": r.description,
                "Стоимость": r.cost,
                "Кто выполнил": r.performed_by,
                # "Следующее ТО": r.next_service_due, # Удалено, как вы просили
                "Дата создания записи": r.created_at
            })
        # ----------------------------------

    # Создаём Excel с ТРЕМЯ листами <-- ИЗМЕНЕНО
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Лист 1: Активы
        pd.DataFrame(asset_data).to_excel(writer, index=False, sheet_name="Активы")

        # Лист 2: История изменений
        if history_data:
            pd.DataFrame(history_data).to_excel(writer, index=False, sheet_name="История изменений")
        else:
            # Если истории нет, создаём пустой лист с заголовками
            pd.DataFrame(columns=[
                "Asset ID", "Инвентарный номер", "Поле", "Старое значение",
                "Новое значение", "Дата изменения", "Изменено пользователем"
            ]).to_excel(writer, index=False, sheet_name="История изменений")

        # Лист 3: Ремонты <-- НОВОЕ
        if repair_data:
            pd.DataFrame(repair_data).to_excel(writer, index=False, sheet_name="Ремонты")
        else:
            # Если ремонтов нет, создаём пустой лист с заголовками
            pd.DataFrame(columns=[
                "Asset ID", "Инвентарный номер", "Дата ремонта", "Описание работ",
                "Стоимость", "Кто выполнил", "Дата создания записи" # "Следующее ТО" удалено
            ]).to_excel(writer, index=False, sheet_name="Ремонты")
        # --------------------------

    buffer.seek(0)
    # Обновлено имя файла для отражения нового содержимого <-- НОВОЕ
    filename = "активы_с_историей_и_ремонтами.xlsx" 
    encoded_filename = quote(filename)
    return StreamingResponse(
        buffer,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

#Импорт из экселя
@app.post("/import/excel")
def import_from_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
):
    # Проверка прав уже включена в зависимость current_user
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате .xlsx")
    try:
        contents = file.file.read()
        df_assets = pd.read_excel(BytesIO(contents), sheet_name="Активы")
        # Попробуем прочитать лист "История"
        try:
            df_history = pd.read_excel(BytesIO(contents), sheet_name="История изменений")
            has_history = True
        except:
            has_history = False
            df_history = pd.DataFrame()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка чтения файла: {str(e)}")
    imported = 0
    errors = []
    # Сначала импортируем активы
    for index, row in df_assets.iterrows():
        try:
            inv_num = str(row["Инвентарный номер"]).strip()
            location = str(row["Расположение"]).strip()
            asset_type = str(row["Тип"]).strip()
            if not inv_num or not location or not asset_type:
                errors.append(f"Строка {index+2}: пустое обязательное поле")
                continue
            data = {
                "inventory_number": clean_value(row.get("Инвентарный номер")),
                "serial_number": clean_value(row.get("Серийный номер")),
                "model": clean_value(row.get("Модель")),
                "type": clean_value(row.get("Тип")) or "Компьютер",
                "status": clean_value(row.get("Статус")) or "в эксплуатации",
                "location": clean_value(row.get("Расположение")),
                "user_name": clean_value(row.get("ФИО пользователя")),
                "issue_date": pd.to_datetime(row.get("Дата выдачи")).date() if pd.notna(row.get("Дата выдачи")) else None,
                "purchase_date": pd.to_datetime(row.get("Дата покупки")).date() if pd.notna(row.get("Дата покупки")) else None,
                "warranty_until": pd.to_datetime(row.get("Гарантия до")).date() if pd.notna(row.get("Гарантия до")) else None,
                "motherboard": clean_value(row.get("Мат. плата")),
                "processor": clean_value(row.get("Процессор")),
                "ram": clean_value(row.get("ОЗУ")),
                "comment": clean_value(row.get("Комментарий")),
                "windows_key": clean_value(row.get("Ключ Windows")),
                "os_type": clean_value(row.get("Тип ОС"))
            }
            existing = db.query(models.Asset).filter(models.Asset.inventory_number == inv_num).first()
            if existing:
                # Обновляем
                for k, v in data.items():
                    setattr(existing, k, v)
                db_asset = existing
            else:
                # Создаём новый
                db_asset = models.Asset(**data)
                db.add(db_asset)
            db.flush()  # Чтобы получить ID
            imported += 1
        except Exception as e:
            errors.append(f"Строка {index+2} (актив): {str(e)}")
    # Сохраняем, чтобы получить ID
    db.commit()
    # Теперь импортируем историю изменений
    if has_history and not df_history.empty:
        for index, row in df_history.iterrows():
            try:
                inv_num = str(row["Инвентарный номер"]).strip()
                asset = db.query(models.Asset).filter(models.Asset.inventory_number == inv_num).first()
                if not asset:
                    errors.append(f"Строка {index+2} (история): актив с инв. номером {inv_num} не найден")
                    continue
                history_data = {
                    "asset_id": asset.id,
                    "field": str(row["Поле"]).strip(),
                    "old_value": str(row["Старое значение"]).strip() if pd.notna(row["Старое значение"]) else None,
                    "new_value": str(row["Новое значение"]).strip() if pd.notna(row["Новое значение"]) else None,
                    "changed_at": pd.to_datetime(row["Дата изменения"]).date(),
                    "changed_by": str(row["Изменено пользователем"]).strip() if pd.notna(row["Изменено пользователем"]) else None
                }
                # Проверяем, нет ли уже такой записи
                existing_history = db.query(models.AssetHistory).filter(
                    models.AssetHistory.asset_id == asset.id,
                    models.AssetHistory.field == history_data["field"],
                    models.AssetHistory.old_value == history_data["old_value"],
                    models.AssetHistory.new_value == history_data["new_value"],
                    models.AssetHistory.changed_at == history_data["changed_at"]
                ).first()
                if not existing_history:
                    history = models.AssetHistory(**history_data)
                    db.add(history)
            except Exception as e:
                errors.append(f"Строка {index+2} (история): {str(e)}")
    db.commit()
    return {
        "detail": f"Импорт завершён: {imported} активов",
        "errors": errors
    }

@app.post("/admin/clear-db")
def clear_database(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
):
    # Проверка прав уже включена в зависимость current_user
    deleted = db.query(models.Asset).delete()
    db.commit()
    return {"message": f"✅ База очищена: удалено {deleted} активов"}

# --- Эндпоинты для записей о ремонте ---
# Получить все записи о ремонте для актива
@app.get("/assets/{asset_id}/repairs/", response_model=List[schemas.RepairRecordResponse])
def read_asset_repairs(asset_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_admin)):
    asset = get_asset(db, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return get_repair_records(db, asset_id)

# Создать запись о ремонте для актива
@app.post("/assets/{asset_id}/repairs/", response_model=schemas.RepairRecordResponse, status_code=201)
def create_asset_repair(asset_id: int, record: schemas.RepairRecordCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_admin)):
    asset = get_asset(db, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return create_repair_record(db, asset_id, record)

# Обновить запись о ремонте
@app.put("/repairs/{record_id}", response_model=schemas.RepairRecordResponse)
def update_repair(record_id: int, record_update: schemas.RepairRecordUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_admin)):
    updated_record = update_repair_record(db, record_id, record_update)
    if not updated_record:
        raise HTTPException(status_code=404, detail="Запись о ремонте не найдена")
    return updated_record

# Удалить запись о ремонте
@app.delete("/repairs/{record_id}")
def delete_repair(record_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_admin)):
    deleted = delete_repair_record(db, record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Запись о ремонте не найдена")
    return {"detail": "Запись о ремонте удалена"}
# ---------------------------------------
