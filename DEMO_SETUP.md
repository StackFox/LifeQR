# EHIS Demo Video Setup Guide

## Quick Start (3 Steps)

### Step 1: Start Docker Services
```powershell
cd backend
docker-compose up -d
```

**Verify Qdrant is running:**
```powershell
curl http://localhost:6333/health
# Should return: {"ok":true}
```

### Step 2: Start Backend (Terminal 1)
```powershell
cd backend
npm run dev
```

**Expected output:**
```
EHIS Backend running on port 5000
Available patients: P-12345, P-67890
Routes:
  GET  /api/health
  ...
```

**Verify it's working:**
```powershell
curl http://localhost:5000/api/health
# Should return: {"status":"ok","version":"2.1-tokenized-qr"}
```

### Step 3: Start Frontend (Terminal 2)
```powershell
cd frontend
npm start
```

**Access:**
- Web: `http://localhost:8081`
- Or use Expo Go app on phone

---

## Environment Configuration

### Backend `.env.local`
```env
PORT=5000
NODE_ENV=development
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=optional_secure_key
GEMINI_API_KEY=<your-key>
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env.local`
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
EXPO_DEBUG=false
```

---

## Key Demo Features

### 1. Patient Data
- **Patient 1:** P-12345 (Alice Johnson)
- **Patient 2:** P-67890 (Bob Smith)

### 2. API Endpoints (Local)
- Health: `GET http://localhost:5000/api/health`
- Patients: `GET http://localhost:5000/api/patients`
- QR Generate: `POST http://localhost:5000/api/qr/generate`
- QR Decode: `POST http://localhost:5000/api/qr/decode`
- AI Summary: `POST http://localhost:5000/api/patients/{patientId}/ai-summary`

### 3. Services
- **Backend:** http://localhost:5000
- **Frontend Web:** http://localhost:8081
- **Qdrant Dashboard:** http://localhost:6333/dashboard

---

## Troubleshooting

### Backend won't start
```powershell
# Check port 5000 is not in use
Get-NetTCPConnection -LocalPort 5000 -State Listen
# Kill if needed
Stop-Process -Id <PID> -Force
```

### Qdrant connection error
```powershell
# Ensure docker-compose is running
docker-compose ps
# Check logs
docker-compose logs qdrant
```

### CORS errors
- Verify `FRONTEND_URL` in backend `.env.local`
- Should be `http://localhost:3000` for web or device IP

### Module not found
```powershell
cd backend
npm install
cd ../frontend
npm install
```

---

## Demo Script Ideas

1. **Show Patient Records** - Navigate to patient detail, show QR code
2. **Scan QR Code** - Use QR scanner to decode and display patient info
3. **AI Summary** - Generate AI-powered medical summary
4. **Risk Assessment** - Show emergency risk indicators
5. **Network Sharing** - Demonstrate hospital enrollment sharing
6. **Offline Access** - Show offline patient records (SQLite)
7. **NFC Access** - Demo NFC emergency unlock (if device supports)

---

## Tips for Recording

- Use **Full HD (1080p)** or higher for clarity
- Record at **60fps** for smooth animations
- Close other apps for best performance
- Use `.env.local` to ensure consistent local API responses
- Pre-populate with sample data (already available)

---

## Cleanup After Demo

```powershell
# Stop backend
Ctrl+C

# Stop frontend
Ctrl+C

# Stop Docker services
docker-compose down

# Optional: Clear logs
docker-compose down -v
```
