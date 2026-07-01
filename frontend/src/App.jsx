// app.jsx
import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import qrCodeGenerator from 'qrcode-generator';
import './TableStyles.css';
import packageInfo from '../package.json';
import toast, { Toaster } from 'react-hot-toast';


const API_BASE = import.meta.env.VITE_API_URL || 'http://10.0.1.225:8000';

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.reload();
  }
  return res;
}

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
    manual_age: '',
    storage_type: '',
    storage_size: '',
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
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [ageRangeFilter, setAgeRangeFilter] = useState('all');
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
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    is_admin: false
  });
  const [editingCell, setEditingCell] = useState({ assetId: null, field: null });
  const [editValue, setEditValue] = useState('');
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 5;
  const resetHistoryPagination = () => {
    setHistoryPage(1);
  };
  const handleHistoryPageChange = (assetId, newPage) => {
    setHistoryPage(newPage);
  };
  // Обновляем useEffect для сброса пагинации при изменении показа истории
  useEffect(() => {
    resetHistoryPagination();
  }, [showHistory]);
  const [uniqueUsers, setUniqueUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [expiringWarranty, setExpiringWarranty] = useState([]);
  const [showWindowsReportModal, setShowWindowsReportModal] = useState(false);
  const [windowsAssets, setWindowsAssets] = useState([]);
  const [showMobileStats, setShowMobileStats] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [editingWindowsCell, setEditingWindowsCell] = useState({ assetId: null, field: null });
  const [editingWindowsValue, setEditingWindowsValue] = useState('');

  // Инвентаризация
  const [inventoryMode, setInventoryMode] = useState(false);
  const [inventorySession, setInventorySession] = useState(null);
  const [inventoryChecks, setInventoryChecks] = useState({}); // { asset_id: check }
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySelected, setInventorySelected] = useState(null); // актив для подтверждения
  const [inventoryUserName, setInventoryUserName] = useState('');
  const [inventoryLocation, setInventoryLocation] = useState('');
  const [showInventoryFinish, setShowInventoryFinish] = useState(false);
  const [inventoryChangedUsers, setInventoryChangedUsers] = useState(0);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState('current');
  const [exportFormat, setExportFormat] = useState('xlsx');
  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importDragOver, setImportDragOver] = useState(false);
  // QR preview modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrScope, setQrScope] = useState('current');
  const [qrTypes, setQrTypes] = useState(['Компьютер', 'Ноутбук']);
  const [qrColumns, setQrColumns] = useState(4);

  const getStatusColor = (status) => {
    switch(status) {
      case 'в эксплуатации': return 'success';
      case 'на складе': return 'secondary';
      case 'на ремонте': return 'warning';
      case 'списано': return 'danger';
      default: return 'secondary';
    }
  };

  // Темная тема
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('darkMode') === 'true'
  );
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('darkMode', newTheme.toString());
  
    // Применяем тему к body
    if (newTheme) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  };
  // Применение темы при загрузке
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);

  
    const handleCopyAssetInfo = async (asset) => {
    const assetType = asset.type || 'Актив';
    const assetModel = asset.model || '';
    const assetTitle = assetModel ? `${assetType} ${assetModel}` : assetType;
    
    const assetInfo = `Актив: ${assetTitle}
Инв. №: ${asset.inventory_number || 'Не указан'}
Пользователь: ${asset.user_name || 'Не назначен'}
Расположение: ${asset.location || 'Не указано'}
Статус: ${asset.status || 'Не указан'}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(assetInfo);
        showToast.success('Информация скопирована в буфер обмена', { icon: '📋' });
      } else {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = assetInfo;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          showToast.success('Информация скопирована в буфер обмена', { icon: '📋' });
        } else {
          showToast.error('Не удалось скопировать информацию');
        }
      }
    } catch (err) {
      console.error('Ошибка копирования:', err);
      showToast.error('Ошибка при копировании в буфер обмена');
    }
  };



  // Регистрация Service Worker для PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered successfully:', registration);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    }
  }, []);


  // Toast helper functions
  const showToast = {
    success: (message, options = {}) => {
      const { duration = 3000 } = options;
      toast.custom((t) => (
        <div className={`t-base t-success${t.visible ? '' : ' t-out'}`}>
          <span className="t-icon">✓</span>
          <span className="t-msg">{message}</span>
        </div>
      ), { duration });
    },

    error: (message, options = {}) => {
      const { duration = 4000 } = options;
      toast.custom((t) => (
        <div className={`t-base t-error${t.visible ? '' : ' t-out'}`}>
          <span className="t-icon">✕</span>
          <span className="t-msg">{message}</span>
        </div>
      ), { duration });
    },

    loading: (message) => {
      return toast.custom((t) => (
        <div className={`t-base t-load${t.visible ? '' : ' t-out'}`}>
          <span className="t-icon"><span className="t-spinner"></span></span>
          <span className="t-msg">{message}</span>
        </div>
      ), { duration: Infinity });
    },

    info: (message, options = {}) => {
      const { duration = 3000 } = options;
      toast.custom((t) => (
        <div className={`t-base t-info${t.visible ? '' : ' t-out'}`}>
          <span className="t-icon t-icon-i">i</span>
          <span className="t-msg">{message}</span>
        </div>
      ), { duration });
    },

    warning: (message, options = {}) => {
      const { duration = 4000 } = options;
      toast.custom((t) => (
        <div className={`t-base t-warn${t.visible ? '' : ' t-out'}`}>
          <span className="t-icon">!</span>
          <span className="t-msg">{message}</span>
        </div>
      ), { duration });
    },

    confirm: (message, onConfirm, onCancel = null) => {
      return toast.custom((t) => (
        <div className={`t-base t-confirm${t.visible ? '' : ' t-out'}`}>
          <div className="t-confirm-title">Подтверждение</div>
          <div className="t-confirm-msg">{message}</div>
          <div className="t-confirm-btns">
            <button className="btn-ok" style={{ fontSize: '12px', height: '28px', padding: '0 14px' }}
              onClick={() => { toast.dismiss(t.id); onConfirm && onConfirm(); }}>
              Да
            </button>
            <button className="btn-sec" style={{ fontSize: '12px', height: '28px', padding: '0 14px' }}
              onClick={() => { toast.dismiss(t.id); onCancel && onCancel(); }}>
              Отмена
            </button>
          </div>
        </div>
      ), { duration: Infinity });
    },

    deleteConfirm: (message, onConfirm, onCancel = null) => {
      return toast.custom((t) => (
        <div className={`t-base t-confirm t-confirm-del${t.visible ? '' : ' t-out'}`}>
          <div className="t-confirm-title t-confirm-del-title">Удалить?</div>
          <div className="t-confirm-msg">{message}</div>
          <div className="t-confirm-btns">
            <button className="btn-ok" style={{ fontSize: '12px', height: '28px', padding: '0 14px', background: '#C93A3A', borderColor: '#C93A3A' }}
              onClick={() => { toast.dismiss(t.id); onConfirm && onConfirm(); }}>
              Удалить
            </button>
            <button className="btn-sec" style={{ fontSize: '12px', height: '28px', padding: '0 14px' }}
              onClick={() => { toast.dismiss(t.id); onCancel && onCancel(); }}>
              Отмена
            </button>
          </div>
        </div>
      ), { duration: Infinity });
    }
  };

  const openAssetInfoModal = (asset) => {
    console.log("Открытие модального окна для актива:", asset?.inventory_number);
    setAssetInfo(asset);
    setShowAssetInfoModal(true);
    if (asset && asset.id) {
      if (window.location.hash !== `#asset-info-${asset.id}`) {
        window.location.hash = `asset-info-${asset.id}`;
      }
    }
  };

  const closeAssetInfoModal = () => {
    console.log("Закрытие модального окна");
    setShowAssetInfoModal(false);
    setAssetInfo(null);
    if (window.location.hash.startsWith('#asset-info-')) {
      console.log("Очистка URL-хэша");
      history.replaceState(null, null, window.location.pathname + window.location.search);
    }
  };

  const refreshWindowsReport = async () => {
    const loadingToast = showToast.loading('Обновление данных...');
  
    try {
      // Получаем свежие данные напрямую с сервера
      const res = await apiFetch(`${API_BASE}/assets/`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
    
      if (!res.ok) {
        throw new Error(`Ошибка ${res.status}`);
      }
    
      const freshData = await res.json();
    
      // Обновляем глобальный стейт
      setAssets(freshData);
    
      // Создаем отчет из свежих данных (не из стейта!)
      const windowsFilter = freshData.filter(asset => 
        asset.os_type && 
        asset.os_type.toLowerCase().includes('windows') &&
        asset.status !== 'списано'
      );
    
      setWindowsAssets(windowsFilter);
    
      toast.dismiss(loadingToast);
      showToast.success(`Данные обновлены. Найдено ${windowsFilter.length} Windows устройств`);
    
    } catch (error) {
      toast.dismiss(loadingToast);
      showToast.error('Ошибка при обновлении данных');
    }
  };


  const getNounForm = (number, forms) => {
    if (number % 100 >= 11 && number % 100 <= 14) {
      return forms[2];
    }
  
    const lastDigit = number % 10;
  
    if (lastDigit === 1) {
      return forms[0];
    } else if (lastDigit >= 2 && lastDigit <= 4) {
      return forms[1];
    } else {
      return forms[2];
    }
  };


  const calculateAssetAge = (asset) => {
    // Если есть ручной возраст - используем его
    if (asset.manual_age && asset.manual_age.trim()) {
      return asset.manual_age;
    }
  
    // Если есть дата покупки - рассчитываем автоматически
    if (asset.purchase_date) {
      const purchase = new Date(asset.purchase_date);
      const now = new Date();
      const diffTime = Math.abs(now - purchase);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);

      if (years === 0 && months === 0) {
        return 'Новый';
      } else if (years === 0) {
        const monthForm = getNounForm(months, ['месяц', 'месяца', 'месяцев']);
        return `${months} ${monthForm}`;
      } else if (months === 0) {
        const yearForm = getNounForm(years, ['год', 'года', 'лет']);
        return `${years} ${yearForm}`;
      } else {
        const yearForm = getNounForm(years, ['год', 'года', 'лет']);
        const monthForm = getNounForm(months, ['месяц', 'месяца', 'месяцев']);
        return `${years} ${yearForm} ${months} ${monthForm}`;
      }
    }
  
    return 'Не указано';
  };


  // Функция для цветового кодирования
  const getAgeClass = (asset) => {
    let years = 0;
  
    // Определяем возраст в годах
    if (asset.manual_age && asset.manual_age.trim()) {
      // Пытаемся извлечь годы из ручного ввода (например "5 лет", "3 года")
      const ageMatch = asset.manual_age.match(/(\d+)/);
      years = ageMatch ? parseInt(ageMatch[1]) : 0;
    } else if (asset.purchase_date) {
      years = Math.floor(Math.abs(new Date() - new Date(asset.purchase_date)) / (1000 * 60 * 60 * 24 * 365));
    }
  
    if (years >= 5) return 'text-danger fw-bold'; // Старше 5 лет
    if (years >= 3) return 'text-warning'; // 3-5 лет  
    if (years >= 1) return 'text-info'; // 1-3 года
    return 'text-success'; // Новое оборудование
  };

  const getAssetAgeInDays = (asset) => {
    // Если есть ручной возраст, пытаемся извлечь годы
    if (asset.manual_age && asset.manual_age.trim()) {
      const ageMatch = asset.manual_age.match(/(\d+)/);
      if (ageMatch) {
        const years = parseInt(ageMatch[1]);
        return years * 365;
      }
      return 999999;
    }
  
    // Если есть дата покупки
    if (asset.purchase_date) {
      const purchaseDate = new Date(asset.purchase_date);
      const now = new Date();
      const diffTime = now - purchaseDate;
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
  
    return -1;
  };

  const getAssetAgeCategory = (asset) => {
    const ageDays = getAssetAgeInDays(asset);
  
    if (ageDays === -1) return 'unknown';
  
    const ageYears = ageDays / 365;
  
    if (ageYears < 1) return 'new';
    if (ageYears < 3) return 'fresh';
    if (ageYears < 5) return 'medium';
    return 'old';
  };

  const getAssetsByAgeCategory = () => {
    const categories = {
      all: assets.length,
      new: 0,
      fresh: 0,
      medium: 0,
      old: 0,
      unknown: 0
    };
  
    assets.forEach(asset => {
      const category = getAssetAgeCategory(asset);
      categories[category]++;
    });
  
    return categories;
  };

  // Единая функция проверки наличия Windows ключа
  const isWindowsKeyMissing = (asset) => {
    return !asset.windows_key || 
           !asset.windows_key.trim() || 
           asset.windows_key === 'Не указан' ||
           asset.windows_key === '-' ||
           asset.windows_key === '' ||
           asset.windows_key === null ||
           asset.windows_key === undefined;
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter, warrantyFilter, disposedFilter, selectedUser, ageRangeFilter]);

  useEffect(() => {
    if (assets.length > 0) {
      const userNames = [...new Set(assets.map(asset => asset.user_name).filter(name => name && name.trim() !== ''))].sort();
      const userOptions = userNames.map(name => ({ value: name, label: name }));
      setUniqueUsers(userOptions);
    }
  }, [assets]);

  const fetchDeletionLogs = async () => {
    if (!token || !user?.is_admin) return;
    setDeletionLogLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/admin/deletion-log/?limit=100`, {
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

  const openDeletionLogModal = async () => {
    await fetchDeletionLogs();
    setShowDeletionLogModal(true);
  };

  const performPrintQR = (assetsForQR, columns) => {
    setShowQRModal(false);
    if (!assetsForQR || assetsForQR.length === 0) {
      showToast.warning('Нет активов для печати');
      return;
    }

    const generateQRCodeSVG = (text) => {
      try {
        const qr = qrCodeGenerator(0, 'M');
        qr.addData(text);
        qr.make();
        return qr.createSvgTag({ cellSize: 3, margin: 2 });
      } catch {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110"><rect width="110" height="110" fill="#f0f0f0"/><text x="55" y="55" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="11" fill="#999">QR Error</text></svg>`;
      }
    };

    const cols = columns || 4;
    let printContent = `<!DOCTYPE html>
<html>
<head>
  <title>QR-коды активов</title>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: white; padding: 16px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 18px; color: #333; margin-bottom: 4px; }
    .header p { font-size: 12px; color: #666; }
    .qr-grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 12px; }
    .qr-card { display: flex; flex-direction: column; align-items: center; padding: 12px 8px; border: 1px solid #ccc; border-radius: 8px; page-break-inside: avoid; text-align: center; }
    .qr-card svg { width: 110px; height: 110px; display: block; }
    .qr-inv { font-size: 11px; font-weight: bold; color: #222; margin-top: 8px; font-family: monospace; }
    .qr-model { font-size: 10px; color: #666; margin-top: 3px; }
    @media print {
      body { padding: 10px; }
      .qr-card { border-color: #000; }
    }
  </style>
</head>
<body>
  <div class="header"><h1>QR-коды активов</h1><p>Всего: ${assetsForQR.length}</p></div>
  <div class="qr-grid">`;

    assetsForQR.forEach(asset => {
      const qrUrl = `${window.location.origin}${window.location.pathname}#asset-info-${asset.id}`;
      printContent += `
    <div class="qr-card">
      ${generateQRCodeSVG(qrUrl)}
      <div class="qr-inv">${asset.inventory_number || '—'}</div>
      <div class="qr-model">${asset.model || asset.type || 'Актив'}</div>
    </div>`;
    });

    printContent += `
  </div>
  <script>setTimeout(() => window.print(), 600);</script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    showToast.success(`Подготовлено ${assetsForQR.length} QR-кодов для печати`);
  };

  const handlePrintSingleQRCode = (asset) => {
    if (!asset) {
      showToast.error("Ошибка: нет данных об активе");
      return;
    }

    try {
      const qr = qrCodeGenerator(0, 'M');
      const qrUrl = `${window.location.origin}${window.location.pathname}#asset-info-${asset.id}`;
      qr.addData(qrUrl);
      qr.make();
      const qrSvgString = qr.createSvgTag({ cellSize: 4, margin: 2 });

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

      const printWindow = window.open('', '_blank', 'width=450,height=550');
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      
      showToast.success('QR-код подготовлен для печати', { icon: '🖨️' });
      
    } catch (error) {
      console.error("Ошибка генерации QR-кода для печати:", error);
      showToast.error("Ошибка при подготовке к печати QR-кода");
    }
  };


  // Функция для генерации отчета с ключами windows
  const openInventory = async () => {
    // Если сессия уже загружена в память — просто разворачиваем
    if (inventorySession) { setInventoryMode(true); return; }
    // Иначе проверяем активную сессию на сервере
    try {
      const activeRes = await apiFetch(`${API_BASE}/inventory/sessions/active`);
      if (activeRes.ok) {
        const data = await activeRes.json();
        const checksMap = {};
        (data.checks || []).forEach(c => { checksMap[c.asset_id] = c; });
        setInventorySession(data);
        setInventoryChecks(checksMap);
        setInventoryChangedUsers((data.checks || []).filter(c => c.user_name_before !== c.user_name_after).length);
        setInventoryMode(true);
        return;
      }
    } catch {}
    // Активной сессии нет — создаём новую
    try {
      const res = await apiFetch(`${API_BASE}/inventory/sessions/`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showToast.error(data.detail || 'Не удалось начать инвентаризацию'); return; }
      setInventorySession(data);
      setInventoryChecks({});
      setInventoryChangedUsers(0);
      setInventorySearch('');
      setInventorySelected(null);
      setInventoryMode(true);
    } catch { showToast.error('Ошибка сети'); }
  };

  const checkInventoryAsset = async (asset, userName, location) => {
    try {
      const res = await apiFetch(`${API_BASE}/inventory/sessions/${inventorySession.id}/check`, {
        method: 'POST',
        body: JSON.stringify({ asset_id: asset.id, user_name: userName, location: location || null }),
      });
      const data = await res.json();
      if (!res.ok) { showToast.error(data.detail || 'Ошибка'); return; }
      setInventoryChecks(prev => ({ ...prev, [asset.id]: data }));
      const updates = {};
      if (data.user_name_before !== data.user_name_after) {
        setInventoryChangedUsers(prev => prev + 1);
        updates.user_name = userName;
      }
      if (location && location.trim() && location.trim() !== asset.location) {
        updates.location = location.trim();
      }
      if (Object.keys(updates).length > 0) {
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, ...updates } : a));
      }
      setInventorySelected(null);
    } catch { showToast.error('Ошибка сети'); }
  };

  const uncheckInventoryAsset = async (assetId) => {
    try {
      const res = await apiFetch(`${API_BASE}/inventory/sessions/${inventorySession.id}/check/${assetId}`, { method: 'DELETE' });
      if (!res.ok) return;
      const check = inventoryChecks[assetId];
      if (check && check.user_name_before !== check.user_name_after) {
        setInventoryChangedUsers(prev => Math.max(0, prev - 1));
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, user_name: check.user_name_before } : a));
      }
      setInventoryChecks(prev => { const n = { ...prev }; delete n[assetId]; return n; });
    } catch {}
  };

  const finishInventory = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/inventory/sessions/${inventorySession.id}/finish`, { method: 'POST' });
      if (!res.ok) return;
      setShowInventoryFinish(true);
    } catch {}
  };

  const closeInventory = () => {
    setInventoryMode(false);
    setInventorySession(null);
    setInventoryChecks({});
    setInventorySearch('');
    setInventorySelected(null);
    setShowInventoryFinish(false);
    fetchAssets();
  };

  const generateWindowsReport = () => {
    // Фильтруем активы с Windows
    const windowsFilter = assets.filter(asset => 
      asset.os_type && 
      asset.os_type.toLowerCase().includes('windows') &&
      asset.status !== 'списано'
    );
  
    setWindowsAssets(windowsFilter);
    setShowWindowsReportModal(true);
  };

  const exportWindowsReport = () => {
    // Подготавливаем данные для экспорта
    const reportData = windowsAssets.map(asset => ({
      'Инвентарный номер': asset.inventory_number || '',
      'Модель': asset.model || '',
      'Расположение': asset.location || 'Не указано',
      'Пользователь': asset.user_name || '',
      'Версия Windows': asset.os_type || '',
      'Ключ Windows': asset.windows_key || 'Не указан',
      'Статус': asset.status,
    }));

    // Создаем CSV
    const headers = Object.keys(reportData[0] || {});
    const csvContent = [
      headers.join(';'),
      ...reportData.map(row => headers.map(header => `"${row[header]}"`).join(';'))
    ].join('\n');

    // Скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `windows_licenses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };


  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#asset-info-')) {
        const idStr = hash.substring(12);
        const id = parseInt(idStr, 10);
        if (!isNaN(id) && id > 0) {
          console.log("Найден ID актива в URL-хэше:", id);
          setAssetIdFromUrlHash(id);
        } else {
          console.warn("Некорректный ID в URL-хэше:", idStr);
          setAssetIdFromUrlHash(null);
        }
      } else {
        setAssetIdFromUrlHash(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (assetIdFromUrlHash && assets.length > 0) {
      console.log("Пытаемся открыть актив с ID:", assetIdFromUrlHash);
      const assetToOpen = assets.find(a => a.id === assetIdFromUrlHash);
      if (assetToOpen) {
        console.log("Актив найден, открываем модальное окно:", assetToOpen.inventory_number);
        openAssetInfoModal(assetToOpen);
        setAssetIdFromUrlHash(null);
      } else {
        console.warn(`Актив с ID ${assetIdFromUrlHash} не найден в списке активов.`);
        showToast.error(`Актив с ID ${assetIdFromUrlHash} не найден.`);
        setAssetIdFromUrlHash(null);
      }
    }
  }, [assetIdFromUrlHash, assets]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      const res = await apiFetch(`${API_BASE}/assets/`, {
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
      showToast.error("Ошибка при загрузке активов");
      setAssets([]);
    }
  };

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
      const res = await apiFetch(`${API_BASE}/users/`, {
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
        if (showExportModal) setShowExportModal(false);
        if (showImportModal) { setShowImportModal(false); setImportFile(null); }
        if (showQRModal) setShowQRModal(false);
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
        if (showWindowsReportModal) { 
          setShowWindowsReportModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExportModal, showImportModal, showQRModal, showAboutModal, isModalOpen, isEditing, showUserModal, showDeletionLogModal, showRepairsModal, showAssetInfoModal, showWindowsReportModal, token]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setUsers([]);
      return;
    }
    apiFetch(`${API_BASE}/users/me`, {
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
    const loadingToast = showToast.loading('Выполняется вход...');
    
    try {
      const res = await fetch(`${API_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(loginData).toString()
      });
      
      toast.dismiss(loadingToast);
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        showToast.success(`Добро пожаловать, ${loginData.username}!`, { icon: '👋' });
      } else {
        showToast.error('Неверный логин или пароль', { icon: '🔒' });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      showToast.error('Ошибка подключения к серверу');
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
    showToast.info('Вы вышли из системы', { icon: '👋' });
  };

  const performExport = async () => {
    setShowExportModal(false);
    const loadingToast = showToast.loading('Подготовка экспорта...');
    try {
      const params = new URLSearchParams();

      if (exportScope === 'current') {
        if (ageRangeFilter !== 'all') {
          const filtered = getFilteredAssets();
          if (filtered.length === 0) {
            toast.dismiss(loadingToast);
            showToast.info('Нет активов для экспорта с текущими фильтрами');
            return;
          }
          params.append('ids', filtered.map(a => a.id).join(','));
        } else {
          if (filter !== 'Все' && !disposedFilter) params.append('type', filter);
          if (disposedFilter) params.append('status', 'списано');
          if (searchQuery) params.append('q', searchQuery);
          if (warrantyFilter !== 'all' && !disposedFilter) params.append('warranty_status', warrantyFilter);
          if (selectedUser) params.append('user_name', selectedUser);
        }
      }
      // exportScope === 'all': no params

      const url = `${API_BASE}/export/excel?${params.toString()}`;
      const res = await apiFetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      toast.dismiss(loadingToast);

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Ошибка экспорта' }));
        showToast.error(error.detail);
        return;
      }

      const blob = await res.blob();
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

      showToast.success('Файл успешно экспортирован');
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error('Ошибка сети при экспорте');
      console.error(err);
    }
  };

  const performImport = async () => {
    if (!importFile) return;
    setShowImportModal(false);

    const loadingToast = showToast.loading('Импорт файла...');
    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await fetch(`${API_BASE}/import/excel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const result = await res.json();
      toast.dismiss(loadingToast);

      if (result.errors && result.errors.length > 0) {
        showToast.warning(`Импорт завершен с предупреждениями (${result.errors.length})`, { duration: 6000 });
      } else {
        showToast.success(result.detail);
      }
      await fetchAssets();
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error('Критическая ошибка импорта: ' + err.message);
      console.error(err);
    }
    setImportFile(null);
  };

  const handleClearDatabase = async () => {
    showToast.confirm(
      "Перед очисткой базы рекомендуется сделать резервную копию. Скачать Excel-файл со всеми данными перед удалением?",
      async () => {
        const link = document.createElement('a');
        link.href = `${API_BASE}/export/excel`;
        link.setAttribute('download', '');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(resolve => setTimeout(resolve, 1000));
        showToast.success('Резервная копия скачана', { icon: '💾' });
        
        setTimeout(() => {
          showToast.deleteConfirm(
            "ВНИМАНИЕ: Все активы и история изменений будут безвозвратно удалены. Вы уверены, что хотите очистить всю базу?",
            async () => {
              const loadingToast = showToast.loading('Очистка базы данных...');
              
              try {
                const res = await apiFetch(`${API_BASE}/admin/clear-db`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const result = await res.json();
                toast.dismiss(loadingToast);
                
                if (res.ok) {
                  showToast.success(result.message, { icon: '🗑️' });
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
                  showToast.error(`Ошибка: ${result.detail}`);
                }
              } catch (err) {
                toast.dismiss(loadingToast);
                showToast.error('Ошибка сети');
                console.error(err);
              }
            },
            () => {
              // Обработчик отмены для окончательного подтверждения
              showToast.info('Очистка базы отменена', { 
                icon: '❌', 
                duration: 2000 
              });
            }
          );
        }, 500);
      },
      () => {
        showToast.deleteConfirm(
          "ВНИМАНИЕ: Все активы и история изменений будут безвозвратно удалены без резервной копии. Вы уверены?",
          async () => {
            const loadingToast = showToast.loading('Очистка базы данных...');
            
            try {
              const res = await apiFetch(`${API_BASE}/admin/clear-db`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              const result = await res.json();
              toast.dismiss(loadingToast);
              
              if (res.ok) {
                showToast.success(result.message, { icon: '🗑️' });
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
                showToast.error(`Ошибка: ${result.detail}`);
              }
            } catch (err) {
              toast.dismiss(loadingToast);
              showToast.error('Ошибка сети');
              console.error(err);
            }
          },
          () => {
            // Обработчик отмены без резервной копии
            showToast.info('Очистка базы отменена', { 
              icon: '❌', 
              duration: 2000 
            });
          }
        );
      }
    );
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
        manual_age: asset.manual_age || '',
        storage_type: asset.storage_type || '',
        storage_size: asset.storage_size || '',
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
        manual_age: '',
        storage_type: '',
        storage_size: '',
      });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
  };

  
  const submitAsset = async () => {
    const loadingToast = showToast.loading(isEditing ? 'Сохранение изменений...' : 'Создание актива...');
  
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
      ? `${API_BASE}/assets/${formData.id}` 
      : `${API_BASE}/assets/`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      toast.dismiss(loadingToast);

      if (res.ok) {
        const updated = await res.json();
        if (isEditing) {
          setAssets(assets.map(a => a.id === updated.id ? updated : a));
          showToast.success('Актив успешно обновлен', { icon: '✏️' });
        } else {
          setAssets([...assets, updated]);
          showToast.success('Актив успешно создан', { icon: '✅' });
        }
        closeModal();
        fetchAssets();
      } else {
        const errorData = await res.json().catch(() => null);
        if (errorData?.detail) {
          if (Array.isArray(errorData.detail)) {
            const messages = errorData.detail.map(err => `${err.loc?.[1]}: ${err.msg}`).join('; ');
            showToast.error(`Ошибка валидации: ${messages}`);
          } else {
            showToast.error(errorData.detail);
          }
        } else {
          showToast.error('Ошибка сохранения актива');
        }
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error('Ошибка сети');
      console.error(err);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // --- Валидация ---
    if (!formData.inventory_number || !formData.inventory_number.trim()) {
      showToast.error("Инвентарный номер обязателен для заполнения", { icon: '📝' });
      return;
    }
    if (!formData.location || !formData.location.trim()) {
      showToast.error("Поле 'Расположение' обязательно для заполнения", { icon: '📍' });
      return;
    }
    if (!formData.type) {
      showToast.error("Пожалуйста, выберите тип оборудования из списка", { icon: '🔧' });
      return;
    }
    if (formData.purchase_date && formData.warranty_until) {
      if (new Date(formData.warranty_until) < new Date(formData.purchase_date)) {
        showToast.error('Дата окончания гарантии не может быть раньше даты покупки', { icon: '📅' });
        return;
      }
    }


    // --- Логика подтверждения ---
    if (!isEditing && !formData.purchase_date && (!formData.manual_age || !formData.manual_age.trim())) {
      showToast.confirm(
        "Не указана дата покупки и возраст техники. Рекомендуется указать хотя бы приблизительный возраст для учета амортизации. Продолжить без указания возраста?",
        () => {
          // Если пользователь нажал "Да" - вызываем submitAsset ОДИН РАЗ
          submitAsset(); 
        },
        () => {
          // Если пользователь нажал "Отмена"
          showToast.info("Добавление отменено. Укажите дату покупки или возраст техники", {
            icon: '⚠️'
          });
        }
      );
    } else {
      // Если дата указана или это редактирование - вызываем submitAsset ОДИН РАЗ
      submitAsset();
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
      manual_age: 'Возраст',
      storage_type: 'Тип накопителя',
      storage_size: 'Объём накопителя'
    };
    return labels[field] || field;
  };

  const handleEdit = async (asset) => {
    const loadingToast = showToast.loading('Загрузка данных актива...');
    
    try {
      const res = await apiFetch(`${API_BASE}/assets/${asset.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.dismiss(loadingToast);
      
      if (res.ok) {
        const fullAsset = await res.json();
        openModal(fullAsset);
      } else {
        showToast.error('Не удалось загрузить данные актива');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error('Ошибка сети при загрузке актива');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    showToast.deleteConfirm(
      'Вы действительно хотите удалить этот актив?',
      async () => {
        const loadingToast = showToast.loading('Удаление актива...');
        
        try {
          const res = await apiFetch(`${API_BASE}/assets/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          toast.dismiss(loadingToast);
          
          if (res.ok) {
            setAssets(assets.filter(a => a.id !== id));
            showToast.success('Актив успешно удален', { icon: '🗑️' });
            fetchAssets();
          } else {
            showToast.error('Ошибка при удалении актива');
          }
        } catch (error) {
          toast.dismiss(loadingToast);
          showToast.error('Ошибка сети при удалении');
          console.error(error);
        }
      }
    );
  };

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
    
    const loadingToast = showToast.loading('Сохранение...');
    const updatedAssetData = { ...assetToEdit };
    
    if (newValue === '' && (typeof currentValue === 'string' || currentValue === null || field.includes('date'))) {
      updatedAssetData[field] = null;
    } else {
      updatedAssetData[field] = newValue;
    }
    
    delete updatedAssetData.id;
    delete updatedAssetData.history;
    
    try {
      const res = await apiFetch(`${API_BASE}/assets/${assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedAssetData)
      });
      
      toast.dismiss(loadingToast);
      
      if (res.ok) {
        const updatedAssetFromServer = await res.json();
        setAssets(assets.map(a => a.id === updatedAssetFromServer.id ? updatedAssetFromServer : a));
        fetchAssets();
        cancelEdit();
        showToast.success('Поле обновлено', { icon: '✏️', duration: 2000 });
      } else {
        const errorData = await res.json().catch(() => null);
        showToast.error(`Ошибка обновления: ${errorData?.detail || 'Неизвестная ошибка'}`);
        cancelEdit();
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error('Ошибка сети при обновлении');
      console.error(err);
      cancelEdit();
    }
  };

  const cancelEdit = () => {
    setEditingCell({ assetId: null, field: null });
    setEditValue('');
  };

  const startEditingWindows = (assetId, field, currentValue) => {
    if (!user?.is_admin) return;
    setEditingWindowsCell({ assetId, field });
    setEditingWindowsValue(currentValue == null ? '' : String(currentValue));
  };

  const handleEditWindowsChange = (e) => {
    setEditingWindowsValue(e.target.value);
  };

  const saveEditWindows = async () => {
    const { assetId, field } = editingWindowsCell;
    if (assetId === null || field === null) return;
    
    const assetToEdit = assets.find(a => a.id === assetId);
    if (!assetToEdit) return;
    
    const currentValue = assetToEdit[field];
    const newValue = editingWindowsValue;
    
    if (currentValue == newValue || (currentValue === null && newValue === '')) {
      cancelEditWindows();
      return;
    }
    
    const loadingToast = showToast.loading('Сохранение...');
    const updatedAssetData = { ...assetToEdit };
    
    if (newValue === '' && (typeof currentValue === 'string' || currentValue === null)) {
      updatedAssetData[field] = null;
    } else {
      updatedAssetData[field] = newValue;
    }
    
    delete updatedAssetData.id;
    delete updatedAssetData.history;
    
    try {
      const res = await apiFetch(`${API_BASE}/assets/${assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedAssetData)
      });
      
      toast.dismiss(loadingToast);
      
      if (res.ok) {
        const updatedAsset = await res.json();
        
        // Обновляем основную таблицу активов
        setAssets(assets.map(a => a.id === updatedAsset.id ? updatedAsset : a));
        
        // Обновляем Windows отчет
        setWindowsAssets(windowsAssets.map(a => a.id === updatedAsset.id ? updatedAsset : a));
        
        cancelEditWindows();
        showToast.success('Ключ Windows обновлен', { icon: '🔑', duration: 2000 });
      } else {
        const errorData = await res.json().catch(() => null);
        showToast.error(`Ошибка обновления: ${errorData?.detail || 'Неизвестная ошибка'}`);
        cancelEditWindows();
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error('Ошибка сети при обновлении');
      console.error(err);
      cancelEditWindows();
    }
  };

  const cancelEditWindows = () => {
    setEditingWindowsCell({ assetId: null, field: null });
    setEditingWindowsValue('');
  };

  const handleEditWindowsKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEditWindows();
    } else if (e.key === 'Escape') {
      cancelEditWindows();
    }
  };


  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

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
    result = result.filter(asset => !selectedUser || (asset.user_name || '').toLowerCase().includes(selectedUser.toLowerCase()));

    if (ageRangeFilter && ageRangeFilter !== 'all') {
      result = result.filter(asset => {
        const category = getAssetAgeCategory(asset);
        return category === ageRangeFilter;
      });
    }

    return result;
  };

  const filteredAssets = getFilteredAssets();
  const qrAssets = (() => {
    const base = qrScope === 'current' ? filteredAssets : assets;
    return qrTypes.length > 0 ? base.filter(a => qrTypes.includes(a.type)) : base;
  })();
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

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
      showToast.error("Пожалуйста, заполните имя пользователя", { icon: '👤' });
      return;
    }
    if (!isEditingUser && (!userFormData.password || !userFormData.password.trim())) {
      showToast.error("Пожалуйста, заполните пароль", { icon: '🔑' });
      return;
    }

    const loadingToast = showToast.loading(isEditingUser ? 'Обновление пользователя...' : 'Создание пользователя...');
    
    const payload = { ...userFormData };
    if (isEditingUser && (!payload.password || !payload.password.trim())) {
      delete payload.password;
    }
    
    const url = isEditingUser
      ? `${API_BASE}/users/${editingUser.id}`
      : `${API_BASE}/users/`;
    const method = isEditingUser ? 'PUT' : 'POST';
    
    try {
      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      toast.dismiss(loadingToast);
      
      if (res.ok) {
        const updatedOrNewUser = await res.json();
        if (isEditingUser) {
          setUsers(users.map(u => u.id === updatedOrNewUser.id ? updatedOrNewUser : u));
          showToast.success("Пользователь успешно обновлен", { icon: '👤' });
        } else {
          setUsers([...users, updatedOrNewUser]);
          showToast.success("Пользователь успешно создан", { icon: '🆕' });
        }
        setShowUserModal(false);
        setIsEditingUser(false);
        setEditingUser(null);
        setUserFormData({ username: '', password: '', is_admin: false });
      } else {
        const errorData = await res.json();
        showToast.error(errorData.detail || `Ошибка ${isEditingUser ? 'обновления' : 'создания'} пользователя`);
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error("Ошибка сети");
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === user.id) {
      showToast.error("Нельзя удалить самого себя!", { icon: '🚫' });
      return;
    }

    showToast.deleteConfirm(
      'Вы уверены, что хотите удалить этого пользователя?',
      async () => {
        const loadingToast = showToast.loading('Удаление пользователя...');
        
        try {
          const res = await apiFetch(`${API_BASE}/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          toast.dismiss(loadingToast);
          
          if (res.ok) {
            setUsers(users.filter(u => u.id !== userId));
            showToast.success("Пользователь удален", { icon: '👤' });
          } else {
            const errorData = await res.json();
            showToast.error(errorData.detail || "Ошибка удаления пользователя");
          }
        } catch (err) {
          toast.dismiss(loadingToast);
          showToast.error("Ошибка сети");
          console.error(err);
        }
      }
    );
  };

  const fetchRepairsForAsset = async (assetId) => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE}/assets/${assetId}/repairs/`, {
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
    
    const loadingToast = showToast.loading('Создание записи о ремонте...');
    
    try {
      const res = await apiFetch(`${API_BASE}/assets/${currentAssetId}/repairs/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(repairFormData)
      });
      
      toast.dismiss(loadingToast);
      
      if (res.ok) {
        const newRepair = await res.json();
        setRepairsForAsset(prev => [...prev, newRepair]);
        setRepairFormData({
          repair_date: '',
          description: '',
          cost: '',
          performed_by: '',
        });
        showToast.success("Запись о ремонте добавлена", { icon: '🔧' });
      } else {
        const errorData = await res.json();
        showToast.error(`Ошибка создания записи: ${errorData.detail || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error("Ошибка сети при создании записи");
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
    
    const loadingToast = showToast.loading('Обновление записи о ремонте...');
    
    try {
      const res = await apiFetch(`${API_BASE}/repairs/${editingRepairId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(repairFormData)
      });
      
      toast.dismiss(loadingToast);
      
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
        showToast.success("Запись о ремонте обновлена", { icon: '🔧' });
      } else {
        const errorData = await res.json();
        showToast.error(`Ошибка обновления записи: ${errorData.detail || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error("Ошибка сети при обновлении записи");
      console.error(err);
    }
  };

  const handleDeleteRepair = async (recordId) => {
    showToast.deleteConfirm(
      "Вы уверены, что хотите удалить эту запись о ремонте?",
      async () => {
        if (!token) return;
        
        const loadingToast = showToast.loading('Удаление записи...');
        
        try {
          const res = await apiFetch(`${API_BASE}/repairs/${recordId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          toast.dismiss(loadingToast);
          
          if (res.ok) {
            setRepairsForAsset(prev => prev.filter(r => r.id !== recordId));
            showToast.success("Запись о ремонте удалена", { icon: '🗑️' });
          } else {
            const errorData = await res.json();
            showToast.error(`Ошибка удаления записи: ${errorData.detail || 'Неизвестная ошибка'}`);
          }
        } catch (err) {
          toast.dismiss(loadingToast);
          showToast.error("Ошибка сети при удалении записи");
          console.error(err);
        }
      }
    );
  };

  <div className="d-block d-md-none">
    <div className="mobile-assets-container">
      {paginatedAssets.map((asset, index) => (
        <div 
          key={asset.id} 
          className="mobile-asset-card mb-3"
          style={{
            backgroundColor: '#ffffff',
            border: '2px solid #e9ecef',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '16px',
            position: 'relative'
          }}
        >
          {/* Заголовок карточки */}
          <div className="card-header-mobile mb-3" style={{
            borderBottom: '2px solid #f8f9fa',
            paddingBottom: '12px'
          }}>
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-bold text-primary">
                {asset.inventory_number}
              </h6>
              <span className={`status-badge status-${getStatusColor(asset.status)}`}>
                {asset.status}
              </span>
            </div>
            {asset.model && (
              <small className="text-muted">{asset.model}</small>
            )}
          </div>

          {/* Основная информация */}
          <div className="mobile-info-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div className="info-block">
              <div className="info-label">
                <i className="fas fa-tag me-1"></i>
                <small className="text-muted fw-semibold">Тип</small>
              </div>
              <div className="info-value fw-medium">{asset.type}</div>
            </div>

            <div className="info-block">
              <div className="info-label">
                <i className="fas fa-map-marker-alt me-1"></i>
                <small className="text-muted fw-semibold">Расположение</small>
              </div>
              <div className="info-value fw-medium">{asset.location}</div>
            </div>

            <div className="info-block">
              <div className="info-label">
                <i className="fas fa-clock me-1"></i>
                <small className="text-muted fw-semibold">Возраст</small>
              </div>
              <div 
                className={`info-value fw-medium ${getAgeClass(asset)} ${user?.is_admin ? 'editable-mobile' : ''}`}
                onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'manual_age', asset.manual_age)}
              >
                {editingCell.assetId === asset.id && editingCell.field === 'manual_age' ? (
                  <input 
                    type="text" 
                    className="form-control form-control-sm" 
                    value={editValue} 
                    onChange={handleEditChange}
                    onKeyDown={handleEditKeyDown} 
                    onBlur={saveEdit} 
                    placeholder="Например: 5 лет" 
                    autoFocus 
                    style={{ fontSize: '0.9em' }}
                  />
                ) : (
                  <>
                    {calculateAssetAge(asset)}
                    {asset.manual_age && (
                      <i className="fas fa-edit text-muted ms-1" style={{ fontSize: '0.7em' }}></i>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="info-block">
              <div className="info-label">
                <i className="fas fa-barcode me-1"></i>
                <small className="text-muted fw-semibold">Серийный №</small>
              </div>
              <div className="info-value fw-medium" style={{ fontSize: '0.85em' }}>
                {asset.serial_number || 'Не указан'}
              </div>
            </div>
          </div>

          {/* Пользователь (если есть) */}
          {asset.user_name && (
            <div className="user-info mb-3" style={{
              backgroundColor: '#f8f9fa',
              padding: '8px 12px',
              borderRadius: '6px'
            }}>
              <div className="d-flex align-items-center">
                <i className="fas fa-user text-primary me-2"></i>
                <div>
                  <small className="text-muted d-block">Пользователь</small>
                  <strong>{asset.user_name}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Ключ Windows (если есть) */}
          {asset.windows_key && (
            <div className="windows-key-info mb-3">
              <small className="text-muted">
                <i className="fab fa-windows me-1"></i>Ключ Windows:
              </small>
              <div 
                className={`windows-key-value ${user?.is_admin ? 'editable-mobile' : ''}`}
                style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.8em',
                  backgroundColor: '#f8f9fa',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  wordBreak: 'break-all',
                  marginTop: '4px'
                }}
                onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'windows_key', asset.windows_key)}
              >
                {editingCell.assetId === asset.id && editingCell.field === 'windows_key' ? (
                  <input 
                    type="text" 
                    className="form-control form-control-sm" 
                    value={editValue} 
                    onChange={handleEditChange}
                    onKeyDown={handleEditKeyDown} 
                    onBlur={saveEdit} 
                    placeholder="Введите ключ Windows" 
                    autoFocus 
                    style={{ fontFamily: 'monospace', fontSize: '0.8em' }}
                  />
                ) : (
                  asset.windows_key
                )}
              </div>
            </div>
          )}

          {/* Действия */}
          <div className="mobile-actions" style={{
            borderTop: '1px solid #e9ecef',
            paddingTop: '12px'
          }}>
            <div className="d-flex flex-wrap gap-2">
              {user?.is_admin && (
                <>
                  <button 
                    className="btn btn-primary btn-sm flex-fill"
                    onClick={() => handleEdit(asset)}
                    style={{ minWidth: '80px' }}
                  >
                    <i className="fas fa-edit me-1"></i>Изменить
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(asset.id)}
                    style={{ minWidth: '40px' }}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </>
              )}
              <button 
                className="btn btn-info btn-sm"
                onClick={() => setShowHistory(showHistory === asset.id ? null : asset.id)}
              >
                <i className="fas fa-history"></i>
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => openAssetInfoModal(asset)}
              >
                <i className="fas fa-qrcode"></i>
              </button>
            </div>
          </div>

          {/* История (если развернута) */}
          {showHistory === asset.id && (
            <div className="mobile-history mt-3" style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <h6 className="mb-2" style={{ fontSize: '0.9em' }}>
                <i className="fas fa-history me-2"></i>История изменений
              </h6>
              <div className="history-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {asset.history && asset.history.length > 0 ? (
                  asset.history
                    .slice()
                    .sort((a, b) => {
                      const dateA = new Date(a.changed_at);
                      const dateB = new Date(b.changed_at);
                      if (dateA.getTime() !== dateB.getTime()) {
                        return dateB - dateA;
                      }
                      return b.id - a.id;
                    })
                    .slice(0, 5)
                    .map((h, idx) => (
                      <div key={idx} className="history-item mb-2" style={{
                        fontSize: '0.8em',
                        padding: '6px 8px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        border: '1px solid #e9ecef'
                      }}>
                        <div className="history-date text-muted mb-1">
                          {h.changed_at} {h.changed_by ? `[${h.changed_by}]` : ''}
                        </div>
                        <div>
                          <strong>{getHumanFieldName(h.field)}:</strong> "{h.old_value}" → "{h.new_value}"
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted mb-0" style={{ fontSize: '0.85em' }}>
                    История изменений отсутствует
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>



  const HistoryPagination = ({ history, historyPage, setHistoryPage, historyItemsPerPage }) => {
    const historyTotalPages = Math.ceil(history.length / historyItemsPerPage);
    const [inputValue, setInputValue] = useState(historyPage.toString());
  
    // Синхронизируем inputValue с historyPage при изменении извне
    useEffect(() => {
      setInputValue(historyPage.toString());
    }, [historyPage]);
  
    if (historyTotalPages <= 1) return null;
  
    const handleInputChange = (e) => {
      const value = e.target.value;
      setInputValue(value); // Всегда обновляем локальное состояние для плавного ввода
    
      // Валидируем и обновляем реальную страницу только если значение корректное
      if (value === '') {
        setHistoryPage(1);
        return;
      }
    
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 1 && num <= historyTotalPages) {
        setHistoryPage(num);
      }
    };
  
    const handleInputBlur = () => {
      // При потере фокуса принудительно валидируем и исправляем значение
      const num = parseInt(inputValue, 10);
      if (isNaN(num) || num < 1 || num > historyTotalPages) {
        setInputValue(historyPage.toString()); // Возвращаем корректное значение
      }
    };
  
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        const num = parseInt(inputValue, 10);
        if (!isNaN(num) && num >= 1 && num <= historyTotalPages) {
          setHistoryPage(num);
          e.target.blur(); // Убираем фокус после Enter
        }
      }
    };
  
    return (
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        {/* Информация о странице */}
        <div className="small text-muted">
          Показано {((historyPage - 1) * historyItemsPerPage) + 1}—{Math.min(historyPage * historyItemsPerPage, history.length)} из {history.length} записей
        </div>
      
        {/* Кнопки навигации */}
        <div className="d-flex align-items-center gap-1">
          {/* К первой странице */}
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setHistoryPage(1)}
            disabled={historyPage === 1}
            title="Первая страница"
          >
            <i className="fas fa-angle-double-left"></i>
          </button>
        
          {/* Назад */}
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
            disabled={historyPage === 1}
            title="Предыдущая страница"
          >
            <i className="fas fa-angle-left"></i>
          </button>

          {/* Номера страниц */}
          {historyTotalPages <= 5 ? (
            Array.from({ length: historyTotalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                className={`btn btn-sm ${
                  pageNum === historyPage ? 'btn-primary' : 'btn-outline-secondary'
                }`}
                onClick={() => setHistoryPage(pageNum)}
                style={{ minWidth: '30px' }}
              >
                {pageNum}
              </button>
            ))
          ) : (
            <>
              {historyPage > 1 && (
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setHistoryPage(historyPage - 1)}
                  style={{ minWidth: '30px' }}
                >
                  {historyPage - 1}
                </button>
              )}
            
              <button
                className="btn btn-sm btn-primary"
                style={{ minWidth: '30px' }}
              >
                {historyPage}
              </button>
            
              {historyPage < historyTotalPages && (
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setHistoryPage(historyPage + 1)}
                  style={{ minWidth: '30px' }}
                >
                  {historyPage + 1}
                </button>
              )}
            </>
          )}
        
          {/* Вперёд */}
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
            disabled={historyPage === historyTotalPages}
            title="Следующая страница"
          >
            <i className="fas fa-angle-right"></i>
          </button>
        
          {/* К последней странице */}
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setHistoryPage(historyTotalPages)}
            disabled={historyPage === historyTotalPages}
            title="Последняя страница"
          >
            <i className="fas fa-angle-double-right"></i>
          </button>
        </div>
      
        {/* Быстрый переход - ИСПРАВЛЕННАЯ ВЕРСИЯ */}
        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted">Перейти:</span>
          <input
            type="number"
            min="1"
            max={historyTotalPages}
            value={inputValue} // Используем локальное состояние
            onChange={handleInputChange} // Новый обработчик
            onBlur={handleInputBlur} // Валидация при потере фокуса
            onKeyPress={handleKeyPress} // Обработка Enter
            className="form-control form-control-sm text-center"
            style={{ width: '60px' }}
            title="Введите номер страницы"
            placeholder={historyPage.toString()}
          />
          <span className="small text-muted">из {historyTotalPages}</span>
        </div>
      </div>
    );
  };



  return (
    <div className="app-root">
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

      {/* HEADER */}
      {token && (
        <header className="hdr">
          <div className="logo-wrap">
            <img
              key={isDarkMode ? 'logo-dark' : 'logo-light'}
              src={isDarkMode ? '/asset-logo-blur.png' : '/enhanced_asset-logo2.png'}
              alt="Asset Tracker"
              style={{ height: '36px', width: '36px', objectFit: 'contain', borderRadius: '6px' }}
            />
            <div>
              <div className="logo-text">Asset Tracker</div>
            </div>
          </div>
          <div className="hdr-gap"></div>
          <button className="theme-btn" onClick={toggleTheme} title={`Переключить на ${isDarkMode ? 'светлую' : 'темную'} тему`}>
            <i className={`fas fa-${isDarkMode ? 'sun' : 'moon'}`}></i>
          </button>
          <div className="chip"><div className="chip-dot"></div>{user?.username || 'пользователь'}</div>
          <button className="btn-exit" onClick={handleLogout}>Выйти</button>
        </header>
      )}

      {/* STATS BAR — desktop */}
      {token && !isMobile && stats.total > 0 && (
        <div className="stats-bar">
          <div className="sc sc-ac"><div className="sc-n">{stats.total}</div><div className="sc-l">Всего активов</div></div>
          <div className="sc"><div className="sc-n">{stats.laptops}</div><div className="sc-l">Ноутбуки</div></div>
          <div className="sc"><div className="sc-n">{stats.computers}</div><div className="sc-l">Компьютеры</div></div>
          <div className="sc"><div className="sc-n">{stats.monitors}</div><div className="sc-l">Мониторы</div></div>
          <div className="sc sc-tm"><div className="sc-n">{stats.other}</div><div className="sc-l">Прочее</div></div>
          <div className="sc sc-tm"><div className="sc-n">{stats.retired}</div><div className="sc-l">Списано</div></div>
          <div className="sc sc-ok"><div className="sc-n">{stats.underWarranty}</div><div className="sc-l">На гарантии</div></div>
          <div className="sc sc-wa"><div className="sc-n">{stats.expiringWarranty}</div><div className="sc-l">Гарантия истекает</div></div>
          <div className="sc sc-er"><div className="sc-n">{stats.inRepair}</div><div className="sc-l">В ремонте</div></div>
        </div>
      )}

      {/* КОМПАКТНАЯ СТАТИСТИКА ДЛЯ МОБИЛЬНЫХ */}
      {token && isMobile && (
        <div className="mobile-stats-section mb-3" style={{ padding: '12px 16px' }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0 text-muted">
              <i className="fas fa-chart-pie me-1"></i>Статистика
            </h6>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setShowMobileStats(!showMobileStats)}
            >
              <i className={`fas fa-chevron-${showMobileStats ? 'up' : 'down'}`}></i>
            </button>
          </div>
          {showMobileStats && (
            <div className="mobile-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              <div className="mini-stat-card"><div className="stat-value text-primary">{stats.total}</div><div className="stat-label">Всего</div></div>
              <div className="mini-stat-card"><div className="stat-value text-info">{stats.laptops}</div><div className="stat-label">Ноутбуки</div></div>
              <div className="mini-stat-card"><div className="stat-value text-success">{stats.computers}</div><div className="stat-label">ПК</div></div>
              <div className="mini-stat-card"><div className="stat-value text-warning">{stats.monitors}</div><div className="stat-label">Мониторы</div></div>
              <div className="mini-stat-card"><div className="stat-value text-muted">{stats.other}</div><div className="stat-label">Прочее</div></div>
              <div className="mini-stat-card"><div className="stat-value text-danger">{stats.retired}</div><div className="stat-label">Списано</div></div>
              <div className="mini-stat-card"><div className="stat-value text-secondary">{stats.inRepair}</div><div className="stat-label">Ремонт</div></div>
              <div className="mini-stat-card"><div className="stat-value text-purple">{stats.underWarranty}</div><div className="stat-label">На гарантии</div></div>
              <div className="mini-stat-card"><div className="stat-value text-orange">{stats.expiringWarranty}</div><div className="stat-label">Гарантия истекает</div></div>
            </div>
          )}
        </div>
      )}

      {/* TOOLBAR */}
      {token && user && (
        <div className="tb">
          {/* tb-scroll-line: all action buttons — scrollable on mobile */}
          <div className="tb-scroll-line">
            {user.is_admin && (
              <button className="btn-p" onClick={() => openModal()}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Добавить
              </button>
            )}
            <div className="tsep"></div>
            <button className="btn-t" onClick={() => setShowExportModal(true)}>↓ Экспорт</button>
            {user.is_admin && (
              <button className="btn-t" onClick={() => { setImportFile(null); setShowImportModal(true); }}>↑ Импорт</button>
            )}
            {user.is_admin && (
              <>
                <div className="tsep"></div>
                <button className="btn-t" onClick={() => setShowQRModal(true)}>⎙ Печать QR</button>
                <button className="btn-t" onClick={generateWindowsReport}>⊞ Windows</button>
                <div className="tsep"></div>
                <button
                  className={`btn-t ${inventorySession && !inventoryMode ? 'lit' : ''}`}
                  onClick={inventoryMode ? undefined : openInventory}
                  disabled={inventoryMode}
                >
                  {inventorySession && !inventoryMode ? '↺ Продолжить' : '✓ Инвентаризация'}
                </button>
              </>
            )}
            <div className="tsep"></div>
            {user.is_admin && (
              <>
                <button className="btn-t sm" onClick={() => openUserModal()}>👥 Пользователи</button>
                <button className="btn-t sm" onClick={openDeletionLogModal}>🕐 Журнал</button>
              </>
            )}
            <button className="btn-t sm" onClick={() => setShowAboutModal(true)}>ℹ О системе</button>
            <div className="tsp"></div>
            {user.is_admin && (
              <button className="btn-t danger sm" onClick={handleClearDatabase}><i className="fas fa-trash-alt"></i> Очистить БД</button>
            )}
          </div>
          {/* Search — last in DOM, moved to top on mobile via order:-1 */}
          <div className="search-wrap">
            <input
              className="search"
              placeholder="Поиск…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-x" type="button" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
        </div>
      )}

      {/* FILTER BAR — flat single row */}
      {token && (() => {
        const ageCounts = getAssetsByAgeCategory();
        const hasActive = filter !== 'Все' || disposedFilter || warrantyFilter !== 'all' || ageRangeFilter !== 'all' || searchQuery || selectedUser;
        return (
          <>
          <div className="fb">
            <button className={`ft ${filter === 'Все' && !disposedFilter && warrantyFilter === 'all' ? 'on' : ''}`}
              onClick={() => { setFilter('Все'); setDisposedFilter(false); setWarrantyFilter('all'); setPage(1); if (activeTab !== 'assets') setActiveTab('assets'); }}>
              Все <span className="n">{stats.total}</span>
            </button>
            <button className={`ft ${filter === 'Монитор' ? 'on' : ''}`}
              onClick={() => { setFilter('Монитор'); setDisposedFilter(false); setWarrantyFilter('all'); setPage(1); if (activeTab !== 'assets') setActiveTab('assets'); }}>
              Мониторы <span className="n">{stats.monitors}</span>
            </button>
            <button className={`ft ${filter === 'Компьютер' ? 'on' : ''}`}
              onClick={() => { setFilter('Компьютер'); setDisposedFilter(false); setWarrantyFilter('all'); setPage(1); if (activeTab !== 'assets') setActiveTab('assets'); }}>
              Компьютеры <span className="n">{stats.computers}</span>
            </button>
            <button className={`ft ${filter === 'Ноутбук' ? 'on' : ''}`}
              onClick={() => { setFilter('Ноутбук'); setDisposedFilter(false); setWarrantyFilter('all'); setPage(1); if (activeTab !== 'assets') setActiveTab('assets'); }}>
              Ноутбуки <span className="n">{stats.laptops}</span>
            </button>
            <button className={`ft ${filter === 'Прочее' ? 'on' : ''}`}
              onClick={() => { setFilter('Прочее'); setDisposedFilter(false); setWarrantyFilter('all'); setPage(1); if (activeTab !== 'assets') setActiveTab('assets'); }}>
              Прочее <span className="n">{stats.other}</span>
            </button>
            <div className="fsep"></div>
            <button className={`ft ${disposedFilter ? 'on' : ''}`}
              onClick={() => { setDisposedFilter(!disposedFilter); setFilter('Все'); setWarrantyFilter('all'); setPage(1); if (activeTab !== 'assets') setActiveTab('assets'); }}>
              Списано
            </button>
            <button className={`ft ${warrantyFilter === 'active' ? 'on' : ''}`}
              onClick={() => { setWarrantyFilter(warrantyFilter === 'active' ? 'all' : 'active'); setDisposedFilter(false); setPage(1); if (activeTab !== 'assets') setActiveTab('assets'); }}>
              На гарантии
            </button>
            <button className={`ft ${activeTab === 'reports' ? 'warn' : ''}`}
              onClick={() => setActiveTab(activeTab === 'reports' ? 'assets' : 'reports')}>
              Гарантия заканчивается
            </button>
            <div className="fsp"></div>
            <input
              className="fsel-input"
              type="text"
              placeholder="Пользователь…"
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
              list="user-datalist"
            />
            <datalist id="user-datalist">
              {uniqueUsers.map(u => <option key={u.value} value={u.value} />)}
            </datalist>
            {hasActive && (
              <button className="btn-rst" onClick={() => { setFilter('Все'); setDisposedFilter(false); setWarrantyFilter('all'); setAgeRangeFilter('all'); setSearchQuery(''); setSelectedUser(''); setPage(1); }}>
                ↺ Сбросить
              </button>
            )}
          </div>
          <div className="fb2">
            <span className="fb2-lbl">Возраст</span>
            <button className={`ab2 ${ageRangeFilter === 'all' ? 'on' : ''}`} onClick={() => setAgeRangeFilter('all')}>Все</button>
            {[
              { key: 'new',     label: 'до 1 года',    color: '#3A9D6E', count: ageCounts.new },
              { key: 'fresh',   label: '1–3 года',     color: 'var(--accent)', count: ageCounts.fresh },
              { key: 'medium',  label: '3–5 лет',      color: '#D4882A', count: ageCounts.medium },
              { key: 'old',     label: 'старше 5 лет', color: '#D95252', count: ageCounts.old },
              { key: 'unknown', label: 'Не указан',    color: 'var(--text-muted)', count: ageCounts.unknown },
            ].map(({ key, label, color, count }) => (
              <button key={key} className={`ab2 ${ageRangeFilter === key ? 'on' : ''}`}
                style={ageRangeFilter === key ? { borderColor: color, color: 'var(--text-primary)' } : {}}
                onClick={() => setAgeRangeFilter(key)}>
                <span className="ab2-dot" style={{ background: color }}></span>
                {label}
                <span className="ab2-cnt" style={{ color }}>{count}</span>
              </button>
            ))}
          </div>
          </>
        );
      })()}

      {/* ───── Режим инвентаризации ───── */}
      {token && inventoryMode && inventorySession && (() => {
        const nonRetired = assets.filter(a => a.status !== 'списано');
        const q = inventorySearch.trim().toLowerCase();
        const filtered = q
          ? nonRetired.filter(a =>
              (a.inventory_number || '').toLowerCase().includes(q) ||
              (a.model || '').toLowerCase().includes(q) ||
              (a.serial_number || '').toLowerCase().includes(q) ||
              (a.location || '').toLowerCase().includes(q)
            )
          : nonRetired;
        const unchecked = filtered.filter(a => !inventoryChecks[a.id]);
        const checked   = filtered.filter(a =>  inventoryChecks[a.id]);
        const checkedCount = Object.keys(inventoryChecks).length;
        const total = inventorySession.total_assets;
        const pct = total > 0 ? Math.round(checkedCount / total * 100) : 0;
        const notFoundAll = nonRetired.filter(a => !inventoryChecks[a.id]);

        return (
          <div className="inv-overlay">
            {/* Шапка */}
            <div className="inv-hdr">
              <span className="inv-badge">Инвентаризация</span>
              <span className="inv-meta">
                начата <span>{new Date(inventorySession.started_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                {' · '}
                <span>{inventorySession.started_by}</span>
              </span>
              {inventoryChangedUsers > 0 && (
                <span className="inv-updated">{inventoryChangedUsers} обновлено</span>
              )}
              <div className="inv-gap"></div>
              <button className="inv-btn" onClick={() => setInventoryMode(false)}>Свернуть</button>
              <button className="inv-btn finish" onClick={finishInventory}>Завершить</button>
            </div>

            {/* Прогресс */}
            <div className="inv-progress-wrap">
              <div className="inv-progress-bar" style={{ width: `${pct}%` }}></div>
            </div>
            <div className="inv-progress-label">
              Проверено: <span>{checkedCount}</span> из <span>{total}</span> — <span>{pct}%</span>
            </div>

            {/* Тело: 2 колонки */}
            <div className="inv-body">
              {/* Левая: поиск + подтверждение + не найденные */}
              <div className="inv-left">
                <div className="inv-search-wrap">
                  <input
                    className="inv-search"
                    type="text"
                    placeholder="Инв. №, модель, серийный, расположение…"
                    value={inventorySearch}
                    autoFocus
                    onChange={e => setInventorySearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && unchecked.length === 1 && !inventorySelected) {
                        setInventorySelected(unchecked[0]);
                        setInventoryUserName(unchecked[0].user_name || '');
                        setInventoryLocation(unchecked[0].location || '');
                      }
                    }}
                  />
                </div>

                {inventorySelected && (
                  <div className="inv-confirm">
                    <div className="inv-confirm-asset">
                      {inventorySelected.model || '—'}
                      {' · '}
                      <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: '11px' }}>
                        {inventorySelected.inventory_number}
                      </span>
                    </div>
                    <div className="inv-confirm-meta">
                      <span>{inventorySelected.type}</span>
                    </div>
                    <div className="inv-user-row">
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Расположение:</span>
                      <input
                        className="inv-user-input"
                        type="text"
                        value={inventoryLocation}
                        onChange={e => setInventoryLocation(e.target.value)}
                        placeholder="Расположение"
                      />
                    </div>
                    <div className="inv-user-row">
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Пользователь:</span>
                      <input
                        className="inv-user-input"
                        type="text"
                        value={inventoryUserName}
                        onChange={e => setInventoryUserName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && checkInventoryAsset(inventorySelected, inventoryUserName || null, inventoryLocation)}
                        autoFocus
                        placeholder="ФИО или оставьте пустым"
                      />
                    </div>
                    <div className="inv-confirm-btns">
                      <button className="inv-btn-cancel" onClick={() => setInventorySelected(null)}>Отмена</button>
                      <button className="inv-btn-ok" onClick={() => checkInventoryAsset(inventorySelected, inventoryUserName || null, inventoryLocation)}>
                        ✓ Подтвердить
                      </button>
                    </div>
                  </div>
                )}

                <div className="inv-list-title">
                  {q ? `Результаты (${unchecked.length})` : `Не найдено (${unchecked.length})`}
                </div>
                <div className="inv-list">
                  {unchecked.map(asset => (
                    <div
                      key={asset.id}
                      className={`inv-item${inventorySelected?.id === asset.id ? ' selected' : ''}`}
                      onClick={() => {
                        setInventorySelected(asset);
                        setInventoryUserName(asset.user_name || '');
                        setInventoryLocation(asset.location || '');
                        setInventorySearch('');
                      }}
                    >
                      <div className="inv-item-dot not-found"></div>
                      <div className="inv-item-body">
                        <div className="inv-item-inv">{asset.inventory_number}</div>
                        <div className="inv-item-name">{asset.model || '—'}</div>
                        <div className="inv-item-meta">{asset.type} · {asset.location}</div>
                      </div>
                    </div>
                  ))}
                  {unchecked.length === 0 && q && (
                    <div className="inv-empty">Ничего не найдено по «{inventorySearch}»</div>
                  )}
                  {unchecked.length === 0 && !q && checkedCount >= total && (
                    <div className="inv-empty" style={{ color: '#3A9D6E' }}>Все активы проверены</div>
                  )}
                </div>
              </div>

              {/* Правая: найденные */}
              <div className="inv-right">
                <div className="inv-list-title">Найдено ({checked.length})</div>
                <div className="inv-list">
                  {checked.map(asset => {
                    const chk = inventoryChecks[asset.id];
                    return (
                      <div key={asset.id} className="inv-item found">
                        <div className="inv-item-dot found-ok"></div>
                        <div className="inv-item-body">
                          <div className="inv-item-inv">{asset.inventory_number}</div>
                          <div className="inv-item-name">{asset.model || '—'}</div>
                          <div className="inv-item-meta">
                            {chk?.user_name_before !== chk?.user_name_after
                              ? `${chk?.user_name_before || '—'} → ${chk?.user_name_after || '—'}`
                              : (asset.user_name || 'без пользователя')
                            }
                          </div>
                        </div>
                        <button className="inv-item-undo" title="Снять отметку" onClick={() => uncheckInventoryAsset(asset.id)}>↺</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Модаль завершения */}
            {showInventoryFinish && (
              <>
                <div className="modal fade show d-block" tabIndex="-1">
                  <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                      <div className="modal-header">
                        <h5 className="modal-title">Итоги инвентаризации</h5>
                        <button type="button" className="btn-close" onClick={() => setShowInventoryFinish(false)}></button>
                      </div>
                      <div className="modal-body">
                        <p>Найдено: <strong style={{ color: '#3A9D6E' }}>{checkedCount}</strong> из <strong>{total}</strong></p>
                        {inventoryChangedUsers > 0 && (
                          <p>Обновлено пользователей: <strong style={{ color: 'var(--accent)' }}>{inventoryChangedUsers}</strong></p>
                        )}
                        {notFoundAll.length > 0 && (
                          <>
                            <p style={{ color: '#D95252', marginBottom: '4px' }}>Не найдено ({notFoundAll.length}):</p>
                            <ul style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px', listStyle: 'none', padding: 0, margin: 0 }}>
                              {notFoundAll.map(a => (
                                <li key={a.id} style={{ color: 'var(--text-muted)', padding: '2px 0' }}>
                                  {a.inventory_number} — {a.model || '—'} ({a.location})
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                      <div className="modal-footer">
                        <button className="btn-ok" onClick={closeInventory}>Закрыть</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-backdrop fade show"></div>
              </>
            )}
          </div>
        );
      })()}

      <React.Fragment>
        {token && activeTab === 'assets' && !isMobile && (
          <div className="tw">
            <div className="tw-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '44px' }}>ID</th>
                    <th style={{ width: '106px' }}>Инв. номер</th>
                    <th style={{ width: '80px' }}>Серийный №</th>
                    <th style={{ width: '116px' }}>Статус</th>
                    <th style={{ width: '106px' }}>Расположение</th>
                    <th style={{ width: '130px' }}>ФИО пользователя</th>
                    <th style={{ width: '95px' }}>Возраст</th>
                    <th>Комментарий</th>
                    {warrantyFilter === 'active' && <th style={{ width: '90px', color: 'rgba(107,122,153,.5)' }}>Гарантия до *</th>}
                    <th className="th-r" style={{ width: '106px' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAssets.length > 0 ? (
                    paginatedAssets.map((asset) => (
                      <React.Fragment key={asset.id}>
                        <tr>
                          <td><span className="cell-id">{asset.id}</span></td>
                          <td onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'inventory_number', asset.inventory_number)}>
                            {editingCell.assetId === asset.id && editingCell.field === 'inventory_number' ? (
                              <input
                                type="text"
                                className="cell-input"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={`cell-inv${user?.is_admin ? ' editable-cell' : ''}`}>{asset.inventory_number || '—'}</span>
                            )}
                          </td>
                          <td onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'serial_number', asset.serial_number)}>
                            {editingCell.assetId === asset.id && editingCell.field === 'serial_number' ? (
                              <input
                                type="text"
                                className="cell-input"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={`cell-srl${user?.is_admin ? ' editable-cell' : ''}`} title={asset.serial_number || '—'}>
                                {asset.serial_number || '—'}
                              </span>
                            )}
                          </td>
                          <td onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'status', asset.status)}>
                            {editingCell.assetId === asset.id && editingCell.field === 'status' ? (
                              <select
                                className="cell-select"
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
                              <span className={`pill ${asset.status === 'в эксплуатации' ? 'pill-on' : asset.status === 'списано' ? 'pill-out' : asset.status === 'на ремонте' ? 'pill-fix' : 'pill-off'}${user?.is_admin ? ' editable-cell' : ''}`}>
                                <span className="pill-dot"></span>{asset.status}
                              </span>
                            )}
                          </td>
                          <td onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'location', asset.location)}>
                            {editingCell.assetId === asset.id && editingCell.field === 'location' ? (
                              <input
                                type="text"
                                className="cell-input"
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
                          <td onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'user_name', asset.user_name)}>
                            {editingCell.assetId === asset.id && editingCell.field === 'user_name' ? (
                              <input
                                type="text"
                                className="cell-input"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={user?.is_admin ? 'editable-cell' : ''}>{asset.user_name || '—'}</span>
                            )}
                          </td>

                          <td onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'manual_age', asset.manual_age)}>
                            {editingCell.assetId === asset.id && editingCell.field === 'manual_age' ? (
                              <input
                                type="text"
                                className="cell-input"
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                placeholder="Например: 5 лет"
                                autoFocus
                              />
                            ) : (
                              <span className={`${getAgeClass(asset)}${user?.is_admin ? ' editable-cell' : ''}`}>
                                {calculateAssetAge(asset)}
                              </span>
                            )}
                          </td>

                          <td onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'comment', asset.comment)}>
                            {editingCell.assetId === asset.id && editingCell.field === 'comment' ? (
                              <textarea
                                className="cell-input"
                                style={{ height: '52px', resize: 'vertical', padding: '4px 8px' }}
                                value={editValue}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                              />
                            ) : (
                              <span className={`cell-cmnt${user?.is_admin ? ' editable-cell' : ''}`}>
                                {asset.comment || ''}
                              </span>
                            )}
                          </td>
                          {warrantyFilter === 'active' && <td style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>{asset.warranty_until || '—'}</td>}
                          <td className="td-actions">
                            <div className="ra">
                              <div className="ra-row">
                                <button
                                  className={`ra-btn ${showHistory === asset.id ? 'ra-on' : ''}`}
                                  title={showHistory === asset.id ? "Скрыть историю" : "История"}
                                  onClick={() => { if (showHistory === asset.id) { setShowHistory(null); } else { setShowHistory(asset.id); setHistoryPage(1); } }}
                                >↺</button>
                                <button className="ra-btn" title="Информация" onClick={() => openAssetInfoModal(asset)}>i</button>
                                <button className="ra-btn" title="Копировать" onClick={() => handleCopyAssetInfo(asset)}>⎘</button>
                              </div>
                              {user?.is_admin && (
                                <div className="ra-row">
                                  <button className="ra-btn" title="Редактировать" onClick={() => handleEdit(asset)}>✎</button>
                                  <button className="ra-btn ra-del" title="Удалить" onClick={() => handleDelete(asset.id)}><i className="fas fa-trash-alt"></i></button>
                                  <button className="ra-btn ra-fix" title="Ремонты" onClick={() => openRepairsModal(asset.id)}><i className="fas fa-cog"></i></button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {showHistory === asset.id && asset.history && asset.history.length > 0 && (
                          <tr className="hist-row">
                            <td colSpan={(user?.is_admin ? 9 : 8) + (warrantyFilter === 'active' ? 1 : 0)}>
                              <div className="hist-inner">
                                <div className="hist-title">История изменений — {asset.inventory_number}</div>
                                <HistoryPagination
                                  history={asset.history}
                                  historyPage={historyPage}
                                  setHistoryPage={setHistoryPage}
                                  historyItemsPerPage={historyItemsPerPage}
                                />
                                {asset.history
                                  .slice()
                                  .sort((a, b) => {
                                    const dateA = new Date(a.changed_at);
                                    const dateB = new Date(b.changed_at);
                                    if (dateA.getTime() !== dateB.getTime()) return dateB - dateA;
                                    return b.id - a.id;
                                  })
                                  .slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage)
                                  .map((h, idx) => (
                                    <div key={idx} className="hist-entry">
                                      <span className="hist-date">{h.changed_at}</span>
                                      {h.changed_by && <span className="hist-user">{h.changed_by}</span>}
                                      <span>{getHumanFieldName(h.field)}: <span className="hist-old">{h.old_value}</span> → <span className="hist-new">{h.new_value}</span></span>
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={(user?.is_admin ? 9 : 8) + (warrantyFilter === 'active' ? 1 : 0)} className="text-center">Нет данных</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {token && activeTab === 'assets' && isMobile && (
          <div className="mobile-container">
            {paginatedAssets.length > 0 ? (
              <div className="mobile-assets-container">
                {paginatedAssets.map((asset, index) => (
                  <div 
                    key={asset.id} 
                    className="mobile-asset-card mb-3"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '2px solid #e9ecef',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      padding: '16px',
                      position: 'relative'
                    }}
                  >
                    {/* Заголовок карточки */}
                    <div className="card-header-mobile mb-3" style={{
                      borderBottom: '2px solid #f8f9fa',
                      paddingBottom: '12px'
                    }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0 fw-bold text-primary">
                          {asset.inventory_number}
                        </h6>
                        <span className={`status-badge status-${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </div>
                      {asset.model && (
                        <small className="text-muted">{asset.model}</small>
                      )}
                    </div>

                    {/* Основная информация */}
                    <div className="mobile-info-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div className="info-block">
                        <div className="info-label">
                          <i className="fas fa-tag me-1"></i>
                          <small className="text-muted fw-semibold">Тип</small>
                        </div>
                        <div className="info-value fw-medium">{asset.type}</div>
                      </div>

                      <div className="info-block">
                        <div className="info-label">
                          <i className="fas fa-map-marker-alt me-1"></i>
                          <small className="text-muted fw-semibold">Расположение</small>
                        </div>
                        <div className="info-value fw-medium">{asset.location}</div>
                      </div>

                      <div className="info-block">
                        <div className="info-label">
                          <i className="fas fa-clock me-1"></i>
                          <small className="text-muted fw-semibold">Возраст</small>
                        </div>
                        <div 
                          className={`info-value fw-medium ${getAgeClass(asset)} ${user?.is_admin ? 'editable-mobile' : ''}`}
                          onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'manual_age', asset.manual_age)}
                        >
                          {editingCell.assetId === asset.id && editingCell.field === 'manual_age' ? (
                            <input 
                              type="text" 
                              className="form-control form-control-sm" 
                              value={editValue} 
                              onChange={handleEditChange}
                              onKeyDown={handleEditKeyDown} 
                              onBlur={saveEdit} 
                              placeholder="Например: 5 лет" 
                              autoFocus 
                              style={{ fontSize: '0.9em' }}
                            />
                          ) : (
                            <>
                              {calculateAssetAge(asset)}
                              {asset.manual_age && (
                                <i className="fas fa-edit text-muted ms-1" style={{ fontSize: '0.7em' }}></i>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="info-block">
                        <div className="info-label">
                          <i className="fas fa-barcode me-1"></i>
                          <small className="text-muted fw-semibold">Серийный №</small>
                        </div>
                        <div className="info-value fw-medium" style={{ fontSize: '0.85em' }}>
                          {asset.serial_number || 'Не указан'}
                        </div>
                      </div>
                    </div>

                    {/* Пользователь (если есть) */}
                    {asset.user_name && (
                      <div className="user-info mb-3" style={{
                        backgroundColor: '#f8f9fa',
                        padding: '8px 12px',
                        borderRadius: '6px'
                      }}>
                        <div className="d-flex align-items-center">
                          <i className="fas fa-user text-primary me-2"></i>
                          <div>
                            <small className="text-muted d-block">Пользователь</small>
                            <strong>{asset.user_name}</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ключ Windows (если есть) */}
                    {asset.windows_key && (
                      <div className="windows-key-info mb-3">
                        <small className="text-muted">
                          <i className="fab fa-windows me-1"></i>Ключ Windows:
                        </small>
                        <div 
                          className={`windows-key-value ${user?.is_admin ? 'editable-mobile' : ''}`}
                          style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '0.8em',
                            backgroundColor: '#f8f9fa',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            wordBreak: 'break-all',
                            marginTop: '4px'
                          }}
                          onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'windows_key', asset.windows_key)}
                        >
                          {editingCell.assetId === asset.id && editingCell.field === 'windows_key' ? (
                            <input 
                              type="text" 
                              className="form-control form-control-sm" 
                              value={editValue} 
                              onChange={handleEditChange}
                              onKeyDown={handleEditKeyDown} 
                              onBlur={saveEdit} 
                              placeholder="Введите ключ Windows" 
                              autoFocus 
                              style={{ fontFamily: 'monospace', fontSize: '0.8em' }}
                            />
                          ) : (
                            asset.windows_key
                          )}
                        </div>
                      </div>
                    )}

                    {/* Действия */}
                    <div className="mobile-actions" style={{
                      borderTop: '1px solid #e9ecef',
                      paddingTop: '12px'
                    }}>
                      <div className="d-flex flex-wrap gap-2">
                        {user?.is_admin && (
                          <>
                            <button 
                              className="btn btn-primary btn-sm flex-fill"
                              onClick={() => handleEdit(asset)}
                              style={{ minWidth: '80px' }}
                            >
                              <i className="fas fa-edit me-1"></i>Изменить
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(asset.id)}
                              style={{ minWidth: '40px' }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                        <button 
                          className="btn btn-info btn-sm"
                          onClick={() => setShowHistory(showHistory === asset.id ? null : asset.id)}
                        >
                          <i className="fas fa-history"></i>
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => openAssetInfoModal(asset)}
                        >
                          <i className="fas fa-info-circle"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Копировать информацию"
                          onClick={() => handleCopyAssetInfo(asset)}
                        >
                          <i className="fas fa-copy"></i>
                        </button>
                        {user?.is_admin && (
                          <button 
                            className="btn btn-warning btn-sm"
                            onClick={() => openRepairsModal(asset.id)}
                          >
                            <i className="fas fa-tools"></i>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* История (если развернута) - УЛУЧШЕННАЯ ВЕРСИЯ С ПАГИНАЦИЕЙ */}
                    {showHistory === asset.id && (
                      <div className="mobile-history mt-3" style={{
                        padding: '12px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                      }}>
                        <h6 className="mb-2" style={{ fontSize: '0.9em' }}>
                          <i className="fas fa-history me-2"></i>История изменений
                          {asset.history && asset.history.length > 0 && (
                            <small className="text-muted ms-2">({asset.history.length} записей)</small>
                          )}
                        </h6>
    
                        <div className="history-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {asset.history && asset.history.length > 0 ? (
                            (() => {
                              const sortedHistory = asset.history
                                .slice()
                                .sort((a, b) => {
                                  const dateA = new Date(a.changed_at);
                                  const dateB = new Date(b.changed_at);
                                  if (dateA.getTime() !== dateB.getTime()) {
                                    return dateB - dateA;
                                  }
                                  return b.id - a.id;
                                });
          
                              const totalPages = Math.ceil(sortedHistory.length / historyItemsPerPage);
                              const startIndex = (historyPage - 1) * historyItemsPerPage;
                              const endIndex = startIndex + historyItemsPerPage;
                              const currentHistory = sortedHistory.slice(startIndex, endIndex);
          
                              return (
                                <>
                                  {currentHistory.map((h, idx) => (
                                    <div key={`${h.id}-${idx}`} className="history-item mb-2" style={{
                                      fontSize: '0.8em',
                                      padding: '6px 8px',
                                      backgroundColor: 'white',
                                      borderRadius: '4px',
                                      border: '1px solid #e9ecef'
                                    }}>
                                      <div className="history-date text-muted mb-1">
                                        {h.changed_at} {h.changed_by ? `[${h.changed_by}]` : ''}
                                      </div>
                                      <div>
                                        <strong>{getHumanFieldName(h.field)}:</strong> "{h.old_value}" → "{h.new_value}"
                                      </div>
                                    </div>
                                  ))}
              
                                  {/* Пагинация истории */}
                                  {totalPages > 1 && (
                                    <div className="history-pagination mt-2">
                                      {/* Основная навигация */}
                                      <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                                        <button 
                                          className="btn btn-outline-secondary btn-sm"
                                          onClick={() => handleHistoryPageChange(asset.id, Math.max(1, historyPage - 1))}
                                          disabled={historyPage === 1}
                                          style={{ minWidth: '30px', fontSize: '0.7em' }}
                                        >
                                          <i className="fas fa-chevron-left"></i>
                                        </button>

                                        <span className="small text-muted" style={{ fontSize: '0.75em' }}>
                                          {historyPage} / {totalPages}
                                        </span>

                                        <button 
                                          className="btn btn-outline-secondary btn-sm"
                                          onClick={() => handleHistoryPageChange(asset.id, Math.min(totalPages, historyPage + 1))}
                                          disabled={historyPage === totalPages}
                                          style={{ minWidth: '30px', fontSize: '0.7em' }}
                                        >
                                          <i className="fas fa-chevron-right"></i>
                                        </button>
                                      </div>

                                      {/* Быстрая навигация */}
                                      {totalPages > 3 && (
                                        <div className="d-flex justify-content-center align-items-center gap-1">
                                          <span style={{ fontSize: '0.7em', color: '#6c757d' }}>Перейти:</span>
                                          <select 
                                            className="form-select form-select-sm"
                                            value={historyPage}
                                            onChange={(e) => handleHistoryPageChange(asset.id, parseInt(e.target.value))}
                                            style={{ 
                                              width: 'auto', 
                                              minWidth: '60px',
                                              fontSize: '0.7em',
                                              padding: '2px 6px'
                                            }}
                                          >
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                              <option key={pageNum} value={pageNum}>
                                                {pageNum}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            <p className="text-muted mb-0" style={{ fontSize: '0.85em' }}>
                              История изменений отсутствует
                            </p>
                          )}
                        </div>
                      </div>
                    )}


                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-3">Нет данных</div>
            )}
          </div>
        )}









      </React.Fragment>

      {token && activeTab === 'assets' && assets.length > 0 && !isMobile && (
        <div className="pg">
          <div className="pg-info">
            Показано {((page - 1) * itemsPerPage) + 1}–{Math.min(page * itemsPerPage, filteredAssets.length)} из {filteredAssets.length}
          </div>
          <div className="pg-nav">
            <button className="pg-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {(() => {
              const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
              const delta = 2;
              const range = [];
              for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) range.push(i);
              if (page - delta > 2) range.unshift('...');
              if (page + delta < totalPages - 1) range.push('...');
              range.unshift(1);
              if (totalPages !== 1) range.push(totalPages);
              return range.map((pageNum, index) => (
                pageNum === '...'
                  ? <span key={index} style={{ color: 'var(--text-muted)', padding: '0 4px', fontSize: '12px' }}>…</span>
                  : <button key={index} className={`pg-btn ${pageNum === page ? 'cur' : ''}`} onClick={() => setPage(pageNum)} disabled={pageNum === page}>{pageNum}</button>
              ));
            })()}
            <button className="pg-btn" onClick={() => setPage(p => Math.min(Math.ceil(filteredAssets.length / itemsPerPage), p + 1))} disabled={page === Math.ceil(filteredAssets.length / itemsPerPage) || filteredAssets.length === 0}>›</button>
            <button className="pg-btn" onClick={() => setPage(Math.ceil(filteredAssets.length / itemsPerPage))} disabled={page === Math.ceil(filteredAssets.length / itemsPerPage) || filteredAssets.length === 0}>»</button>
          </div>
          <div className="pg-jump">
            Перейти на стр.
            <input
              className="pg-inp"
              type="number"
              min="1"
              max={Math.ceil(filteredAssets.length / itemsPerPage)}
              value={page}
              onChange={(e) => {
                const num = parseInt(e.target.value, 10);
                if (num >= 1 && num <= Math.ceil(filteredAssets.length / itemsPerPage)) setPage(num);
              }}
            />
          </div>
        </div>
      )}


      {activeTab === 'reports' && token && (
        <div className="reports-section">
          <h4>Отчёт: Гарантия заканчивается</h4>
          <p>Активы, у которых гарантия заканчивается в ближайшие 30 дней</p>
          
          {/* ДЕСКТОПНАЯ ТАБЛИЦА */}
          {!isMobile && (
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
                  <tr key={asset.id} className="expiring-soon">
                    <td data-label="Инвентарный номер">{asset.inventory_number}</td>
                    <td data-label="Модель">{asset.model}</td>
                    <td data-label="ФИО">{asset.user_name || '-'}</td>
                    <td data-label="Гарантия до">{asset.warranty_until}</td>
                    <td data-label="Статус">{asset.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* МОБИЛЬНЫЕ КАРТОЧКИ */}
          {isMobile && (
            <div className="mobile-reports-container">
              {expiringWarranty.length > 0 ? (
                expiringWarranty.map((asset) => (
                  <div key={asset.id} className="mobile-asset-card mb-3 border-warning" style={{
                    backgroundColor: '#fff3cd', 
                    border: '2px solid #ffeaa7',
                    borderRadius: '12px', 
                    padding: '16px'
                  }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0 fw-bold text-warning">
                        {asset.inventory_number}
                      </h6>
                      <span className="badge bg-warning text-dark">
                        Гарантия истекает
                      </span>
                    </div>
                    
                    {asset.model && (
                      <div className="mb-2">
                        <strong>Модель:</strong> {asset.model}
                      </div>
                    )}
                    
                    {asset.user_name && (
                      <div className="mb-2">
                        <strong>Пользователь:</strong> {asset.user_name}
                      </div>
                    )}
                    
                    <div className="mb-2">
                      <strong>Гарантия до:</strong> 
                      <span className="text-danger fw-bold ms-1">{asset.warranty_until}</span>
                    </div>
                    
                    <div>
                      <span className={`badge bg-${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-4 text-muted">
                  Нет активов с истекающей гарантией
                </div>
              )}
            </div>
          )}
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
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

                  <div className="mrow">
                    <div className="mf">
                      <label>Инвентарный номер *</label>
                      <input type="text" name="inventory_number" value={formData.inventory_number} onChange={handleChange} required />
                    </div>
                    <div className="mf">
                      <label>Тип *</label>
                      <select name="type" value={formData.type} onChange={handleChange} required>
                        <option value="">Выберите тип</option>
                        <option value="Монитор">Монитор</option>
                        <option value="Компьютер">Компьютер</option>
                        <option value="Ноутбук">Ноутбук</option>
                        <option value="Прочее">Прочее</option>
                      </select>
                    </div>
                  </div>

                  <div className="mrow">
                    <div className="mf">
                      <label>Серийный номер</label>
                      <input type="text" name="serial_number" value={formData.serial_number || ''} onChange={handleChange} />
                    </div>
                    <div className="mf">
                      <label>Модель</label>
                      <input type="text" name="model" value={formData.model || ''} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="mrow">
                    <div className="mf">
                      <label>Расположение *</label>
                      <input type="text" name="location" value={formData.location} onChange={handleChange} required />
                    </div>
                    <div className="mf">
                      <label>ФИО пользователя</label>
                      <input type="text" name="user_name" value={formData.user_name || ''} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="mrow">
                    <div className="mf">
                      <label>Статус</label>
                      <select name="status" value={formData.status} onChange={handleChange}>
                        <option value="в эксплуатации">в эксплуатации</option>
                        <option value="на ремонте">на ремонте</option>
                        <option value="списано">списано</option>
                      </select>
                    </div>
                    <div className="mf">
                      <label>Дата покупки</label>
                      <input type="date" name="purchase_date" value={formData.purchase_date || ''} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="mrow">
                    <div className="mf">
                      <label>Возраст (если дата покупки неизвестна)</label>
                      <input type="text" name="manual_age" value={formData.manual_age || ''} onChange={handleChange} placeholder="3 года, 5 лет..." />
                    </div>
                    <div className="mf">
                      <label>Гарантия до</label>
                      <input type="date" name="warranty_until" value={formData.warranty_until || ''} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="mf">
                    <label>Комментарий</label>
                    <input type="text" name="comment" value={formData.comment || ''} onChange={handleChange} />
                  </div>

                  {(formData.purchase_date || formData.manual_age) && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '7px 11px', background: 'var(--bg-raised)', borderRadius: '5px', border: '1px solid var(--border-color)' }}>
                      Возраст будет отображаться как: <span className={getAgeClass(formData)}>{calculateAssetAge(formData)}</span>
                    </div>
                  )}

                  {formData.type === 'Компьютер' && (
                    <>
                      <div className="msec">Характеристики</div>
                      <div className="mrow3">
                        <div className="mf">
                          <label>Мат. плата</label>
                          <input type="text" name="motherboard" value={formData.motherboard || ''} onChange={handleChange} />
                        </div>
                        <div className="mf">
                          <label>Процессор</label>
                          <input type="text" name="processor" value={formData.processor || ''} onChange={handleChange} />
                        </div>
                        <div className="mf">
                          <label>ОЗУ</label>
                          <input type="text" name="ram" value={formData.ram || ''} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="mrow">
                        <div className="mf">
                          <label>Тип накопителя</label>
                          <select name="storage_type" value={formData.storage_type || ''} onChange={handleChange}>
                            <option value="">Не указан</option>
                            <option value="SSD">SSD</option>
                            <option value="HDD">HDD</option>
                            <option value="NVMe">NVMe</option>
                            <option value="eMMC">eMMC</option>
                          </select>
                        </div>
                        <div className="mf">
                          <label>Объём накопителя</label>
                          <input type="text" name="storage_size" value={formData.storage_size || ''} onChange={handleChange} placeholder="512 ГБ" />
                        </div>
                      </div>
                      <div className="mrow">
                        <div className="mf">
                          <label>Ключ Windows</label>
                          <input type="text" name="windows_key" value={formData.windows_key || ''} onChange={handleChange} />
                        </div>
                        <div className="mf">
                          <label>Тип ОС</label>
                          <input type="text" name="os_type" value={formData.os_type || ''} onChange={handleChange} />
                        </div>
                      </div>
                    </>
                  )}

                  {formData.type === 'Ноутбук' && (
                    <>
                      <div className="msec">Характеристики</div>
                      <div className="mrow">
                        <div className="mf">
                          <label>Процессор</label>
                          <input type="text" name="processor" value={formData.processor || ''} onChange={handleChange} />
                        </div>
                        <div className="mf">
                          <label>ОЗУ</label>
                          <input type="text" name="ram" value={formData.ram || ''} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="mrow">
                        <div className="mf">
                          <label>Тип накопителя</label>
                          <select name="storage_type" value={formData.storage_type || ''} onChange={handleChange}>
                            <option value="">Не указан</option>
                            <option value="SSD">SSD</option>
                            <option value="HDD">HDD</option>
                            <option value="NVMe">NVMe</option>
                            <option value="eMMC">eMMC</option>
                          </select>
                        </div>
                        <div className="mf">
                          <label>Объём накопителя</label>
                          <input type="text" name="storage_size" value={formData.storage_size || ''} onChange={handleChange} placeholder="512 ГБ" />
                        </div>
                      </div>
                      <div className="mrow">
                        <div className="mf">
                          <label>Ключ Windows</label>
                          <input type="text" name="windows_key" value={formData.windows_key || ''} onChange={handleChange} />
                        </div>
                        <div className="mf">
                          <label>Тип ОС</label>
                          <input type="text" name="os_type" value={formData.os_type || ''} onChange={handleChange} />
                        </div>
                      </div>
                      <div style={{ maxWidth: '50%' }}>
                        <div className="mf">
                          <label>Дата выдачи</label>
                          <input type="date" name="issue_date" value={formData.issue_date || ''} onChange={handleChange} />
                        </div>
                      </div>
                    </>
                  )}

                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Отмена
                </button>
                <button type="button" className="btn btn-success" onClick={handleSubmit}>
                  {isEditing ? 'Сохранить изменения' : 'Добавить актив'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {isEditingUser ? 'Редактировать пользователя' : 'Пользователи'}
                </h5>
                <button type="button" className="btn-close" onClick={() => { setShowUserModal(false); setIsEditingUser(false); setEditingUser(null); setUserFormData({ username: '', password: '', is_admin: false }); }}></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

                {/* Форма создания / редактирования */}
                <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  <div className="msec" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                    {isEditingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
                  </div>
                  <div className="mrow">
                    <div className="mf">
                      <label>Имя пользователя</label>
                      <input type="text" name="username" value={userFormData.username} onChange={handleUserChange} required />
                    </div>
                    <div className="mf">
                      <label>{isEditingUser ? 'Новый пароль (пусто — не менять)' : 'Пароль'}</label>
                      <input type="password" name="password" value={userFormData.password} onChange={handleUserChange} required={!isEditingUser} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="is_admin_cb"
                      name="is_admin"
                      checked={userFormData.is_admin}
                      onChange={handleUserChange}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <label htmlFor="is_admin_cb" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                      Администратор
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn-ok">
                      {isEditingUser ? 'Сохранить' : 'Создать пользователя'}
                    </button>
                    {isEditingUser && (
                      <button type="button" className="btn-sec" onClick={() => { setIsEditingUser(false); setEditingUser(null); setUserFormData({ username: '', password: '', is_admin: false }); }}>
                        Отмена
                      </button>
                    )}
                  </div>
                </form>

                {/* Список пользователей */}
                {user?.is_admin && (
                  <>
                    <div className="msec">Список пользователей</div>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', width: '44px' }}>ID</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Пользователь</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', width: '140px' }}>Роль</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', width: '72px' }}>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.length > 0 ? users.map((u, idx) => (
                            <tr key={u.id} style={{ borderBottom: idx < users.length - 1 ? '1px solid var(--bg-raised)' : 'none' }}>
                              <td style={{ padding: '8px 12px' }}><span className="cell-id">{u.id}</span></td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontSize: '13px' }}>
                                {u.username}
                                {u.id === user.id && <span style={{ marginLeft: '7px', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>вы</span>}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {u.is_admin
                                  ? <span className="pill pill-on"><span className="pill-dot"></span>Администратор</span>
                                  : <span className="pill pill-off"><span className="pill-dot"></span>Пользователь</span>
                                }
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <div className="ra-row" style={{ justifyContent: 'flex-end' }}>
                                  <button className="ra-btn" title="Редактировать" onClick={() => openUserModal(u)}>✎</button>
                                  <button className="ra-btn ra-del" title="Удалить" onClick={() => handleDeleteUser(u.id)} disabled={u.id === user.id}><i className="fas fa-trash-alt"></i></button>
                                </div>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan="4" style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Нет пользователей</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowUserModal(false); setIsEditingUser(false); setEditingUser(null); setUserFormData({ username: '', password: '', is_admin: false }); }}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRepairsModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Ремонты — актив #{currentAssetId}</h5>
                <button type="button" className="btn-close" onClick={() => setShowRepairsModal(false)}></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

                {/* Форма добавления / редактирования */}
                <form onSubmit={editingRepairId ? handleUpdateRepair : handleCreateRepair} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  <div className="msec" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                    {editingRepairId ? 'Редактировать запись' : 'Новая запись'}
                  </div>
                  <div className="mrow3">
                    <div className="mf">
                      <label>Дата ремонта *</label>
                      <input type="date" name="repair_date" value={repairFormData.repair_date} onChange={handleRepairChange} required />
                    </div>
                    <div className="mf">
                      <label>Стоимость</label>
                      <input type="text" name="cost" value={repairFormData.cost} onChange={handleRepairChange} placeholder="1500 руб." />
                    </div>
                    <div className="mf">
                      <label>Кто выполнил</label>
                      <input type="text" name="performed_by" value={repairFormData.performed_by} onChange={handleRepairChange} placeholder="ФИО или организация" />
                    </div>
                  </div>
                  <div className="mf">
                    <label>Описание работ *</label>
                    <textarea name="description" value={repairFormData.description} onChange={handleRepairChange} required style={{ minHeight: '60px', resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn-ok">
                      {editingRepairId ? 'Сохранить' : 'Добавить запись'}
                    </button>
                    {editingRepairId && (
                      <button type="button" className="btn-sec" onClick={() => { setEditingRepairId(null); setRepairFormData({ repair_date: '', description: '', cost: '', performed_by: '' }); }}>
                        Отмена
                      </button>
                    )}
                  </div>
                </form>

                {/* Список записей */}
                <div className="msec">История ремонтов</div>
                {repairsForAsset.length > 0 ? (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', width: '90px' }}>Дата</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Описание</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', width: '100px' }}>Стоимость</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', width: '130px' }}>Кто выполнил</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', width: '60px' }}>Дейст.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repairsForAsset.map((record, idx) => (
                          <tr key={record.id} style={{ borderBottom: idx < repairsForAsset.length - 1 ? '1px solid var(--bg-raised)' : 'none' }}>
                            <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{record.repair_date}</td>
                            <td style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.description}>{record.description}</td>
                            <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{record.cost || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.performed_by}>{record.performed_by || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <div className="ra-row" style={{ justifyContent: 'flex-end' }}>
                                <button className="ra-btn" title="Редактировать" onClick={() => handleEditRepair(record)}>✎</button>
                                <button className="ra-btn ra-del" title="Удалить" onClick={() => handleDeleteRepair(record.id)}><i className="fas fa-trash-alt"></i></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-raised)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    Нет записей о ремонте для этого актива
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRepairsModal(false)}>Закрыть</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeletionLogModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Журнал удалений</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeletionLogModal(false)}></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                {deletionLogLoading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Загрузка...
                  </div>
                ) : deletionLogs.length > 0 ? (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-raised)' }}>
                          <th style={{ width: '150px', padding: '7px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', textAlign: 'left' }}>Дата/Время</th>
                          <th style={{ width: '100px', padding: '7px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', textAlign: 'left' }}>Тип</th>
                          <th style={{ width: '50px', padding: '7px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', textAlign: 'left' }}>ID</th>
                          <th style={{ width: '130px', padding: '7px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', textAlign: 'left' }}>Пользователь</th>
                          <th style={{ padding: '7px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', textAlign: 'left' }}>Данные</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deletionLogs.map((log, idx) => {
                          let shortData = '—';
                          if (log.entity_data) {
                            try {
                              const dataObj = JSON.parse(log.entity_data);
                              shortData = dataObj.inventory_number || dataObj.id || 'Данные есть';
                            } catch (e) {
                              shortData = log.entity_data.substring(0, 50) + (log.entity_data.length > 50 ? '...' : '');
                            }
                          }
                          return (
                            <tr key={log.id} style={{ borderBottom: idx < deletionLogs.length - 1 ? '1px solid var(--bg-raised)' : 'none' }}>
                              <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={new Date(log.deleted_at).toLocaleString()}>{new Date(log.deleted_at).toLocaleString()}</td>
                              <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.entity_type}>{log.entity_type}</td>
                              <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{log.entity_id}</td>
                              <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.deleted_by}>{log.deleted_by}</td>
                              <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shortData}>{shortData}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-raised)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    Записи об удалениях отсутствуют.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sec" onClick={() => setShowDeletionLogModal(false)}>
                  Закрыть
                </button>
                <button type="button" className="btn-ok" onClick={fetchDeletionLogs} disabled={deletionLogLoading}>
                  {deletionLogLoading ? 'Обновление...' : 'Обновить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssetInfoModal && assetInfo && (
        <>
          <div className="modal fade show" style={{ display: 'block' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{assetInfo.type} — {assetInfo.inventory_number}</h5>
                  <button type="button" className="btn-close" onClick={closeAssetInfoModal}></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                  {/* Поля актива */}
                  <div style={{ flex: 1 }}>
                    <div className="ai-sec">Основное</div>
                    <div className="ai-row"><span className="ai-lbl">Инв. номер</span><span className="ai-val ai-mono">{assetInfo.inventory_number}</span></div>
                    {assetInfo.serial_number && <div className="ai-row"><span className="ai-lbl">Серийный №</span><span className="ai-val ai-mono">{assetInfo.serial_number}</span></div>}
                    {assetInfo.model && <div className="ai-row"><span className="ai-lbl">Модель</span><span className="ai-val">{assetInfo.model}</span></div>}
                    <div className="ai-row">
                      <span className="ai-lbl">Статус</span>
                      <span className="ai-val">
                        <span className={`pill ${assetInfo.status === 'в эксплуатации' ? 'pill-on' : assetInfo.status === 'списано' ? 'pill-out' : assetInfo.status === 'на ремонте' ? 'pill-fix' : 'pill-off'}`}>
                          <span className="pill-dot"></span>{assetInfo.status}
                        </span>
                      </span>
                    </div>
                    <div className="ai-row"><span className="ai-lbl">Расположение</span><span className="ai-val">{assetInfo.location || '—'}</span></div>
                    {assetInfo.user_name && <div className="ai-row"><span className="ai-lbl">Пользователь</span><span className="ai-val">{assetInfo.user_name}</span></div>}
                    <div className="ai-row"><span className="ai-lbl">Возраст</span><span className={`ai-val ${getAgeClass(assetInfo)}`}>{calculateAssetAge(assetInfo)}</span></div>
                    {assetInfo.purchase_date && <div className="ai-row"><span className="ai-lbl">Дата покупки</span><span className="ai-val">{new Date(assetInfo.purchase_date).toLocaleDateString('ru-RU')}</span></div>}
                    {assetInfo.warranty_until && <div className="ai-row"><span className="ai-lbl">Гарантия до</span><span className="ai-val">{new Date(assetInfo.warranty_until).toLocaleDateString('ru-RU')}</span></div>}
                    {assetInfo.comment && <div className="ai-row"><span className="ai-lbl">Комментарий</span><span className="ai-val" style={{ color: 'var(--text-muted)' }}>{assetInfo.comment}</span></div>}

                    {(assetInfo.type === 'Компьютер' || assetInfo.type === 'Ноутбук') && (
                      <>
                        <div className="ai-sec">Характеристики</div>
                        {assetInfo.type === 'Компьютер' && assetInfo.motherboard && <div className="ai-row"><span className="ai-lbl">Мат. плата</span><span className="ai-val">{assetInfo.motherboard}</span></div>}
                        {assetInfo.processor && <div className="ai-row"><span className="ai-lbl">Процессор</span><span className="ai-val">{assetInfo.processor}</span></div>}
                        {assetInfo.ram && <div className="ai-row"><span className="ai-lbl">ОЗУ</span><span className="ai-val">{assetInfo.ram}</span></div>}
                        {(assetInfo.storage_type || assetInfo.storage_size) && <div className="ai-row"><span className="ai-lbl">Накопитель</span><span className="ai-val">{[assetInfo.storage_type, assetInfo.storage_size].filter(Boolean).join(' ')}</span></div>}
                        {assetInfo.os_type && <div className="ai-row"><span className="ai-lbl">ОС</span><span className="ai-val">{assetInfo.os_type}</span></div>}
                        {assetInfo.os_type && assetInfo.os_type.toLowerCase().includes('windows') && assetInfo.windows_key && <div className="ai-row"><span className="ai-lbl">Ключ Windows</span><span className="ai-val ai-mono" style={{ fontSize: '11px' }}>{assetInfo.windows_key}</span></div>}
                        {assetInfo.type === 'Ноутбук' && assetInfo.issue_date && <div className="ai-row"><span className="ai-lbl">Дата выдачи</span><span className="ai-val">{new Date(assetInfo.issue_date).toLocaleDateString('ru-RU')}</span></div>}
                      </>
                    )}
                  </div>

                  {/* QR-код */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <QRCode
                        size={128}
                        style={{ display: 'block' }}
                        value={`${window.location.origin}${window.location.pathname}#asset-info-${assetInfo.id}`}
                        viewBox="0 0 256 256"
                      />
                    </div>
                    <button className="btn-sec" style={{ fontSize: '11px', height: '28px', padding: '0 10px' }} onClick={() => handlePrintSingleQRCode(assetInfo)}>
                      ⎙ Печать QR
                    </button>
                  </div>

                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeAssetInfoModal}>Закрыть</button>
                  {user?.is_admin && (
                    <button className="btn btn-primary" onClick={() => { closeAssetInfoModal(); handleEdit(assetInfo); }}>
                      <i className="fas fa-edit"></i> Редактировать
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {/* QR PREVIEW MODAL */}
      {showQRModal && (
        <div className="modal fade show" style={{ display: 'block' }} onClick={() => setShowQRModal(false)}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="mhdr">
                <div className="mhdr-left"><div className="mhdr-title">Предпросмотр QR-кодов</div></div>
                <div className="mhdr-right">
                  <button className="mclose" onClick={() => setShowQRModal(false)}>×</button>
                </div>
              </div>

              {/* Settings bar */}
              <div className="qr-settings">
                <div className="qr-setting-group">
                  <span>Активы:</span>
                  <button className={`qr-seg-btn${qrScope === 'current' ? ' active' : ''}`} onClick={() => setQrScope('current')}>Текущий фильтр</button>
                  <button className={`qr-seg-btn${qrScope === 'all' ? ' active' : ''}`} onClick={() => setQrScope('all')}>Все</button>
                </div>
                <div className="qr-setting-sep"></div>
                <div className="qr-setting-group">
                  <span>Типы:</span>
                  {['Компьютер', 'Ноутбук'].map(t => (
                    <label key={t} className="qr-type-chk">
                      <input
                        type="checkbox"
                        checked={qrTypes.includes(t)}
                        onChange={e => setQrTypes(prev => e.target.checked ? [...prev, t] : prev.filter(x => x !== t))}
                      />
                      {t}
                    </label>
                  ))}
                </div>
                <div className="qr-setting-sep"></div>
                <div className="qr-setting-group">
                  <span>Колонки:</span>
                  {[3, 4, 5].map(n => (
                    <button key={n} className={`qr-seg-btn${qrColumns === n ? ' active' : ''}`} onClick={() => setQrColumns(n)}>{n}</button>
                  ))}
                </div>
                <span className="qr-count">{qrAssets.length} кодов</span>
              </div>

              {/* Preview grid */}
              <div className="qr-preview-body">
                {qrAssets.length === 0 ? (
                  <div className="qr-empty">Нет активов под текущие фильтры</div>
                ) : (
                  <div className="qr-grid-preview" style={{ gridTemplateColumns: `repeat(${qrColumns}, 1fr)` }}>
                    {qrAssets.map(asset => (
                      <div key={asset.id} className="qr-card-preview">
                        <div className="qr-card-img">
                          <QRCode
                            size={96}
                            value={`${window.location.origin}${window.location.pathname}#asset-info-${asset.id}`}
                            style={{ display: 'block' }}
                          />
                        </div>
                        <div className="qr-card-inv">{asset.inventory_number || '—'}</div>
                        <div className="qr-card-model">{asset.model || asset.type}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mftr">
                <button className="btn-sec" onClick={() => setShowQRModal(false)}>Отмена</button>
                <button
                  className="btn-ok"
                  onClick={() => performPrintQR(qrAssets, qrColumns)}
                  disabled={qrAssets.length === 0}
                  style={qrAssets.length === 0 ? { opacity: 0.5, cursor: 'default' } : {}}
                >
                  ⎙ Печать{qrAssets.length > 0 ? ` (${qrAssets.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showQRModal && <div className="modal-backdrop fade show"></div>}

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="modal fade show" style={{ display: 'block' }} onClick={() => setShowExportModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="mhdr">
                <div className="mhdr-left"><div className="mhdr-title">Экспорт данных</div></div>
                <div className="mhdr-right">
                  <button className="mclose" onClick={() => setShowExportModal(false)}>×</button>
                </div>
              </div>
              <div className="mbody">
                <div className="radio-group">
                  <div className={`radio-item${exportScope === 'current' ? ' selected' : ''}`} onClick={() => setExportScope('current')}>
                    <div className="radio-dot"></div>
                    <div className="radio-body">
                      <div className="radio-title">Текущий фильтр</div>
                      <div className="radio-sub">
                        {getFilteredAssets().length} записей
                        {searchQuery ? ` · поиск «${searchQuery}»` : ''}
                      </div>
                    </div>
                  </div>
                  <div className={`radio-item${exportScope === 'all' ? ' selected' : ''}`} onClick={() => setExportScope('all')}>
                    <div className="radio-dot"></div>
                    <div className="radio-body">
                      <div className="radio-title">Все активы</div>
                      <div className="radio-sub">{assets.length} записей</div>
                    </div>
                  </div>
                </div>
                <div className="mf">
                  <label>Формат</label>
                  <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                    <option value="xlsx">Excel (.xlsx)</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
              </div>
              <div className="mftr">
                <button className="btn-sec" onClick={() => setShowExportModal(false)}>Отмена</button>
                <button className="btn-ok" onClick={performExport}>↓ Скачать</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showExportModal && <div className="modal-backdrop fade show"></div>}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="modal fade show" style={{ display: 'block' }} onClick={() => { setShowImportModal(false); setImportFile(null); }}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="mhdr">
                <div className="mhdr-left"><div className="mhdr-title">Импорт данных</div></div>
                <div className="mhdr-right">
                  <button className="mclose" onClick={() => { setShowImportModal(false); setImportFile(null); }}>×</button>
                </div>
              </div>
              <div className="mbody">
                <div
                  className={`drop-zone${importDragOver ? ' drag-over' : ''}`}
                  onClick={() => document.getElementById('import-file-input').click()}
                  onDragOver={e => { e.preventDefault(); setImportDragOver(true); }}
                  onDragLeave={() => setImportDragOver(false)}
                  onDrop={e => { e.preventDefault(); setImportDragOver(false); const f = e.dataTransfer.files[0]; if (f) setImportFile(f); }}
                >
                  <div className="drop-icon">↑</div>
                  <div className="drop-title">Перетащите файл сюда</div>
                  <div className="drop-sub">или нажмите для выбора · Excel (.xlsx, .xls)</div>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files[0]; if (f) setImportFile(f); e.target.value = null; }}
                  />
                </div>
                {importFile && (
                  <div className="file-selected">
                    <span>Файл:</span>
                    <span className="fn">{importFile.name}</span>
                    <span style={{ color: '#3A9D6E', marginLeft: 'auto', flexShrink: 0 }}>✓ {(importFile.size / 1024).toFixed(0)} KB</span>
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 2px' }}>
                  Существующие активы будут обновлены по инвентарному номеру. Новые — добавлены.
                </div>
              </div>
              <div className="mftr">
                <button className="btn-sec" onClick={() => { setShowImportModal(false); setImportFile(null); }}>Отмена</button>
                <button className="btn-ok" onClick={performImport} disabled={!importFile} style={!importFile ? { opacity: 0.5, cursor: 'default' } : {}}>↑ Загрузить</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showImportModal && <div className="modal-backdrop fade show"></div>}

      {showAboutModal && (
        <div className="modal fade show" style={{ display: 'block' }} onClick={() => setShowAboutModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">О системе</h5>
                <button type="button" className="btn-close" onClick={() => setShowAboutModal(false)}></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Шапка: логотип + название + версия */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0 8px', borderBottom: '1px solid var(--border-color)' }}>
                  <img
                    key={isDarkMode ? 'about-logo-dark' : 'about-logo-light'}
                    src={isDarkMode ? '/asset-logo-blur.png' : '/enhanced_asset-logo2.png'}
                    alt="Asset Tracker"
                    style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em' }}>Asset Tracker</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      Версия <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>v{packageInfo.version.split('.').slice(0, 2).join('.')}</span> · Система учёта оборудования
                    </div>
                  </div>
                </div>

                {/* Возможности */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { icon: 'fas fa-desktop', text: 'Учёт ПК, ноутбуков и периферии с инвентарными номерами' },
                    { icon: 'fas fa-history', text: 'История всех изменений с указанием автора' },
                    { icon: 'fas fa-download', text: 'Экспорт и импорт данных через Excel' },
                    { icon: 'fas fa-shield-alt', text: 'Контроль гарантийных сроков и предупреждения' },
                    { icon: 'fas fa-wrench', text: 'Журнал ремонтов: даты, стоимость, исполнители' },
                    { icon: 'fas fa-qrcode', text: 'QR-коды для быстрой идентификации актива' },
                  ].map(({ icon, text }, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <i className={icon} style={{ color: 'var(--accent)', marginTop: '2px', flexShrink: 0, width: '14px', textAlign: 'center', fontSize: '13px' }}></i>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <a
                  href="https://gitlab.aspro.cloud/office/asset_tracker/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-sec"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fab fa-gitlab"></i> Репозиторий
                </a>
                <button type="button" className="btn-sec" onClick={() => setShowAboutModal(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAboutModal && <div className="modal-backdrop fade show"></div>}

      {/* Фон затемнения для модальных окон */}
      {showDeletionLogModal && (
        <div className="modal-backdrop fade show" onClick={() => setShowDeletionLogModal(false)}></div>
      )}
      {showRepairsModal && (
        <div className="modal-backdrop fade show" onClick={() => setShowRepairsModal(false)}></div>
      )}
      {(isModalOpen || showUserModal) && (
        <div className="modal-backdrop fade show" onClick={() => {
          if (isModalOpen) closeModal();
          if (showUserModal) {
            setShowUserModal(false);
            setIsEditingUser(false);
            setEditingUser(null);
            setUserFormData({ username: '', password: '', is_admin: false });
          }
        }}></div>
      )}

      {/* Toast Container */}
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{ style: { background: 'transparent', padding: 0, boxShadow: 'none' } }}
      />

      {showWindowsReportModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-xl" style={{ maxWidth: 'min(1100px, 95vw)' }} role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Windows — лицензии</h5>
                <button type="button" className="btn-close" onClick={() => setShowWindowsReportModal(false)}></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

                {/* Статистика */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { label: 'Всего', value: windowsAssets.length, color: 'var(--accent)' },
                    { label: 'С ключами', value: windowsAssets.filter(a => !isWindowsKeyMissing(a)).length, color: '#4ade80' },
                    { label: 'Без ключей', value: windowsAssets.filter(isWindowsKeyMissing).length, color: '#f87171' },
                    { label: 'В эксплуатации', value: windowsAssets.filter(a => a.status === 'в эксплуатации').length, color: 'var(--text-primary)' },
                    { label: 'Без пользователя', value: windowsAssets.filter(a => !a.user_name || !a.user_name.trim()).length, color: 'var(--text-muted)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: '1 1 120px', background: 'var(--bg-raised)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Кнопки */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn-sec" style={{ fontSize: '12px', height: '28px', padding: '0 10px' }} onClick={refreshWindowsReport}>
                    ↺ Обновить
                  </button>
                  <button className="btn-ok" style={{ fontSize: '12px', height: '28px', padding: '0 10px' }} onClick={exportWindowsReport} disabled={windowsAssets.length === 0}>
                    ↓ Экспорт CSV
                  </button>
                </div>

                {/* Таблица */}
                {windowsAssets.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-raised)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    Активы с Windows не найдены
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-raised)' }}>
                          {[
                            { label: 'Инв. номер', w: '11%' },
                            { label: 'Модель', w: '12%' },
                            { label: 'Расположение', w: '11%' },
                            { label: 'Пользователь', w: '12%' },
                            { label: 'Версия', w: '13%' },
                            { label: 'Ключ Windows', w: '26%' },
                            { label: 'Статус', w: '15%' },
                          ].map(({ label, w }) => (
                            <th key={label} style={{ width: w, padding: '7px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', textAlign: 'left' }}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {windowsAssets.map((asset, idx) => (
                          <tr key={asset.id} style={{ borderBottom: idx < windowsAssets.length - 1 ? '1px solid var(--bg-raised)' : 'none', background: isWindowsKeyMissing(asset) ? 'rgba(248,113,113,.05)' : 'transparent' }}>
                            <td style={{ padding: '7px 10px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.inventory_number}>{asset.inventory_number}</td>
                            <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.model || ''}>{asset.model || '—'}</td>
                            <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.location || ''}>{asset.location || '—'}</td>
                            <td style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.user_name || ''}>{asset.user_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                            <td style={{ padding: '7px 10px', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.os_type || ''}>{asset.os_type || '—'}</td>
                            <td style={{ padding: '6px 10px' }} onDoubleClick={() => user?.is_admin && startEditingWindows(asset.id, 'windows_key', asset.windows_key)}>
                              {editingWindowsCell.assetId === asset.id && editingWindowsCell.field === 'windows_key' ? (
                                <input
                                  type="text"
                                  value={editingWindowsValue}
                                  onChange={handleEditWindowsChange}
                                  onKeyDown={handleEditWindowsKeyDown}
                                  onBlur={saveEditWindows}
                                  placeholder="Введите ключ"
                                  autoFocus
                                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px', padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none' }}
                                />
                              ) : !isWindowsKeyMissing(asset) ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)', cursor: user?.is_admin ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.windows_key}</span>
                                  <button className="ra-btn" onClick={() => navigator.clipboard.writeText(asset.windows_key)} title="Скопировать ключ" style={{ flexShrink: 0 }}>
                                    <i className="fas fa-copy"></i>
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#f87171', cursor: user?.is_admin ? 'pointer' : 'default' }}>
                                  <i className="fas fa-exclamation-triangle"></i> Не указан
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '7px 10px' }}>
                              <span className={`pill ${asset.status === 'в эксплуатации' ? 'pill-on' : asset.status === 'списано' ? 'pill-out' : asset.status === 'на ремонте' ? 'pill-fix' : 'pill-off'}`}>
                                <span className="pill-dot"></span>{asset.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-sec" onClick={() => setShowWindowsReportModal(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {showWindowsReportModal && (
        <div className="modal-backdrop fade show"></div>
      )}

    </div>
  );
}

export default App;
