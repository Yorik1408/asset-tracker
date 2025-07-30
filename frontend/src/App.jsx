import React, { useState, useEffect } from 'react';
import '/home/server/asset-tracker/frontend/src/TableStyles.css';

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
  const [isModalOpen, setIsModalOpen] = useState(false); // Управление модальным окном
  const [filter, setFilter] = useState('Все');
  const [activeTab, setActiveTab] = useState('assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });

  // Загрузка активов
  // Универсальная загрузка активов
  const fetchAssets = async () => {
    try {
      const res = await fetch('http://10.0.1.225:8000/assets/');
      const data = await res.json();
      setAssets(data);
    } catch (err) {
      console.error("Ошибка загрузки активов:", err);
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
    }
  }, [assets]);

  // Загружаем всегда
  useEffect(() => {
    fetchAssets();
  }, [token]);

  // Проверка токена
  useEffect(() => {
    if (!token) return;
    fetch('http://10.0.1.225:8000/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(userData => setUser(userData))
      .catch(() => {
        alert("Ошибка токена");
        handleLogout();
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
    window.location.reload();
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
    `Экспорт будет выполнен согласено выбранному фильтру ${filterText}.\n\nПродолжить?`
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
    const filenameMatch = res.headers.get('Content-Disposition')?.match(/filename[^;=\n]*=([^;\n]*)/);
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
    "Перед очисткой базы рекомендуется сделать резервную копию.\n\nСкачать Excel-файл со всеми данными перед удалением?"
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
    "ВНИМАНИЕ: Все активы и история изменений будут безвозвратно удалены.\n\nВы уверены, что хотите очистить всю базу?"
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
    } else {
      alert(`Ошибка: ${result.detail}`);
    }
  } catch (err) {
    alert('Ошибка сети');
    console.error(err);
  }
};

  // Обработка формы
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Открытие модального окна
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

  // Закрытие модального окна
  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
  };

  // Отправка формы
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
      
      {/* Информация о пользователе */}
      {token && (
  <div className="d-flex justify-content-between align-items-center mb-3">
    <span>Вы вошли как {user?.username || 'админ'}</span>
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

      {/* Кнопка "Добавить актив" (только для админа) */}
      {user?.is_admin && (
        <div className="d-flex justify-content-end mt-2 sticky-top bg-white p-2">
          <button
            className="btn btn-success"
            onClick={() => openModal()}
          >
            Добавить актив
          </button>
        </div>
      )}

      {/* Кнопки экспорта/импорта */}
{user?.is_admin && (
  <div className="d-flex gap-2 mb-4">
    {/* Экспорт */}
    <button
      className="btn btn-outline-success btn-sm"
      onClick={handleExport}
    >
      <i className="fas fa-file-export"></i> Экспорт в Excel
    </button>

    {/* Импорт */}
    <label className="btn btn-outline-primary btn-sm mb-0">
      <i className="fas fa-file-import"></i> Импорт из Excel
      <input
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
    </label>
    {/* Кнопка очистки базы — только для админа */}
    <button
      className="btn btn-danger ms-auto"
      onClick={handleClearDatabase}
    >
      <i className="fas fa-trash-alt"></i> Очистить всю базу
    </button>
  </div>
)}


      {/* Кнопки фильтрации */}
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
    Отчёт о гарантиях
  </button>
</div>

      {/* Поле поиска */}
      <div className="input-group">
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

      {/* Таблица */}
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
                    <td data-label="Комментарий">{asset.comment || ''}</td>
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
                      <td colSpan={user?.is_admin ? "8" : "7"} className="bg-light small p-2">
                        <strong>История изменений:</strong>
                        <ul className="mb-0 ps-3">
                          {asset.history.map((h, idx) => (
                            <li key={idx}>
                              {getHumanFieldName(h.field)}: "{h.old_value}" → "{h.new_value}" ({h.changed_at})
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

      {/* Пагинация */}
      {/* Пагинация с быстрым переходом */}
<div className="d-flex justify-content-between align-items-center mt-3">
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

    {activeTab === 'reports' && (
      <div className="reports-section">
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

      {/* Модальное окно */}
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

      {/* Фон затемнения */}
      {isModalOpen && (
        <div
          className="modal-backdrop fade show"
          onClick={closeModal}
        ></div>
      )}
    </div>
  );
}

export default App;
