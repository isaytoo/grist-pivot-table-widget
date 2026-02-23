/**
 * Grist Pivot Table Widget
 * Copyright 2026 Said Hamadou (isaytoo)
 * Licensed under the Apache License, Version 2.0
 * https://github.com/isaytoo/grist-pivot-table-widget
 */

// =============================================================================
// INTERNATIONALIZATION
// =============================================================================

const i18n = {
  fr: {
    title: 'Tableau Croisé Dynamique',
    viewMode: 'Vue :',
    viewPivot: 'Tableau Croisé',
    viewFullscreen: 'Plein écran',
    columnSize: 'Taille colonnes :',
    reset: 'Réinitialiser',
    export: 'Exporter CSV',
    loading: 'Chargement des données...',
    emptyTitle: 'Aucune donnée',
    emptyDesc: 'Sélectionnez une table source dans les paramètres du widget pour commencer à créer votre tableau croisé dynamique.',
    configSaved: 'Configuration sauvegardée',
    configReset: 'Configuration réinitialisée',
    exportSuccess: 'Export CSV réussi'
  },
  en: {
    title: 'Pivot Table',
    viewMode: 'View:',
    viewPivot: 'Pivot Table',
    viewFullscreen: 'Fullscreen',
    columnSize: 'Column size:',
    reset: 'Reset',
    export: 'Export CSV',
    loading: 'Loading data...',
    emptyTitle: 'No data',
    emptyDesc: 'Select a source table in the widget settings to start creating your pivot table.',
    configSaved: 'Configuration saved',
    configReset: 'Configuration reset',
    exportSuccess: 'CSV export successful'
  }
};

let currentLang = 'fr';

function t(key) {
  return (i18n[currentLang] && i18n[currentLang][key]) || (i18n.fr[key]) || key;
}

function setLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === lang);
  });
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  // Save language preference
  grist.setOption('language', lang).catch(console.error);
}

// =============================================================================
// GLOBAL STATE
// =============================================================================

let currentViewMode = 'pivot';
let lastRecords = null;
let currentConfig = {};
let pivotInitialized = false;
let selectedTableId = null;
let availableTables = [];

// =============================================================================
// GRIST INITIALIZATION
// =============================================================================

grist.ready({
  requiredAccess: 'full',
  allowSelectBy: true
});

// =============================================================================
// TABLE SELECTOR
// =============================================================================

async function loadAvailableTables() {
  try {
    const tables = await grist.docApi.listTables();
    availableTables = tables;
    const select = document.getElementById('table-select');
    if (select) {
      select.innerHTML = '<option value="">' + (currentLang === 'fr' ? '-- Choisir une table --' : '-- Select a table --') + '</option>';
      tables.forEach(tableName => {
        const opt = document.createElement('option');
        opt.value = tableName;
        opt.textContent = tableName;
        if (tableName === selectedTableId) opt.selected = true;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Error loading tables:', e);
  }
}

async function onTableSelect(tableName) {
  if (!tableName) return;
  selectedTableId = tableName;
  console.log('Saving selectedTable:', tableName);
  try {
    await grist.setOption('selectedTable', tableName);
    console.log('selectedTable saved successfully');
  } catch (e) {
    console.error('Error saving selectedTable:', e);
  }
  
  // Show loading
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('pivot-table').innerHTML = '';
  
  try {
    const tableData = await grist.docApi.fetchTable(tableName);
    // Convert column-based data to row-based records
    // Filter out internal Grist columns like 'id' and 'manualSort'
    const columnsToHide = ['id', 'manualSort'];
    const columns = Object.keys(tableData).filter(k => !columnsToHide.includes(k));
    const numRows = tableData.id ? tableData.id.length : 0;
    const records = [];
    for (let i = 0; i < numRows; i++) {
      const record = {};
      columns.forEach(col => {
        record[col] = tableData[col][i];
      });
      records.push(record);
    }
    lastRecords = records;
    renderPivotTable(records);
  } catch (e) {
    console.error('Error fetching table:', e);
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
  }
}

// =============================================================================
// CUSTOM AGGREGATORS
// =============================================================================

function weightedAverage([valAttr, coefAttr]) {
  return function() {
    return {
      values: [],
      push: function(record) {
        const val = record[valAttr];
        const coef = record[coefAttr];
        if (typeof val === 'number' && typeof coef === 'number') {
          this.values.push([val, coef]);
        }
      },
      value: function() {
        if (this.values.length === 0) return null;
        const sumProduct = this.values.reduce((acc, [v, c]) => acc + v * c, 0);
        const sumCoef = this.values.reduce((acc, [, c]) => acc + c, 0);
        return sumCoef !== 0 ? sumProduct / sumCoef : null;
      },
      format: function(x) {
        return x !== null ? x.toFixed(2) : '';
      },
      numInputs: 2
    };
  };
}

// Extend aggregators with French locale and custom ones
$.extend(
  $.pivotUtilities.aggregators,
  $.pivotUtilities.locales.fr.aggregators,
  { 'Moyenne pondérée': weightedAverage }
);

// Extend renderers with export capabilities
$.extend(
  $.pivotUtilities.renderers,
  $.pivotUtilities.locales.fr.renderers,
  $.pivotUtilities.export_renderers
);

// =============================================================================
// VIEW MODE
// =============================================================================

function applyViewMode() {
  const body = document.body;
  const viewSelect = document.getElementById('view-mode-select');
  
  if (currentViewMode === 'fullscreen') {
    body.classList.add('fullscreen-active');
  } else {
    body.classList.remove('fullscreen-active');
  }
  
  if (viewSelect) {
    viewSelect.value = currentViewMode;
  }
}

function exitFullscreen() {
  currentViewMode = 'pivot';
  applyViewMode();
  grist.setOption('viewMode', currentViewMode).catch(console.error);
}

// =============================================================================
// COLUMN SIZE
// =============================================================================

function changeColumnSize(scale) {
  const pivotTable = document.querySelector('.pvtTable');
  if (pivotTable) {
    pivotTable.style.fontSize = (12 * parseFloat(scale)) + 'px';
    const cells = pivotTable.querySelectorAll('th, td');
    cells.forEach(cell => {
      cell.style.padding = (6 * parseFloat(scale)) + 'px ' + (10 * parseFloat(scale)) + 'px';
    });
  }
}

// =============================================================================
// PIVOT TABLE RENDERING
// =============================================================================

function renderPivotTable(records) {
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const pivotTable = document.getElementById('pivot-table');
  
  if (!records || records.length === 0) {
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    pivotTable.innerHTML = '';
    return;
  }
  
  loadingState.classList.add('hidden');
  emptyState.classList.add('hidden');
  
  let firstRefresh = true;
  
  // Check if we have a saved config to restore
  const hasSavedConfig = currentConfig && (currentConfig.rows?.length > 0 || currentConfig.cols?.length > 0 || currentConfig.vals?.length > 0);
  
  $('#pivot-table').pivotUI(
    records,
    {
      rows: currentConfig.rows || [],
      cols: currentConfig.cols || [],
      vals: currentConfig.vals || [],
      aggregatorName: currentConfig.aggregatorName || 'Compte',
      rendererName: currentConfig.rendererName || 'Table',
      
      onRefresh: function(config) {
        if (firstRefresh) {
          firstRefresh = false;
          pivotInitialized = true;
          
          // Apply column size after initial render
          setTimeout(() => {
            const sizeSelect = document.getElementById('column-size-select');
            if (sizeSelect) {
              changeColumnSize(sizeSelect.value);
            }
          }, 100);
          
          return;
        }
        
        // Save configuration
        currentConfig = {
          rows: config.rows,
          cols: config.cols,
          vals: config.vals,
          aggregatorName: config.aggregatorName,
          rendererName: config.rendererName
        };
        
        grist.setOption('pivotConfig', currentConfig).catch(console.error);
        
        // Apply column size after refresh
        setTimeout(() => {
          const sizeSelect = document.getElementById('column-size-select');
          if (sizeSelect) {
            changeColumnSize(sizeSelect.value);
          }
        }, 100);
      }
    },
    true, // overwrite - force apply saved config
    'fr'   // locale
  );
}

// =============================================================================
// RESET & EXPORT
// =============================================================================

function resetConfig() {
  currentConfig = {};
  grist.setOption('pivotConfig', null).catch(console.error);
  
  if (lastRecords) {
    renderPivotTable(lastRecords);
  }
  
  showToast(t('configReset'), 'info');
}

function exportCSV() {
  const table = document.querySelector('.pvtTable');
  if (!table) {
    showToast('Aucun tableau à exporter', 'error');
    return;
  }
  
  let csv = '';
  const rows = table.querySelectorAll('tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    const rowData = [];
    cells.forEach(cell => {
      let text = cell.textContent.trim();
      // Escape quotes and wrap in quotes if contains comma
      if (text.includes(',') || text.includes('"')) {
        text = '"' + text.replace(/"/g, '""') + '"';
      }
      rowData.push(text);
    });
    csv += rowData.join(',') + '\n';
  });
  
  // Download CSV
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'pivot_table_' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  
  showToast(t('exportSuccess'), 'success');
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    z-index: 10000;
    animation: fadeIn 0.3s;
    ${type === 'success' ? 'background: #10b981; color: white;' : ''}
    ${type === 'error' ? 'background: #ef4444; color: white;' : ''}
    ${type === 'info' ? 'background: #0ea5e9; color: white;' : ''}
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
  // View mode selector
  document.getElementById('view-mode-select').addEventListener('change', function() {
    currentViewMode = this.value;
    applyViewMode();
    grist.setOption('viewMode', currentViewMode).catch(console.error);
  });
  
  // Column size selector
  document.getElementById('column-size-select').addEventListener('change', function() {
    const size = this.value;
    changeColumnSize(size);
    grist.setOption('columnSize', size).catch(console.error);
  });
});

// =============================================================================
// GRIST DATA HANDLER
// =============================================================================

// Initialize when Grist is ready
async function initWidget() {
  console.log('initWidget started');
  
  // Load saved options
  try {
    const savedLang = await grist.getOption('language');
    console.log('savedLang:', savedLang);
    if (savedLang) {
      setLanguage(savedLang);
    }
    
    const savedViewMode = await grist.getOption('viewMode');
    if (savedViewMode) {
      currentViewMode = savedViewMode;
      applyViewMode();
    }
    
    const savedColumnSize = await grist.getOption('columnSize');
    if (savedColumnSize) {
      document.getElementById('column-size-select').value = savedColumnSize;
    }
    
    const savedConfig = await grist.getOption('pivotConfig');
    console.log('savedConfig:', savedConfig);
    if (savedConfig) {
      currentConfig = savedConfig;
    }
    
    const savedTable = await grist.getOption('selectedTable');
    console.log('savedTable:', savedTable);
    if (savedTable) {
      selectedTableId = savedTable;
    }
  } catch (e) {
    console.error('Error loading options:', e);
  }
  
  // Load available tables
  await loadAvailableTables();
  console.log('Tables loaded, selectedTableId:', selectedTableId);
  
  // If a table was previously selected, load it
  if (selectedTableId) {
    console.log('Loading saved table:', selectedTableId);
    onTableSelect(selectedTableId);
  } else {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
  }
}

// Also handle onRecords for when user selects table via Grist UI
grist.onRecords(async function(records) {
  if (records && records.length > 0) {
    lastRecords = records;
    renderPivotTable(records);
  }
});

// Start initialization after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initWidget, 500);
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(10px); }
  }
`;
document.head.appendChild(style);
