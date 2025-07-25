# Система учёта оборудования - Asset Tracker

Полноценная веб-система для учёта компьютеров, ноутбуков, мониторов и другой техники.

## 🛠 Технологии
- Бэкенд: FastAPI (Python)
- Фронтенд: React
- БД: SQLite / PostgreSQL
- Авторизация: JWT

## 🚀 Возможности
- Добавление и редактирование активов
- История изменений и перемещений
- Поиск и фильтрация
- Модальные окна
- Админ-панель для добавления и редактирования, не авторизированный пользователь имеет право только на просмотр
- Возможность экспорта\импорта в\из эксель файла, приложение чувствительно к формату внутри экселя, смотри пример правильно заполненного эксель файла в репозитории "активы.xlsx"

## 📦 Развертка на сервере AlmaLinux (или любой RedHat дистрибутив)
## Обнови систему и установи базовые инструменты
```
sudo dnf update -y
sudo dnf install -y epel-release
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y git curl wget vim
```
## Установи Python 3.9
```
sudo dnf install -y python39 python39-pip python39-devel
```
## Установи Node.js 18
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x  | sudo bash -
sudo dnf install -y nodejs
```
## Создай папку проекта и склонируй репозиторий
```
cd /home
sudo mkdir server
sudo chown $USER:$USER server
cd server
git clone https://github.com/Yorik1408/asset-tracker.git 
cd asset-tracker
```
## Настрой бэкенд
```
cd backend
python3.9 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
## Настрой фронтенд
```
cd ../frontend
npm install
npm run build  # Сборка для production
```

## 📦 Запуск из двух консолей
```bash
# Бэкенд
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Фронтенд
cd frontend && npm run dev
