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
  
  // Create WebDataRocks pivot with modern theme - start completely empty
  pivot = new WebDataRocks({
    container: '#pivot-container',
    toolbar: true,
    height: '100%',
    width: '100%',
    global: {
      localization: currentLanguage === 'fr' ? 'https://cdn.webdatarocks.com/loc/fr.json' : undefined
    },
    beforetoolbarcreated: function(toolbar) {
      // Remove fullscreen button (not allowed in Grist iframe)
      toolbar.getTabs = function() {
        var tabs = [];
        tabs.push({
          id: "wdr-tab-connect",
          title: "Connecter",
          handler: "connectHandler",
          icon: this.icons.connect
        });
        tabs.push({
          id: "wdr-tab-open",
          title: "Ouvrir",
          handler: "openHandler",
          icon: this.icons.open
        });
        tabs.push({
          id: "wdr-tab-save",
          title: "Sauvegarder",
          handler: "saveHandler",
          icon: this.icons.save
        });
        tabs.push({
          id: "wdr-tab-export",
          title: "Exporter",
          handler: "exportHandler",
          icon: this.icons.export
        });
        tabs.push({ divider: true });
        tabs.push({
          id: "wdr-tab-format",
          title: "Format",
          handler: "formatHandler",
          icon: this.icons.format
        });
        tabs.push({
          id: "wdr-tab-options",
          title: "Options",
          handler: "optionsHandler",
          icon: this.icons.options
        });
        tabs.push({
          id: "wdr-tab-fields",
          title: "Champs",
          handler: "fieldsHandler",
          icon: this.icons.fields
        });
        // Fullscreen removed - not allowed in Grist iframe
        return tabs;
      };
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
  
  // Set data with explicitly empty slice - no auto-detection
  pivot.setReport({
    dataSource: {
      data: data
    },
    slice: {
      rows: [],
      columns: [],
      measures: [],
      reportFilters: [],
      drills: {},
      sorting: {},
      expands: {}
    },
    options: {
      grid: {
        type: 'compact',
        showTotals: 'on',
        showGrandTotals: 'on',
        showHeaders: true
      },
      configuratorActive: true,
      configuratorButton: true,
      showAggregationLabels: true,
      datePattern: 'dd/MM/yyyy',
      showEmptyData: false,
      showDefaultSlice: false
    }
  });
}

function applyCustomTheme() {
  // Apply isaytoo theme colors via CSS injection - softer, more readable
  const style = document.createElement('style');
  style.textContent = `
    /* WebDataRocks isaytoo Theme - Soft & Modern */
    #wdr-pivot-view .wdr-ui-element {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    /* Toolbar */
    #wdr-toolbar {
      background: #ffffff !important;
      border-bottom: 1px solid #e2e8f0 !important;
    }
    #wdr-toolbar .wdr-toolbar-group-content {
      gap: 4px !important;
    }
    #wdr-toolbar .wdr-ui-btn {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      color: #475569 !important;
      transition: all 0.2s ease !important;
    }
    #wdr-toolbar .wdr-ui-btn:hover {
      background: #10b981 !important;
      color: white !important;
      border-color: #10b981 !important;
    }
    
    /* Grid headers - softer green */
    .wdr-header, .wdr-header-r, .wdr-header-c {
      background: #f1f5f9 !important;
      color: #334155 !important;
      font-weight: 600 !important;
      border-bottom: 2px solid #10b981 !important;
    }
    
    /* Totals - soft yellow */
    .wdr-total, .wdr-grand-total {
      background: #fefce8 !important;
      color: #854d0e !important;
      font-weight: 700 !important;
    }
    
    /* Cells */
    .wdr-cell {
      border-color: #f1f5f9 !important;
    }
    .wdr-cell:hover {
      background: #f0fdf4 !important;
    }
    
    /* Configurator popup */
    .wdr-popup {
      border-radius: 12px !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15) !important;
    }
    .wdr-popup-header {
      background: #ffffff !important;
      color: #1e293b !important;
      border-bottom: 1px solid #e2e8f0 !important;
      font-weight: 700 !important;
    }
    .wdr-popup-content {
      background: #ffffff !important;
    }
    .wdr-fields-view-wrap {
      background: #ffffff !important;
    }
    
    /* Fields in configurator */
    .wdr-field {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      margin: 4px !important;
      padding: 8px 12px !important;
      transition: all 0.2s ease !important;
    }
    .wdr-field:hover {
      border-color: #10b981 !important;
      background: #f0fdf4 !important;
    }
    .wdr-field.wdr-checked {
      background: #10b981 !important;
      color: white !important;
      border-color: #059669 !important;
    }
    .wdr-field.wdr-checked:hover {
      background: #059669 !important;
    }
    
    /* Drop zones headers */
    .wdr-fields-section-header {
      background: #f8fafc !important;
      color: #64748b !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      font-size: 10px !important;
      letter-spacing: 0.5px !important;
      padding: 8px 12px !important;
      border-radius: 6px 6px 0 0 !important;
    }
    
    /* Drop zones content */
    .wdr-fields-section-content {
      background: #fafafa !important;
      border: 2px dashed #d1d5db !important;
      border-radius: 0 0 8px 8px !important;
      min-height: 50px !important;
      padding: 8px !important;
    }
    
    /* Buttons */
    .wdr-ui-btn-primary {
      background: #10b981 !important;
      border: none !important;
      border-radius: 8px !important;
      color: white !important;
      font-weight: 600 !important;
      padding: 10px 20px !important;
    }
    .wdr-ui-btn-primary:hover {
      background: #059669 !important;
    }
    .wdr-ui-btn-secondary {
      background: #f1f5f9 !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      color: #475569 !important;
    }
    .wdr-ui-btn-secondary:hover {
      background: #e2e8f0 !important;
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
