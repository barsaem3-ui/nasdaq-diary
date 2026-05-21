/**
 * ==========================================================================
 * NASDAQ 100 Trading Diary by HyunKyu - Core JavaScript Application
 * Features: IndexedDB local DB, Supabase Synchronization, Canvas Compression,
 *           Clipboard Paste, Psychological Trade Coaching, Formula Math
 * ==========================================================================
 */

// Force cache cleanup & Service Worker unregistration if version changes
const APP_VERSION = '7.5';
if (localStorage.getItem('app_version') !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let reg of registrations) {
                reg.unregister();
            }
        });
    }
    caches.keys().then(names => {
        for (let name of names) {
            caches.delete(name);
        }
    });
    // Hard reload the browser window to clear local caches
    setTimeout(() => {
        window.location.reload(true);
    }, 300);
}

// Register Service Worker for PWA (Installable App)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('Service Worker registered successfully.', reg.scope);
                
                // Monitor for updates and hard-reload to activate immediately
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    console.log('Newer Service Worker version detected, triggering reload...');
                                    window.location.reload(true);
                                }
                            }
                        };
                    }
                };
            })
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}


// Application State
let db = null;
let supabaseClient = null;
let tradesList = [];
let activePeriod = 'ALL'; // PnL Calculation Period: ALL, MONTH, WEEK, DAY
let activeSupabaseTable = 'nasdaq_diary_trades'; // Dynamic fallback table

// Image editing temp states
let imageDeleteModes = {
    entry: false,
    exit: false
};
let entryImageBase64 = null;
let exitImageBase64 = null;

// HTML Elements
const elements = {
    // Header
    btnSettings: document.getElementById('btn-settings'),
    btnAddTrade: document.getElementById('btn-add-trade'),
    btnLogout: document.getElementById('btn-logout'),
    
    // Login Screen
    loginContainer: document.getElementById('login-container'),
    appContainer: document.querySelector('.app-container'),
    formLogin: document.getElementById('form-login'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginErrorMsg: document.getElementById('login-error-msg'),
    btnTogglePassword: document.getElementById('btn-toggle-password'),
    
    // Stats Dashboard
    statTotalPnl: document.getElementById('stat-total-pnl'),
    statPnlLabel: document.getElementById('stat-pnl-label'),
    statWinRate: document.getElementById('stat-win-rate'),
    statWinrateBar: document.getElementById('stat-winrate-bar'),
    statWinRatio: document.getElementById('stat-win-ratio'),
    statTotalTrades: document.getElementById('stat-total-trades'),
    statTotalContracts: document.getElementById('stat-total-contracts'),
    periodBtns: document.querySelectorAll('.period-btn'),
    statPeriodDesc: document.getElementById('stat-period-desc'),
    
    // Filters
    filterPosition: document.getElementById('filter-position'),
    filterResult: document.getElementById('filter-result'),
    filterMind: document.getElementById('filter-mind'),
    
    // Sync Status
    syncStatusBar: document.getElementById('sync-status-bar'),
    syncStatusText: document.getElementById('sync-status-text'),
    btnSyncNow: document.getElementById('btn-sync-now'),
    
    // Grid Container
    tradesContainer: document.getElementById('trades-container'),
    emptyState: document.getElementById('empty-state'),
    
    // Thoughts Panel
    thoughtSignal: document.getElementById('thought-signal'),
    thoughtReason: document.getElementById('thought-reason'),
    thoughtTech: document.getElementById('thought-tech'),
    thoughtPsych: document.getElementById('thought-psych'),
    
    // Modal Trade Form
    modalTrade: document.getElementById('modal-trade'),
    formTrade: document.getElementById('form-trade'),
    modalTitle: document.getElementById('modal-title'),
    tradeId: document.getElementById('trade-id'),
    tradeDate: document.getElementById('trade-date'),
    tradeContracts: document.getElementById('trade-contracts'),
    tradeEntry: document.getElementById('trade-entry'),
    tradeExit: document.getElementById('trade-exit'),
    entryTechReason: document.getElementById('entry-tech-reason'),
    entryPsychReason: document.getElementById('entry-psych-reason'),
    exitTechReason: document.getElementById('exit-tech-reason'),
    exitPsychReason: document.getElementById('exit-psych-reason'),
    modalCalcPnl: document.getElementById('modal-calc-pnl'),
    calcFormulaDisplay: document.getElementById('calc-formula-display'),
    btnCloseTradeModal: document.getElementById('btn-close-trade-modal'),
    btnCancelTrade: document.getElementById('btn-cancel-trade'),
    btnSubmitTrade: document.getElementById('btn-submit-trade'),
    
    // Image Zones
    zoneEntryImg: document.getElementById('zone-entry-img'),
    zoneExitImg: document.getElementById('zone-exit-img'),
    fileEntryImg: document.getElementById('file-entry-img'),
    fileExitImg: document.getElementById('file-exit-img'),
    previewEntryContainer: document.getElementById('preview-entry-container'),
    previewExitContainer: document.getElementById('preview-exit-container'),
    previewEntryImg: document.getElementById('preview-entry-img'),
    previewExitImg: document.getElementById('preview-exit-img'),
    overlayEntryDelete: document.getElementById('overlay-entry-delete'),
    overlayExitDelete: document.getElementById('overlay-exit-delete'),
    
    // Modal Settings
    modalSettings: document.getElementById('modal-settings'),
    settingsUrl: document.getElementById('settings-url'),
    settingsKey: document.getElementById('settings-key'),
    settingsSync: document.getElementById('settings-sync'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnDisconnectSupabase: document.getElementById('btn-disconnect-supabase'),
    btnCloseSettingsModal: document.getElementById('btn-close-settings-modal'),
    
    // Modal Lightbox
    modalLightbox: document.getElementById('modal-lightbox'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxCaption: document.getElementById('lightbox-caption'),
    btnCloseLightbox: document.getElementById('btn-close-lightbox')
};

// ==========================================================================
// 1. IndexedDB Initialization & Management
// ==========================================================================
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('HyunKyuNasdaqDiaryDB', 1);
        
        request.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('trades')) {
                db.createObjectStore('trades', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = function(e) {
            db = e.target.result;
            resolve(db);
        };
        
        request.onerror = function(e) {
            console.error('IndexedDB 로드 오류:', e.target.error);
            reject(e.target.error);
        };
    });
}

function loadTradesFromLocal() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['trades'], 'readonly');
        const store = transaction.objectStore('trades');
        const request = store.getAll();
        
        request.onsuccess = function() {
            tradesList = request.result;
            // Sort by trade date descending
            tradesList.sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
            resolve(tradesList);
        };
        
        request.onerror = function() {
            reject(request.error);
        };
    });
}

function saveTradeToLocal(trade) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['trades'], 'readwrite');
        const store = transaction.objectStore('trades');
        const request = store.put(trade);
        
        request.onsuccess = function() {
            resolve();
        };
        
        request.onerror = function() {
            reject(request.error);
        };
    });
}

function deleteTradeFromLocal(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['trades'], 'readwrite');
        const store = transaction.objectStore('trades');
        const request = store.delete(id);
        
        request.onsuccess = function() {
            resolve();
        };
        
        request.onerror = function() {
            reject(request.error);
        };
    });
}

// ==========================================================================
// 2. Supabase Integration Bridge
// ==========================================================================
function initSupabase() {
    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_key');
    
    if (url && key) {
        try {
            supabaseClient = supabase.createClient(url, key);
            elements.syncStatusBar.className = 'sync-status-bar online';
            elements.syncStatusText.textContent = '수파베이스 클라우드 연결됨 (무중단 실시간 연동)';
            elements.btnSyncNow.classList.remove('hidden');
            return true;
        } catch (error) {
            console.error('Supabase 연결 초기화 실패:', error);
            elements.syncStatusBar.className = 'sync-status-bar error';
            elements.syncStatusText.textContent = '수파베이스 인증 키 연결 오류!';
            elements.btnSyncNow.classList.add('hidden');
        }
    } else {
        elements.syncStatusBar.className = 'sync-status-bar offline';
        elements.syncStatusText.textContent = '로컬 보안 저장 모드 (다른 기기와 데이터 연동은 우측 상단 [설정] 클릭 💡)';
        elements.btnSyncNow.classList.add('hidden');
    }
    supabaseClient = null;
    return false;
}

// Synchronize Local database with Supabase Database
async function syncDataWithCloud() {
    if (!supabaseClient) return;
    
    elements.syncStatusText.textContent = '데이터 동기화 진행 중...';
    elements.btnSyncNow.classList.add('hidden');
    
    try {
        // 1. Fetch cloud trades with automatic fallback table name check (both existence and row counts)
        let cloudTrades = [];
        let fetchedFromDiary = false;
        
        try {
            const { data, error } = await supabaseClient
                .from('nasdaq_diary_trades')
                .select('*');
            if (error) throw error;
            cloudTrades = data || [];
            activeSupabaseTable = 'nasdaq_diary_trades';
            fetchedFromDiary = true;
        } catch (err) {
            console.warn('nasdaq_diary_trades 테이블 조회 실패:', err);
        }
        
        // If diary query failed, OR it succeeded but returned 0 rows, check trades table
        if (!fetchedFromDiary || cloudTrades.length === 0) {
            try {
                const { data, error } = await supabaseClient
                    .from('trades')
                    .select('*');
                if (!error && data && data.length > 0) {
                    cloudTrades = data;
                    activeSupabaseTable = 'trades';
                    console.log('trades 테이블에서 데이터 감지됨 (우선 적용).');
                } else if (!fetchedFromDiary) {
                    if (error) throw error;
                    cloudTrades = data || [];
                    activeSupabaseTable = 'trades';
                }
            } catch (errFallback) {
                if (!fetchedFromDiary) {
                    throw new Error(`테이블 조회 실패: nasdaq_diary_trades 및 trades 모두 실패했습니다. (${errFallback.message})`);
                }
                console.log('trades 테이블 조회 실패. 빈 nasdaq_diary_trades 테이블을 유지합니다.');
            }
        }
        
        // 2. Insert missing local trades to cloud
        const localIds = new Set(tradesList.map(t => t.id));
        const cloudIds = new Set(cloudTrades.map(c => c.id));
        
        const unsyncedLocal = tradesList.filter(t => !cloudIds.has(t.id));
        
        for (const localTrade of unsyncedLocal) {
            // Clean localTrade fields to prevent DB schema conflicts
            const cloudPayload = { ...localTrade };
            delete cloudPayload._dirty; // Internal sync flags if any
            
            const { error: uploadError } = await supabaseClient
                .from(activeSupabaseTable)
                .upsert([cloudPayload]);
                
            if (uploadError) console.error('Cloud 업로드 누락 에러:', uploadError);
        }
        
        // 3. Sync missing cloud trades down to local IndexedDB
        let updatedCount = 0;
        for (const cloudTrade of cloudTrades) {
            if (!localIds.has(cloudTrade.id)) {
                await saveTradeToLocal(cloudTrade);
                updatedCount++;
            }
        }
        
        // 4. Reload local data and UI
        await loadTradesFromLocal();
        renderTradesGrid();
        updateDashboardStats();
        
        elements.syncStatusBar.className = 'sync-status-bar online';
        elements.syncStatusText.textContent = '동기화 완료! 클라우드와 로컬 데이터가 최신 상태입니다.';
        
        setTimeout(() => {
            if (supabaseClient) {
                elements.syncStatusText.textContent = '수파베이스 클라우드 연결됨 (무중단 실시간 연동)';
                elements.btnSyncNow.classList.remove('hidden');
            }
        }, 3000);
        
    } catch (err) {
        console.error('동기화 실패:', err);
        elements.syncStatusBar.className = 'sync-status-bar error';
        elements.syncStatusText.innerHTML = `클라우드 동기화 실패: ${err.message} <a href="#" onclick="openDiagnosticsFromStatusBar(event)" style="color: var(--gold-bright); text-decoration: underline; margin-left: 10px; font-weight: 600;">🔍 원인 분석 및 자가 진단</a>`;
        elements.btnSyncNow.classList.remove('hidden');
    }
}

// ==========================================================================
// 3. Canvas Image Compression Module (Optimizing size for Storage and DB)
// ==========================================================================
function compressImage(fileOrBlob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileOrBlob);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Max dimensions to ensure quick upload & excellent clarity
                const MAX_WIDTH = 1000;
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to highly efficient JPEG (Quality 0.70)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.70);
                resolve(compressedBase64);
            };
        };
    });
}

// Automatically analyze the uploaded file name or modified date to extract timestamp
function autofillDateFromImage(file) {
    if (file && file.lastModified) {
        const lastModifiedDate = new Date(file.lastModified);
        // Format to local datetime-local ISO format: YYYY-MM-DDTHH:MM
        const offset = lastModifiedDate.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(lastModifiedDate - offset)).toISOString().slice(0, 16);
        elements.tradeDate.value = localISOTime;
    }
}

// ==========================================================================
// 4. Form Steppers & Image Paste / Drag & Drop Interaction
// ==========================================================================
function stepInput(inputId, step) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    let currentVal = parseFloat(input.value) || 0;
    
    // Contracts can only be positive integers
    if (inputId === 'trade-contracts') {
        currentVal = Math.max(1, Math.round(currentVal + step));
    } else {
        // Points can have decimals (e.g. Nasdaq step 0.25)
        currentVal = +(currentVal + step).toFixed(2);
    }
    
    input.value = currentVal;
    
    // Fire event to trigger recalculation
    calculatePnLOnForm();
}
window.stepInput = stepInput; // Expose globally for HTML onclick

function triggerFileInput(fileInputId) {
    document.getElementById(fileInputId).click();
}
window.triggerFileInput = triggerFileInput;

function toggleImageDeleteMode(type) {
    const btn = document.querySelector(`.image-upload-group:nth-of-type(${type === 'entry' ? 1 : 2}) .minus-btn`);
    imageDeleteModes[type] = !imageDeleteModes[type];
    
    if (imageDeleteModes[type]) {
        btn.classList.add('active');
        const overlay = document.getElementById(`overlay-${type}-delete`);
        if (overlay && ((type === 'entry' && entryImageBase64) || (type === 'exit' && exitImageBase64))) {
            overlay.classList.remove('hidden');
        }
    } else {
        btn.classList.remove('active');
        const overlay = document.getElementById(`overlay-${type}-delete`);
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}
window.toggleImageDeleteMode = toggleImageDeleteMode;

function clearZoneImage(type) {
    if (type === 'entry') {
        entryImageBase64 = null;
        elements.previewEntryContainer.classList.add('hidden');
        elements.previewEntryImg.src = '';
        elements.zoneEntryImg.querySelector('.zone-placeholder').classList.remove('hidden');
    } else {
        exitImageBase64 = null;
        elements.previewExitContainer.classList.add('hidden');
        elements.previewExitImg.src = '';
        elements.zoneExitImg.querySelector('.zone-placeholder').classList.remove('hidden');
    }
    // Turn off delete mode automatically
    imageDeleteModes[type] = false;
    const btn = document.querySelector(`.image-upload-group:nth-of-type(${type === 'entry' ? 1 : 2}) .minus-btn`);
    btn.classList.remove('active');
}
window.clearZoneImage = clearZoneImage;

function setupImageDropZones() {
    const configureZone = (zone, fileInput, container, imgPreview, type) => {
        // 1. Double click to trigger file input
        zone.addEventListener('dblclick', (e) => {
            // Avoid triggering when delete mode overlay is active
            if (imageDeleteModes[type]) return;
            if (e.target.closest('.delete-overlay')) return;
            fileInput.click();
        });

        // 2. Drag & Drop events
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                const compressed = await compressImage(files[0]);
                displayPreview(compressed, type);
                autofillDateFromImage(files[0]);
            }
        });

        // 3. Copy & Paste events (Clipboard API)
        // Set tabindex so the div can focus and listen to paste
        zone.addEventListener('paste', async (e) => {
            e.preventDefault();
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    const compressed = await compressImage(blob);
                    displayPreview(compressed, type);
                    
                    // Simple notification animation
                    zone.style.borderColor = 'var(--gold-bright)';
                    setTimeout(() => zone.style.borderColor = 'var(--border-gold-low)', 500);
                    break;
                }
            }
        });

        // 4. File input change
        fileInput.addEventListener('change', async () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const compressed = await compressImage(file);
                displayPreview(compressed, type);
                autofillDateFromImage(file);
            }
        });
    };

    configureZone(elements.zoneEntryImg, elements.fileEntryImg, elements.previewEntryContainer, elements.previewEntryImg, 'entry');
    configureZone(elements.zoneExitImg, elements.fileExitImg, elements.previewExitContainer, elements.previewExitImg, 'exit');
}

function displayPreview(base64Data, type) {
    if (type === 'entry') {
        entryImageBase64 = base64Data;
        elements.previewEntryImg.src = base64Data;
        elements.previewEntryContainer.classList.remove('hidden');
        elements.zoneEntryImg.querySelector('.zone-placeholder').classList.add('hidden');
        if (imageDeleteModes.entry) {
            elements.overlayEntryDelete.classList.remove('hidden');
        }
    } else {
        exitImageBase64 = base64Data;
        elements.previewExitImg.src = base64Data;
        elements.previewExitContainer.classList.remove('hidden');
        elements.zoneExitImg.querySelector('.zone-placeholder').classList.add('hidden');
        if (imageDeleteModes.exit) {
            elements.overlayExitDelete.classList.remove('hidden');
        }
    }
}

// ==========================================================================
// 5. Nasdaq P&L Calculations & Formatting
// ==========================================================================
function formatCurrency(value) {
    const sign = value > 0 ? '+' : (value < 0 ? '-' : '');
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(Math.abs(value));
    return `${sign}${formatted}`;
}

function calculatePnL(position, contracts, entryPoint, exitPoint) {
    if (!contracts || isNaN(entryPoint) || isNaN(exitPoint)) return 0;
    
    // Commission is $4 per contract
    const commission = contracts * 4;
    let rawPnl = 0;
    
    if (position === 'BUY') {
        rawPnl = (exitPoint - entryPoint) * contracts;
    } else {
        rawPnl = (entryPoint - exitPoint) * contracts;
    }
    
    return rawPnl - commission;
}

function calculatePnLOnForm() {
    const position = document.querySelector('input[name="position"]:checked').value;
    const contracts = parseInt(elements.tradeContracts.value) || 1;
    
    const entryVal = elements.tradeEntry.value.trim();
    const exitVal = elements.tradeExit.value.trim();
    
    const entryPoint = entryVal !== '' ? parseFloat(entryVal) : 0;
    const exitPoint = exitVal !== '' ? parseFloat(exitVal) : 0;
    
    const isHolding = entryPoint > 0 && (exitVal === '' || exitPoint === 0);
    const isDraft = entryVal === '' || entryPoint === 0;
    
    if (isHolding) {
        elements.calcFormulaDisplay.innerHTML = `진입가: ${entryPoint.toFixed(2)} | 청산 대기 중 (보유 포지션)`;
        elements.modalCalcPnl.textContent = '보유 중 ⏳';
        elements.modalCalcPnl.style.color = '#ffae00';
    } else if (isDraft) {
        elements.calcFormulaDisplay.innerHTML = `진입포인트 입력 대기 중 (메모 기록용)`;
        elements.modalCalcPnl.textContent = '기록용 📝';
        elements.modalCalcPnl.style.color = 'var(--text-muted)';
    } else {
        // Render formula on the modal
        if (position === 'BUY') {
            elements.calcFormulaDisplay.innerHTML = `((${exitPoint.toFixed(2)} - ${entryPoint.toFixed(2)}) * ${contracts}) - (${contracts} * $4)`;
        } else {
            elements.calcFormulaDisplay.innerHTML = `((${entryPoint.toFixed(2)} - ${exitPoint.toFixed(2)}) * ${contracts}) - (${contracts} * $4)`;
        }
        
        const profitLoss = calculatePnL(position, contracts, entryPoint, exitPoint);
        elements.modalCalcPnl.textContent = formatCurrency(profitLoss);
        
        if (profitLoss > 0) {
            elements.modalCalcPnl.style.color = 'var(--red)';
        } else if (profitLoss < 0) {
            elements.modalCalcPnl.style.color = 'var(--blue)';
        } else {
            elements.modalCalcPnl.style.color = 'white';
        }
    }
}

// Hook form inputs to real-time PnL calculation
function setupFormListeners() {
    const inputs = [elements.tradeContracts, elements.tradeEntry, elements.tradeExit];
    inputs.forEach(input => {
        input.addEventListener('input', calculatePnLOnForm);
    });
    
    // Position toggle listener
    document.getElementById('pos-buy').addEventListener('change', calculatePnLOnForm);
    document.getElementById('pos-sell').addEventListener('change', calculatePnLOnForm);
}

// ==========================================================================
// 6. UI Renders (Cards Grid, Dashboard & Mind Stats)
// ==========================================================================
function updateDashboardStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Monday of this week (Standard trading week start)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfThisWeek = new Date(startOfToday.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    
    // 1st of current calendar month
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Filter the trades list based on activePeriod
    const filteredTrades = tradesList.filter(trade => {
        const tradeDate = new Date(trade.trade_date);
        if (activePeriod === 'DAY') {
            return tradeDate >= startOfToday;
        } else if (activePeriod === 'WEEK') {
            return tradeDate >= startOfThisWeek;
        } else if (activePeriod === 'MONTH') {
            return tradeDate >= startOfThisMonth;
        }
        return true; // 'ALL'
    });
    
    let totalPnl = 0;
    let totalTrades = 0;
    let totalContracts = 0;
    let wins = 0;
    let losses = 0;
    
    filteredTrades.forEach(trade => {
        const isHolding = trade.entry_point > 0 && (!trade.exit_point || trade.exit_point === 0);
        const isDraft = !trade.entry_point || trade.entry_point === 0;
        
        // Exclude active holding and draft/notes trades from performance statistics
        if (!isHolding && !isDraft) {
            totalPnl += trade.profit_loss;
            totalContracts += trade.contracts;
            totalTrades++;
            
            const isWin = trade.profit_loss >= 0;
            if (isWin) {
                wins++;
            } else {
                losses++;
            }
        }
    });
    
    // 1. Render Net P&L
    elements.statTotalPnl.textContent = formatCurrency(totalPnl);
    elements.statTotalPnl.className = 'dash-card-value';
    
    if (totalPnl > 0) {
        elements.statTotalPnl.classList.add('profit');
        elements.statTotalPnl.style.color = 'var(--red)';
    } else if (totalPnl < 0) {
        elements.statTotalPnl.classList.add('loss');
        elements.statTotalPnl.style.color = 'var(--blue)';
    } else {
        elements.statTotalPnl.style.color = 'white';
    }
    
    // 2. Render P&L Period Label
    if (elements.statPnlLabel) {
        if (activePeriod === 'DAY') {
            elements.statPnlLabel.textContent = '오늘 기준 (수수료 $4 반영)';
        } else if (activePeriod === 'WEEK') {
            elements.statPnlLabel.textContent = '이번 주 기준 (수수료 $4 반영)';
        } else if (activePeriod === 'MONTH') {
            elements.statPnlLabel.textContent = '이번 달 기준 (수수료 $4 반영)';
        } else {
            elements.statPnlLabel.textContent = '계약당 수수료 $4 반영됨';
        }
    }
    
    // 3. Render Win Rate
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    elements.statWinRate.textContent = `${winRate}%`;
    elements.statWinrateBar.style.width = `${winRate}%`;
    elements.statWinRatio.textContent = `${wins}승 / ${losses}패`;
    
    // 4. Render Totals
    elements.statTotalTrades.textContent = `${totalTrades}회`;
    elements.statTotalContracts.textContent = `${totalContracts}계약`;
    
    // 5. Update Helper Description
    if (elements.statPeriodDesc) {
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        if (activePeriod === 'DAY') {
            elements.statPeriodDesc.innerHTML = `📅 <strong>오늘</strong> (${startOfToday.toLocaleDateString('ko-KR', options)}) 하루 동안 진행된 매매 성과입니다.`;
        } else if (activePeriod === 'WEEK') {
            elements.statPeriodDesc.innerHTML = `📅 <strong>이번 주</strong> (${startOfThisWeek.toLocaleDateString('ko-KR', options)} ~ 현재) 진행된 누적 매매 성과입니다.`;
        } else if (activePeriod === 'MONTH') {
            elements.statPeriodDesc.innerHTML = `📅 <strong>이번 달</strong> (${startOfThisMonth.toLocaleDateString('ko-KR', options)} ~ 현재) 진행된 누적 매매 성과입니다.`;
        } else {
            elements.statPeriodDesc.innerHTML = `📊 <strong>전체 기간</strong> 동안 축적된 매매 일지의 누적 통계 성과입니다.`;
        }
    }
}

function renderTradesGrid() {
    const filterPos = elements.filterPosition ? elements.filterPosition.value : 'ALL';
    const filterRes = elements.filterResult ? elements.filterResult.value : 'ALL';
    const filterMnd = elements.filterMind ? elements.filterMind.value : 'ALL';
    
    // Filtered items
    const filteredTrades = tradesList.filter(trade => {
        // Filter matches
        const positionMatches = filterPos === 'ALL' || trade.position === filterPos;
        const resultMatches = filterRes === 'ALL' || 
                             (filterRes === 'WIN' && trade.profit_loss >= 0) ||
                             (filterRes === 'LOSS' && trade.profit_loss < 0);
                             
        const mindMatches = filterMnd === 'ALL' || trade.mind_tag === filterMnd;
        
        return positionMatches && resultMatches && mindMatches;
    });
    
    // Clean list
    elements.tradesContainer.innerHTML = '';
    
    if (filteredTrades.length === 0) {
        if (!supabaseClient) {
            elements.emptyState.querySelector('p').innerHTML = `
                상단의 '새 일지 작성' 버튼을 눌러 매매 여정을 기록해 보세요!<br><br>
                🏠 <strong>집이나 다른 기기에서 접속하셨나요?</strong><br>
                우측 상단 <strong>[설정]</strong> 버튼을 누르고 기존의 <strong>수파베이스(Supabase) 클라우드 연동</strong>을 진행하시면 회사에서 작성한 모든 매매 기록이 실시간으로 동기화되어 즉시 나타납니다!
            `;
        } else {
            elements.emptyState.querySelector('p').innerHTML = `
                상단의 '새 일지 작성' 버튼을 눌러 나스닥100 트레이딩 여정을 기록해 보세요!
            `;
        }
        elements.tradesContainer.appendChild(elements.emptyState);
        elements.emptyState.classList.remove('hidden');
        return;
    }
    
    elements.emptyState.classList.add('hidden');
    
    filteredTrades.forEach(trade => {
        const isHolding = trade.entry_point > 0 && (!trade.exit_point || trade.exit_point === 0);
        const isDraft = !trade.entry_point || trade.entry_point === 0;
        
        let cardClass = '';
        let formattedPnl = '';
        let pnlColorStyle = '';
        
        if (isHolding) {
            cardClass = 'holding';
            formattedPnl = '보유 중 ⏳';
            pnlColorStyle = '#ffae00';
        } else if (isDraft) {
            cardClass = 'draft';
            formattedPnl = '기록용 📝';
            pnlColorStyle = 'var(--text-muted)';
        } else {
            const isWin = trade.profit_loss >= 0;
            cardClass = isWin ? 'win' : 'loss';
            formattedPnl = formatCurrency(trade.profit_loss);
            pnlColorStyle = isWin ? 'var(--red)' : 'var(--blue)';
        }
        
        // Psychological State translation and Emoji
        const mindMeta = getMindMeta(trade.mind_tag);
        
        const card = document.createElement('div');
        card.className = `trade-card ${cardClass}`;
        card.setAttribute('onclick', `cardClicked(event, '${trade.id}')`);
        
        // Dynamic images sections
        let imagesHtml = '';
        if (trade.entry_image_url || trade.exit_image_url) {
            imagesHtml = `<div class="card-images-row">`;
            if (trade.entry_image_url) {
                imagesHtml += `
                    <div class="card-img-container" onclick="openLightbox('${trade.entry_image_url}', '진입 차트 복기 - ${new Date(trade.trade_date).toLocaleDateString()}')">
                        <img src="${trade.entry_image_url}" alt="진입 차트">
                        <div class="img-lbl">진입 차트</div>
                    </div>`;
            }
            if (trade.exit_image_url) {
                imagesHtml += `
                    <div class="card-img-container" onclick="openLightbox('${trade.exit_image_url}', '청산 차트 복기 - ${new Date(trade.trade_date).toLocaleDateString()}')">
                        <img src="${trade.exit_image_url}" alt="청산 차트">
                        <div class="img-lbl">청산 차트</div>
                    </div>`;
            }
            imagesHtml += `</div>`;
        }
        
        card.innerHTML = `
            <div class="card-top">
                <div class="card-date">
                    <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                    <span>${new Date(trade.trade_date).toLocaleString('ko-KR', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    })}</span>
                </div>
                <div class="card-badges">
                    <span class="badge-pos ${trade.position.toLowerCase()}">${trade.position === 'BUY' ? '매수' : '매도'}</span>
                    <span class="badge-concl">${trade.conclusion}</span>
                    <span class="badge-mind ${trade.mind_tag}">${mindMeta.emoji} ${mindMeta.label}</span>
                </div>
            </div>
            
            <div class="card-body">
                <div class="card-metrics-grid">
                    <div class="metric-item">
                        <span class="lbl">계약수</span>
                        <span class="val">${trade.contracts}계약</span>
                    </div>
                    <div class="metric-item">
                        <span class="lbl">진입가</span>
                        <span class="val">${(trade.entry_point && trade.entry_point > 0) ? trade.entry_point.toFixed(2) : '-'}</span>
                    </div>
                    <div class="metric-item">
                        <span class="lbl">청산가</span>
                        <span class="val">${(trade.exit_point && trade.exit_point > 0) ? trade.exit_point.toFixed(2) : '-'}</span>
                    </div>
                </div>
                
                <div class="card-pnl-box ${cardClass}">
                    <span class="lbl">최종 손익 (수수료 차감)</span>
                    <span class="val" style="color: ${pnlColorStyle}">${formattedPnl}</span>
                </div>
                
                <div class="card-thoughts-snapshot">
                    <div class="snapshot-header">
                        <i data-lucide="brain-circuit" class="gold-icon" style="width: 13px; height: 13px;"></i>
                        <span>진입 당시 나의 생각</span>
                    </div>
                    <div class="snapshot-content">
                        <div class="snapshot-item"><span class="lbl">신호대기:</span> <span class="val">${trade.thought_signal || '기록없음'}</span></div>
                        <div class="snapshot-item"><span class="lbl">대기이유:</span> <span class="val">${trade.thought_reason || '기록없음'}</span></div>
                        <div class="snapshot-item"><span class="lbl">시장비중:</span> <span class="val">${trade.thought_tech || '기록없음'}</span></div>
                        <div class="snapshot-item"><span class="lbl">심리비중:</span> <span class="val">${trade.thought_psych || '기록없음'}</span></div>
                    </div>
                </div>
                
                ${imagesHtml}
                
                <div class="card-details">
                    <div class="detail-section">
                        <strong><i data-lucide="bar-chart-3" style="width: 12px; height: 12px;"></i> 기술적 사유:</strong>
                        <p>${trade.entry_tech_reason ? trade.entry_tech_reason : '작성 없음'}</p>
                    </div>
                    <div class="detail-section psych">
                        <strong><i data-lucide="heart" style="width: 12px; height: 12px;"></i> 심리적 사유:</strong>
                        <p>${trade.entry_psych_reason ? trade.entry_psych_reason : '작성 없음'}</p>
                    </div>
                </div>
            </div>
            
            <div class="card-footer">
                <button class="btn-card-action btn-card-edit" onclick="editTrade('${trade.id}')" title="매매기록 수정">
                    <i data-lucide="edit" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn-card-action btn-card-del" onclick="deleteTrade('${trade.id}')" title="매매기록 삭제">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        `;
        
        elements.tradesContainer.appendChild(card);
    });
    
    // Lucide Icon refresh inside dynamic cards
    lucide.createIcons();
}

function getMindMeta(tag) {
    switch (tag) {
        case 'disciplined': return { emoji: '😊', label: '평온(원칙)' };
        case 'impatient': return { emoji: '⚡', label: '조급함' };
        case 'revenge': return { emoji: '😡', label: '분노(복수)' };
        case 'fomo': return { emoji: '🤑', label: '탐욕(추격)' };
        case 'fear': return { emoji: '😨', label: '공포(위축)' };
        default: return { emoji: '🤔', label: '미정' };
    }
}

// ==========================================================================
// 7. Lightbox, Modals & Form Action Logics
// ==========================================================================
function openLightbox(imageUrl, captionText) {
    elements.lightboxImg.src = imageUrl;
    elements.lightboxCaption.textContent = captionText;
    elements.modalLightbox.style.display = 'flex';
}
window.openLightbox = openLightbox;

function closeLightbox() {
    elements.modalLightbox.style.display = 'none';
    elements.lightboxImg.src = '';
}

function openTradeModal(editingId = null) {
    elements.modalTrade.classList.add('open');
    elements.formTrade.reset();
    
    // Default image caches
    entryImageBase64 = null;
    exitImageBase64 = null;
    clearZoneImage('entry');
    clearZoneImage('exit');
    
    // Default date to now
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
    elements.tradeDate.value = localISOTime;
    
    const modalThoughtsSection = document.querySelector('.modal-thoughts-section');
    const thoughtInputs = [
        document.getElementById('trade-thought-signal'),
        document.getElementById('trade-thought-reason'),
        document.getElementById('trade-thought-tech'),
        document.getElementById('trade-thought-psych')
    ];
    
    if (editingId) {
        // Editing Mode
        const trade = tradesList.find(t => t.id === editingId);
        if (!trade) return;
        
        elements.modalTitle.querySelector('span').textContent = '매매일지 수정하기';
        elements.tradeId.value = trade.id;
        
        // Setup Date
        const tDate = new Date(trade.trade_date);
        const tOffset = tDate.getTimezoneOffset() * 60000;
        elements.tradeDate.value = (new Date(tDate - tOffset)).toISOString().slice(0, 16);
        
        // Radio buttons setup
        document.querySelector(`input[name="position"][value="${trade.position}"]`).checked = true;
        document.querySelector(`input[name="conclusion"][value="${trade.conclusion}"]`).checked = true;
        document.querySelector(`input[name="mind_tag"][value="${trade.mind_tag}"]`).checked = true;
        
        // Core inputs
        elements.tradeContracts.value = trade.contracts;
        elements.tradeEntry.value = (trade.entry_point && trade.entry_point > 0) ? trade.entry_point : '';
        elements.tradeExit.value = (trade.exit_point && trade.exit_point > 0) ? trade.exit_point : '';
        
        // Thoughts snap
        document.getElementById('trade-thought-signal').value = trade.thought_signal || '';
        document.getElementById('trade-thought-reason').value = trade.thought_reason || '';
        document.getElementById('trade-thought-tech').value = trade.thought_tech || '';
        document.getElementById('trade-thought-psych').value = trade.thought_psych || '';
        
        // Descriptions
        elements.entryTechReason.value = trade.entry_tech_reason || '';
        elements.entryPsychReason.value = trade.entry_psych_reason || '';
        elements.exitTechReason.value = trade.exit_tech_reason || '';
        elements.exitPsychReason.value = trade.exit_psych_reason || '';
        
        // Previews image caches
        if (trade.entry_image_url) displayPreview(trade.entry_image_url, 'entry');
        if (trade.exit_image_url) displayPreview(trade.exit_image_url, 'exit');
        
        // Show thoughts section but do not make them required
        if (modalThoughtsSection) modalThoughtsSection.style.display = 'block';
        thoughtInputs.forEach(input => {
            if (input) input.removeAttribute('required');
        });
        
    } else {
        // Create Mode
        elements.modalTitle.querySelector('span').textContent = '새로운 매매기록 작성';
        elements.tradeId.value = '';
        elements.tradeContracts.value = 1;
        elements.tradeEntry.value = '';
        elements.tradeExit.value = '';
        
        // Autofill from dashboard real-time thoughts
        document.getElementById('trade-thought-signal').value = localStorage.getItem('thought_signal') || '';
        document.getElementById('trade-thought-reason').value = localStorage.getItem('thought_reason') || '';
        document.getElementById('trade-thought-tech').value = localStorage.getItem('thought_tech') || '';
        document.getElementById('trade-thought-psych').value = localStorage.getItem('thought_psych') || '';
        
        // Hide thoughts section and make them not required
        if (modalThoughtsSection) modalThoughtsSection.style.display = 'none';
        thoughtInputs.forEach(input => {
            if (input) input.removeAttribute('required');
        });
    }
    
    calculatePnLOnForm();
}

function closeTradeModal() {
    elements.modalTrade.classList.remove('open');
    elements.formTrade.reset();
}

async function handleTradeFormSubmit(e) {
    e.preventDefault();
    
    const id = elements.tradeId.value || crypto.randomUUID();
    const dateStr = elements.tradeDate.value;
    const position = document.querySelector('input[name="position"]:checked').value;
    const conclusion = document.querySelector('input[name="conclusion"]:checked').value;
    const mindTag = document.querySelector('input[name="mind_tag"]:checked').value;
    
    const contracts = parseInt(elements.tradeContracts.value) || 1;
    const entryPoint = parseFloat(elements.tradeEntry.value) || 0;
    const exitPoint = parseFloat(elements.tradeExit.value) || 0;
    
    const thoughtSignal = document.getElementById('trade-thought-signal').value.trim();
    const thoughtReason = document.getElementById('trade-thought-reason').value.trim();
    const thoughtTech = document.getElementById('trade-thought-tech').value.trim();
    const thoughtPsych = document.getElementById('trade-thought-psych').value.trim();
    
    const entryTech = elements.entryTechReason.value.trim();
    const entryPsych = elements.entryPsychReason.value.trim();
    const exitTech = elements.exitTechReason.value.trim();
    const exitPsych = elements.exitPsychReason.value.trim();
    
    const profitLoss = calculatePnL(position, contracts, entryPoint, exitPoint);
    
    const tradeData = {
        id: id,
        trade_date: new Date(dateStr).toISOString(),
        position: position,
        conclusion: conclusion,
        contracts: contracts,
        entry_point: entryPoint,
        exit_point: exitPoint,
        thought_signal: thoughtSignal,
        thought_reason: thoughtReason,
        thought_tech: thoughtTech,
        thought_psych: thoughtPsych,
        entry_tech_reason: entryTech,
        entry_psych_reason: entryPsych,
        exit_tech_reason: exitTech,
        exit_psych_reason: exitPsych,
        entry_image_url: entryImageBase64,
        exit_image_url: exitImageBase64,
        mind_tag: mindTag,
        profit_loss: profitLoss
    };
    
    try {
        // 1. Save locally
        await saveTradeToLocal(tradeData);
        
        // 2. Sync with Supabase asynchronously if online
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from(activeSupabaseTable)
                    .upsert([tradeData]);
                if (error) throw error;
            } catch (supaErr) {
                console.warn('수파베이스 저장 실패(오프라인 자동 백업 저장 완료):', supaErr);
                // Keep local working, user can sync later manually
            }
        }
        
        // 3. Reload list & UI
        await loadTradesFromLocal();
        renderTradesGrid();
        updateDashboardStats();
        
        closeTradeModal();
    } catch (err) {
        alert(`저장 도중 문제가 발생했습니다: ${err.message}`);
    }
}

async function editTrade(id) {
    openTradeModal(id);
}
window.editTrade = editTrade;

function cardClicked(event, id) {
    // If the click is on the delete button, edit button, or image container, let their own handlers work
    if (event.target.closest('.btn-card-del') || event.target.closest('.btn-card-edit') || event.target.closest('.card-img-container')) {
        return;
    }
    editTrade(id);
}
window.cardClicked = cardClicked;

async function deleteTrade(id) {
    if (confirm('정말로 이 매매 기록을 영구히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        try {
            // 1. Local Delete
            await deleteTradeFromLocal(id);
            
            // 2. Cloud Delete if configured
            if (supabaseClient) {
                try {
                    const { error } = await supabaseClient
                        .from(activeSupabaseTable)
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                } catch (supaErr) {
                    console.warn('수파베이스 클라우드 삭제 실패(오프라인 우선 삭제 완료):', supaErr);
                }
            }
            
            // 3. Reload UI
            await loadTradesFromLocal();
            renderTradesGrid();
            updateDashboardStats();
        } catch (err) {
            alert(`삭제 중 에러가 발생했습니다: ${err.message}`);
        }
    }
}
window.deleteTrade = deleteTrade;

// ==========================================================================
// 8. Settings Management (Supabase Configurations)
// ==========================================================================
function openSettingsModal() {
    elements.modalSettings.classList.add('open');
    elements.settingsUrl.value = localStorage.getItem('supabase_url') || '';
    elements.settingsKey.value = localStorage.getItem('supabase_key') || '';
}

function closeSettingsModal() {
    elements.modalSettings.classList.remove('open');
}

function saveSettings() {
    const url = elements.settingsUrl.value.trim();
    const key = elements.settingsKey.value.trim();
    
    if (url && key) {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
        
        // Try linking
        const connected = initSupabase();
        
        if (connected && elements.settingsSync.checked) {
            syncDataWithCloud();
        }
        
        closeSettingsModal();
    } else {
        alert('Supabase Project URL 및 API Key를 올바르게 채워 주세요.');
    }
}

function disconnectSupabase() {
    if (confirm('수파베이스 연동을 해제하시겠습니까? 데이터는 브라우저 로컬 저장소(IndexedDB)에 안전하게 보관됩니다.')) {
        localStorage.removeItem('supabase_url');
        localStorage.removeItem('supabase_key');
        initSupabase();
        closeSettingsModal();
    }
}

async function runSupabaseDiagnostics() {
    const resultsContainer = document.getElementById('diagnostic-results');
    if (!resultsContainer) return;
    resultsContainer.style.display = 'block';
    resultsContainer.textContent = '진단 중... ⏳';
    resultsContainer.style.color = '#8F9CAE';
    
    const url = document.getElementById('settings-url').value.trim();
    const key = document.getElementById('settings-key').value.trim();
    
    if (!url || !key) {
        resultsContainer.textContent = '❌ 오류: URL 또는 API Key가 입력되지 않았습니다. 입력을 먼저 진행해 주세요.';
        resultsContainer.style.color = 'var(--blue)';
        return;
    }
    
    let report = [];
    report.push(`[1] Supabase Client 생성 시도...`);
    
    let tempClient = null;
    try {
        tempClient = supabase.createClient(url, key);
        report.push(`✅ Client 생성 성공!`);
    } catch (e) {
        report.push(`❌ Client 생성 실패: ${e.message}`);
        resultsContainer.textContent = report.join('\n');
        resultsContainer.style.color = 'var(--blue)';
        return;
    }
    
    report.push(`\n[2] 테이블 및 데이터베이스 연결성 진단...`);
    
    // Test nasdaq_diary_trades
    let testDiaryTradesOk = false;
    let diaryCount = 0;
    try {
        const { error, count } = await tempClient
            .from('nasdaq_diary_trades')
            .select('*', { count: 'exact', head: true });
        if (error) throw error;
        testDiaryTradesOk = true;
        diaryCount = count || 0;
        report.push(`✅ 'nasdaq_diary_trades' 테이블: 존재함 (행 개수: ${diaryCount}개)`);
    } catch (e) {
        report.push(`⚠️ 'nasdaq_diary_trades' 테이블 조회 실패: ${e.message}`);
    }
    
    // Test trades
    let testTradesOk = false;
    let tradesCount = 0;
    try {
        const { error, count } = await tempClient
            .from('trades')
            .select('*', { count: 'exact', head: true });
        if (error) throw error;
        testTradesOk = true;
        tradesCount = count || 0;
        report.push(`✅ 'trades' 테이블: 존재함 (행 개수: ${tradesCount}개)`);
    } catch (e) {
        report.push(`⚠️ 'trades' 테이블 조회 실패: ${e.message}`);
    }
    
    report.push(`\n[3] 최종 상태 진단 결과:`);
    if (testDiaryTradesOk || testTradesOk) {
        resultsContainer.style.color = '#4CD964';
        const bestTable = testTradesOk && tradesCount >= diaryCount ? 'trades' : 'nasdaq_diary_trades';
        const bestCount = bestTable === 'trades' ? tradesCount : diaryCount;
        
        report.push(`🎉 연결 성공! 활성 데이터 테이블은 [${bestTable}] 입니다.`);
        report.push(`📊 저장된 데이터 개수: ${bestCount}개`);
        
        if (bestCount === 0) {
            report.push(`⚠️ 주의: 연결은 정상이나 테이블에 데이터가 0개입니다.\n\n🏠 혹시 집에서 '새로운 수파베이스 프로젝트'를 따로 생성해 연동하셨나요?\n회사 컴퓨터와 데이터가 동기화되려면 회사에서 사용하신 '동일한 Supabase Project URL 및 API Key'를 그대로 복사해 입력하셔야 합니다.`);
            resultsContainer.style.color = '#ffae00';
        } else {
            report.push(`👉 [설정 저장 및 연결]을 클릭하시면 이 데이터를 즉시 동기화하여 불러옵니다.`);
        }
    } else {
        resultsContainer.style.color = 'var(--blue)';
        report.push(`❌ 연결 실패: 테이블을 전혀 찾을 수 없거나 데이터베이스 접근 권한(Anon Key 혹은 RLS) 정책 문제일 수 있습니다.`);
        report.push(`💡 도움말: 수파베이스 대시보드의 SQL Editor에 테이블 생성 쿼리를 실행했는지 다시 확인해 주세요.`);
    }
    
    resultsContainer.textContent = report.join('\n');
}
window.runSupabaseDiagnostics = runSupabaseDiagnostics;

// ==========================================================================
// 8.1 Easy Connection Syncing & Clickable Self-Diagnosis (Version 7.5 Addition)
// ==========================================================================
function generateShareLink() {
    const url = localStorage.getItem('supabase_url') || document.getElementById('settings-url').value.trim();
    const key = localStorage.getItem('supabase_key') || document.getElementById('settings-key').value.trim();
    
    if (!url || !key) {
        alert('연동 설정이 완료된 상태에서만 링크를 생성할 수 있습니다. URL과 API Key를 입력하고 설정 저장 후 시도해 주세요.');
        return;
    }
    
    const config = { url, key };
    try {
        const jsonStr = JSON.stringify(config);
        const encoded = btoa(jsonStr);
        // Build the full URL
        const shareUrl = `${window.location.origin}${window.location.pathname}#config=${encoded}`;
        
        const input = document.getElementById('share-link-input');
        const copyBtn = document.getElementById('btn-copy-share-link');
        
        if (input && copyBtn) {
            input.style.display = 'block';
            input.value = shareUrl;
            copyBtn.style.display = 'block';
            input.select();
        }
    } catch (e) {
        alert('링크 생성 도중 에러가 발생했습니다: ' + e.message);
    }
}
window.generateShareLink = generateShareLink;

function copyShareLink() {
    const input = document.getElementById('share-link-input');
    if (!input || !input.value) return;
    
    navigator.clipboard.writeText(input.value).then(() => {
        const btn = document.getElementById('btn-copy-share-link');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '복사 완료!';
            btn.style.backgroundColor = '#4CD964';
            btn.style.borderColor = '#4CD964';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
            }, 2000);
        }
    }).catch(err => {
        alert('복사에 실패했습니다: ' + err);
    });
}
window.copyShareLink = copyShareLink;

function checkConfigHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#config=')) {
        try {
            const encoded = hash.substring(8);
            const decoded = atob(encoded);
            const config = JSON.parse(decoded);
            
            if (config.url && config.key) {
                localStorage.setItem('supabase_url', config.url);
                localStorage.setItem('supabase_key', config.key);
                
                alert('🎉 회사 컴퓨터의 수파베이스 연동 설정이 성공적으로 감지 및 반영되었습니다!\n\n저장 버튼을 따로 누르지 않아도 즉시 데이터를 클라우드와 동기화합니다.');
                
                // Clean the hash from the address bar to keep it tidy
                window.history.replaceState(null, document.title, window.location.pathname);
            }
        } catch (e) {
            console.error('URL 설정 동기화 파싱 에러:', e);
        }
    }
}

function openDiagnosticsFromStatusBar(event) {
    if (event) event.preventDefault();
    openSettingsModal();
    
    // Smooth scroll to diagnostic box or highlight it
    const diagBox = document.getElementById('diagnostic-box');
    if (diagBox) {
        diagBox.scrollIntoView({ behavior: 'smooth' });
        diagBox.style.outline = '2px solid var(--gold-bright)';
        diagBox.style.borderRadius = '8px';
        setTimeout(() => {
            diagBox.style.outline = 'none';
        }, 3000);
    }
    // Automatically trigger diagnostics
    setTimeout(() => {
        runSupabaseDiagnostics();
    }, 400);
}
window.openDiagnosticsFromStatusBar = openDiagnosticsFromStatusBar;

// ==========================================================================
// 9. Real-time Thoughts Management ("지금 너의 생각")
// ==========================================================================
function loadThoughts() {
    if (elements.thoughtSignal) elements.thoughtSignal.value = localStorage.getItem('thought_signal') || '';
    if (elements.thoughtReason) elements.thoughtReason.value = localStorage.getItem('thought_reason') || '';
    if (elements.thoughtTech) elements.thoughtTech.value = localStorage.getItem('thought_tech') || '';
    if (elements.thoughtPsych) elements.thoughtPsych.value = localStorage.getItem('thought_psych') || '';
    
    // Scale font size to fit text in the container on initial load
    setTimeout(adjustThoughtsFontSizes, 50); // slight delay to ensure elements are rendered and have dimensions
}

function saveThoughts() {
    const signal = elements.thoughtSignal ? elements.thoughtSignal.value.trim() : '';
    const reason = elements.thoughtReason ? elements.thoughtReason.value.trim() : '';
    const tech = elements.thoughtTech ? elements.thoughtTech.value.trim() : '';
    const psych = elements.thoughtPsych ? elements.thoughtPsych.value.trim() : '';
    
    localStorage.setItem('thought_signal', signal);
    localStorage.setItem('thought_reason', reason);
    localStorage.setItem('thought_tech', tech);
    localStorage.setItem('thought_psych', psych);
}

function adjustTextareaFontSize(textarea) {
    if (!textarea || textarea.clientHeight === 0) return;
    
    // Reset to default max font-size first
    textarea.style.fontSize = '1.7rem';
    textarea.style.lineHeight = '2.3rem';
    
    let fontSize = 1.7;
    const minFontSize = 0.75; // Allow scaling down even slightly further if needed
    const step = 0.05;
    
    // Iteratively shrink font size while content overflows height
    while (textarea.scrollHeight > textarea.clientHeight && fontSize > minFontSize) {
        fontSize -= step;
        textarea.style.fontSize = `${fontSize}rem`;
        textarea.style.lineHeight = `${fontSize * 1.35}rem`;
    }
}

function adjustThoughtsFontSizes() {
    const thoughtInputs = [elements.thoughtSignal, elements.thoughtReason, elements.thoughtTech, elements.thoughtPsych];
    thoughtInputs.forEach(input => {
        if (input) {
            adjustTextareaFontSize(input);
        }
    });
}

// ==========================================================================
// 10. Core Setup & Events Loop
// ==========================================================================
async function applicationBootstrap() {
    // 1. Init Storage
    try {
        await initIndexedDB();
        await loadTradesFromLocal();
    } catch (e) {
        console.error('IndexedDB를 열 수 없으므로 MemoryArray 폴백을 활성화합니다.', e);
    }
    
    // 2. Load settings and render Thoughts
    loadThoughts();
    
    // 3. Init Supabase Connection
    initSupabase();
    
    // 4. Initial Sync if Supabase is connected
    if (supabaseClient) {
        // Sync silently in the background
        syncDataWithCloud();
    }
    
    // 5. Render list and stats Dashboard
    renderTradesGrid();
    updateDashboardStats();
    
    // 6. Bind UI event listeners
    bindEventListeners();
    
    // Initial Lucide activation
    lucide.createIcons();
}

function bindEventListeners() {
    // Global Header Actions
    elements.btnSettings.addEventListener('click', openSettingsModal);
    elements.btnAddTrade.addEventListener('click', () => openTradeModal());
    
    // Logout Button
    if (elements.btnLogout) {
        elements.btnLogout.addEventListener('click', () => {
            localStorage.removeItem('isLoggedIn');
            window.location.reload(true);
        });
    }
    
    // Filters
    if (elements.filterPosition) elements.filterPosition.addEventListener('change', renderTradesGrid);
    if (elements.filterResult) elements.filterResult.addEventListener('change', renderTradesGrid);
    if (elements.filterMind) elements.filterMind.addEventListener('change', renderTradesGrid);
    
    // Period Filter Controls
    if (elements.periodBtns) {
        elements.periodBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                elements.periodBtns.forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                activePeriod = target.getAttribute('data-period');
                updateDashboardStats();
            });
        });
    }
    
    // Sync Button
    elements.btnSyncNow.addEventListener('click', syncDataWithCloud);
    
    // Thoughts Panel Auto-Save and Font Auto-Scaling on Input
    const thoughtInputs = [elements.thoughtSignal, elements.thoughtReason, elements.thoughtTech, elements.thoughtPsych];
    thoughtInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                saveThoughts();
                adjustTextareaFontSize(input);
            });
        }
    });
    
    // Modal Trade Interactions
    elements.btnCloseTradeModal.addEventListener('click', closeTradeModal);
    elements.btnCancelTrade.addEventListener('click', closeTradeModal);
    elements.formTrade.addEventListener('submit', handleTradeFormSubmit);
    
    // Modal Settings Interactions
    elements.btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
    elements.btnSaveSettings.addEventListener('click', saveSettings);
    elements.btnDisconnectSupabase.addEventListener('click', disconnectSupabase);
    
    // Lightbox Modal
    elements.btnCloseLightbox.addEventListener('click', closeLightbox);
    elements.modalLightbox.addEventListener('click', (e) => {
        if (e.target.id === 'modal-lightbox') {
            closeLightbox();
        }
    });
    
    // Setup Drag-n-Drop / Clipboard pasting on inputs
    setupImageDropZones();
    
    // Steppers and Calculator trigger setup
    setupFormListeners();
    
    // Close modals on clicking backdrop
    window.addEventListener('click', (e) => {
        if (e.target === elements.modalTrade) closeTradeModal();
        if (e.target === elements.modalSettings) closeSettingsModal();
    });
    
    // Dynamic text area font resize on window resize
    window.addEventListener('resize', adjustThoughtsFontSizes);
}

// Copy SQL Script to Clipboard helper
function copySQLScript() {
    const sqlText = document.getElementById('sql-code-text').textContent;
    navigator.clipboard.writeText(sqlText).then(() => {
        const btn = document.getElementById('btn-copy-sql');
        const originalText = btn.textContent;
        btn.textContent = '복사 완료! ✓';
        btn.style.color = '#4CD964';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = '';
        }, 2000);
    }).catch(err => {
        alert('복사에 실패했습니다: ' + err);
    });
}
window.copySQLScript = copySQLScript;

// ==========================================================================
// 11. Security Authentication & Session Persistence
// ==========================================================================
function checkLoginState() {
    // Check URL configuration hash first
    checkConfigHash();
    
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    if (isLoggedIn) {
        // Hide login and show app container
        if (elements.loginContainer) elements.loginContainer.classList.add('hidden');
        if (elements.appContainer) elements.appContainer.classList.remove('hidden');
        
        // Bootstrap the application
        applicationBootstrap();
    } else {
        // Show login and hide app container
        if (elements.loginContainer) elements.loginContainer.classList.remove('hidden');
        if (elements.appContainer) elements.appContainer.classList.add('hidden');
        
        // Activate Lucide icons for login screen
        lucide.createIcons();
        
        // Bind login-specific listeners
        setupLoginListeners();
    }
}

function setupLoginListeners() {
    // Toggle Password Visibility
    if (elements.btnTogglePassword && elements.loginPassword) {
        elements.btnTogglePassword.addEventListener('click', () => {
            const type = elements.loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            elements.loginPassword.setAttribute('type', type);
            
            // Toggle eye icon
            const icon = elements.btnTogglePassword.querySelector('i');
            if (icon) {
                const currentIcon = icon.getAttribute('data-lucide');
                const newIcon = currentIcon === 'eye' ? 'eye-off' : 'eye';
                icon.setAttribute('data-lucide', newIcon);
                lucide.createIcons();
            }
        });
    }
    
    // Form Submit Authentication
    if (elements.formLogin) {
        elements.formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = elements.loginEmail ? elements.loginEmail.value.trim() : '';
            const password = elements.loginPassword ? elements.loginPassword.value.trim() : '';
            
            if (email === 'barsaem3@gmail.com' && password === 'guswjd71') {
                // Successful Login
                localStorage.setItem('isLoggedIn', 'true');
                
                // Visual transition
                if (elements.loginContainer) elements.loginContainer.classList.add('hidden');
                if (elements.appContainer) elements.appContainer.classList.remove('hidden');
                
                // Bootstrap full app
                applicationBootstrap();
            } else {
                // Failed Login
                if (elements.loginErrorMsg) {
                    elements.loginErrorMsg.classList.remove('hidden');
                    // Reset CSS animation to shake again
                    elements.loginErrorMsg.style.animation = 'none';
                    elements.loginErrorMsg.offsetHeight; // trigger reflow
                    elements.loginErrorMsg.style.animation = null;
                }
                if (elements.loginPassword) {
                    elements.loginPassword.value = '';
                    elements.loginPassword.focus();
                }
            }
        });
    }
}

// Start application validation when DOM is ready
document.addEventListener('DOMContentLoaded', checkLoginState);
