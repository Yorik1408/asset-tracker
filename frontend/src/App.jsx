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
  try {
    // Формируем параметры запроса
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

    if (!formData.inventory_number.trim()) {
      alert("Поле 'Инвентарный номер' обязательно для заполнения");
      return;
    }
    if (!formData.location.trim()) {
      alert("Поле 'Расположение' обязательно для заполнения");
      return;
    }
    if (!formData.type) {
      alert("Пожалуйста, выберите тип оборудования из списка");
      return;
    }

    const payload = {};
    for (const key in formData) {
      if (formData[key]) {
        payload[key] = formData[key];
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
        alert(errorData?.detail || 'Ошибка сохранения актива');
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
      if (typeof val === "string") {
        return val.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return false;
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
        <div className="login-form mb-4 p-3 bg-light border rounded">
          <h3>Авторизация</h3>
          <input
            type="text"
            placeholder="Логин"
            className="form-control mb-2"
            value={loginData.username}
            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="Пароль"
            className="form-control mb-2"
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
          />
          <button className="btn btn-primary mt-2" onClick={handleLogin}>
            Войти
          </button>
        </div>
      )}

      {/* Информация о пользователе */}
      {token && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span>Вы вошли как {user?.username || 'админ'}</span>
          <button className="btn btn-outline-danger" onClick={handleLogout}>Выйти</button>
        </div>
      )}

      {/* Кнопка "Добавить актив" (только для админа) */}
      {user?.is_admin && (
        <div className="d-flex justify-content-end mt-2 sticky-top bg-white p-2 shadow-sm">
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
</div>

      {/* Поле поиска */}
      <div className="mb-4">
        <input
          type="text"
          className="form-control"
          placeholder="Поиск по нужным данным..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Таблица */}
      <div className="table-container">
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
                    <td data-label="Комментарий">{asset.comment || '-'}</td>
                    {user?.is_admin && (
                      <td>
                        <button
                          className="btn btn-primary btn-sm me-2"
                          onClick={() => handleEdit(asset)}
                        >
                          Редактировать
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(asset.id)}
                        >
                          Удалить
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm ms-2"
                          onClick={() => setShowHistory(showHistory === asset.id ? null : asset.id)}
                        >
                          {showHistory === asset.id ? 'Скрыть' : 'Показать'} историю
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

      {/* Пагинация */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <button
          className="btn btn-outline-primary"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Назад
        </button>
        <span>Страница {page} из {totalPages}</span>
        <button
          className="btn btn-outline-primary"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages || totalPages === 0}
        >
          Вперёд
        </button>
      </div>

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
                  <div className="col-12">
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
