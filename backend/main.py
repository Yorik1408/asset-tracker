from fastapi import FastAPI, Depends, HTTPException, status, Response, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
import numpy as np
import pandas as pd
from urllib.parse import quote
from io import BytesIO
from sqlalchemy.orm import Session
from typing import List
import models
from database import engine, SessionLocal
from schemas import AssetResponse, AssetCreate, AssetUpdate, UserLogin, UserCreate, UserResponse
from crud import get_asset, get_assets, create_asset, update_asset, delete_asset

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
    return str(val).strip() if str(val).strip() != "" else None

# Простая проверка пользователя (в реальном приложении используйте хэширование)
fake_users_db = {
    "admin": {"username": "admin", "password": "secret", "is_admin": True},
}

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user_dict = fake_users_db.get(form_data.username)
    if not user_dict or user_dict["password"] != form_data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"access_token": f"token_{form_data.username}", "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(token: str = Depends(oauth2_scheme)):
    username = token.replace("token_", "", 1)
    user_dict = fake_users_db.get(username)
    if not user_dict:
        raise HTTPException(status_code=401, detail="Неавторизован")
    return UserResponse(id=1, username=user_dict["username"], is_admin=user_dict["is_admin"])
# Роуты для активов

# 🔍 Все могут читать
@app.get("/assets/", response_model=List[AssetResponse])
def read_assets(skip: int = 0, limit: int = 5000, db: Session = Depends(get_db)):
    return get_assets(db, skip=skip, limit=limit)

@app.get("/assets/{asset_id}", response_model=AssetResponse)
def read_asset(asset_id: int, db: Session = Depends(get_db)):
    db_asset = get_asset(db, asset_id=asset_id)
    if not db_asset:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return db_asset

# ✏️ Только админы могут создавать
@app.post("/assets/", response_model=AssetResponse, status_code=201)
def create_new_asset(asset: AssetCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    username = token.replace("token_", "", 1)
    if username not in fake_users_db or not fake_users_db[username]["is_admin"]:
        raise HTTPException(status_code=403, detail="Нет прав на создание актива")
    return create_asset(db=db, asset=asset)

# 📝 Только админы могут редактировать
@app.put("/assets/{asset_id}", response_model=AssetResponse)
def update_existing_asset(asset_id: int, asset_update: AssetUpdate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    username = token.replace("token_", "", 1)
    if username not in fake_users_db or not fake_users_db[username]["is_admin"]:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование")
    updated = update_asset(db, asset_id, asset_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return updated

# ❌ Только админы могут удалять
@app.delete("/assets/{asset_id}")
def delete_existing_asset(asset_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    username = token.replace("token_", "", 1)
    if username not in fake_users_db or not fake_users_db[username]["is_admin"]:
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    deleted = delete_asset(db, asset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Актив не найден")
    return {"detail": "Актив удален"}

# Экспорт в эксель
@app.get("/export/excel")
def export_to_excel(db: Session = Depends(get_db)):
    # Получаем все активы
    assets = db.query(models.Asset).all()
    
    # Преобразуем в список словарей
    data = []
    for asset in assets:
        data.append({
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
            "Комментарий": asset.comment
        })
    
    # Создаём DataFrame
    df = pd.DataFrame(data)
    
    # Сохраняем в буфер
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="Активы")
    
    buffer.seek(0)
    filename = "активы.xlsx"
    encoded_filename = quote(filename)    
    return StreamingResponse(
        buffer,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )

#Импорт из экселя
@app.post("/import/excel")
def import_from_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате .xlsx")

    try:
        contents = file.file.read()
        df = pd.read_excel(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка чтения файла: {str(e)}")

    # Проверяем обязательные столбцы
    required_columns = ["Инвентарный номер", "Расположение", "Тип"]
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Отсутствует столбец: {col}")

    imported = 0
    errors = []

    for index, row in df.iterrows():
        try:
            # Проверяем обязательные поля
            inv_num = str(row["Инвентарный номер"]).strip()
            location = str(row["Расположение"]).strip()
            asset_type = str(row["Тип"]).strip()

            if not inv_num or not location or not asset_type:
                errors.append(f"Строка {index+2}: пустое обязательное поле")
                continue

            # Проверяем, существует ли уже актив
            existing = db.query(models.Asset).filter(models.Asset.inventory_number == inv_num).first()

            # Подготовка данных
            data = {
 	        "inventory_number": str(row["Инвентарный номер"]).strip(),
                "serial_number": clean_value(row.get("Серийный номер")),
                "model": clean_value(row.get("Модель")),
                "type": str(row["Тип"]).strip(),
                "status": clean_value(row.get("Статус")) or "в эксплуатации",
                "location": str(row["Расположение"]).strip(),
                "user_name": clean_value(row.get("ФИО пользователя")),
                "issue_date": pd.to_datetime(row.get("Дата выдачи")).date() if pd.notna(row.get("Дата выдачи")) else None,
                "purchase_date": pd.to_datetime(row.get("Дата покупки")).date() if pd.notna(row.get("Дата покупки")) else None,
                "warranty_until": pd.to_datetime(row.get("Гарантия до")).date() if pd.notna(row.get("Гарантия до")) else None,
                "motherboard": clean_value(row.get("Мат. плата")),
                "processor": clean_value(row.get("Процессор")),
                "ram": clean_value(row.get("ОЗУ")),
                "comment": clean_value(row.get("Комментарий"))
            }

            if existing:
                # Обновляем
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                # Создаём новый
                new_asset = models.Asset(**data)
                db.add(new_asset)

            imported += 1
        except Exception as e:
            errors.append(f"Строка {index+2}: {str(e)}")

    db.commit()

    return {
        "detail": f"Импорт завершён: {imported} активов",
        "errors": errors
    }
