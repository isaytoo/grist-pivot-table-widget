# Grist Pivot Table Widget

A powerful Pivot Table (Tableau Croisé Dynamique) widget for Grist, inspired by Excel's pivot tables.

## Features

- 📊 **Drag & Drop Interface** - Easily drag fields to rows, columns, and values
- 🔢 **Multiple Aggregators** - Sum, Count, Average, Min, Max, Weighted Average, etc.
- 🌍 **Bilingual** - French and English support
- 💾 **Auto-save Configuration** - Your pivot table configuration is automatically saved
- 📱 **Fullscreen Mode** - View your pivot table in fullscreen
- 📥 **CSV Export** - Export your pivot table to CSV
- 🎨 **Modern Design** - Clean, modern UI with isaytoo styling

## Installation

### In Grist

1. Add a Custom Widget to your page
2. Set the URL to: `https://isaytoo.github.io/grist-pivot-table-widget/`
3. Select your source table
4. Grant "Read table" access

### Local Development

```bash
# Clone the repository
git clone https://github.com/isaytoo/grist-pivot-table-widget.git
cd grist-pivot-table-widget

# Serve locally (using any static server)
npx serve .
# or
python -m http.server 8000
```

## Usage

1. **Select columns** - Drag columns from the "Available Fields" area
2. **Build your pivot** - Drop columns into Rows, Columns, or Values areas
3. **Choose aggregation** - Select how to aggregate values (Sum, Count, Average, etc.)
4. **Customize view** - Adjust column size, switch to fullscreen, or export to CSV

## Configuration Options

| Option | Description |
|--------|-------------|
| View Mode | Normal pivot view or fullscreen |
| Column Size | Adjust the size of table columns |
| Reset | Clear all configuration and start fresh |
| Export CSV | Download the pivot table as CSV |

## Technologies

- [PivotTable.js](https://pivottable.js.org/) - Core pivot table functionality
- [jQuery UI](https://jqueryui.com/) - Drag & drop support
- [Grist Plugin API](https://support.getgrist.com/widget-custom/) - Grist integration

## License

Apache License 2.0

## Author

Said Hamadou (isaytoo) - [gristup.fr](https://gristup.fr)
