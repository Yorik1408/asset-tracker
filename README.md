# Asset Tracker — система учёта IT-оборудования

Веб-приложение для учёта компьютеров, ноутбуков, мониторов и другой техники. Отслеживает историю изменений, ремонты, гарантии, лицензии Windows и позволяет проводить инвентаризацию прямо со смартфона.

## Технологии

- Бэкенд: FastAPI (Python), SQLAlchemy, SQLite
- Фронтенд: React + Vite, Bootstrap 5
- Контейнеризация: Podman / Docker Compose
- Безопасность: JWT-авторизация, bcrypt-хэширование паролей

---

## Функциональность

### Учёт активов

- Добавление, редактирование, удаление активов
- Поля: инвентарный и серийный номер, модель, тип, статус, расположение, пользователь, процессор, RAM, тип и объём накопителя, ОС, материнская плата, ключ Windows, даты покупки/выдачи/гарантии, комментарий
- Инлайн-редактирование ячеек прямо в таблице (двойной клик)
- Цветовое кодирование возраста: до 1 года / 1–3 / 3–5 / старше 5 лет
- Возраст рассчитывается автоматически из даты покупки, либо задаётся вручную

### Фильтрация и поиск

- Полнотекстовый поиск по всем полям
- Фильтр по типу, статусу, возрасту, пользователю
- Быстрые кнопки: «Списано», «На гарантии», «Гарантия заканчивается»

### История изменений

- Автоматическая фиксация всех изменений: кто, когда, что было, что стало
- История раскрывается по клику прямо в таблице
- Включается в Excel-экспорт отдельным листом

### Ремонты

- Журнал ремонтов: дата, описание, стоимость, исполнитель
- Включается в Excel-экспорт отдельным листом

### Режим инвентаризации

- Запуск кнопкой «Инвентаризация» в панели инструментов
- Поиск активов по инв. №, модели, серийному номеру или расположению
- Поддержка USB-сканера штрихкодов: сканируй инвентарный номер — актив находится мгновенно
- При отметке «Найдено» можно сразу обновить ответственного пользователя
- Прогресс-бар: найдено X из Y
- Итоговый отчёт: найдено / не найдено / обновлено пользователей
- Сессия сохраняется в БД — можно свернуть и продолжить позже
- Адаптивный интерфейс для работы на смартфоне

### Отчёты

- **Гарантия** — активы с истекающей гарантией в ближайшие 30 дней
- **Windows** — все устройства с Windows: версия ОС, ключ лицензии, статус; инлайн-редактирование, копирование в буфер, экспорт в CSV

### QR-коды

- Генерация QR-кода для каждого актива (ссылка на карточку в приложении)
- Печать одного кода из карточки или массовая печать для всех ПК и ноутбуков

### Импорт и экспорт

- Экспорт в Excel — активы + история + ремонты с учётом текущих фильтров
- Импорт из Excel — создание и обновление активов (формат совпадает с экспортом)

### Управление пользователями

- Роли: Администратор / Обычный пользователь
- Администратор: полный доступ, создание пользователей, очистка БД
- Обычный пользователь: просмотр, поиск, фильтрация, экспорт
- Журнал удалений — история удалённых активов

### Интерфейс

- Светлая и тёмная тема
- Адаптивный дизайн: таблица на десктопе, карточки на мобильном
- PWA — устанавливается как приложение на iPhone и Android

---

## Развёртывание

### Требования

- Linux-сервер (AlmaLinux, RHEL, Debian, Ubuntu)
- Podman или Docker
- Git

### 1. Клонировать репозиторий

```bash
git clone https://gitlab.aspro.cloud/office/asset_tracker
cd asset-tracker
```

### 2. Создать файлы конфигурации

**`frontend/.env`**
```
VITE_API_URL=http://IP_СЕРВЕРА:8000
```

**`backend/.env`**
```
SECRET_KEY=сгенерированная_случайная_строка_32+_символа
TOKEN_EXPIRE_MINUTES=480
ALLOWED_ORIGINS=http://IP_СЕРВЕРА:5173,http://IP_СЕРВЕРА:8000
```

Сгенерировать `SECRET_KEY`:
```bash
openssl rand -hex 32
```

### 3. Открыть порты

```bash
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

### 4. Запустить через Podman

Установка:
```bash
# RHEL / AlmaLinux:
sudo dnf upgrade -y
sudo dnf install -y git podman
pip install --user podman-compose

# Debian / Ubuntu:
sudo apt update && sudo apt upgrade -y
sudo apt install -y git podman
pip install --user podman-compose
```

Запуск:
```bash
podman-compose up --build
```

### 4. Запустить через Docker (альтернатива)

```bash
# Установка (RHEL / AlmaLinux):
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker $USER
# Выйти и войти заново, затем:
docker compose up --build
```

### 5. Создать первого администратора

Открыть `http://IP_СЕРВЕРА:8000/docs`, выполнить `POST /users/`:
```json
{
  "username": "admin",
  "password": "надёжный_пароль",
  "is_admin": true
}
```

После создания первого пользователя эндпоинт закрывается — последующие пользователи создаются только через интерфейс под учётной записью администратора.

Приложение доступно по адресу: `http://IP_СЕРВЕРА:5173`

---

## Резервное копирование

Два варианта:

- **Ручной** — кнопка «Экспорт» скачивает Excel со всеми активами. Не включает пользователей и ремонты.
- **Автоматический** — скрипт копирует файл SQLite-базы локально и в облако через [rclone](https://rclone.org). Включает всё: активы, историю изменений, пользователей, ремонты, инвентаризации.

### Настройка автоматического резервного копирования в Google Drive

#### Шаг 1 — Установить rclone

```bash
curl https://rclone.org/install.sh | sudo bash
rclone version  # проверить установку
```

#### Шаг 2 — Авторизовать Google Drive

Этот шаг нужно выполнить **на компьютере с браузером** — rclone откроет страницу Google для входа. После авторизации конфиг копируется на сервер.

Запустить мастер настройки:
```bash
rclone config
```

Пройти диалог:
```
n) New remote
name> backup_asset-tracker          ← обязательно это имя — оно захардкожено в скрипте
Storage> drive                       ← выбрать Google Drive
client_id>                           ← Enter (оставить пустым)
client_secret>                       ← Enter (оставить пустым)
scope> 1                             ← Full access to all files
root_folder_id>                      ← Enter (оставить пустым)
service_account_file>                ← Enter (оставить пустым)
Edit advanced config> n
Use auto config> y                   ← браузер откроется, войти в нужный Google-аккаунт
Configure as Shared Drive> n
```

Если настройка выполняется удалённо (через SSH без браузера), выбрать `Use auto config> n` — rclone даст ссылку, которую нужно открыть в браузере на другом устройстве.

Скопировать конфиг на сервер:
```bash
scp ~/.config/rclone/rclone.conf user@IP_СЕРВЕРА:~/.config/rclone/rclone.conf
```

Проверить, что всё работает:
```bash
rclone lsd backup_asset-tracker:
```

#### Шаг 3 — Настроить скрипт

Открыть `scripts/backup_db.sh` и проверить блок переменных в начале файла:

| Переменная | Описание | Значение по умолчанию |
|---|---|---|
| `DB_FILE` | Путь к файлу SQLite-базы | `/home/server/asset-tracker/backend/test.db` |
| `BACKUP_DIR` | Папка для локальных копий | `/home/server/asset-tracker/backups` |
| `RCLONE_REMOTE` | Имя remote из rclone config | `backup_asset-tracker` |
| `RCLONE_PATH` | Папка внутри Google Drive | `db_backups` |
| `RETENTION_DAYS` | Сколько дней хранить в облаке | `7` |

Если пути на сервере отличаются — исправить `DB_FILE` и `BACKUP_DIR`.

Создать папку для локальных копий и протестировать скрипт:
```bash
mkdir -p /home/server/asset-tracker/backups
chmod +x /home/server/asset-tracker/scripts/backup_db.sh
/home/server/asset-tracker/scripts/backup_db.sh

# Проверить лог:
cat /home/server/asset-tracker/backups/backup.log

# Проверить, что файл появился в Google Drive:
rclone ls backup_asset-tracker:db_backups/
```

#### Шаг 4 — Добавить в cron

```bash
crontab -e
```

Добавить строку (запуск каждую ночь в 01:05):
```
5 1 * * * /home/server/asset-tracker/scripts/backup_db.sh
```

Проверить:
```bash
crontab -l
```

### Восстановление из резервной копии

```bash
# Посмотреть доступные копии:
rclone ls backup_asset-tracker:db_backups/

# Скачать нужную копию (имя файла из вывода выше):
rclone copyto "backup_asset-tracker:db_backups/20260625_010501_test.db" /tmp/restore.db

# Остановить контейнер, заменить БД, запустить:
podman stop asset-tracker-backend
cp /tmp/restore.db /home/server/asset-tracker/backend/test.db
podman start asset-tracker-backend
```

При переезде на новый сервер скопировать `~/.config/rclone/rclone.conf` — повторная авторизация не потребуется.

---

## Структура проекта

```
asset-tracker/
├── backend/
│   ├── main.py           # FastAPI endpoints
│   ├── models.py         # SQLAlchemy модели (активы, история, ремонты, инвентаризации)
│   ├── schemas.py        # Pydantic схемы
│   ├── crud.py           # Операции с БД
│   ├── database.py       # Подключение к БД
│   └── test.db           # SQLite база данных
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Основной компонент
│   │   └── TableStyles.css
│   ├── public/
│   │   └── manifest.json # PWA манифест
│   └── index.html
├── scripts/
│   └── backup_db.sh      # Скрипт резервного копирования
├── backups/              # Локальные резервные копии (создаётся автоматически)
├── docker-compose.yml
└── README.md
```
