// app.jsx
import React, { useState, useEffect } from 'react';
import '/home/server/asset-tracker/frontend/src/TableStyles.css';
import packageInfo from '../package.json';

function App() {
  const [assets, setAssets] = useState([]);
  const [showHistory, setShowHistory] = useState(null);
  const [formData, setFormData] = useState({
    inventory_number: '',
    serial_number: '',
    model: '',
    purchase_date: '',
    warranty_until: '',
    status: 'в эксплуатации',
    location: '',
    user_name: '',
    motherboard: '',
    processor: '',
    ram: '',
    comment: '',
    type: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // Управление модальным окном актива
  const [filter, setFilter] = useState('Все');
  const [activeTab, setActiveTab] = useState('assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    laptops: 0,
    monitors: 0, // Новое
    computers: 0, // Новое
    retired: 0, // Новое (списано)
    underWarranty: 0, // Новое (на гарантии)
    expiringWarranty: 0,
    inRepair: 0
  });

  // --- Состояния для управления пользователями ---
  const [users, setUsers] = useState([]); // Список всех пользователей
  const [showUserModal, setShowUserModal] = useState(false); // Открытие модального окна пользователей
  const [isEditingUser, setIsEditingUser] = useState(false); // Флаг редактирования пользователя
  const [editingUser, setEditingUser] = useState(null); // Данные редактируемого пользователя
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    is_admin: false
  });
  // ---------------------------------------------

  // --- Загрузка активов (только если есть токен) ---
  const fetchAssets = async () => {
    // Добавлена проверка на наличие токена
    if (!token) {
        // Если токена нет, очищаем список активов и выходим
        setAssets([]);
        // Сбрасываем статистику
        setStats({
            total: 0,
            laptops: 0,
            monitors: 0,
            computers: 0,
            retired: 0,
            underWarranty: 0,
            expiringWarranty: 0,
            inRepair: 0
        });
        return;
    }

    try {
      const res = await fetch('http://10.0.1.225:8000/assets/', {
        headers: { Authorization: `Bearer ${token}` } // Передаем токен
      });
      if (!res.ok) {
        // Если сервер вернул ошибку (например, 401), выходим
        if (res.status === 401) {
            handleLogout(); // Выход, если токен недействителен
        }
        throw new Error(`Ошибка ${res.status}`);
      }
      const data = await res.json();
      setAssets(data);

      // --- Обновленная логика подсчета статистики ---
      const today = new Date();
      const total = data.length;
      const laptops = data.filter(a => a.type === 'Ноутбук').length;
      const monitors = data.filter(a => a.type === 'Монитор').length; // Новое
      const computers = data.filter(a => a.type === 'Компьютер').length; // Новое
      const retired = data.filter(a => a.status === 'списано').length; // Новое
      const inRepair = data.filter(a => a.status === 'на ремонте').length;
      // Гарантия заканчивается в ближайшие 30 дней
      const threshold = new Date();
      threshold.setDate(today.getDate() + 30);
      const expiringWarranty = data.filter(asset => {
        if (!asset.warranty_until) return false;
        const warrantyDate = new Date(asset.warranty_until);
        return warrantyDate >= today && warrantyDate <= threshold;
      }).length;
      // На гарантии (дата окончания позже сегодня)
      const underWarranty = data.filter(asset => {
        if (!asset.warranty_until) return false;
        const warrantyDate = new Date(asset.warranty_until);
        return warrantyDate > today; // Используем >, чтобы исключить истекшие
      }).length;
      // --------------------------------------------

      setStats({
        total,
        laptops,
        monitors, // Новое
        computers, // Новое
        retired, // Новое
        underWarranty, // Новое
        expiringWarranty,
        inRepair
      });
    } catch (err) {
      console.error("Ошибка загрузки активов:", err);
      // При ошибке загрузки также очищаем список
      setAssets([]);
    }
  };

  const [expiringWarranty, setExpiringWarranty] = useState([]);
  useEffect(() => {
    if (assets.length > 0) {
      const today = new Date();
      const threshold = new Date();
      threshold.setDate(today.getDate() + 30);
      const expiring = assets.filter(asset => {
        if (!asset.warranty_until) return false;
        const warrantyDate = new Date(asset.warranty_until);
        return warrantyDate >= today && warrantyDate <= threshold;
      });
      setExpiringWarranty(expiring);
    } else {
        setExpiringWarranty([]); // Очищаем, если активов нет
    }
  }, [assets]);

  // Загрузка пользователей (только для админов)
  const fetchUsers = async () => {
    if (!user || !user.is_admin || !token) return;
    try {
      const res = await fetch('http://10.0.1.225:8000/users/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
         console.error("Ошибка загрузки пользователей:", await res.text());
      }
    } catch (err) {
      console.error("Ошибка сети при загрузке пользователей:", err);
    }
  };

  // Загружаем всегда
  useEffect(() => {
    // fetchAssets будет вызвана внутри, если есть токен
    fetchAssets();
    const handleKeyDown = (e) => {
      // Закрываем модальные окна только если они открыты
      if (e.key === 'Escape') {
        // Закрываем "О системе"
        if (showAboutModal) {
          setShowAboutModal(false);
        }
        // Закрываем форму активов (редактирование/добавление)
        if (isModalOpen || isEditing) {
          closeModal();
        }
        // Закрываем форму пользователей
        if (showUserModal) {
          setShowUserModal(false);
          // Сбросить состояние редактирования при закрытии
          setIsEditingUser(false);
          setEditingUser(null);
        }
      }
    };
    // Добавляем слушатель
    window.addEventListener('keydown', handleKeyDown);
    // Убираем при размонтировании
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAboutModal, isModalOpen, isEditing, showUserModal, token]); // Добавили token в зависимости

  // Проверка токена и загрузка данных пользователя
  useEffect(() => {
    if (!token) {
        // Если токена нет, сбрасываем данные пользователя
        setUser(null);
        setUsers([]); // Очистить список пользователей
        return;
    }
    fetch('http://10.0.1.225:8000/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(userData => {
        setUser(userData);
        // После авторизации загружаем пользователей, если админ
        if (userData.is_admin) {
             fetchUsers();
        }
      })
      .catch(() => {
        // alert("Ошибка токена");
        handleLogout(); // Лучше выйти, чем показывать alert
      });
  }, [token]);

  // Авторизация
  const handleLogin = async () => {
    const res = await fetch('http://10.0.1.225:8000/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(loginData).toString()
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      // fetchAssets будет вызвана через useEffect при изменении token
      alert("Вы вошли");
    } else {
      alert("Неверный логин или пароль");
    }
  };

  // Выход
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setUsers([]); // Очистить список пользователей при выходе
    setAssets([]); // Очистить список активов при выходе
    // Сброс статистики
    setStats({
        total: 0,
        laptops: 0,
        monitors: 0,
        computers: 0,
        retired: 0,
        underWarranty: 0,
        expiringWarranty: 0,
        inRepair: 0
    });
    setExpiringWarranty([]); // Очистить список гарантий
    // window.location.reload(); // Не обязательно перезагружать всю страницу
  };

  // Экспорт в Excel
  const handleExport = async () => {
    // Формируем текст уведомления
    let filterText = "всех активов";
    if (filter !== 'Все') {
      filterText = `активов типа "${filter}"`;
    }
    if (searchQuery) {
      filterText += ` с поиском по "${searchQuery}"`;
    }
    const confirmExport = window.confirm(
      `Экспорт будет выполнен согласено выбранному фильтру ${filterText}.
Продолжить?`
    );
    if (!confirmExport) {
      return; // Пользователь отменил
    }
    try {
      const params = new URLSearchParams();
      if (filter !== 'Все') {
        params.append('type', filter);
      }
      if (searchQuery) {
        params.append('q', searchQuery);
      }
      const url = `http://10.0.1.225:8000/export/excel?${params.toString()}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Ошибка экспорта' }));
        alert(error.detail);
        return;
      }
      const blob = await res.blob();
      const filenameMatch = res.headers.get('Content-Disposition')?.match(/filename[^;=\n\r]*=([^;\n\r]*)/);
      const filename = decodeURIComponent(filenameMatch?.[1]?.replace(/['"]/g, '') || 'активы.xlsx');
      const urlBlob = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(urlBlob);
      document.body.removeChild(a);
    } catch (err) {
      alert('Ошибка сети при экспорте');
      console.error(err);
    }
  };

  // Импорт из Excel
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('http://10.0.1.225:8000/import/excel', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const result = await res.json();
      // Показываем результат
      if (result.errors && result.errors.length > 0) {
        // Используем \n для перевода строки вместо фактического перевода
        alert(`Импорт частично завершён:\n${result.errors.join('\n')}`);
      } else {
        alert(result.detail); // "Импорт завершён: 5 активов"
      }
      // ВСЕГДА обновляем список, даже если были ошибки
      await fetchAssets();
    } catch (err) {
      alert('Критическая ошибка импорта: ' + err.message);
      console.error(err);
    }
    e.target.value = null;
  };

  const handleClearDatabase = async () => {
    // 1. Спросим: хочешь ли скачать резервную копию?
    const wantBackup = window.confirm(
      "Перед очисткой базы рекомендуется сделать резервную копию. Скачать Excel-файл со всеми данными перед удалением?"
    );
    // 2. Если да — скачиваем
    if (wantBackup) {
      const link = document.createElement('a');
      link.href = `http://10.0.1.225:8000/export/excel`;
      link.setAttribute('download', '');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Ждём 1 секунду, чтобы файл начал скачиваться
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    // 3. Подтверждение очистки
    const confirmed = window.confirm(
      "ВНИМАНИЕ: Все активы и история изменений будут безвозвратно удалены. Вы уверены, что хотите очистить всю базу?"
    );
    if (!confirmed) return;
    // 4. Отправляем запрос на очистку
    try {
      const res = await fetch('http://10.0.1.225:8000/admin/clear-db', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message);
        setAssets([]); // Очищаем локально
        // Сбрасываем статистику
        setStats({
            total: 0,
            laptops: 0,
            monitors: 0,
            computers: 0,
            retired: 0,
            underWarranty: 0,
            expiringWarranty: 0,
            inRepair: 0
        });
        setExpiringWarranty([]);
      } else {
        alert(`Ошибка: ${result.detail}`);
      }
    } catch (err) {
      alert('Ошибка сети');
      console.error(err);
    }
  };

  // Обработка формы актива
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Открытие модального окна актива
  const openModal = (asset = null) => {
    if (asset) {
      setFormData(asset);
      setIsEditing(true);
    } else {
      setFormData({
        inventory_number: '',
        serial_number: '',
        model: '',
        purchase_date: '',
        warranty_until: '',
        status: 'в эксплуатации',
        location: '',
        user_name: '',
        motherboard: '',
        processor: '',
        ram: '',
        comment: '',
        type: ''
      });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  // Закрытие модального окна актива
  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
  };

  // Отправка формы актива
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Валидация
    if (!formData.inventory_number || !formData.inventory_number.trim()) {
      alert("Поле 'Инвентарный номер' обязательно для заполнения");
      return;
    }
    if (!formData.location || !formData.location.trim()) {
      alert("Поле 'Расположение' обязательно для заполнения");
      return;
    }
    if (!formData.type) {
      alert("Пожалуйста, выберите тип оборудования из списка");
      return;
    }
    // Формируем payload
    const payload = {};
    for (const key in formData) {
      const value = formData[key];
      // Если это поле даты и значение пустое — отправляем null
      if (['purchase_date', 'warranty_until'].includes(key)) {
        payload[key] = value ? value : null;
      } else if (value !== null && value !== undefined) {
        payload[key] = value;
      }
    }
    const url = isEditing
      ? `http://10.0.1.225:8000/assets/${formData.id}`
      : 'http://10.0.1.225:8000/assets/';
    const method = isEditing ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        if (isEditing) {
          setAssets(assets.map(a => a.id === updated.id ? updated : a));
        } else {
          setAssets([...assets, updated]);
        }
        closeModal();
        // Обновляем статистику после добавления/редактирования
        fetchAssets();
      } else {
        const errorData = await res.json().catch(() => null);
        if (errorData?.detail) {
          // Попробуем разобрать ошибку Pydantic
          if (Array.isArray(errorData.detail)) {
            const messages = errorData.detail.map(err => `${err.loc?.[1]}: ${err.msg}`).join('; ');
            alert(`Ошибка валидации: ${messages}`);
          } else {
            alert(errorData.detail);
          }
        } else {
          alert('Ошибка сохранения актива');
        }
      }
    } catch (err) {
      alert('Ошибка сети');
      console.error(err);
    }
  };

  // Хуманизация полей
  const getHumanFieldName = (field) => {
    const labels = {
      inventory_number: 'Инвентарный номер',
      serial_number: 'Серийный номер',
      location: 'Расположение',
      user_name: 'ФИО пользователя',
      status: 'Статус',
      model: 'Модель',
      type: 'Тип',
      motherboard: 'Мат. плата',
      processor: 'Процессор',
      ram: 'ОЗУ',
      os_type: 'Тип ОС',
      windows_key: 'Ключ Windows',
      purchase_date: 'Дата покупки',
      warranty_until: 'Гарантия до',
      issue_date: 'Дата выдачи',
      comment: 'Комментарий',
      created: 'Создание', // Если используется в логике crud.py
      deleted: 'Удаление'
    };
    return labels[field] || field;
  };

  // Редактирование актива
  const handleEdit = async (asset) => {
    const res = await fetch(`http://10.0.1.225:8000/assets/${asset.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const fullAsset = await res.json();
    openModal(fullAsset);
  };

  // Удаление актива
  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены?')) return;
    const res = await fetch(`http://10.0.1.225:8000/assets/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setAssets(assets.filter(a => a.id !== id));
      alert("Актив удален");
      // Обновляем статистику после удаления
      fetchAssets();
    } else {
      alert("Ошибка удаления");
    }
  };

  // Фильтрация + поиск
  const filteredAssets = assets.filter((asset) => {
    const matchesFilter = filter === 'Все' || asset.type === filter;
    const matchesSearch = !searchQuery || Object.values(asset).some(val => {
      if (val == null || typeof val === 'number' || val instanceof Date) {
        return false;
      }
      return String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
    return matchesFilter && matchesSearch;
  });
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // --- Функции для управления пользователями ---
  // Открытие модального окна пользователей (для создания или просмотра/редактирования)
  const openUserModal = (userToEdit = null) => {
    if (userToEdit) {
        // Режим редактирования
        setIsEditingUser(true);
        setEditingUser(userToEdit);
        setUserFormData({
            username: userToEdit.username,
            password: '', // Не заполняем пароль для безопасности
            is_admin: userToEdit.is_admin
        });
    } else {
        // Режим создания
        setIsEditingUser(false);
        setEditingUser(null);
        setUserFormData({
            username: '',
            password: '',
            is_admin: false
        });
    }
    setShowUserModal(true);
    fetchUsers(); // Обновляем список при открытии
  };

  const handleUserChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Создание или обновление пользователя
  const handleUserSubmit = async (e) => {
    e.preventDefault();

    // Валидация
    if (!userFormData.username || !userFormData.username.trim()) {
        alert("Пожалуйста, заполните имя пользователя");
        return;
    }
    if (!isEditingUser && (!userFormData.password || !userFormData.password.trim())) {
        // Пароль обязателен только при создании
        alert("Пожалуйста, заполните пароль");
        return;
    }
    // Если редактируем и пароль пуст, убираем его из запроса
    const payload = { ...userFormData };
    if (isEditingUser && (!payload.password || !payload.password.trim())) {
        delete payload.password;
    }

    const url = isEditingUser
        ? `http://10.0.1.225:8000/users/${editingUser.id}`
        : 'http://10.0.1.225:8000/users/';
    const method = isEditingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updatedOrNewUser = await res.json();
        if (isEditingUser) {
            // Обновляем пользователя в локальном состоянии
            setUsers(users.map(u => u.id === updatedOrNewUser.id ? updatedOrNewUser : u));
            alert("Пользователь обновлен");
        } else {
            // Добавляем нового пользователя в локальное состояние
            setUsers([...users, updatedOrNewUser]);
            alert("Пользователь создан");
        }
        setShowUserModal(false);
        setIsEditingUser(false);
        setEditingUser(null);
        setUserFormData({ username: '', password: '', is_admin: false }); // Сброс формы
      } else {
        const errorData = await res.json();
        alert(errorData.detail || `Ошибка ${isEditingUser ? 'обновления' : 'создания'} пользователя`);
      }
    } catch (err) {
      alert("Ошибка сети");
      console.error(err);
    }
  };

  // Удаление пользователя
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    if (userId === user.id) {
         alert("Нельзя удалить самого себя!");
         return;
    }
    try {
      const res = await fetch(`http://10.0.1.225:8000/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        alert("Пользователь удален");
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Ошибка удаления пользователя");
      }
    } catch (err) {
      alert("Ошибка сети");
      console.error(err);
    }
  };
  // ---------------------------------------------

  return (
    <div className="container mt-4">
      {/* Форма входа */}
      {!token && (
        <form
          className="login-form mb-4 p-3 bg-light border rounded"
          onSubmit={(e) => {
            e.preventDefault(); // ⚠️ Обязательно!
            handleLogin();
          }}
        >
          <h3>Авторизация</h3>
          <input
            type="text"
            placeholder="Логин"
            className="form-control mb-2"
            value={loginData.username}
            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
            autoFocus
          />
          <input
            type="password"
            placeholder="Пароль"
            className="form-control mb-2"
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
          />
          <button type="submit" className="btn btn-primary mt-2">
            Войти
          </button>
        </form>
      )}
      {/* Статистика (показываем только если есть токен) */}
      {token && (
        <div className="mb-4 p-3 rounded shadow-sm">
          <div className="row text-center">
            {/* Существующие метрики */}
            <div className="col-md-3 col-6">
              <div className="fw-bold text-primary">{stats.total}</div>
              <div className="text-muted small">Всего активов</div>
            </div>
            <div className="col-md-3 col-6">
              <div className="fw-bold text-success">{stats.laptops}</div>
              <div className="text-muted small">Ноутбуков</div>
            </div>
            <div className="col-md-3 col-6">
              <div className="fw-bold text-warning">{stats.expiringWarranty}</div>
              <div className="text-muted small">Гарантия заканчивается</div>
            </div>
            <div className="col-md-3 col-6">
              <div className="fw-bold text-danger">{stats.inRepair}</div>
              <div className="text-muted small">В ремонте</div>
            </div>

            {/* НОВЫЕ МЕТРИКИ */}
            <div className="col-md-3 col-6 mt-2"> {/* Добавил mt-2 для отступа на мобильных */}
              <div className="fw-bold text-info">{stats.monitors}</div>
              <div className="text-muted small">Мониторов</div>
            </div>
            <div className="col-md-3 col-6 mt-2">
              <div className="fw-bold text-secondary">{stats.computers}</div>
              <div className="text-muted small">Компьютеров</div>
            </div>
            <div className="col-md-3 col-6 mt-2">
              <div className="fw-bold text-dark">{stats.retired}</div>
              <div className="text-muted small">Списано</div>
            </div>
            <div className="col-md-3 col-6 mt-2">
              <div className="fw-bold text-primary">{stats.underWarranty}</div>
              <div className="text-muted small">На гарантии</div>
            </div>
            {/* --- */}
          </div>
        </div>
      )}
      {/* Информация о пользователе */}
      {token && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span>Вы вошли как {user?.username || 'пользователь'}</span>
          <div className="d-flex align-items-center gap-2">
            {/* Логотип */}
            <img
              src="/asset-logo.png"
              alt="Логотип"
              style={{
                height: '80px',
                opacity: 0.9,
                filter: 'grayscale(100%)'
              }}
            />
            {/* Кнопка выхода */}
            <button className="btn btn-outline-danger" onClick={handleLogout}>Выйти</button>
          </div>
        </div>
      )}
      {/* Компактная панель управления (показываем только если есть токен и пользователь загружен) */}
      {token && user && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 p-2 bg-white border rounded">
          {/* Левая группа: сервисные кнопки (доступны всем авторизованным) */}
          <div className="d-flex flex-wrap gap-1">
            {/* Кнопка "О системе" */}
            <button
              className="btn btn-outline-info btn-sm"
              onClick={() => setShowAboutModal(true)}
              title="О системе"
            >
              <i className="fas fa-info-circle"></i> О системе
            </button>
            {/* Экспорт в Excel */}
            <button
              className="btn btn-outline-success btn-sm"
              onClick={handleExport}
              title="Экспорт в Excel"
            >
              <i className="fas fa-file-export"></i> Экспорт
            </button>
            {/* Импорт из Excel — только для админа */}
            {user.is_admin && (
              <label
                className="btn btn-outline-primary btn-sm mb-0"
                title="Импорт из Excel"
              >
                <i className="fas fa-file-import"></i> Импорт
                <input
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={handleImport}
                />
              </label>
            )}
          </div>
          {/* Правая группа: действия админа */}
          {user.is_admin && (
            <div className="d-flex flex-wrap gap-1">
              {/* Кнопка "Добавить актив" */}
              <button
                className="btn btn-success btn-sm"
                onClick={() => openModal()}
                title="Добавить актив"
              >
                <i className="fas fa-plus"></i> Добавить
              </button>
              {/* Кнопка "Управление пользователями" */}
              <button
                className="btn btn-warning btn-sm"
                onClick={() => openUserModal()} // Открываем модальное окно без данных для создания
                title="Управление пользователями"
              >
                <i className="fas fa-users"></i> Пользователи
              </button>
              {/* Кнопка "Очистить базу" */}
              <button
                className="btn btn-danger btn-sm"
                onClick={handleClearDatabase}
                title="Очистить всю базу"
              >
                <i className="fas fa-trash-alt"></i> Очистить
              </button>
            </div>
          )}
        </div>
      )}
      {/* Кнопки фильтрации (показываем только если есть токен) */}
      {token && (
        <div className="btn-group mb-4" role="group">
          <button
            className={`btn btn-outline-primary ${filter === 'Все' ? 'active' : ''}`}
            onClick={() => {
              setFilter('Все');
              setPage(1);
            }}
          >
            Все
          </button>
          <button
            className={`btn btn-outline-primary ${filter === 'Монитор' ? 'active' : ''}`}
            onClick={() => {
              setFilter('Монитор');
              setPage(1);
            }}
          >
            Мониторы
          </button>
          <button
            className={`btn btn-outline-primary ${filter === 'Компьютер' ? 'active' : ''}`}
            onClick={() => {
              setFilter('Компьютер');
              setPage(1);
            }}
          >
            Компьютеры
          </button>
          <button
            className={`btn btn-outline-primary ${filter === 'Ноутбук' ? 'active' : ''}`}
            onClick={() => {
              setFilter('Ноутбук');
              setPage(1);
            }}
          >
            Ноутбуки
          </button>
          <button
            className={`btn btn-outline-primary ${filter === 'Прочее' ? 'active' : ''}`}
            onClick={() => {
              setFilter('Прочее');
              setPage(1);
            }}
          >
            Прочее
          </button>
          <button
            className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab(activeTab === 'reports' ? 'assets' : 'reports')}
          >
            Активы с истекающей гарантией
          </button>
        </div>
      )}
      {/* Поле поиска (показываем только если есть токен) */}
      {token && (
        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Введите данные актива для поиска..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ display: 'flex', alignItems: 'center', padding: '0 10px' }}
              title="Очистить поиск"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      )}
      {/* Таблица (показываем только если есть токен) */}
      {token && (
        <div className="table-container">
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Инвентарный номер</th>
                  <th>Серийный номер</th>
                  <th>Статус</th>
                  <th>Расположение</th>
                  <th>ФИО пользователя</th>
                  <th>Комментарий</th>
                  {user?.is_admin && <th>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.length > 0 ? (
                  paginatedAssets.map((asset) => (
                    <React.Fragment key={asset.id}>
                      <tr>
                        <td data-label="ID">{asset.id}</td>
                        <td data-label="Инвентарный номер">{asset.inventory_number || '-'}</td>
                        <td data-label="Серийный номер">{asset.serial_number || '-'}</td>
                        <td data-label="Статус">{asset.status}</td>
                        <td data-label="Расположение">{asset.location}</td>
                        <td data-label="ФИО пользователя">{asset.user_name || '-'}</td>
                        <td data-label="Комментарий"><div className="comment-cell">{asset.comment || ''}</div></td>
                        {user?.is_admin && (
                          <td className="text-center">
                            {/* Редактировать — карандаш */}
                            <button
                              className="btn btn-sm btn-outline-primary me-1"
                              title="Редактировать"
                              onClick={() => handleEdit(asset)}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            {/* Удалить — корзина */}
                            <button
                              className="btn btn-sm btn-outline-danger me-1"
                              title="Удалить"
                              onClick={() => handleDelete(asset.id)}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                            {/* Показать/скрыть историю — часы/история */}
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              title={showHistory === asset.id ? "Скрыть историю" : "Показать историю"}
                              onClick={() => setShowHistory(showHistory === asset.id ? null : asset.id)}
                            >
                              <i className={`fas ${showHistory === asset.id ? 'fa-eye-slash' : 'fa-history'}`}></i>
                            </button>
                          </td>
                        )}
                      </tr>
                      {/* История изменений */}
                      {showHistory === asset.id && asset.history && asset.history.length > 0 && (
                        <tr>
                          {/* Выравнивание по левому краю */}
                          <td colSpan={user?.is_admin ? "8" : "7"} className="bg-light small p-2" style={{ textAlign: 'left' }}>
                            <strong>История изменений:</strong>
                            <ul className="mb-0 ps-3">
                              {asset.history.map((h, idx) => (
                                <li key={idx}>
                                  {/* Дата в начале */}
                                  ({h.changed_at}) {h.changed_by ? `[${h.changed_by}] ` : ''}
                                  {getHumanFieldName(h.field)}: "{h.old_value}" → "{h.new_value}"
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={user?.is_admin ? "8" : "7"} className="text-center">Нет данных</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Пагинация (показываем только если есть токен и активы) */}
      {token && assets.length > 0 && (
        <div className="pagination-container d-flex justify-content-between align-items-center mt-3 mb-4"> {/* Добавлен mb-4 для отступа снизу */}
          <button
            className="btn btn-outline-primary"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Назад
          </button>
          <div className="d-flex align-items-center gap-2">
            <span>Страница</span>
            <input
              type="number"
              min="1"
              max={Math.ceil(filteredAssets.length / itemsPerPage)}
              value={page}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setPage(1); // или оставить пустым, если хочешь
                  return;
                }
                const num = parseInt(value, 10);
                if (num >= 1 && num <= Math.ceil(filteredAssets.length / itemsPerPage)) {
                  setPage(num);
                }
              }}
              className="form-control text-center"
              style={{ width: '70px' }}
            />
            <span>из {Math.ceil(filteredAssets.length / itemsPerPage)}</span>
          </div>
          <button
            className="btn btn-outline-primary"
            onClick={() => setPage(p => Math.min(Math.ceil(filteredAssets.length / itemsPerPage), p + 1))}
            disabled={page === Math.ceil(filteredAssets.length / itemsPerPage) || filteredAssets.length === 0}
          >
            Вперёд
          </button>
        </div>
      )}
      {activeTab === 'reports' && token && (
        <div className="reports-section pagination-container">
          <h4>Отчёт: Гарантия заканчивается</h4>
          <p>Активы, у которых гарантия заканчивается в ближайшие 30 дней</p>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Инвентарный номер</th>
                <th>Модель</th>
                <th>ФИО пользователя</th>
                <th>Гарантия до</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {expiringWarranty.map((asset) => (
                <tr key={asset.id} className="expiring-soon" >
                  <td data-label="Инвентарный номер">{asset.inventory_number}</td>
                  <td data-label="Модель">{asset.model}</td>
                  <td data-label="ФИО">{asset.user_name || '-'}</td>
                  <td data-label="Гарантия до">{asset.warranty_until}</td>
                  <td data-label="Статус">{asset.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Модальное окно для актива */}
      {isModalOpen && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {isEditing ? 'Редактировать актив' : 'Добавить актив'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeModal}
                ></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit} className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Инвентарный номер</label>
                    <input
                      type="text"
                      className="form-control required-field"
                      name="inventory_number"
                      value={formData.inventory_number}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Тип</label>
                    <select
                      className="form-select required-field"
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Выберите тип</option>
                      <option value="Монитор">Монитор</option>
                      <option value="Компьютер">Компьютер</option>
                      <option value="Ноутбук">Ноутбук</option>
                      <option value="Прочее">Прочее</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Серийный номер</label>
                    <input
                      type="text"
                      className="form-control"
                      name="serial_number"
                      value={formData.serial_number || ''}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Модель</label>
                    <input
                      type="text"
                      className="form-control"
                      name="model"
                      value={formData.model || ''}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Расположение</label>
                    <input
                      type="text"
                      className="form-control required-field"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">ФИО пользователя</label>
                    <input
                      type="text"
                      className="form-control"
                      name="user_name"
                      value={formData.user_name || ''}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Статус</label>
                    <select
                      className="form-select"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value="в эксплуатации">в эксплуатации</option>
                      <option value="на ремонте">на ремонте</option>
                      <option value="списано">списано</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Дата покупки</label>
                    <input
                      type="date"
                      className="form-control"
                      name="purchase_date"
                      value={formData.purchase_date}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Гарантия до</label>
                    <input
                      type="date"
                      className="form-control"
                      name="warranty_until"
                      value={formData.warranty_until || ''}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Комментарий</label>
                    <input
                      type="text"
                      className="form-control"
                      name="comment"
                      value={formData.comment || ''}
                      onChange={handleChange}
                    />
                  </div>
                  {/* Поля только для компьютеров */}
                  {formData.type === 'Компьютер' && (
                    <>
                      <div className="col-md-4">
                        <label className="form-label">Мат. плата</label>
                        <input
                          type="text"
                          className="form-control"
                          name="motherboard"
                          value={formData.motherboard || ''}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Процессор</label>
                        <input
                          type="text"
                          className="form-control"
                          name="processor"
                          value={formData.processor || ''}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">ОЗУ</label>
                        <input
                          type="text"
                          className="form-control"
                          name="ram"
                          value={formData.ram || ''}
                          onChange={handleChange}
                        />
                      </div>
                    </>
                  )}
                  {/* Поля только для ноутбуков и компьютеров */}
                  {(formData.type === 'Компьютер' || formData.type === 'Ноутбук') && (
                    <>
                      <div className="col-md-6">
                        <label className="form-label">Ключ Windows</label>
                        <input
                          type="text"
                          className="form-control"
                          name="windows_key"
                          value={formData.windows_key || ''}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Тип ОС</label>
                        <input
                          type="text"
                          className="form-control"
                          name="os_type"
                          value={formData.os_type || ''}
                          onChange={handleChange}
                        />
                      </div>
                    </>
                  )}
                  {formData.type === 'Ноутбук' && (
                    <div className="col-md-6">
                      <label className="form-label">Дата выдачи</label>
                      <input
                        type="date"
                        className="form-control"
                        name="issue_date"
                        value={formData.issue_date || ''}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                </form>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSubmit}
                >
                  {isEditing ? 'Сохранить изменения' : 'Добавить актив'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Модальное окно для управления пользователями */}
      {showUserModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-lg" role="document"> {/* Увеличил размер модального окна */}
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                    {isEditingUser ? 'Редактировать пользователя' : 'Создать пользователя'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                      setShowUserModal(false);
                      setIsEditingUser(false);
                      setEditingUser(null);
                      setUserFormData({ username: '', password: '', is_admin: false });
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Форма пользователя */}
                <form onSubmit={handleUserSubmit} className="mb-4">
                  <div className="mb-3">
                    <label className="form-label">Имя пользователя</label>
                    <input
                      type="text"
                      className="form-control"
                      name="username"
                      value={userFormData.username}
                      onChange={handleUserChange}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                        {isEditingUser ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      name="password"
                      value={userFormData.password}
                      onChange={handleUserChange}
                      // Пароль обязателен только при создании
                      required={!isEditingUser}
                    />
                  </div>
                  <div className="mb-3 form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      name="is_admin"
                      checked={userFormData.is_admin}
                      onChange={handleUserChange}
                    />
                    <label className="form-check-label">Администратор</label>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-success"
                  >
                    {isEditingUser ? 'Сохранить изменения' : 'Создать'}
                  </button>
                </form>

                {/* Список пользователей (только для админов и при редактировании/создании) */}
                {user?.is_admin && (
                  <div>
                    <h5>Список пользователей</h5>
                    <div className="table-responsive">
                      <table className="table table-striped table-hover">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Имя пользователя</th>
                            <th>Администратор</th>
                            <th>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.length > 0 ? (
                            users.map(u => (
                              <tr key={u.id}>
                                <td>{u.id}</td>
                                <td>{u.username}</td>
                                <td>{u.is_admin ? 'Да' : 'Нет'}</td>
                                <td>
                                  <button
                                    className="btn btn-sm btn-outline-primary me-1"
                                    onClick={() => openUserModal(u)} // Передаем пользователя для редактирования
                                    title="Редактировать"
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteUser(u.id)}
                                    title="Удалить"
                                    disabled={u.id === user.id} // Запретить удаление себя
                                  >
                                    <i className="fas fa-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="text-center">Нет пользователей</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                      setShowUserModal(false);
                      setIsEditingUser(false);
                      setEditingUser(null);
                      setUserFormData({ username: '', password: '', is_admin: false });
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Фон затемнения */}
      {(isModalOpen || showUserModal) && (
        <div
          className="modal-backdrop fade show"
          onClick={() => {
            if (isModalOpen) closeModal();
            if (showUserModal) {
                setShowUserModal(false);
                setIsEditingUser(false);
                setEditingUser(null);
                setUserFormData({ username: '', password: '', is_admin: false });
            }
          }}
        ></div>
      )}
      {/* Модальное окно "О системе" */}
      {showAboutModal && (
        <div className="modal fade show" style={{ display: 'block' }} onClick={() => setShowAboutModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">О системе учёта активов</h5>
                <button type="button" className="btn-close" onClick={() => setShowAboutModal(false)}></button>
              </div>
              <div className="modal-body">
                <p><strong>Версия:</strong> v{packageInfo.version.split('.').slice(0, 2).join('.')}</p>
                <p>Система учёта активов Asset Tracker — это веб-приложение для управления компьютерами, ноутбуками, мониторами и другим оборудованием.</p>
                <p>Позволяет:</p>
                <ul>
                  <li>Вести учёт активов с инвентарными номерами</li>
                  <li>Отслеживать историю изменений с указанием пользователя</li>
                  <li>Экспортировать и импортировать данные через Excel</li>
                  <li>Контролировать гарантийные сроки</li>
                </ul>
                <p>Разработано для повышения прозрачности и эффективности учёта оборудования.</p>
                <p>
                  <a
                    href="https://github.com/yorik1408/asset-tracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-primary btn-sm"
                  >
                    <i className="fab fa-github"></i> Открыть репозиторий
                  </a>
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAboutModal(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Фон затемнения */}
      {showAboutModal && <div className="modal-backdrop fade show"></div>}
    </div>
  );
}

export default App;

