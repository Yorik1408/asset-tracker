#!/bin/bash

# --- Настройки ---
DB_FILE="/home/server/asset-tracker/backend/test.db"
BACKUP_DIR="/home/server/asset-tracker/backups"
RCLONE_REMOTE="backup_asset-tracker" # Имя удаленного хранилища из rclone config
RCLONE_PATH="db_backups"            # Путь внутри удаленного хранилища (будет создан автоматически)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="${TIMESTAMP}_test.db"
LOCAL_BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
REMOTE_BACKUP_PATH="${RCLONE_REMOTE}:${RCLONE_PATH}/${BACKUP_FILENAME}"
LOG_FILE="/home/server/asset-tracker/backups/backup.log"
RETENTION_DAYS=7 # Количество дней хранения резервных копий в облаке

# --- Логика ---
echo "[$(date)] Начало резервного копирования..." >> "$LOG_FILE"

# 1. Проверка существования исходного файла БД
if [ ! -f "$DB_FILE" ]; then
  echo "[$(date)] ОШИБКА: Файл базы данных $DB_FILE не найден!" >> "$LOG_FILE"
  exit 1
fi

# 2. Создание локальной резервной копии
if cp "$DB_FILE" "$LOCAL_BACKUP_PATH"; then
    echo "[$(date)] Локальная копия создана: $LOCAL_BACKUP_PATH" >> "$LOG_FILE"
else
    echo "[$(date)] ОШИБКА: Не удалось создать локальную копию!" >> "$LOG_FILE"
    exit 1
fi

# 3. Загрузка копии в облако через rclone
if rclone copyto "$LOCAL_BACKUP_PATH" "$REMOTE_BACKUP_PATH"; then
    echo "[$(date)] Копия успешно загружена в облако: $REMOTE_BACKUP_PATH" >> "$LOG_FILE"

    # --- Удаление старых копий из облака ---
    # Удаляем файлы в удаленной папке старше RETENTION_DAYS дней
    if rclone delete --min-age ${RETENTION_DAYS}d "${RCLONE_REMOTE}:${RCLONE_PATH}"; then
        echo "[$(date)] Старые копии (старше ${RETENTION_DAYS} дней) удалены из облака (${RCLONE_REMOTE}:${RCLONE_PATH})." >> "$LOG_FILE"

        # --- Очистка корзины Google Drive ---
        # Эта команда пытается окончательно удалить файлы, перемещенные в корзину Google Drive
        if rclone cleanup "${RCLONE_REMOTE}:${RCLONE_PATH}"; then
            echo "[$(date)] Команда очистки корзины Google Drive выполнена для ${RCLONE_REMOTE}:${RCLONE_PATH}." >> "$LOG_FILE"
        else
            echo "[$(date)] Предупреждение: Ошибка при выполнении очистки корзины Google Drive или функция не поддерживается/не требуется." >> "$LOG_FILE"
            # Не завершаем с ошибкой, так как это может быть не критично
        fi
    else
        echo "[$(date)] Предупреждение: Ошибка при удалении старых копий из облака или файлов для удаления не найдено." >> "$LOG_FILE"
    fi

else
    echo "[$(date)] ОШИБКА: Не удалось загрузить копию в облако!" >> "$LOG_FILE"
    # Не завершаем скрипт с ошибкой, так как локальная копия есть
fi

# 4. (Опционально) Удаление старых локальных копий (оставим, например, последние 7)
# Найдем и отсортируем файлы по времени, удалим все, кроме последних 7
find "$BACKUP_DIR" -name "*_test.bd" -type f -printf '%T@ %p\n' | sort -n | cut -d' ' -f 2- | head -n -7 | xargs -r rm -f
if [ $? -eq 0 ]; then
    echo "[$(date)] Старые локальные копии удалены (оставлены последние 7)." >> "$LOG_FILE"
else
    echo "[$(date)] Предупреждение: Не удалось удалить старые локальные копии или их меньше 7." >> "$LOG_FILE"
fi

echo "[$(date)] Резервное копирование завершено." >> "$LOG_FILE"
