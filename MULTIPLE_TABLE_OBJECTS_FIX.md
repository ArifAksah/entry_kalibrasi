# Fix Multiple Table Objects Handling

## Problem
Data tabel memiliki struktur array yang berisi multiple objects dengan format `{rows: [...], title: "..."}`. Setiap object dalam array adalah tabel terpisah yang perlu di-render secara individual.

## Data Structure Discovered
```json
[
  {
    "rows": [
      {
        "key": "Range Pengukuran",
        "unit": "g",
        "value": "89"
      },
      {
        "key": "Resolusi",
        "unit": "kg",
        "value": "d"
      },
      {
        "key": "Akurasi",
        "unit": "%",
        "value": "± 0.5"
      },
      {
        "key": "Repeatability",
        "unit": "%",
        "value": "± 0.2"
      },
      {
        "key": "Hysteresis",
        "unit": "%",
        "value": "± 0.3"
      }
    ],
    "title": "Hasil Pengukuran"
  },
  {
    "rows": [
      {
        "key": "Suhu",
        "unit": "°C",
        "value": "20 ± 2"
      },
      {
        "key": "Kelembaban",
        "unit": "% RH",
        "value": "45-75"
      },
      {
        "key": "Tekanan",
        "unit": "hPa",
        "value": "1013.25 ± 10"
      }
    ],
    "title": "Kondisi Kalibrasi"
  }
]
```

## Root Cause
TableRenderer sebelumnya hanya menghandle single table object, tidak menghandle array dari multiple table objects.

## Solution Applied

### 1. Multiple Table Objects Handling
```typescript
{/* Handle multiple table objects */}
{Array.isArray(result.table) ? (
  result.table.map((tableObj: any, index: number) => (
    <TableRenderer key={index} data={tableObj} />
  ))
) : (
  <TableRenderer data={result.table} title="Tabel Kalibrasi" />
)}
```

### 2. Individual Table Rendering
Each table object is rendered separately with its own title:
- Table 1: "Hasil Pengukuran"
- Table 2: "Kondisi Kalibrasi"

## Expected Output

### Table 1: Hasil Pengukuran
```
Hasil Pengukuran
| Parameter      | Nilai   | Satuan |
|----------------|---------|--------|
| Range Pengukuran | 89      | g      |
| Resolusi       | d       | kg     |
| Akurasi        | ± 0.5   | %      |
| Repeatability  | ± 0.2   | %      |
| Hysteresis     | ± 0.3   | %      |
```

### Table 2: Kondisi Kalibrasi
```
Kondisi Kalibrasi
| Parameter  | Nilai      | Satuan |
|------------|------------|--------|
| Suhu       | 20 ± 2     | °C     |
| Kelembaban | 45-75      | % RH   |
| Tekanan    | 1013.25 ± 10 | hPa   |
```

## Implementation Details

### 1. Array Detection
```typescript
Array.isArray(result.table)
```
Checks if the table data is an array of multiple table objects.

### 2. Individual Rendering
```typescript
result.table.map((tableObj: any, index: number) => (
  <TableRenderer key={index} data={tableObj} />
))
```
Maps over each table object and renders it individually.

### 3. Title Extraction
Each table object has its own title that gets extracted by TableRenderer:
- `tableObj.title` → "Hasil Pengukuran"
- `tableObj.title` → "Kondisi Kalibrasi"

## Benefits

### ✅ **Multiple Tables Support**
- Can handle multiple table objects in a single result
- Each table gets its own title and formatting
- Proper separation between different data sets

### ✅ **Flexible Data Structure**
- Supports both single table and multiple tables
- Backward compatible with existing data formats
- Handles various table configurations

### ✅ **Clean Rendering**
- Each table is rendered independently
- Proper spacing between tables
- Consistent styling across all tables

## Data Flow

### Input
```json
[
  {rows: [...], title: "Hasil Pengukuran"},
  {rows: [...], title: "Kondisi Kalibrasi"}
]
```

### Processing
1. Check if `result.table` is array
2. Map over each table object
3. Pass each object to `TableRenderer`
4. `TableRenderer` extracts `rows` and `title`

### Output
- Table 1: "Hasil Pengukuran" with 5 rows
- Table 2: "Kondisi Kalibrasi" with 3 rows

## Testing Scenarios

### Scenario 1: Multiple Tables
```json
[
  {rows: [...], title: "Table 1"},
  {rows: [...], title: "Table 2"}
]
```
**Expected**: Two separate tables rendered

### Scenario 2: Single Table Object
```json
{
  rows: [...],
  title: "Single Table"
}
```
**Expected**: One table rendered

### Scenario 3: Direct Array
```json
[
  {key: "param", value: "val", unit: "unit"}
]
```
**Expected**: One table with provided title

## Future Enhancements

### 1. Table Grouping
```typescript
// Group tables by category
const groupedTables = result.table.reduce((acc, table) => {
  const category = table.category || 'General'
  if (!acc[category]) acc[category] = []
  acc[category].push(table)
  return acc
}, {})
```

### 2. Table Navigation
```typescript
// Add tabs for multiple tables
const [activeTable, setActiveTable] = useState(0)
```

### 3. Table Comparison
```typescript
// Side-by-side table comparison
<div className="grid grid-cols-2 gap-4">
  {result.table.map(table => <TableRenderer data={table} />)}
</div>
```

## Performance Considerations
- Multiple table rendering may impact performance
- Consider lazy loading for large datasets
- Implement memoization for repeated renders
- Use React.memo for TableRenderer component

## Browser Compatibility
- ✅ Array.isArray() widely supported
- ✅ Array.map() universally supported
- ✅ React key prop supported
- ✅ Conditional rendering supported









