# API Documentation - Entry Kalibrasi

Base URL: `/api`

## Authentication

Login menggunakan Supabase Auth client-side (bukan endpoint API custom):

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})
// data.session.access_token → digunakan sebagai Bearer token
```

### Logout
```javascript
await supabase.auth.signOut()
```

### Get Current Session
```javascript
const { data: { session } } = await supabase.auth.getSession()
```

### Get Current User
```javascript
const { data: { user } } = await supabase.auth.getUser()
```

---

## Core Endpoints

### Stations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stations` | List with pagination (q, page, pageSize, user_id) |
| GET | `/api/stations/all` | Get all stations |
| POST | `/api/stations` | Create (Auth: Bearer) |
| PUT | `/api/stations/:id` | Update (Auth: Bearer) |
| DELETE | `/api/stations/:id` | Delete (Auth: Bearer) |

### Personel
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personel` | List all personnel with roles |
| GET | `/api/personel/:id` | Get personel by ID |
| POST | `/api/personel` | Create personel |
| PUT | `/api/personel/:id` | Update personel |
| DELETE | `/api/personel/:id` | Delete personel |
| POST | `/api/personel/register` | Register new user with auto station assign |

### Instruments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instruments` | List (q, type: standard/uut, user_id) |
| POST | `/api/instruments` | Create |
| PUT | `/api/instruments/:id` | Update |
| DELETE | `/api/instruments/:id` | Delete |
| GET | `/api/instrument-names` | List instrument names |
| POST | `/api/instrument-names` | Create instrument name |
| PUT | `/api/instrument-names/:id` | Update instrument name |
| DELETE | `/api/instrument-names/:id` | Delete instrument name |

### Sensors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sensors` | List with pagination |
| POST | `/api/sensors` | Create |
| PUT | `/api/sensors/:id` | Update |
| DELETE | `/api/sensors/:id` | Delete |
| GET | `/api/sensor-names` | List sensor names |
| POST | `/api/sensor-names` | Create sensor name |
| PUT | `/api/sensor-names/:id` | Update sensor name |
| DELETE | `/api/sensor-names/:id` | Delete sensor name |

### Certificates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/certificates` | List with verification status |
| POST | `/api/certificates` | Create (Auth: Bearer, Role: calibrator/admin) |
| GET | `/api/certificates/:id` | Get by ID |
| PUT | `/api/certificates/:id` | Update |
| DELETE | `/api/certificates/:id` | Delete |

### Calibration Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calibration-sessions` | List (station_id) |
| POST | `/api/calibration-sessions` | Create |
| PUT | `/api/calibration-sessions` | Update (requires session_id) |

### Raw Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/raw-data` | List (session_id, certificate_id) |
| POST | `/api/raw-data` | Insert multiple rows |

### User Roles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user-roles` | Get (user_id) |
| PUT | `/api/user-roles` | Upsert role |

### User Stations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user-stations` | Get assignments |
| POST | `/api/user-stations` | Assign stations (Admin only) |

### Master QC
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/master-qc` | List |
| POST | `/api/master-qc` | Create |
| PUT | `/api/master-qc/:id` | Update |
| DELETE | `/api/master-qc/:id` | Delete |

### Units
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/units` | List |
| POST | `/api/units` | Create |
| PUT | `/api/units/:id` | Update |
| DELETE | `/api/units/:id` | Delete |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup-simple` | Register user |
| POST | `/api/auth/forgot-password` | Request reset |
| POST | `/api/auth/reset-password` | Reset password |

## Request Examples

### Create Station
```json
POST /api/stations
Authorization: Bearer <token>
{
  "name": "Station Name",
  "address": "Address",
  "time_zone": "UTC+07:00",
  "region": "Region",
  "province": "Province",
  "regency": "Regency",
  "type": "AWS"
}
```

### Create Certificate
```json
POST /api/certificates
Authorization: Bearer <token>
{
  "no_identification": "ID-001",
  "issue_date": "2024-01-01",
  "instrument_code": "AWS",
  "certificate_type": "sert",
  "calibration_place": "FC"
}
```

### Assign User to Stations
```json
POST /api/user-stations
{
  "user_id": "uuid",
  "station_ids": [1, 2, 3]
}
```

### Create Raw Data
```json
POST /api/raw-data
{
  "session_id": 1,
  "rows": [{
    "sheet_name": "Sheet1",
    "point_uut": 10,
    "point_std": 10.1,
    "unit_uut": "°C",
    "unit_std": "°C"
  }]
}
```
