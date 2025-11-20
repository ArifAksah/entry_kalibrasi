# Add Conditional Table/Image Section Based on Station Type

## Problem
User requested to add conditional functionality in the calibration results table form:
- If station type is "geofisika": Show "Tambah Bagian Tabel Baru" (Add New Table Section)
- If station type is NOT "geofisika": Show "Add Gambar dan Caption Gambar" (Add Image and Caption)

## Solution Implemented

### 1. Enhanced ResultItem Type
**Location**: `app/ui/dashboard/certificates-crud.tsx` (line 263-279)

**Before:**
```typescript
type ResultItem = {
  sensorId: number | null
  startDate: string
  endDate: string
  place: string
  environment: KV[]
  table: TableSection[]
  notesForm: { 
    traceable_to_si_through: string; 
    reference_document: string; 
    calibration_methode: string; 
    others: string;
    standardInstruments: number[]
  }
  sensorDetails?: Partial<Sensor>
}
```

**After:**
```typescript
type ResultItem = {
  sensorId: number | null
  startDate: string
  endDate: string
  place: string
  environment: KV[]
  table: TableSection[]
  images: Array<{ url: string; caption: string }>
  notesForm: { 
    traceable_to_si_through: string; 
    reference_document: string; 
    calibration_methode: string; 
    others: string;
    standardInstruments: number[]
  }
  sensorDetails?: Partial<Sensor>
}
```

**New Features:**
- Added `images` field to store array of image objects
- Each image object contains `url` and `caption` fields

### 2. Updated Initial State
**Location**: `app/ui/dashboard/certificates-crud.tsx` (line 281-298)

**Changes:**
- Added `images: []` to initial `results` state
- Added `images: []` to `addResult` function

### 3. Image Management Functions
**Location**: `app/ui/dashboard/certificates-crud.tsx` (line 323-350)

**New Functions:**

#### `addImage(resultIdx: number)`
```typescript
const addImage = (resultIdx: number) => {
  setResults(prev => prev.map((r, i) => 
    i === resultIdx 
      ? { ...r, images: [...r.images, { url: '', caption: '' }] }
      : r
  ))
}
```

#### `removeImage(resultIdx: number, imageIdx: number)`
```typescript
const removeImage = (resultIdx: number, imageIdx: number) => {
  setResults(prev => prev.map((r, i) => 
    i === resultIdx 
      ? { ...r, images: r.images.filter((_, idx) => idx !== imageIdx) }
      : r
  ))
}
```

#### `updateImage(resultIdx: number, imageIdx: number, field: 'url' | 'caption', value: string)`
```typescript
const updateImage = (resultIdx: number, imageIdx: number, field: 'url' | 'caption', value: string) => {
  setResults(prev => prev.map((r, i) => 
    i === resultIdx 
      ? { 
          ...r, 
          images: r.images.map((img, idx) => 
            idx === imageIdx ? { ...img, [field]: value } : img
          )
        }
      : r
  ))
}
```

### 4. Station Type Helper Function
**Location**: `app/ui/dashboard/certificates-crud.tsx` (line 355-360)

```typescript
const getSelectedStationType = () => {
  if (!form.station) return null
  const selectedStation = stations.find(s => s.id === form.station)
  return selectedStation?.type || null
}
```

**Features:**
- Returns the type of currently selected station
- Returns `null` if no station is selected
- Uses the `type` field from Station interface

### 5. Added ImageIcon Component
**Location**: `app/ui/dashboard/certificates-crud.tsx` (line 28-32)

```typescript
const ImageIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
```

### 6. Conditional UI Implementation
**Location**: `app/ui/dashboard/certificates-crud.tsx` (line 1667-1740)

**Conditional Logic:**
```typescript
{getSelectedStationType() === 'geofisika' ? (
  // Show "Tambah Bagian Tabel Baru" button
  <button onClick={() => setTableDraft(prev => [...prev, { title: '', rows: [{ key: '', unit: '', value: '' }] }])}>
    <PlusIcon className="w-4 h-4" />
    Tambah Bagian Tabel Baru
  </button>
) : (
  // Show Image and Caption section
  <div className="space-y-3">
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Gambar dan Caption</h4>
        <button onClick={() => addImage(tableEditIndex)}>
          <ImageIcon className="w-3 h-3" />
          <span>Tambah Gambar</span>
        </button>
      </div>
      // Image management UI...
    </div>
  </div>
)}
```

### 7. Image Management UI Features

#### Add Image Button:
- **Icon**: ImageIcon with proper styling
- **Color**: Blue theme matching existing design
- **Functionality**: Calls `addImage(tableEditIndex)`

#### Image List Display:
- **Dynamic Rendering**: Maps through `results[tableEditIndex]?.images`
- **Numbering**: Shows "Gambar #1", "Gambar #2", etc.
- **Delete Button**: Red trash icon for each image

#### Image Form Fields:
- **URL Input**: 
  - Type: `url` for proper validation
  - Placeholder: "https://example.com/image.jpg"
  - Styling: Consistent with existing form inputs

- **Caption Textarea**:
  - Placeholder: "Deskripsi gambar..."
  - Rows: 2 for compact display
  - Styling: Consistent with existing form inputs

#### Empty State:
- **Message**: "Belum ada gambar yang ditambahkan"
- **Styling**: Centered, gray text
- **Condition**: Shows when no images exist

### 8. Visual Design Features

#### Consistent Styling:
- **Border**: `border-gray-200` for consistency
- **Background**: `bg-white` and `bg-gray-50` alternating
- **Rounded Corners**: `rounded-lg` for modern look
- **Shadow**: `shadow-sm` for depth

#### Interactive Elements:
- **Hover Effects**: Blue theme on buttons
- **Focus States**: Blue ring on form inputs
- **Transitions**: Smooth `transition-all duration-200`

#### Color Scheme:
- **Primary**: Blue theme (`#1e377c`, `#2a4a9d`)
- **Destructive**: Red theme for delete buttons
- **Neutral**: Gray theme for labels and placeholders

## Key Features

### Conditional Display:
- ✅ **Station Type Detection**: Automatically detects selected station type
- ✅ **Dynamic UI**: Shows different UI based on station type
- ✅ **Geofisika**: Shows "Tambah Bagian Tabel Baru" button
- ✅ **Other Types**: Shows "Gambar dan Caption" section

### Image Management:
- ✅ **Add Images**: Dynamic addition of image entries
- ✅ **Remove Images**: Individual image deletion
- ✅ **Edit Images**: URL and caption editing
- ✅ **Empty State**: Clear indication when no images

### Data Persistence:
- ✅ **State Management**: Proper React state updates
- ✅ **Form Integration**: Images saved with certificate data
- ✅ **Type Safety**: TypeScript interfaces for data structure

### User Experience:
- ✅ **Intuitive Interface**: Clear labels and placeholders
- ✅ **Visual Feedback**: Hover and focus states
- ✅ **Consistent Design**: Matches existing UI patterns
- ✅ **Responsive Layout**: Works on different screen sizes

## Testing Scenarios

1. **Station Type "geofisika"**:
   - Select a station with type "geofisika"
   - Open calibration results table
   - Verify "Tambah Bagian Tabel Baru" button appears
   - Verify image section is hidden

2. **Station Type "other"**:
   - Select a station with different type
   - Open calibration results table
   - Verify "Gambar dan Caption" section appears
   - Verify table button is hidden

3. **Image Management**:
   - Add multiple images
   - Edit URL and caption fields
   - Delete individual images
   - Verify empty state when no images

4. **Data Persistence**:
   - Add images and submit form
   - Verify images are saved
   - Reopen form and verify images are loaded

5. **No Station Selected**:
   - Don't select any station
   - Verify default behavior (likely shows image section)

## Result

The calibration results table form now supports:
- ✅ **Conditional UI**: Different interface based on station type
- ✅ **Image Management**: Add, edit, and remove images with captions
- ✅ **Data Persistence**: Images saved with certificate data
- ✅ **Type Safety**: Proper TypeScript interfaces
- ✅ **Consistent Design**: Matches existing UI patterns

Users can now:
- Add multiple table sections for "geofisika" stations
- Add multiple images with captions for other station types
- Manage images dynamically with proper validation
- Save all data including images with the certificate















