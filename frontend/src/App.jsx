// app.jsx
import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import qrCodeGenerator from 'qrcode-generator';
import './TableStyles.css';
import packageInfo from '../package.json';
import Select from 'react-select';
import toast, { Toaster } from 'react-hot-toast';

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
  // Обновите useEffect для сброса пагинации при изменении показа истории
  useEffect(() => {
    resetHistoryPagination();
  }, [showHistory]);
  const [uniqueUsers, setUniqueUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [expiringWarranty, setExpiringWarranty] = useState([]);
  const [showWindowsReportModal, setShowWindowsReportModal] = useState(false);
  const [windowsAssets, setWindowsAssets] = useState([]);
  const getStatusColor = (status) => {
    switch(status) {
      case 'в эксплуатации': return 'success';
      case 'на складе': return 'secondary';
      case 'на ремонте': return 'warning';
      case 'списано': return 'danger';
      default: return 'secondary';
    }
  };


  // Toast helper functions
  const showToast = {
    success: (message, options = {}) => {
      toast.success(message, {
        icon: '✅',
        duration: 3000,
        ...options,
      });
    },
    
    error: (message, options = {}) => {
      toast.error(message, {
        icon: '❌',
        duration: 4000,
        ...options,
      });
    },
    
    loading: (message) => {
      return toast.loading(message, {
        icon: '⏳',
      });
    },
    
    info: (message, options = {}) => {
      toast(message, {
        icon: 'ℹ️',
        style: {
          background: '#3b82f6',
          color: '#fff',
        },
        duration: 3000,
        ...options,
      });
    },
    
    warning: (message, options = {}) => {
      toast(message, {
        icon: '⚠️',
        style: {
          background: '#f59e0b',
          color: '#fff',
        },
        duration: 4000,
        ...options,
      });
    },

    confirm: (message, onConfirm, onCancel = null) => {
      return toast.custom((t) => (
        <div className="bg-white rounded-lg shadow-lg p-4 border toast-confirm" style={{ minWidth: '300px' }}>
          <div className="d-flex align-items-start">
            <i className="fas fa-question-circle text-primary me-3 mt-1"></i>
            <div className="flex-grow-1">
              <h6 className="mb-2 fw-bold">Подтверждение</h6>
              <p className="mb-3 text-muted small">{message}</p>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    toast.dismiss(t.id);
                    onConfirm && onConfirm();
                  }}
                >
                  Да
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    toast.dismiss(t.id);
                    onCancel && onCancel();
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      ), { 
        duration: Infinity,
      });
    },

    deleteConfirm: (message, onConfirm, onCancel = null) => {
      return toast.custom((t) => (
        <div className="bg-white rounded-lg shadow-lg p-4 border toast-confirm" style={{ minWidth: '300px' }}>
          <div className="d-flex align-items-start">
            <i className="fas fa-exclamation-triangle text-danger me-3 mt-1"></i>
            <div className="flex-grow-1">
              <h6 className="mb-2 fw-bold text-danger">Подтверждение удаления</h6>
              <p className="mb-3 text-muted small">{message}</p>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    toast.dismiss(t.id);
                    onConfirm && onConfirm();
                  }}
                >
                  Удалить
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    toast.dismiss(t.id);
                    onCancel && onCancel();
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
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
      const res = await fetch('http://10.0.1.225:8000/assets/', { 
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


  // Обновите функцию для цветового кодирования
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

  // Добавьте эти функции после getAgeClass:
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
      const res = await fetch(`http://10.0.1.225:8000/admin/deletion-log/?limit=100`, {
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

  const handlePrintAllQRCodes = () => {
    if (!assets || assets.length === 0) {
      showToast.warning("Нет активов для печати");
      return;
    }

    const assetsForQR = assets.filter(asset => 
      asset.type === 'Ноутбук' || asset.type === 'Компьютер'
    );

    if (assetsForQR.length === 0) {
      showToast.warning("Нет активов типа 'Ноутбук' или 'Компьютер' для печати QR-кодов");
      return;
    }

    const generateQRCodeSVG = (text) => {
      try {
        const qr = qrCodeGenerator(0, 'M');
        qr.addData(text);
        qr.make();
        const svgString = qr.createSvgTag({ cellSize: 3, margin: 2 }); 
        return svgString;
      } catch (error) {
        console.error("Ошибка генерации QR-кода:", error);
        return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
                  <rect width="120" height="120" fill="#f0f0f0" stroke="#ccc"/>
                  <text x="60" y="60" text-anchor="middle" dominant-baseline="middle" 
                        font-family="Arial" font-size="12" fill="#999">QR Ошибка</text>
                </svg>`;
      }
    };

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

    assetsForQR.forEach(asset => {
      const qrUrl = `${window.location.origin}${window.location.pathname}#asset-info-${asset.id}`;
      const qrSvg = generateQRCodeSVG(qrUrl);
      
      printContent += `
        <div class="qr-card">
          <div class="qr-container">
            ${qrSvg}
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
          setTimeout(() => {
            window.print();
          }, 1000);
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    showToast.success(`Подготовлено ${assetsForQR.length} QR-кодов для печати`, { icon: '🖨️' });
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
        if (showWindowsReportModal) { 
          setShowWindowsReportModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAboutModal, isModalOpen, isEditing, showUserModal, showDeletionLogModal, showRepairsModal, showAssetInfoModal, showWindowsReportModal, token]);

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
    const loadingToast = showToast.loading('Выполняется вход...');
    
    try {
      const res = await fetch('http://10.0.1.225:8000/token', {
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
    if (selectedUser) {
      filterText += ` для пользователя "${selectedUser}"`;
    }

    showToast.confirm(
      `Экспорт будет выполнен согласно выбранному фильтру ${filterText}. Продолжить?`,
      async () => {
        const loadingToast = showToast.loading('Подготовка экспорта...');
        
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
          if (selectedUser) {
            params.append('user_name', selectedUser);
          }

          const url = `http://10.0.1.225:8000/export/excel?${params.toString()}`;
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
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
          
          showToast.success('Файл успешно экспортирован', { icon: '📥' });
        } catch (err) {
          toast.dismiss(loadingToast);
  
        showToast.error('Ошибка сети при экспорте');
          console.error(err);
        }
      },
      () => {
        // Обработчик для кнопки "Отмена"
        showToast.info('Экспорт отменен', { 
          icon: '❌', 
          duration: 2000,
          style: {
            background: '#6c757d',
            color: '#fff',
          }
        });
      }
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const loadingToast = showToast.loading('Импорт файла...');
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('http://10.0.1.225:8000/import/excel', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const result = await res.json();
      toast.dismiss(loadingToast);
      
      if (result.errors && result.errors.length > 0) {
        toast.custom((t) => (
          <div className="bg-warning text-dark rounded-lg shadow-lg p-4" style={{ maxWidth: '400px' }}>
            <div className="d-flex align-items-start">
              <i className="fas fa-exclamation-triangle me-2"></i>
              <div>
                <h6 className="mb-2 fw-bold">Импорт завершен с предупреждениями</h6>
                <div className="small">
                  {result.errors.slice(0, 3).map((error, idx) => (
                    <div key={idx} className="mb-1">• {error}</div>
                  ))}
                  {result.errors.length > 3 && (
                    <div className="text-muted">и еще {result.errors.length - 3} ошибок...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ), { duration: 8000 });
      } else {
        showToast.success(result.detail, { icon: '📥' });
      }
      await fetchAssets();
    } catch (err) {
      toast.dismiss(loadingToast);
      showToast.error('Критическая ошибка импорта: ' + err.message);
      console.error(err);
    }
    e.target.value = null;
  };

  const handleClearDatabase = async () => {
    showToast.confirm(
      "Перед очисткой базы рекомендуется сделать резервную копию. Скачать Excel-файл со всеми данными перед удалением?",
      async () => {
        const link = document.createElement('a');
        link.href = `http://10.0.1.225:8000/export/excel`;
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
                const res = await fetch('http://10.0.1.225:8000/admin/clear-db', {
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
              const res = await fetch('http://10.0.1.225:8000/admin/clear-db', {
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
    if (!formData.purchase_date && (!formData.manual_age || !formData.manual_age.trim())) {
      showToast.confirm(
        "Не указана дата покупки и возраст техники. Рекомендуется указать хотя бы приблизительный возраст для учета амортизации. Продолжить без указания возраста?",
        async () => {
          // Если пользователь нажал "Да" - продолжаем сохранение
          await submitAsset(); // Вынесем логику сохранения в отдельную функцию
        },
        () => {
          // Если пользователь нажал "Отмена"  
          showToast.info("Добавление отменено. Укажите дату покупки или возраст техники", {
            icon: '⚠️'
          });
        }
      );
      return; // Останавливаем выполнение, ждем ответа пользователя
    }

    await submitAsset();

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
  
    console.log('Payload отправляемый на сервер:', payload);
    console.log('manual_age в payload:', payload.manual_age);
  
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
      
      toast.dismiss(loadingToast);
      
      if (res.ok) {
        const updated = await res.json();
        if (isEditing) {
          setAssets(assets.map(a => a.id === updated.id ? updated : a));
          showToast.success('Актив успешно обновлен', { icon: '✏️' });
        } else {
          setAssets([...assets, updated]);
          showToast.success('Актив успешно создан', { icon: '🆕' });
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
      manual_age: 'Возраст'
    };
    return labels[field] || field;
  };

  const handleEdit = async (asset) => {
    const loadingToast = showToast.loading('Загрузка данных актива...');
    
    try {
      const res = await fetch(`http://10.0.1.225:8000/assets/${asset.id}`, {
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
          const res = await fetch(`http://10.0.1.225:8000/assets/${id}`, {
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
      const res = await fetch(`http://10.0.1.225:8000/assets/${assetId}`, {
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
    result = result.filter(asset => !selectedUser || asset.user_name === selectedUser);

    if (ageRangeFilter && ageRangeFilter !== 'all') {
      result = result.filter(asset => {
        const category = getAssetAgeCategory(asset);
        return category === ageRangeFilter;
      });
    }

    return result;
  };

  const filteredAssets = getFilteredAssets();
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
          const res = await fetch(`http://10.0.1.225:8000/users/${userId}`, {
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
    
    const loadingToast = showToast.loading('Создание записи о ремонте...');
    
    try {
      const res = await fetch(`http://10.0.1.225:8000/assets/${currentAssetId}/repairs/`, {
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
      const res = await fetch(`http://10.0.1.225:8000/repairs/${editingRepairId}`, {
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
          const res = await fetch(`http://10.0.1.225:8000/repairs/${recordId}`, {
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
              <span className={`badge bg-${getStatusColor(asset.status)} fs-6`}>
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

      {token && (
        <div className="mb-4 p-3 rounded shadow-sm">
          <div className="d-flex flex-wrap justify-content-start gap-3">
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
            <div className="vr d-none d-md-block mx-2"></div>
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
    
                <button 
                  className="btn btn-warning btn-sm" 
                  onClick={generateWindowsReport}
                  title="Отчет по лицензиям Windows"
                >
                  <i className="fab fa-windows"></i> Windows отчет
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
            {ageRangeFilter !== 'all' && ` | Возраст: ${(() => {
              const labels = {
                'new': 'новые',
                'fresh': 'свежие', 
                'medium': 'средние',
                'old': 'старые',
                'unknown': 'неизвестно'
              };
              return labels[ageRangeFilter];
            })()}`}
            {(filter !== 'Все' || disposedFilter || warrantyFilter !== 'all' || ageRangeFilter !== 'all') && (
              <button
                className="btn btn-sm btn-outline-secondary ms-2"
                onClick={() => {
                  setFilter('Все');
                  setDisposedFilter(false);
                  setWarrantyFilter('all');
                  setAgeRangeFilter('all');
                  setPage(1);
                }}
              >
                Сбросить фильтры
              </button>
            )}
          </div>
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
              placeholder="Фильтр по пользователю"
              noOptionsMessage={() => "Нет пользователей"}
              classNamePrefix="react-select"
            />
          </div>
        </div>
      )}

      {token && (
        <div className="age-range-filter mb-4">
          <div className="card">
            <div className="card-body py-3">
              <div className="row align-items-center">
                <div className="col-md-2">
                  <label className="form-label mb-0 fw-bold">
                    <i className="fas fa-hourglass-half me-2"></i>
                    Фильтр по возрасту:
                  </label>
                </div>
                <div className="col-md-10">
                  <div className="d-flex gap-2 flex-wrap">
                    {(() => {
                      const ageCounts = getAssetsByAgeCategory();
                      const filterButtons = [
                        {
                          key: 'all',
                          label: 'Все',
                          icon: 'fas fa-list',
                          color: 'secondary',
                          count: ageCounts.all
                        },
                        {
                          key: 'new',
                          label: 'Новые',
                          sublabel: 'до 1 года',
                          icon: 'fas fa-star',
                          color: 'success',
                          count: ageCounts.new
                        },
                        {
                          key: 'fresh',
                          label: 'Свежие',
                          sublabel: '1-3 года',
                          icon: 'fas fa-clock',
                          color: 'info',
                          count: ageCounts.fresh
                        },
                        {
                          key: 'medium',
                          label: 'Средние',
                          sublabel: '3-5 лет',
                          icon: 'fas fa-exclamation-triangle',
                          color: 'warning',
                          count: ageCounts.medium
                        },
                        {
                          key: 'old',
                          label: 'Старые',
                          sublabel: '5+ лет',
                          icon: 'fas fa-calendar-times',
                          color: 'danger',
                          count: ageCounts.old
                        },
                        {
                          key: 'unknown',
                          label: 'Неизвестно',
                          sublabel: 'без даты',
                          icon: 'fas fa-question',
                          color: 'dark',
                          count: ageCounts.unknown
                        }
                      ];

                      return filterButtons.map(button => (
                        <button
                          key={button.key}
                          className={`btn btn-sm ${
                            ageRangeFilter === button.key 
                              ? `btn-${button.color}` 
                              : `btn-outline-${button.color}`
                          } age-filter-btn`}
                          onClick={() => setAgeRangeFilter(button.key)}
                          title={`Показать ${button.label.toLowerCase()} активы${button.sublabel ? ` (${button.sublabel})` : ''}`}
                        >
                          <div className="d-flex align-items-center">
                            <i className={`${button.icon} me-2`}></i>
                            <div>
                              <div className="fw-bold">{button.label}</div>
                              {button.sublabel && (
                                <small className="d-block" style={{fontSize: '0.7em', marginTop: '-2px'}}>
                                  {button.sublabel}
                                </small>
                              )}
                            </div>
                            <span className="badge bg-white text-dark ms-2 fw-bold">
                              {button.count}
                            </span>
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
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

      <React.Fragment>
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
		    <th>Возраст</th>
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
                          <td data-label="Инвентарный номер" onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'inventory_number', asset.inventory_number)}>
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
                          <td data-label="Серийный номер" onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'serial_number', asset.serial_number)}>
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
                          <td data-label="Статус" onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'status', asset.status)}>
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
                          <td data-label="Расположение" onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'location', asset.location)}>
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
                          <td data-label="ФИО пользователя" onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'user_name', asset.user_name)}>
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

                          <td data-label="Возраст" 
                              className={getAgeClass(asset)}
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
                              />
                            ) : (
                              <span className={user?.is_admin ? 'editable-cell' : ''}>
                                {calculateAssetAge(asset)}
                              </span>
                            )}
                            {asset.manual_age && (
                              <i className="fas fa-edit text-muted ms-1" title="Возраст указан вручную" style={{ fontSize: '0.8em' }}></i>
                            )}
                          </td>

                          <td data-label="Комментарий" onDoubleClick={() => user?.is_admin && startEditing(asset.id, 'comment', asset.comment)}>
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
                            <td colSpan={(user?.is_admin ? 9 : 8) + (warrantyFilter === 'active' ? 1 : 0)} className="bg-light small p-2" style={{ textAlign: 'left' }}>
                              <strong>История изменений:</strong>
                              <HistoryPagination 
                                history={asset.history} 
                                historyPage={historyPage} 
                                setHistoryPage={setHistoryPage} 
                                historyItemsPerPage={historyItemsPerPage}
                              />
		              <ul className="mb-0 ps-3">
                                {asset.history 
                                  .slice()
                                  .sort((a, b) => {
                                    // Сначала по дате, потом по ID в убывающем порядке  
                                    const dateA = new Date(a.changed_at);
                                    const dateB = new Date(b.changed_at);
    
                                    if (dateA.getTime() !== dateB.getTime()) {
                                      return dateB - dateA; // Новые даты сверху
                                    }
    
                                    return b.id - a.id; // При одинаковой дате - новые ID сверху
                                  })
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
                        <span className={`badge bg-${getStatusColor(asset.status)} fs-6`}>
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
                                    <div className="history-pagination mt-2 d-flex justify-content-center align-items-center gap-2">
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

      {token && activeTab === 'assets' && assets.length > 0 && (
        <div className="pagination-container d-flex justify-content-center align-items-center mt-3 mb-4 flex-wrap gap-2">
          <div className="pagination-info text-muted me-auto">
            Показано {((page - 1) * itemsPerPage) + 1}-{Math.min(page * itemsPerPage, filteredAssets.length)} из {filteredAssets.length} записей
          </div>

          <div className="d-flex align-items-center gap-1">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="Первая страница"
            >
              <i className="fas fa-angle-double-left"></i>
              <span className="d-none d-sm-inline ms-1">Первая</span>
            </button>

            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              title="Предыдущая страница"
            >
              <i className="fas fa-angle-left"></i>
              <span className="d-none d-sm-inline ms-1">Назад</span>
            </button>

            {(() => {
              const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
              const delta = 2;
              const range = [];
              
              for (let i = Math.max(2, page - delta); 
                   i <= Math.min(totalPages - 1, page + delta); 
                   i++) {
                range.push(i);
              }
              
              if (page - delta > 2) {
                range.unshift('...');
              }
              if (page + delta < totalPages - 1) {
                range.push('...');
              }
              
              range.unshift(1);
              if (totalPages !== 1) {
                range.push(totalPages);
              }
              
              return range.map((pageNum, index) => (
                <button
                  key={index}
                  className={`btn btn-sm ${
                    pageNum === page 
                      ? 'btn-primary' 
                      : pageNum === '...' 
                        ? 'btn-outline-secondary disabled' 
                        : 'btn-outline-primary'
                  }`}
                  onClick={() => pageNum !== '...' && setPage(pageNum)}
                  disabled={pageNum === '...' || pageNum === page}
                  style={{ minWidth: '35px' }}
                >
                  {pageNum}
                </button>
              ));
            })()}

            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setPage(p => Math.min(Math.ceil(filteredAssets.length / itemsPerPage), p + 1))}
              disabled={page === Math.ceil(filteredAssets.length / itemsPerPage) || filteredAssets.length === 0}
              title="Следующая страница"
            >
              <span className="d-none d-sm-inline me-1">Вперёд</span>
              <i className="fas fa-angle-right"></i>
            </button>

            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setPage(Math.ceil(filteredAssets.length / itemsPerPage))}
              disabled={page === Math.ceil(filteredAssets.length / itemsPerPage) || filteredAssets.length === 0}
              title="Последняя страница"
            >
              <span className="d-none d-sm-inline me-1">Последняя</span>
              <i className="fas fa-angle-double-right"></i>
            </button>
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto">
            <span className="text-muted">Перейти:</span>
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
              className="form-control form-control-sm text-center"
              style={{ width: '60px' }}
              title="Введите номер страницы"
            />
            <span className="text-muted">из {Math.ceil(filteredAssets.length / itemsPerPage)}</span>
          </div>
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

                  {/* Поле возраста */}
                  <div className="col-md-6">
                    <label className="form-label">
                      Возраст (если дата покупки неизвестна)
                      <small className="text-muted d-block">Например: "5 лет", "около 3 лет"</small>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="manual_age" 
                      value={formData.manual_age || ''} 
                      onChange={handleChange}
                      placeholder="3 года, 5 лет, более 10 лет..."
                    />
                  </div>

                  {/* Показываем какой возраст будет отображаться */}
                  {(formData.purchase_date || formData.manual_age) && (
                    <div className="col-12">
                      <div className="alert alert-info">
                        <strong>Возраст будет отображаться как:</strong> 
                        <span className={getAgeClass(formData)}>
                          {calculateAssetAge(formData)}
                        </span>
                      </div>
                    </div>
                  )}

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
                  <button type="submit" className="btn btn-success">
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

      {showRepairsModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  История ремонтов (Актив ID: {currentAssetId})
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowRepairsModal(false)}></button>
              </div>
              <div className="modal-body">
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
                      <button type="submit" className="btn btn-sm btn-success">
                        {editingRepairId ? 'Сохранить изменения' : 'Добавить запись'}
                      </button>
                    </div>
                  </div>
                </form>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowRepairsModal(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeletionLogModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Журнал удалений</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeletionLogModal(false)}></button>
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
                              const dataObj = JSON.parse(log.entity_data);
                              shortData = dataObj.inventory_number || dataObj.id || 'Данные есть';
                            } catch (e) {
                              shortData = log.entity_data.substring(0, 50) + (log.entity_data.length > 50 ? '...' : '');
                            }
                          }
                          return (
                            <tr key={log.id}>
                              <td>{new Date(log.deleted_at).toLocaleString()}</td>
                              <td>{log.entity_type}</td>
                              <td>{log.entity_id}</td>
                              <td>{log.deleted_by}</td>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeletionLogModal(false)}>
                  Закрыть
                </button>
                <button type="button" className="btn btn-primary" onClick={fetchDeletionLogs} disabled={deletionLogLoading}>
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
                  <h5 className="modal-title">Информация об активе — {assetInfo.inventory_number}</h5>
                  <button type="button" className="btn-close" onClick={closeAssetInfoModal}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3 d-flex flex-column align-items-center">
                    <div style={{ height: "auto", margin: "0 auto", maxWidth: "160px", width: "100%" }}>
                      <div style={{ height: "160px", width: "160px", backgroundColor: "white", padding: "8px", borderRadius: "4px" }}>
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
            
                  <table className="table table-bordered">
                    <tbody>
                      {/* ДЛЯ НОУТБУКОВ */}
                      {assetInfo.type === 'Ноутбук' && (
                        <>
                          <tr><th>Модель</th><td>{assetInfo.model || '-'}</td></tr>
                          <tr><th>Процессор</th><td>{assetInfo.processor || '-'}</td></tr>
                        </>
                      )}
                
                      {/* ДЛЯ КОМПЬЮТЕРОВ */}
                      {assetInfo.type === 'Компьютер' && (
                        <>
                          <tr><th>Материнская плата</th><td>{assetInfo.motherboard || '-'}</td></tr>
                          <tr><th>Процессор</th><td>{assetInfo.processor || '-'}</td></tr>
                        </>
                      )}
                
                      {/* ОБЩИЕ ПОЛЯ ДЛЯ ОБОИХ ТИПОВ */}
                      <tr><th>ОЗУ</th><td>{assetInfo.ram || '-'}</td></tr>
                      <tr><th>Операционная система</th><td>{assetInfo.os_type || '-'}</td></tr>
                      {/* КЛЮЧ WINDOWS - ТОЛЬКО ЕСЛИ ОС СОДЕРЖИТ WINDOWS */}
                      {assetInfo.os_type && assetInfo.os_type.toLowerCase().includes('windows') && (
                        <tr><th>Ключ Windows</th><td>{assetInfo.windows_key || '-'}</td></tr>
                      )}
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
                    <i className="fab fa-gitlab"></i> Открыть репозиторий
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
        reverseOrder={false}
        gutter={8}
        containerClassName=""
        containerStyle={{}}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '8px',
            padding: '12px 16px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4aed88',
              secondary: '#fff',
            },
            style: {
              background: '#10b981',
              color: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ff6b6b',
              secondary: '#fff',
            },
            style: {
              background: '#ef4444',
              color: '#fff',
            },
          },
          loading: {
            style: {
              background: '#3b82f6',
              color: '#fff',
            },
          },
          custom: {
	    duration: Infinity,
	  }
        }}
      />

      {showWindowsReportModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fab fa-windows me-2"></i>
                  Отчет по лицензиям Windows
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowWindowsReportModal(false)}
                ></button>
              </div>
              <div className="modal-body">
          
                {/* Сводная информация */}
                <div className="windows-report-stats">
                  <div className="row mb-4 g-3">
                    <div className="col-xl-3 col-lg-6">
                      <div className="card bg-primary text-white">
                        <div className="card-body text-center">
                          <h4>{windowsAssets.length}</h4>
                          <small>Всего Windows устройств</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-xl-3 col-lg-6">
                      <div className="card bg-success text-white">
                       <div className="card-body text-center">
                          <h4>{windowsAssets.filter(a => a.windows_key && a.windows_key.trim()).length}</h4>
                          <small>С ключами</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-xl-3 col-lg-6">
                      <div className="card bg-danger text-white">
                        <div className="card-body text-center">
                          <h4>{windowsAssets.filter(a => !a.windows_key || !a.windows_key.trim()).length}</h4>
                          <small>Без ключей</small>
                        </div>
                      </div>
                    </div>

                    <div className="col-xl-3 col-lg-6">
                      <div className="card bg-info text-white">
                        <div className="card-body text-center">
                          <h4>{windowsAssets.filter(a => !a.user_name || !a.user_name.trim()).length}</h4>
                          <small>Без пользователя</small>
                        </div>
                      </div>
                    </div>

                    <div className="col-md-3">
                      <div className="card bg-info text-white">
                        <div className="card-body text-center">
                          <h4>{windowsAssets.filter(a => a.status === 'в эксплуатации').length}</h4>
                          <small>В эксплуатации</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div> 

                {/* Кнопки действий */}
                <div className="d-flex justify-content-between mb-3">
                  <div>
                    <button 
                      className="btn btn-outline-primary btn-sm me-2"
                      onClick={refreshWindowsReport} 
                    >
                      <i className="fas fa-sync"></i> Обновить данные
                    </button>
                  </div>
                  <div>
                    <button 
                      className="btn btn-success btn-sm"
                      onClick={exportWindowsReport}
                      disabled={windowsAssets.length === 0}
                    >
                      <i className="fas fa-download"></i> Экспорт в CSV
                    </button>
                  </div>
                </div>

                {/* Таблица с данными */}
                <div className="windows-report-table">
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Инвентарный номер</th>
                          <th>Модель</th>
                          <th>Расположение</th>
                          <th>Пользователь</th>
                          <th>Версия Windows</th>
                          <th>Ключ Windows</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {windowsAssets.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center text-muted">
                              Активы с Windows не найдены
                            </td>
                          </tr>
                        ) : (
                          windowsAssets.map(asset => (
                            <tr 
                              key={asset.id}
                              className={!asset.windows_key || !asset.windows_key.trim() ? 'table-warning' : ''}
                            >
                              <td>
                                <strong>{asset.inventory_number}</strong>
                              </td>
                              <td>{asset.model || '-'}</td>
                              <td>
                                <span className="badge bg-secondary">
                                  {asset.location || 'Не указано'}
                                </span>
                              </td>

                              <td>
                                {asset.user_name ? (
                                  <span className="text-primary fw-bold">{asset.user_name}</span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>

                              <td>
                                <span className="badge bg-info">
                                  {asset.os_type}
                                </span>
                              </td>
                              <td>
                                {asset.windows_key && asset.windows_key.trim() ? (
                                  <div className="d-flex align-items-center">
                                    <code className="small me-2">{asset.windows_key}</code>
                                    <button 
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => navigator.clipboard.writeText(asset.windows_key)}
                                      title="Скопировать ключ"
                                    >
                                      <i className="fas fa-copy"></i>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-danger">
                                    <i className="fas fa-exclamation-triangle"></i> Не указан
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`badge bg-${getStatusColor(asset.status)}`}>
                                  {asset.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {windowsAssets.length > 0 && (
                  <div className="mt-3">
                    <small className="text-muted">
                      <i className="fas fa-info-circle"></i>
                      Строки выделены желтым цветом для активов без ключей Windows.
                      Нажмите на иконку копирования рядом с ключом, чтобы скопировать его в буфер обмена.
                    </small>
                  </div>
                )}
              </div>
        
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowWindowsReportModal(false)}
                >
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
