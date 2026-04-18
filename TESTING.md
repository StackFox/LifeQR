# LifeQR App - Testing Guide

## Feature Testing

All fixes implemented:
1. ✅ **PDF Vector DB (Qdrant)** - Uses embedding-001 model, proper error handling
2. ✅ **AI Summaries** - Calls buildMedicalSummary() for real summaries in QR generation
3. ✅ **Role-Separated Notifications** - Patient & Doctor notifications isolated by role
4. ✅ **Access Requests** - Doctors can request, patients approve/reject with notifications

## Quick Start

**Terminal 1 - Backend:**
```bash
cd backend
node src/index.js
# Should see: EHIS Backend v2.0 running on port 5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npx expo start -c
# Scan QR or press 'w' for web
```

## Testing Endpoints

### 1. Test PDF Upload & Qdrant Embedding

```bash
# Generate a test PDF (or use real one)
curl -X POST \
  -F "record=@test.pdf" \
  http://localhost:5000/api/patients/P-12345/upload-records

# Expected: Qdrant vector created, notification sent to patient
```

### 2. Test AI Summary Generation

```bash
# Generate offline QR (includes AI summary)
curl -X POST http://localhost:5000/api/qr/generate \
  -H "Content-Type: application/json" \
  -d '{"patientId":"P-67890"}'

# Check response: medicalSummary should have real data
```

### 3. Test Role-Separated Notifications

```bash
# Get PATIENT notifications only
curl http://localhost:5000/api/notifications/P-12345/PATIENT

# Get DOCTOR notifications only
curl http://localhost:5000/api/notifications/DOC-001/DOCTOR

# Response format: { notifications: [], unreadCount: 0 }
```

### 4. Test Access Requests

```bash
# Doctor requests patient data
curl -X POST http://localhost:5000/api/access-requests \
  -H "Content-Type: application/json" \
  -d '{"patientId":"P-12345","doctorId":"DOC-001","reason":"Emergency checkup"}'

# Patient approves
curl -X PUT http://localhost:5000/api/access-requests/<requestId>/approve

# Or reject
curl -X PUT http://localhost:5000/api/access-requests/<requestId>/reject

# Patient sees notifications on /api/notifications/P-12345/PATIENT
```

## Frontend Testing

1. **Dashboard** → Click "Generate Offline QR" → Check for AI summary in QR payload
2. **Upload PDF** → Check patient notifications
3. **Access QR Data** → Notifications sent to both patient & doctor
4. **Notifications Screen** → Tab to view role-specific notifications & access requests

## Logs to Monitor

Backend logs will show:
- ✅ `Generated vector dimension: 768` (or similar)
- ✅ `Created Qdrant collection: patient_records`
- ✅ `Vector uploaded to Qdrant successfully`
- ✅ Notification creation for role-specific users
