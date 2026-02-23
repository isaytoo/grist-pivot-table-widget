/**
 * Grist Pivot Table Widget
 * Copyright 2026 Said Hamadou (isaytoo)
 * Licensed under the Apache License, Version 2.0
 * https://github.com/isaytoo/grist-pivot-table-widget
 */

// =============================================================================
// STATE
// =============================================================================

let pivot = null;
let selectedTableId = null;
let currentLanguage = 'fr';
let lastRecords = null;

// =============================================================================
// TRANSLATIONS
// =============================================================================

const translations = {
  fr: {
    title: 'Tableau Croisé Dynamique',
    selectTable: '-- Choisir une table --',
    loading: 'Chargement des données...',
    noData: 'Aucune donnée',
    noDataDesc: 'Sélectionnez une table source pour commencer à créer votre tableau croisé dynamique.'
  },
  en: {
    title: 'Pivot Table',
    selectTable: '-- Select a table --',
    loading: 'Loading data...',
    noData: 'No data',
    noDataDesc: 'Select a source table to start creating your pivot table.'
  }
};

function t(key) {
  return translations[currentLanguage][key] || key;
}

function setLanguage(lang) {
  currentLanguage = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === lang);
  });
  
  // Update UI texts
  document.querySelector('[data-i18n="title"]').textContent = t('title');
  
  // Save preference
  grist.setOption('language', lang).catch(console.error);
}

// =============================================================================
// GRIST INITIALIZATION
// =============================================================================

grist.ready({
  requiredAccess: 'full',
  columns: []
});

// =============================================================================
// TABLE LOADING
// =============================================================================

async function loadAvailableTables() {
  try {
    const tables = await grist.docApi.listTables();
    const select = document.getElementById('table-select');
    
    // Clear existing options except first
    select.innerHTML = '<option value="">-- Choisir une table --</option>';
    
    tables.forEach(tableName => {
      // Skip hidden tables (starting with _)
      if (!tableName.startsWith('_')) {
        const option = document.createElement('option');
        option.value = tableName;
        option.textContent = tableName;
        if (tableName === selectedTableId) {
          option.selected = true;
        }
        select.appendChild(option);
      }
    });
  } catch (e) {
    console.error('Error loading tables:', e);
  }
}

async function onTableSelect(tableName) {
  if (!tableName) return;
  selectedTableId = tableName;
  
  // Save selection
  try {
    await grist.setOption('selectedTable', tableName);
  } catch (e) {
    console.error('Error saving selectedTable:', e);
  }
  
  // Show loading
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('pivot-container').innerHTML = '';
  
  try {
    const tableData = await grist.docApi.fetchTable(tableName);
    
    // Convert column-based data to row-based records
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
    renderPivotTable(records, columns);
  } catch (e) {
    console.error('Error fetching table:', e);
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
  }
}

// =============================================================================
// WEBDATAROCKS PIVOT TABLE
// =============================================================================

function renderPivotTable(records, columns) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');
  
  if (!records || records.length === 0) {
    document.getElementById('empty-state').classList.remove('hidden');
    return;
  }
  
  // Destroy existing pivot if any
  if (pivot) {
    pivot.dispose();
  }
  
  // Prepare data for WebDataRocks
  const data = records;
  
  // Create WebDataRocks pivot with modern theme
  pivot = new WebDataRocks({
    container: '#pivot-container',
    toolbar: true,
    height: '100%',
    width: '100%',
    report: {
      dataSource: {
        data: data
      },
      slice: {
        rows: [],
        columns: [],
        measures: []
      },
      options: {
        grid: {
          type: 'compact',
          showTotals: 'on',
          showGrandTotals: 'on',
          showHeaders: true
        },
        configuratorActive: false,
        configuratorButton: true,
        showAggregationLabels: true,
        datePattern: 'dd/MM/yyyy',
        showEmptyData: false
      }
    },
    global: {
      localization: currentLanguage === 'fr' ? 'https://cdn.webdatarocks.com/loc/fr.json' : undefined
    },
    reportcomplete: function() {
      // Apply custom theme after render
      applyCustomTheme();
    },
    reportchange: function() {
      // Save configuration when report changes
      saveConfiguration();
    }
  });
}

function applyCustomTheme() {
  // Apply isaytoo theme colors via CSS injection
  const style = document.createElement('style');
  style.textContent = `
    /* WebDataRocks isaytoo Theme */
    #wdr-pivot-view .wdr-ui-element {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    /* Toolbar */
    #wdr-toolbar {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
      border-bottom: 2px solid #0ea5e9 !important;
    }
    #wdr-toolbar .wdr-toolbar-group-content {
      gap: 4px !important;
    }
    #wdr-toolbar .wdr-ui-btn {
      background: white !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      color: #475569 !important;
      transition: all 0.2s ease !important;
    }
    #wdr-toolbar .wdr-ui-btn:hover {
      background: #0ea5e9 !important;
      color: white !important;
      border-color: #0ea5e9 !important;
    }
    
    /* Grid headers */
    .wdr-header, .wdr-header-r, .wdr-header-c {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
      color: white !important;
      font-weight: 600 !important;
    }
    
    /* Totals */
    .wdr-total, .wdr-grand-total {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
      color: #92400e !important;
      font-weight: 700 !important;
    }
    
    /* Cells */
    .wdr-cell {
      border-color: #e2e8f0 !important;
    }
    .wdr-cell:hover {
      background: #f0f9ff !important;
    }
    
    /* Configurator */
    .wdr-popup-header {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
      color: white !important;
    }
    .wdr-fields-view-wrap {
      background: #f8fafc !important;
    }
    .wdr-field {
      background: white !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 6px !important;
      margin: 4px !important;
    }
    .wdr-field:hover {
      border-color: #0ea5e9 !important;
      box-shadow: 0 2px 8px rgba(14, 165, 233, 0.15) !important;
    }
    .wdr-field.wdr-checked {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
      color: white !important;
      border-color: #0284c7 !important;
    }
    
    /* Drop zones */
    .wdr-fields-section-header {
      background: #f1f5f9 !important;
      color: #475569 !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      font-size: 11px !important;
      letter-spacing: 0.5px !important;
    }
    .wdr-fields-section-content {
      background: white !important;
      border: 2px dashed #cbd5e1 !important;
      border-radius: 8px !important;
      min-height: 60px !important;
    }
    .wdr-fields-section-content:empty::before {
      content: "Déposez un champ ici" !important;
      color: #94a3b8 !important;
      font-style: italic !important;
    }
    
    /* Buttons */
    .wdr-ui-btn-primary {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
      border: none !important;
      border-radius: 8px !important;
      color: white !important;
      font-weight: 600 !important;
    }
    .wdr-ui-btn-primary:hover {
      filter: brightness(1.1) !important;
    }
  `;
  document.head.appendChild(style);
}

// =============================================================================
// CONFIGURATION PERSISTENCE
// =============================================================================

async function saveConfiguration() {
  if (!pivot) return;
  
  try {
    const report = pivot.getReport();
    await grist.setOption('pivotConfig', report);
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

async function loadConfiguration() {
  try {
    const savedConfig = await grist.getOption('pivotConfig');
    if (savedConfig && pivot) {
      pivot.setReport(savedConfig);
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function initWidget() {
  // Load saved options
  try {
    const savedLang = await grist.getOption('language');
    if (savedLang) {
      setLanguage(savedLang);
    }
    
    const savedTable = await grist.getOption('selectedTable');
    if (savedTable) {
      selectedTableId = savedTable;
    }
  } catch (e) {
    console.error('Error loading options:', e);
  }
  
  // Load available tables
  await loadAvailableTables();
  
  // If a table was previously selected, load it
  if (selectedTableId) {
    onTableSelect(selectedTableId);
  } else {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
  }
}

// Start initialization after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initWidget, 500);
});
