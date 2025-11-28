// app.jsx
import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import qrCodeGenerator from 'qrcode-generator';
import './TableStyles.css';
import packageInfo from '../package.json';
import Select from 'react-select'; // NEW: Импорт react-select для улучшенного select с поиском

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
    type: '',
    issue_date: '',
    windows_key: '',
    os_type: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('Все');
  const [activeTab, setActiveTab] = useState('assets');
  const [warrantyFilter, setWarrantyFilter] = useState('all');
  const [disposedFilter, setDisposedFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [showDeletionLogModal, setShowDeletionLogModal] = useState(false);
  const [deletionLogs, setDeletionLogs] = useState([]);
  const [deletionLogLoading, setDeletionLogLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [assetIdFromUrlHash, setAssetIdFromUrlHash] = useState(null);
  const [showAssetInfoModal, setShowAssetInfoModal] = useState(false);
  const [assetInfo, setAssetInfo] = useState(null);

  // Ваша существующая функция открытия модального окна
  const openAssetInfoModal = (asset) => {
    console.log("Открытие модального окна для актива:", asset?.inventory_number); // Для отладки
    setAssetInfo(asset); // Предполагается, что состояние называется assetInfo
    setShowAssetInfoModal(true);
    // Устанавливаем хэш в URL при открытии модального окна вручную (не через QR)
    // Это позволяет пользователю использовать "Назад" в браузере для закрытия
    if (asset && asset.id) {
        // Проверяем, не установлен ли хэш уже (например, из QR-кода)
        if (window.location.hash !== `#asset-info-${asset.id}`) {
            window.location.hash = `asset-info-${asset.id}`;
        }
    }
  };

  // Ваша существующая функция закрытия модального окна
  const closeAssetInfoModal = () => {
    console.log("Закрытие модального окна"); // Для отладки
    setShowAssetInfoModal(false);
    setAssetInfo(null);
    // Очищаем хэш при закрытии модального окна пользователем
    // Проверяем, что хэш относится к нашему модальному окну
    if (window.location.hash.startsWith('#asset-info-')) {
       console.log("Очистка URL-хэша"); // Для отладки
       window.location.hash = ''; // Это вызовет событие 'hashchange'
    }
  };

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    laptops: 0,
    monitors: 0,
    computers: 0,
    other: 0,
    retired: 0,
    underWarranty: 0,
    expiringWarranty: 0,
    inRepair: 0
  });
  // --- Состояния для управления пользователями ---
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    is_admin: false
  });
  // ---------------------------------------------
  // --- Состояния для inline-редактирования ---
  const [editingCell, setEditingCell] = useState({ assetId: null, field: null });
  const [editValue, setEditValue] = useState('');
  // --------------------------------------------
  // --- Состояния для управления ремонтами ---
  const [showRepairsModal, setShowRepairsModal] = useState(false);
  const [repairsForAsset, setRepairsForAsset] = useState([]);
  const [currentAssetId, setCurrentAssetId] = useState(null);
  const [repairFormData, setRepairFormData] = useState({
    repair_date: '',
    description: '',
    cost: '',
    performed_by: '',
  });
  const [editingRepairId, setEditingRepairId] = useState(null);
  // --------------------------------------------
  // --- Состояние для определения мобильного устройства ---
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // --- Состояния для пагинации истории ---
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 5;
  
  // NEW: Состояния для фильтра по ФИО пользователя
  const [uniqueUsers, setUniqueUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  // NEW: Обновлённый useEffect для сброса страницы, включая selectedUser
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter, warrantyFilter, disposedFilter, selectedUser]); 

  // NEW: Вычисление уникальных пользователей как опций для react-select
  useEffect(() => {
    if (assets.length > 0) {
      const userNames = [...new Set(assets.map(asset => asset.user_name).filter(name => name && name.trim() !== ''))].sort();
      const userOptions = userNames.map(name => ({ value: name, label: name }));
      setUniqueUsers(userOptions);
    }
  }, [assets]);

  // --- Функция для загрузки журнала удалений ---
  const fetchDeletionLogs = async () => {
    if (!token || !user?.is_admin) return;
    setDeletionLogLoading(true);
    try {
      const res = await fetch(`http://10.0.1.225:8000/admin/deletion-log/?limit=100`, { // Можно добавить пагинацию
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDeletionLogs(data);
      } else {
        console.error("Ошибка загрузки журнала удалений:", await res.text());
        setDeletionLogs([]);
      }
    } catch (err) {
      console.error("Ошибка сети при загрузке журнала удалений:", err);
      setDeletionLogs([]);
    } finally {
      setDeletionLogLoading(false);
    }
  };
  // ---------------------------------------------

  // --- Функция для открытия модального окна журнала ---
  const openDeletionLogModal = async () => {
    await fetchDeletionLogs(); // Загружаем данные при открытии
    setShowDeletionLogModal(true);
  };
  // ----------------------------------------------------


const handlePrintAllQRCodes = () => {
  if (!assets || assets.length === 0) {
    alert("Нет активов для печати");
    return;
  }

  // Фильтруем только компьютеры и ноутбуки
  const assetsForQR = assets.filter(asset => 
    asset.type === 'Ноутбук' || asset.type === 'Компьютер'
  );

  if (assetsForQR.length === 0) {
    alert("Нет активов типа 'Ноутбук' или 'Компьютер' для печати QR-кодов");
    return;
  }

  // Функция для генерации SVG QR-кода с помощью qrcode-generator
  const generateQRCodeSVG = (text) => {
    try {
      // Используем импортированную библиотеку напрямую
      const qr = qrCodeGenerator(0, 'M'); // 0 - автоматический выбор типа, 'M' - уровень коррекции
      qr.addData(text);
      qr.make();
    
      // Получаем SVG строку
      const svgString = qr.createSvgTag({ cellSize: 3, margin: 2 }); 
    
      return svgString;
    } catch (error) {
      console.error("Ошибка генерации QR-кода:", error);
      // Возвращаем placeholder в случае ошибки
      return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
                <rect width="120" height="120" fill="#f0f0f0" stroke="#ccc"/>
                <text x="60" y="60" text-anchor="middle" dominant-baseline="middle" 
                      font-family="Arial" font-size="12" fill="#999">QR Ошибка</text>
              </svg>`;
    }
  };
  // Создаем HTML для печати
  let printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR-коды активов</title>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          background-color: white;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          color: #333;
        }
        .qr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
          margin: 0 auto;
          max-width: 1200px;
        }
        .qr-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          page-break-inside: avoid;
        }
        .qr-container {
          margin-bottom: 12px;
          width: 120px;
          height: 120px;
          background-color: white;
          border: 1px solid #ccc;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .qr-title {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          margin-bottom: 5px;
          color: #333;
          word-break: break-word;
        }
        .qr-inventory {
          font-size: 12px;
          color: #666;
          text-align: center;
          margin-bottom: 5px;
        }
        .qr-id {
          font-size: 10px;
          color: #999;
          text-align: center;
        }
        @media print {
          body {
            margin: 0;
            padding: 20px;
          }
          .qr-card {
            border: 1px solid black;
            box-shadow: none;
            page-break-inside: avoid;
          }
          .header {
            margin-top: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>QR-коды активов</h1>
        <p>Всего кодов: ${assetsForQR.length}</p>
      </div>
      <div class="qr-grid">
  `;

  // Добавляем QR-коды для каждого актива
  assetsForQR.forEach(asset => {
    // Генерируем уникальный URL для этого актива
    const qrUrl = `${window.location.origin}${window.location.pathname}#asset-info-${asset.id}`;
    
    // Генерируем SVG QR-кода
    const qrSvg = generateQRCodeSVG(qrUrl);
    
    printContent += `
      <div class="qr-card">
        <div class="qr-container">
          ${qrSvg} <!-- Вставляем сгенерированный SVG -->
        </div>
        <div class="qr-title">${asset.model || asset.type || 'Актив'}</div>
        <div class="qr-inventory">${asset.inventory_number || 'Без инв. номера'}</div>
        <div class="qr-id">ID: ${asset.id}</div>
      </div>
    `;
  });

  printContent += `
      </div>
      <script>
        // Автоматически вызываем печать через небольшую задержку
        setTimeout(() => {
          window.print();
        }, 1000);
      </script>
    </body>
    </html>
  `;

  // Открываем новое окно для печати
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Фокусируемся на новом окне
  printWindow.focus();
};



const handlePrintSingleQRCode = (asset) => {
  if (!asset) {
    alert("Ошибка: нет данных об активе");
    return;
  }

  try {
    // Генерируем QR-код
    const qr = qrCodeGenerator(0, 'M');
    const qrUrl = `${window.location.origin}${window.location.pathname}#asset-info-${asset.id}`;
    qr.addData(qrUrl);
    qr.make();
    const qrSvgString = qr.createSvgTag({ cellSize: 4, margin: 2 });

    // Создаем HTML для печати
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-код для ${asset.inventory_number || asset.model || 'Актива'}</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: white;
          }
          .qr-container {
            text-align: center;
            padding: 20px;
            border: 1px solid #000;
            display: inline-block;
          }
          .qr-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .qr-inventory {
            font-size: 14px;
            margin-bottom: 10px;
          }
          .qr-model {
            font-size: 12px;
            color: #666;
            margin-bottom: 15px;
          }
          .qr-code {
            width: 200px;
            height: 200px;
          }
          @media print {
            body {
              padding: 10px;
            }
            .qr-container {
              border: 1px solid black;
            }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="qr-title">Информация об активе</div>
          <div class="qr-inventory">Инв. номер: ${asset.inventory_number || 'Без номера'}</div>
          <div class="qr-model">${asset.model || asset.type || 'Актив'}</div>
          <div class="qr-code">${qrSvgString}</div>
          <div style="margin-top: 15px; font-size: 10px; color: #999;">
            Отсканируйте для просмотра информации
          </div>
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    // Открываем новое окно для печати
    const printWindow = window.open('', '_blank', 'width=450,height=550');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    
  } catch (error) {
    console.error("Ошибка генерации QR-кода для печати:", error);
    alert("Ошибка при подготовке к печати QR-кода");
  }
};

  // Добавьте этот useEffect после других useEffect
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      // Проверяем, начинается ли хэш с #asset-info-
      if (hash && hash.startsWith('#asset-info-')) {
        const idStr = hash.substring(12); // Убираем '#asset-info-'
        const id = parseInt(idStr, 10);
        if (!isNaN(id) && id > 0) {
          console.log("Найден ID актива в URL-хэше:", id); // Для отладки
          setAssetIdFromUrlHash(id);
        } else {
          console.warn("Некорректный ID в URL-хэше:", idStr);
          setAssetIdFromUrlHash(null);
        }
      } else {
        // Если хэш не наш, сбрасываем состояние
        setAssetIdFromUrlHash(null);
      }
    };

    // Проверить при первой загрузке приложения
    handleHashChange();

    // Добавить слушатель события изменения хэша (например, при нажатии "Назад" в браузере)
    window.addEventListener('hashchange', handleHashChange);

    // Убрать слушатель при размонтировании компонента
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Пустой массив зависимостей - запускается только при монтировании/размонтировании

  // Добавьте этот useEffect рядом
  useEffect(() => {
      // Проверяем, есть ли ID из хэша и загружен ли список активов
      if (assetIdFromUrlHash && assets.length > 0) {
          console.log("Пытаемся открыть актив с ID:", assetIdFromUrlHash); // Для отладки
          // Найти актив по ID в вашем уже загруженном списке assets
          const assetToOpen = assets.find(a => a.id === assetIdFromUrlHash);
          if (assetToOpen) {
              console.log("Актив найден, открываем модальное окно:", assetToOpen.inventory_number); // Для отладки
              // Открыть модальное окно с информацией об активе
              // Предполагается, что openAssetInfoModal - ваша существующая функция
              openAssetInfoModal(assetToOpen);
              // ВАЖНО: Очистить assetIdFromUrlHash, чтобы это срабатывало только один раз
              // и не мешало обычной работе модального окна
              setAssetIdFromUrlHash(null);
              // Опционально: очистить хэш из URL после открытия
              // window.location.hash = '';
          } else {
              console.warn(`Актив с ID ${assetIdFromUrlHash} не найден в списке активов.`);
              // Можно показать уведомление пользователю, если он отсканировал QR-код
              // другого приложения или ID неверный
              alert(`Актив с ID ${assetIdFromUrlHash} не найден.`);
              setAssetIdFromUrlHash(null); // Важно сбросить, чтобы не было зацикливания
          }
      }
      // Важно: зависимость от assetIdFromUrlHash, assets и openAssetInfoModal
      // Если openAssetInfoModal не является useCallback, можно убрать её из зависимостей,
      // но лучше обернуть в useCallback
  }, [assetIdFromUrlHash, assets]); // Добавьте openAssetInfoModal, если она обернута в useCallback


  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // -------------------------------------------------------
  // --- Загрузка активов (только если есть токен) ---
  const fetchAssets = async () => {
    if (!token) {
      setAssets([]);
      setStats({
        total: 0,
        laptops: 0,
        monitors: 0,
        computers: 0,
        other: 0,
        retired: 0,
        underWarranty: 0,
        expiringWarranty: 0,
        inRepair: 0
      });
      return;
    }
    try {
      const res = await fetch('http://10.0.1.225:8000/assets/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
        }
        throw new Error(`Ошибка ${res.status}`);
      }
      const data = await res.json();
      setAssets(data);
      const today = new Date();
      const total = data.length;
      const laptops = data.filter(a => a.type === 'Ноутбук').length;
      const monitors = data.filter(a => a.type === 'Монитор').length;
      const computers = data.filter(a => a.type === 'Компьютер').length;
      const other = data.filter(a => a.type === 'Прочее').length;
      const retired = data.filter(a => a.status === 'списано').length;
      const inRepair = data.filter(a => a.status === 'на ремонте').length;
      const threshold = new Date();
      threshold.setDate(today.getDate() + 30);
      const expiringWarranty = data.filter(asset => {
        if (!asset.warranty_until) return false;
        const warrantyDate = new Date(asset.warranty_until);
        return warrantyDate >= today && warrantyDate <= threshold;
      }).length;
      const underWarranty = data.filter(asset => {
        if (!asset.warranty_until) return false;
        const warrantyDate = new Date(asset.warranty_until);
        return warrantyDate > today;
      }).length;
      setStats({
        total,
        laptops,
        monitors,
        computers,
        other,
        retired,
        underWarranty,
        expiringWarranty,
        inRepair
      });
    } catch (err) {
      console.error("Ошибка загрузки активов:", err);
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
      setExpiringWarranty([]);
    }
  }, [assets]);
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
  useEffect(() => {
    fetchAssets();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAboutModal) setShowAboutModal(false);
        if (isModalOpen || isEditing) closeModal();
        if (showUserModal) {
          setShowUserModal(false);
          setIsEditingUser(false);
          setEditingUser(null);
        }
        if (showRepairsModal) {
          setShowRepairsModal(false);
          setEditingRepairId(null);
        }
        if (showDeletionLogModal) {
          setShowDeletionLogModal(false);
        }
        if (showAssetInfoModal) {
          closeAssetInfoModal();
        }

      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAboutModal, isModalOpen, isEditing, showUserModal, showDeletionLogModal, showRepairsModal, showAssetInfoModal, token]);
  useEffect(() => {
    if (!token) {
      setUser(null);
      setUsers([]);
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
        if (userData.is_admin) {
          fetchUsers();
        }
      })
      .catch(() => {
        handleLogout();
      });
  }, [token]);
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
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setUsers([]);
    setAssets([]);
    setStats({
      total: 0,
      laptops: 0,
      monitors: 0,
      computers: 0,
      other: 0,
      retired: 0,
      underWarranty: 0,
      expiringWarranty: 0,
      inRepair: 0
    });
    setExpiringWarranty([]);
  };
  const handleExport = async () => {
    let filterText = "всех активов";
    if (filter !== 'Все') {
      filterText = `активов типа "${filter}"`;
    }
    if (disposedFilter) {
      filterText = "списанных активов";
    }
    if (warrantyFilter !== 'all' && !disposedFilter) {
        const warrantyText = warrantyFilter === 'active' ? 'на гарантии' : 'с заканчивающейся гарантией';
        if (filterText === "всех активов") {
            filterText = `активов ${warrantyText}`;
        } else {
            filterText += ` и ${warrantyText}`;
        }
    }
    if (searchQuery) {
      filterText += ` с поиском по "${searchQuery}"`;
    }
    const confirmExport = window.confirm(
      `Экспорт будет выполнен согласено выбранному фильтру ${filterText}.
Продолжить?`
    );
    if (!confirmExport) return;
    try {
      const params = new URLSearchParams();
      if (filter !== 'Все' && !disposedFilter) {
        params.append('type', filter);
      }
      if (disposedFilter) {
        params.append('status', 'списано');
      }
      if (searchQuery) {
        params.append('q', searchQuery);
      }
      if (warrantyFilter !== 'all' && !disposedFilter) {
          params.append('warranty_status', warrantyFilter);
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
      // Исправленное регулярное выражение
      const filenameMatch = res.headers.get('Content-Disposition')?.match(/filename[^;=\r\n]*=([^;\r\n]*)/);
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
      if (result.errors && result.errors.length > 0) {
        alert(`Импорт частично завершён:\n${result.errors.join('\n')}`);
      } else {
        alert(result.detail);
      }
      await fetchAssets();
    } catch (err) {
      alert('Критическая ошибка импорта: ' + err.message);
      console.error(err);
    }
    e.target.value = null;
  };
  const handleClearDatabase = async () => {
    const wantBackup = window.confirm(
      "Перед очисткой базы рекомендуется сделать резервную копию. Скачать Excel-файл со всеми данными перед удалением?"
    );
    if (wantBackup) {
      const link = document.createElement('a');
      link.href = `http://10.0.1.225:8000/export/excel`;
      link.setAttribute('download', '');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const confirmed = window.confirm(
      "ВНИМАНИЕ: Все активы и история изменений будут безвозвратно удалены. Вы уверены, что хотите очистить всю базу?"
    );
    if (!confirmed) return;
    try {
      const res = await fetch('http://10.0.1.225:8000/admin/clear-db', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message);
        setAssets([]);
        setStats({
          total: 0,
          laptops: 0,
          monitors: 0,
          computers: 0,
          other: 0,
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
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  const openModal = (asset = null) => {
    if (asset) {
      setFormData({
        id: asset.id,
        inventory_number: asset.inventory_number || '',
        serial_number: asset.serial_number || '',
        model: asset.model || '',
        purchase_date: asset.purchase_date || '',
        warranty_until: asset.warranty_until || '',
        status: asset.status || 'в эксплуатации',
        location: asset.location || '',
        user_name: asset.user_name || '',
        motherboard: asset.motherboard || '',
        processor: asset.processor || '',
        ram: asset.ram || '',
        comment: asset.comment || '',
        type: asset.type || '',
        issue_date: asset.issue_date || '',
        windows_key: asset.windows_key || '',
        os_type: asset.os_type || '',
      });
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
        type: '',
        issue_date: '',
        windows_key: '',
        os_type: '',
      });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
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
    const payload = {};
    for (const key in formData) {
      const value = formData[key];
      if (['purchase_date', 'warranty_until', 'issue_date'].includes(key)) {
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
        fetchAssets();
      } else {
        const errorData = await res.json().catch(() => null);
        if (errorData?.detail) {
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
      created: 'Создание',
     // deleted: 'Удаление'
    };
    return labels[field] || field;
  };
  const handleEdit = async (asset) => {
    const res = await fetch(`http://10.0.1.225:8000/assets/${asset.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const fullAsset = await res.json();
    openModal(fullAsset);
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены?')) return;
    const res = await fetch(`http://10.0.1.225:8000/assets/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setAssets(assets.filter(a => a.id !== id));
      alert("Актив удален");
      fetchAssets();
    } else {
      alert("Ошибка удаления");
    }
  };
  // --- Inline-редактирование ---
  const startEditing = (assetId, field, currentValue) => {
    if (!user?.is_admin) return;
    setEditingCell({ assetId, field });
    setEditValue(currentValue == null ? '' : String(currentValue));
  };
  const handleEditChange = (e) => {
    setEditValue(e.target.value);
  };
  const saveEdit = async () => {
    const { assetId, field } = editingCell;
    if (assetId === null || field === null) return;
    const assetToEdit = assets.find(a => a.id === assetId);
    if (!assetToEdit) return;
    const currentValue = assetToEdit[field];
    const newValue = editValue;
    if (currentValue == newValue || (currentValue === null && newValue === '')) {
      cancelEdit();
      return;
    }
    const updatedAssetData = { ...assetToEdit };
    if (newValue === '' && (typeof currentValue === 'string' || currentValue === null || field.includes('date'))) {
      updatedAssetData[field] = null;
    } else {
      updatedAssetData[field] = newValue;
    }
    delete updatedAssetData.id;
    delete updatedAssetData.history;
    try {
      const res = await fetch(`http://10.0.1.225:8000/assets/${assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedAssetData)
      });
      if (res.ok) {
        const updatedAssetFromServer = await res.json();
        setAssets(assets.map(a => a.id === updatedAssetFromServer.id ? updatedAssetFromServer : a));
        fetchAssets();
        cancelEdit();
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`Ошибка обновления: ${errorData?.detail || 'Неизвестная ошибка'}`);
        cancelEdit();
      }
    } catch (err) {
      alert('Ошибка сети при обновлении');
      console.error(err);
      cancelEdit();
    }
  };
  const cancelEdit = () => {
    setEditingCell({ assetId: null, field: null });
    setEditValue('');
  };
  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };
  // -----------------------------
  // --- Фильтрация + поиск ---
  const getFilteredAssets = () => {
    let result = [...assets];
    if (disposedFilter) {
      result = result.filter(asset => asset.status === 'списано');
    } else {
      if (filter !== 'Все') {
        result = result.filter(asset => asset.type === filter);
      }
      const today = new Date();
      if (warrantyFilter === 'active') {
        result = result.filter(asset => {
          if (!asset.warranty_until) return false;
          const warrantyDate = new Date(asset.warranty_until);
          return warrantyDate > today;
        });
      } else if (warrantyFilter === 'expiring') {
        const threshold = new Date();
        threshold.setDate(today.getDate() + 30);
        result = result.filter(asset => {
          if (!asset.warranty_until) return false;
          const warrantyDate = new Date(asset.warranty_until);
          return warrantyDate >= today && warrantyDate <= threshold;
        });
      }
    }
    if (searchQuery) {
      result = result.filter(asset =>
        Object.values(asset).some(val => {
          if (val == null || typeof val === 'number' || val instanceof Date) {
            return false;
          }
          return String(val).toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    }
    // NEW: Фильтрация по выбранному пользователю
    result = result.filter(asset => !selectedUser || asset.user_name === selectedUser);
    return result;
  };
  const filteredAssets = getFilteredAssets();
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  // ------------------------
  // --- Функции для управления пользователями ---
  const openUserModal = (userToEdit = null) => {
    if (userToEdit) {
      setIsEditingUser(true);
      setEditingUser(userToEdit);
      setUserFormData({
        username: userToEdit.username,
        password: '',
        is_admin: userToEdit.is_admin
      });
    } else {
      setIsEditingUser(false);
      setEditingUser(null);
      setUserFormData({
        username: '',
        password: '',
        is_admin: false
      });
    }
    setShowUserModal(true);
    fetchUsers();
  };
  const handleUserChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userFormData.username || !userFormData.username.trim()) {
      alert("Пожалуйста, заполните имя пользователя");
      return;
    }
    if (!isEditingUser && (!userFormData.password || !userFormData.password.trim())) {
      alert("Пожалуйста, заполните пароль");
      return;
    }
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
          setUsers(users.map(u => u.id === updatedOrNewUser.id ? updatedOrNewUser : u));
          alert("Пользователь обновлен");
        } else {
          setUsers([...users, updatedOrNewUser]);
          alert("Пользователь создан");
        }
        setShowUserModal(false);
        setIsEditingUser(false);
        setEditingUser(null);
        setUserFormData({ username: '', password: '', is_admin: false });
      } else {
        const errorData = await res.json();
        alert(errorData.detail || `Ошибка ${isEditingUser ? 'обновления' : 'создания'} пользователя`);
      }
    } catch (err) {
      alert("Ошибка сети");
      console.error(err);
    }
  };
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    if (userId === user.id) {
      alert("Нельзя удалить самого себя!");
      return;
    }
    try {
      const res = await fetch(`http://10.0.1.225:8000/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
  // --- Функции для управления ремонтами ---
  const fetchRepairsForAsset = async (assetId) => {
    if (!token) return;
    try {
      const res = await fetch(`http://10.0.1.225:8000/assets/${assetId}/repairs/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRepairsForAsset(data);
      } else {
        console.error("Ошибка загрузки ремонтов:", await res.text());
        setRepairsForAsset([]);
      }
    } catch (err) {
      console.error("Ошибка сети при загрузке ремонтов:", err);
      setRepairsForAsset([]);
    }
  };
  const openRepairsModal = async (assetId) => {
    setCurrentAssetId(assetId);
    await fetchRepairsForAsset(assetId);
    setEditingRepairId(null);
    setRepairFormData({
      repair_date: '',
      description: '',
      cost: '',
      performed_by: '',
    });
    setShowRepairsModal(true);
  };
  const handleRepairChange = (e) => {
    const { name, value } = e.target;
    setRepairFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleCreateRepair = async (e) => {
    e.preventDefault();
    if (!currentAssetId || !token) return;
    try {
      const res = await fetch(`http://10.0.1.225:8000/assets/${currentAssetId}/repairs/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(repairFormData)
      });
      if (res.ok) {
        const newRepair = await res.json();
        setRepairsForAsset(prev => [...prev, newRepair]);
        setRepairFormData({
          repair_date: '',
          description: '',
          cost: '',
          performed_by: '',
        });
        alert("Запись о ремонте добавлена");
      } else {
        const errorData = await res.json();
        alert(`Ошибка создания записи: ${errorData.detail || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      alert("Ошибка сети при создании записи");
      console.error(err);
    }
  };
  const handleEditRepair = (repair) => {
    setEditingRepairId(repair.id);
    setRepairFormData({
      repair_date: repair.repair_date,
      description: repair.description,
      cost: repair.cost || '',
      performed_by: repair.performed_by || '',
    });
  };
  const handleUpdateRepair = async (e) => {
    e.preventDefault();
    if (!editingRepairId || !token) return;
    try {
      const res = await fetch(`http://10.0.1.225:8000/repairs/${editingRepairId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(repairFormData)
      });
      if (res.ok) {
        const updatedRepair = await res.json();
        setRepairsForAsset(prev => prev.map(r => r.id === updatedRepair.id ? updatedRepair : r));
        setEditingRepairId(null);
        setRepairFormData({
          repair_date: '',
          description: '',
          cost: '',
          performed_by: '',
        });
        alert("Запись о ремонте обновлена");
      } else {
        const errorData = await res.json();
        alert(`Ошибка обновления записи: ${errorData.detail || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      alert("Ошибка сети при обновлении записи");
      console.error(err);
    }
  };
  const handleDeleteRepair = async (recordId) => {
    if (!window.confirm("Вы уверены, что хотите удалить эту запись о ремонте?")) return;
    if (!token) return;
    try {
      const res = await fetch(`http://10.0.1.225:8000/repairs/${recordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setRepairsForAsset(prev => prev.filter(r => r.id !== recordId));
        alert("Запись о ремонте удалена");
      } else {
        const errorData = await res.json();
        alert(`Ошибка удаления записи: ${errorData.detail || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      alert("Ошибка сети при удалении записи");
      console.error(err);
    }
  };
  // ------------------------------------
  
  // --- Функция для рендеринга мобильного представления актива ---
  const renderMobileAssetDetails = (asset) => (
    <div className="mobile-view" key={asset.id}>
      <div><strong>ID:</strong> {asset.id}</div>
      <div><strong>Инвентарный номер:</strong> <span className={user?.is_admin ? 'editable-cell' : ''} onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'inventory_number', asset.inventory_number)}>{asset.inventory_number || '-'}</span></div>
      <div><strong>Серийный номер:</strong> <span className={user?.is_admin ? 'editable-cell' : ''} onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'serial_number', asset.serial_number)}>{asset.serial_number || '-'}</span></div>
      <div><strong>Статус:</strong> <span className={user?.is_admin ? 'editable-cell' : ''} onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'status', asset.status)}>{asset.status}</span></div>
      <div><strong>Расположение:</strong> <span className={user?.is_admin ? 'editable-cell' : ''} onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'location', asset.location)}>{asset.location}</span></div>
      <div><strong>ФИО пользователя:</strong> <span className={user?.is_admin ? 'editable-cell' : ''} onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'user_name', asset.user_name)}>{asset.user_name || '-'}</span></div>
      {warrantyFilter === 'active' && <div><strong>Гарантия до:</strong> {asset.warranty_until || '-'}</div>}
      <div><strong>Комментарий:</strong> <div className={user?.is_admin ? 'editable-cell comment-cell' : 'comment-cell'} onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'comment', asset.comment)}>{asset.comment || ''}</div></div>
      {user?.is_admin && (
        <div className="mt-2">
          <strong>Действия:</strong>
          <div className="d-flex gap-1 flex-wrap mt-1">
            <button
              className="btn btn-sm btn-outline-primary"
              title="Редактировать"
              onClick={() => handleEdit(asset)}
            >
              <i className="fas fa-edit"></i>
            </button>
            <button
              className="btn btn-sm btn-outline-danger"
              title="Удалить"
              onClick={() => handleDelete(asset.id)}
            >
              <i className="fas fa-trash"></i>
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              title={showHistory === asset.id ? "Скрыть историю" : "Показать историю"}
              onClick={() => {
                if (showHistory === asset.id) {
                  setShowHistory(null);
                } else {
                  setShowHistory(asset.id);
                  // Сброс пагинации истории при открытии новой
                  setHistoryPage(1);
                }
              }}
            >
              <i className={`fas ${showHistory === asset.id ? 'fa-eye-slash' : 'fa-history'}`}></i>
            </button>
            <button
              className="btn btn-sm btn-outline-info"
              title="Показать ремонты"
              onClick={() => openRepairsModal(asset.id)}
            >
              <i className="fas fa-wrench"></i>
            </button>
	    {(asset.type === 'Ноутбук' || asset.type === 'Компьютер') && (
              <button
                className="btn btn-sm btn-outline-info"
                title="Информация о ПК"
                onClick={() => openAssetInfoModal(asset)}
              >
                <i className="fas fa-info-circle"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {showHistory === asset.id && asset.history && asset.history.length > 0 && (
        <div className="mt-2 p-2 bg-light rounded">
          <strong>История изменений:</strong>
          {/* Пагинация истории - мобильная версия */}
          <HistoryPagination 
            history={asset.history} 
            historyPage={historyPage} 
            setHistoryPage={setHistoryPage} 
            historyItemsPerPage={historyItemsPerPage}
          />
          <ul className="mb-0 ps-3 small">
            {asset.history
              .slice()
              .reverse() // Сортировка от свежих к старым
              .slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage)
              .map((h, idx) => (
                <li key={idx}>
                  ({h.changed_at}) {h.changed_by ? `[${h.changed_by}] ` : ''}
                  {getHumanFieldName(h.field)}: "{h.old_value}" → "{h.new_value}"
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
  // ---------------------------------------------------------------
  
  // --- Функция для рендеринга пагинации истории ---
  const HistoryPagination = ({ history, historyPage, setHistoryPage, historyItemsPerPage }) => {
    const historyTotalPages = Math.ceil(history.length / historyItemsPerPage);
    
    if (historyTotalPages <= 1) return null;
    
    return (
      <div className="d-flex justify-content-between align-items-center mb-2">
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
          disabled={historyPage === 1}
        >
          Назад
        </button>
        <span className="small">
          Страница {historyPage} из {historyTotalPages}
        </span>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
          disabled={historyPage === historyTotalPages}
        >
          Вперёд
        </button>
      </div>
    );
  };
  // ----------------------------------------------

  return (
    <div className="container mt-4">
      {!token && (
        <form
          className="login-form mb-4 p-3 bg-light border rounded"
          onSubmit={(e) => {
            e.preventDefault();
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
          {/* Используем d-flex и flex-wrap для создания гибкой сетки */}
          <div className="d-flex flex-wrap justify-content-start gap-3">
            {/* Группа 1: Общая сводка */}
            <div className="stat-card">
              <div className="stat-value text-primary">{stats.total}</div>
              <div className="stat-label">Всего активов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-success">{stats.laptops}</div>
              <div className="stat-label">Ноутбуков</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-info">{stats.monitors}</div>
              <div className="stat-label">Мониторов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-secondary">{stats.computers}</div>
              <div className="stat-label">Компьютеров</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-muted">{stats.other}</div>
              <div className="stat-label">Прочее</div>
            </div>
            {/* Разделитель или новая строка (визуально) */}
            <div className="vr d-none d-md-block mx-2"></div> {/* Вертикальная линия на md+ */}
            {/* Группа 2: Статусы */}
            <div className="stat-card">
              <div className="stat-value text-dark">{stats.retired}</div>
              <div className="stat-label">Списано</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-danger">{stats.inRepair}</div>
              <div className="stat-label">В ремонте</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-primary">{stats.underWarranty}</div>
              <div className="stat-label">На гарантии</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-warning">{stats.expiringWarranty}</div>
              <div className="stat-label">Гарантия истекает</div>
            </div>
          </div>
        </div>
      )}
      {token && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span>Вы вошли как {user?.username || 'пользователь'}</span>
          <div className="d-flex align-items-center gap-2">
            <img
              src="/asset-logo.png"
              alt="Логотип"
              style={{
                height: '80px',
                opacity: 0.9,
                filter: 'grayscale(100%)'
              }}
            />
            <button className="btn btn-outline-danger" onClick={handleLogout}>Выйти</button>
          </div>
        </div>
      )}
      {token && user && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 p-2 bg-white border rounded">
          <div className="d-flex flex-wrap gap-1">
            <button
              className="btn btn-outline-info btn-sm"
              onClick={() => setShowAboutModal(true)}
              title="О системе"
            >
              <i className="fas fa-info-circle"></i> О системе
            </button>
            <button
              className="btn btn-outline-success btn-sm"
              onClick={handleExport}
              title="Экспорт в Excel"
            >
              <i className="fas fa-file-export"></i> Экспорт
            </button>
            {user.is_admin && (
              <>
                <label
                  className="btn btn-outline-primary btn-sm mb-0 d-flex align-items-center"
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
                <button className="btn btn-info btn-sm" onClick={handlePrintAllQRCodes}>
                  <i className="fas fa-qrcode"></i> Печать всех QR-кодов
                </button>
              </>
            )}
          </div>

          {user.is_admin && (
            <div className="d-flex flex-wrap gap-1">
              <button
                className="btn btn-success btn-sm"
                onClick={() => openModal()}
                title="Добавить актив"
              >
                <i className="fas fa-plus"></i> Добавить
              </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={() => openUserModal()}
                title="Управление пользователями"
              >
                <i className="fas fa-users"></i> Пользователи
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleClearDatabase}
                title="Очистить всю базу"
              >
                <i className="fas fa-trash-alt"></i> Очистить
              </button>
              <button
                className="btn btn-info btn-sm"
                onClick={openDeletionLogModal}
                title="Просмотреть журнал удалений"
              >
                <i className="fas fa-history"></i> Журнал удалений
              </button>
               
            </div>
          )}
        </div>
      )}
      {token && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
          <div className="btn-group" role="group">
            <button
              className={`btn btn-outline-primary ${filter === 'Все' ? 'active' : ''}`}
              onClick={() => {
                setFilter('Все');
                setDisposedFilter(false);
                setPage(1);
              }}
            >
              Все типы
            </button>
            <button
              className={`btn btn-outline-primary ${filter === 'Монитор' ? 'active' : ''}`}
              onClick={() => {
                setFilter('Монитор');
                setDisposedFilter(false);
                setPage(1);
              }}
            >
              Мониторы
            </button>
            <button
              className={`btn btn-outline-primary ${filter === 'Компьютер' ? 'active' : ''}`}
              onClick={() => {
                setFilter('Компьютер');
                setDisposedFilter(false);
                setPage(1);
              }}
            >
              Компьютеры
            </button>
            <button
              className={`btn btn-outline-primary ${filter === 'Ноутбук' ? 'active' : ''}`}
              onClick={() => {
                setFilter('Ноутбук');
                setDisposedFilter(false);
                setPage(1);
              }}
            >
              Ноутбуки
            </button>
            <button
              className={`btn btn-outline-primary ${filter === 'Прочее' ? 'active' : ''}`}
              onClick={() => {
                setFilter('Прочее');
                setDisposedFilter(false);
                setPage(1);
              }}
            >
              Прочее
            </button>
          </div>
          <div className="btn-group" role="group">
            <button
              className={`btn btn-outline-dark ${disposedFilter ? 'active' : ''}`}
              onClick={() => {
                setDisposedFilter(!disposedFilter);
                setFilter('Все');
                setWarrantyFilter('all');
                setPage(1);
                if (activeTab !== 'assets') setActiveTab('assets');
              }}
              title="Показать только списанные активы"
            >
              <i className="fas fa-trash-alt"></i> Списано
            </button>
          </div>
          <div className="btn-group" role="group">
            <button
              className={`btn btn-outline-success ${warrantyFilter === 'active' ? 'active' : ''}`}
              onClick={() => {
                setWarrantyFilter('active');
                setDisposedFilter(false);
                setPage(1);
                if (activeTab !== 'assets') setActiveTab('assets');
              }}
              title="Показать активы на гарантии"
            >
              <i className="fas fa-shield-alt"></i> На гарантии
            </button>
            <button
              className={`btn ${activeTab === 'reports' ? 'btn-warning' : 'btn-outline-warning'}`}
              onClick={() => setActiveTab(activeTab === 'reports' ? 'assets' : 'reports')}
              title="Показать отчет: гарантия заканчивается"
            >
              <i className="fas fa-exclamation-triangle"></i> {activeTab === 'reports' ? 'Вернуться к таблице' : 'Гарантия заканчивается'}
            </button>
          </div>
          <div className="small text-muted">
            {filter !== 'Все' && `Тип: ${filter}`}
            {disposedFilter && ` | Списано`}
            {warrantyFilter !== 'all' && !disposedFilter && ` | Гарантия: ${warrantyFilter === 'active' ? 'активна' : 'заканчивается'}`}
            {(filter !== 'Все' || disposedFilter || warrantyFilter !== 'all') && (
              <button
                className="btn btn-sm btn-outline-secondary ms-2"
                onClick={() => {
                  setFilter('Все');
                  setDisposedFilter(false);
                  setWarrantyFilter('all');
                  setPage(1);
                }}
              >
                Сбросить фильтры
              </button>
            )}
          </div>
          {/* NEW: Выпадающий список с поиском по ФИО пользователя (react-select) */}
          <div className="me-2 align-self-center" style={{ minWidth: '200px' }}>
            <Select
              options={uniqueUsers}
              value={selectedUser ? { value: selectedUser, label: selectedUser } : null}
              onChange={(option) => {
                setSelectedUser(option ? option.value : '');
                setPage(1);
              }}
              isClearable
              isSearchable
              placeholder="Все пользователи"
              noOptionsMessage={() => "Нет пользователей"}
              classNamePrefix="react-select"
            />
          </div>
        </div>
      )}
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
      {/* Основной контейнер для таблицы и мобильного представления */}
      <React.Fragment>
        {/* Десктопная таблица */}
        {token && activeTab === 'assets' && !isMobile && (
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
                    {warrantyFilter === 'active' && <th>Гарантия до</th>}
                    {user?.is_admin && <th>Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedAssets.length > 0 ? (
                    paginatedAssets.map((asset) => (
                      <React.Fragment key={asset.id}>
                        <tr>
                          <td data-label="ID">{asset.id}</td>
                          <td
                            data-label="Инвентарный номер"
                            onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'inventory_number', asset.inventory_number)}
                          >
                            {editingCell.assetId === asset.id && editingCell.field === 'inventory_number' ? (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={user?.is_admin ? 'editable-cell' : ''}>{asset.inventory_number || '-'}</span>
                            )}
                          </td>
                          <td
                            data-label="Серийный номер"
                            onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'serial_number', asset.serial_number)}
                          >
                            {editingCell.assetId === asset.id && editingCell.field === 'serial_number' ? (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={user?.is_admin ? 'editable-cell' : ''}>{asset.serial_number || '-'}</span>
                            )}
                          </td>
                          <td
                            data-label="Статус"
                            onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'status', asset.status)}
                          >
                            {editingCell.assetId === asset.id && editingCell.field === 'status' ? (
                              <select
                                className="form-select form-select-sm"
                                value={editValue}
                                onChange={handleEditChange}
                                onBlur={saveEdit}
                                autoFocus
                              >
                                <option value="в эксплуатации">в эксплуатации</option>
                                <option value="на ремонте">на ремонте</option>
                                <option value="списано">списано</option>
                              </select>
                            ) : (
                              <span className={user?.is_admin ? 'editable-cell' : ''}>{asset.status}</span>
                            )}
                          </td>
                          <td
                            data-label="Расположение"
                            onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'location', asset.location)}
                          >
                            {editingCell.assetId === asset.id && editingCell.field === 'location' ? (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={user?.is_admin ? 'editable-cell' : ''}>{asset.location}</span>
                            )}
                          </td>
                          <td
                            data-label="ФИО пользователя"
                            onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'user_name', asset.user_name)}
                          >
                            {editingCell.assetId === asset.id && editingCell.field === 'user_name' ? (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={user?.is_admin ? 'editable-cell' : ''}>{asset.user_name || '-'}</span>
                            )}
                          </td>
                          <td
                            data-label="Комментарий"
                            onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'comment', asset.comment)}
                          >
                            {editingCell.assetId === asset.id && editingCell.field === 'comment' ? (
                              <textarea
                                className="form-control form-control-sm"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <div className={user?.is_admin ? 'editable-cell comment-cell' : 'comment-cell'}>
                                {asset.comment || ''}
                              </div>
                            )}
                          </td>
                          {warrantyFilter === 'active' && <td data-label="Гарантия до">{asset.warranty_until || '-'}</td>}
                          {user?.is_admin && (
                            <td className="text-center">
                              <button
                                className="btn btn-sm btn-outline-primary me-1"
                                title="Редактировать"
                                onClick={() => handleEdit(asset)}
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger me-1"
                                title="Удалить"
                                onClick={() => handleDelete(asset.id)}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary me-1"
                                title={showHistory === asset.id ? "Скрыть историю" : "Показать историю"}
                                onClick={() => {
                                  if (showHistory === asset.id) {
                                    setShowHistory(null);
                                  } else {
                                    setShowHistory(asset.id);
                                    // Сброс пагинации истории при открытии новой
                                    setHistoryPage(1);
                                  }
                                }}
                              >
                                <i className={`fas ${showHistory === asset.id ? 'fa-eye-slash' : 'fa-history'}`}></i>
                              </button>
                              {(asset.type === 'Ноутбук' || asset.type === 'Компьютер') && (
	                        <button
                                  className="btn btn-sm btn-outline-info"
                                  title="Информация о ПК"
                                  onClick={() => openAssetInfoModal(asset)}
                                >
                                  <i className="fas fa-info-circle"></i>
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-outline-info"
                                title="Показать ремонты"
                                onClick={() => openRepairsModal(asset.id)}
                              >
                                <i className="fas fa-wrench"></i>
                              </button>
                            </td>
                          )}
                        </tr>
                        {showHistory === asset.id && asset.history && asset.history.length > 0 && (
                          <tr>
                            <td colSpan={(user?.is_admin ? 8 : 7) + (warrantyFilter === 'active' ? 1 : 0)} className="bg-light small p-2" style={{ textAlign: 'left' }}>
                              <strong>История изменений:</strong>
                              {/* Пагинация истории - десктопная версия */}
                              <HistoryPagination 
                                history={asset.history} 
                                historyPage={historyPage} 
                                setHistoryPage={setHistoryPage} 
                                historyItemsPerPage={historyItemsPerPage}
                              />
                              <ul className="mb-0 ps-3">
                                {asset.history
                                  .slice()
                                  .reverse() // Сортировка от свежих к старым
                                  .slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage)
                                  .map((h, idx) => (
                                    <li key={idx}>
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
                      <td colSpan={(user?.is_admin ? 8 : 7) + (warrantyFilter === 'active' ? 1 : 0)} className="text-center">Нет данных</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Мобильное представление */}
        {token && activeTab === 'assets' && isMobile && (
          <div className="mobile-container">
            {paginatedAssets.length > 0 ? (
              paginatedAssets.map(asset => renderMobileAssetDetails(asset))
            ) : (
              <div className="text-center p-3">Нет данных</div>
            )}
          </div>
        )}
      </React.Fragment>
      {/* Конец контейнера для таблицы и мобильного представления */}
      {token && activeTab === 'assets' && assets.length > 0 && !isMobile && (
        <div className="pagination-container d-flex justify-content-between align-items-center mt-3 mb-4">
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
                  setPage(1);
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
                      value={formData.purchase_date || ''}
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
      {showUserModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-lg" role="document">
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
                                    onClick={() => openUserModal(u)}
                                    title="Редактировать"
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteUser(u.id)}
                                    title="Удалить"
                                    disabled={u.id === user.id}
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
      {/* Модальное окно для ремонтов */}
      {showRepairsModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  История ремонтов (Актив ID: {currentAssetId})
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowRepairsModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Форма добавления/редактирования */}
                <form onSubmit={editingRepairId ? handleUpdateRepair : handleCreateRepair} className="mb-4 p-3 border rounded">
                  <h6>{editingRepairId ? 'Редактировать запись' : 'Добавить новую запись'}</h6>
                  <div className="row g-2">
                    <div className="col-md-3">
                      <label className="form-label">Дата ремонта *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        name="repair_date"
                        value={repairFormData.repair_date}
                        onChange={handleRepairChange}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Стоимость</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        name="cost"
                        value={repairFormData.cost}
                        onChange={handleRepairChange}
                        placeholder="Например, 1500 руб."
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Кто выполнил</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        name="performed_by"
                        value={repairFormData.performed_by}
                        onChange={handleRepairChange}
                        placeholder="ФИО или организация"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Описание работ *</label>
                      <textarea
                        className="form-control form-control-sm"
                        name="description"
                        value={repairFormData.description}
                        onChange={handleRepairChange}
                        rows="2"
                        required
                      ></textarea>
                    </div>
                    <div className="col-12 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary me-2"
                        onClick={() => {
                          setEditingRepairId(null);
                          setRepairFormData({
                            repair_date: '',
                            description: '',
                            cost: '',
                            performed_by: '',
                          });
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="btn btn-sm btn-success"
                      >
                        {editingRepairId ? 'Сохранить изменения' : 'Добавить запись'}
                      </button>
                    </div>
                  </div>
                </form>
                {/* Список ремонтов */}
                <h6>Список записей</h6>
                {repairsForAsset.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover table-sm">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Описание</th>
                          <th>Стоимость</th>
                          <th>Кто выполнил</th>
                          <th>Создано</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repairsForAsset.map((record) => (
                          <tr key={record.id}>
                            <td>{record.repair_date}</td>
                            <td>{record.description}</td>
                            <td>{record.cost}</td>
                            <td>{record.performed_by}</td>
                            <td>{new Date(record.created_at).toLocaleString()}</td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-primary me-1"
                                onClick={() => handleEditRepair(record)}
                                title="Редактировать"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteRepair(record.id)}
                                title="Удалить"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">Нет записей о ремонте для этого актива.</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRepairsModal(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Модальное окно для журнала удалений */}
      {showDeletionLogModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-xl" role="document"> {/* Используем modal-xl для большего пространства */}
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Журнал удалений</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowDeletionLogModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {deletionLogLoading ? (
                  <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Загрузка...</span>
                    </div>
                  </div>
                ) : deletionLogs.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover table-sm">
                      <thead>
                        <tr>
                          <th>Дата/Время</th>
                          <th>Тип</th>
                          <th>ID</th>
                          <th>Удалено пользователем</th>
                          <th>Данные (кратко)</th> 
                        </tr>
                      </thead>
                      <tbody>
                        {deletionLogs.map((log) => {
                          let shortData = '-';
                          if (log.entity_data) {
                            try {
                              // Если entity_data - строка JSON
                              const dataObj = JSON.parse(log.entity_data);
                              // Покажем, например, инвентарный номер или ID
                              shortData = dataObj.inventory_number || dataObj.id || 'Данные есть';
                            } catch (e) {
                              // Если не JSON, покажем как есть или обрежем
                              shortData = log.entity_data.substring(0, 50) + (log.entity_data.length > 50 ? '...' : '');
                            }
                          }
                          return (
                            <tr key={log.id}>
                              <td>{new Date(log.deleted_at).toLocaleString()}</td>
                              <td>{log.entity_type}</td>
                              <td>{log.entity_id}</td>
                              <td>{log.deleted_by}</td>
                              {/* <td>{log.reason || '-'}</td> */}
                              <td>{shortData}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted text-center">Записи об удалениях отсутствуют.</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeletionLogModal(false)}
                >
                  Закрыть
                </button>
                {/* Можно добавить кнопку обновления журнала */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={fetchDeletionLogs}
                  disabled={deletionLogLoading}
                >
                  {deletionLogLoading ? 'Обновление...' : 'Обновить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Фон затемнения для модального окна журнала */}
      {showDeletionLogModal && (
        <div
          className="modal-backdrop fade show"
          onClick={() => setShowDeletionLogModal(false)}
        ></div>
      )}




      {/* Фон затемнения для модального окна ремонтов */}
      {showRepairsModal && (
        <div
          className="modal-backdrop fade show"
          onClick={() => setShowRepairsModal(false)}
        ></div>
      )}
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
      
      {showAssetInfoModal && assetInfo && (
        <>
          <div className="modal fade show" style={{ display: 'block' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Информация об активе — {assetInfo.inventory_number}</h5>
                  <button type="button" className="btn-close" onClick={closeAssetInfoModal}></button>
                </div>
                <div className="modal-body">
		  {/* --- НАЧАЛО ДОБАВЛЕНИЯ QR-КОДА (react-qr-code) --- */}
		  <div className="mb-3 d-flex flex-column align-items-center">
                    <div style={{ height: "auto", margin: "0 auto", maxWidth: "160px", width: "100%" }}>
                      <div style={{ height: "160px", width: "160px", backgroundColor: "white", padding: "8px", borderRadius: "4px" }}>
                      {/* Кодируем хэш URL, который будет обрабатываться приложением */}
                        <QRCode
                          size={256}
                          style={{ height: "100%", width: "100%" }}
                          value={`${window.location.origin}${window.location.pathname}#asset-info-${assetInfo.id}`}
                          viewBox={`0 0 256 256`}
                        />
                      </div>
                    </div>
                    <p className="text-center text-muted small mt-2 mb-0">Отсканируйте QR-код на активе для быстрого доступа к информации</p>
                    <button 
                      className="btn btn-outline-primary btn-sm mt-2"
                      onClick={() => handlePrintSingleQRCode(assetInfo)}
                    >
                      <i className="fas fa-print"></i> Печать QR-кода
                    </button>
                  </div>
		   {/* --- КОНЕЦ ДОБАВЛЕНИЯ QR-КОДА --- */}
                  <table className="table table-bordered">
                    <tbody>
                      <tr><th>Материнская плата</th><td>{assetInfo.motherboard || '-'}</td></tr>
                      <tr><th>Процессор</th><td>{assetInfo.processor || '-'}</td></tr>
                      <tr><th>ОЗУ</th><td>{assetInfo.ram || '-'}</td></tr>
                      <tr><th>Операционная система</th><td>{assetInfo.os_type || '-'}</td></tr>
                      <tr><th>Ключ Windows</th><td>{assetInfo.windows_key || '-'}</td></tr>
                    </tbody>
                  </table>                  
		</div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeAssetInfoModal}>Закрыть</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
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
		  <li>Узнавать историю ремонтов оборудования</li>
                </ul>
                <p>Разработано для повышения прозрачности и эффективности учёта оборудования.</p>
                <p>
                  <a
                    href="https://gitlab.aspro.cloud/office/asset_tracker/"
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
      {showAboutModal && <div className="modal-backdrop fade show"></div>}
    </div>
  );
}
export default App;
