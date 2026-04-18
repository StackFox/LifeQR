#!/usr/bin/env pwsh

$BASE_URL = "http://localhost:5001"

Write-Host "🧪 EHIS Backend Clean - Endpoint Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Health
Write-Host "1️⃣  Health Endpoint" -ForegroundColor Yellow
try {
  $resp = Invoke-WebRequest -Uri "$BASE_URL/api/health" -UseBasicParsing
  Write-Host "   Status: $($resp.StatusCode) ✅" -ForegroundColor Green
  Write-Host "   Response: $($resp.Content)"
} catch {
  Write-Host "   ERROR: $_" -ForegroundColor Red
}

# Test 2: Create Access Request
Write-Host "`n2️⃣  Create Access Request" -ForegroundColor Yellow
try {
  $body = @{
    patientId = "P-12345"
    doctorId = "DOC-001"
  } | ConvertTo-Json

  $resp = Invoke-WebRequest -Uri "$BASE_URL/api/access-requests" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing
  
  $data = $resp.Content | ConvertFrom-Json
  $requestId = $data.requestId
  
  Write-Host "   Status: $($resp.StatusCode) ✅" -ForegroundColor Green
  Write-Host "   Request ID: $requestId"
  Write-Host "   Response: $($resp.Content)"
} catch {
  Write-Host "   ERROR: $_" -ForegroundColor Red
  $requestId = $null
}

# Test 3: Get Patient Notifications
Write-Host "`n3️⃣  Get Patient Notifications" -ForegroundColor Yellow
try {
  $resp = Invoke-WebRequest -Uri "$BASE_URL/api/notifications/P-12345?role=PATIENT" -UseBasicParsing
  Write-Host "   Status: $($resp.StatusCode) ✅" -ForegroundColor Green
  $data = $resp.Content | ConvertFrom-Json
  Write-Host "   Count: $($data.count)"
  Write-Host "   Response: $($resp.Content)"
} catch {
  Write-Host "   ERROR: $_" -ForegroundColor Red
}

# Test 4: Get Doctor Notifications
Write-Host "`n4️⃣  Get Doctor Notifications" -ForegroundColor Yellow
try {
  $resp = Invoke-WebRequest -Uri "$BASE_URL/api/notifications/DOC-001?role=DOCTOR" -UseBasicParsing
  Write-Host "   Status: $($resp.StatusCode) ✅" -ForegroundColor Green
  $data = $resp.Content | ConvertFrom-Json
  Write-Host "   Count: $($data.count)"
  Write-Host "   Response: $($resp.Content)"
} catch {
  Write-Host "   ERROR: $_" -ForegroundColor Red
}

# Test 5: Get Access Requests for Patient
Write-Host "`n5️⃣  Get Access Requests (Patient)" -ForegroundColor Yellow
try {
  $resp = Invoke-WebRequest -Uri "$BASE_URL/api/access-requests/patient/P-12345" -UseBasicParsing
  Write-Host "   Status: $($resp.StatusCode) ✅" -ForegroundColor Green
  $data = $resp.Content | ConvertFrom-Json
  Write-Host "   Count: $($data.count)"
  Write-Host "   Response: $($resp.Content)"
} catch {
  Write-Host "   ERROR: $_" -ForegroundColor Red
}

# Test 6: Approve Access Request (if we have a request ID)
if ($requestId) {
  Write-Host "`n6️⃣  Approve Access Request" -ForegroundColor Yellow
  try {
    $resp = Invoke-WebRequest -Uri "$BASE_URL/api/access-requests/$requestId/approve" `
      -Method PUT `
      -UseBasicParsing
    Write-Host "   Status: $($resp.StatusCode) ✅" -ForegroundColor Green
    Write-Host "   Response: $($resp.Content)"
  } catch {
    Write-Host "   ERROR: $_" -ForegroundColor Red
  }
  
  # Test 7: Check notifications after approval
  Write-Host "`n7️⃣  Check Patient Notifications After Approval" -ForegroundColor Yellow
  try {
    $resp = Invoke-WebRequest -Uri "$BASE_URL/api/notifications/P-12345?role=PATIENT" -UseBasicParsing
    Write-Host "   Status: $($resp.StatusCode) ✅" -ForegroundColor Green
    $data = $resp.Content | ConvertFrom-Json
    Write-Host "   Count: $($data.count)"
    Write-Host "   Response: $($resp.Content)"
  } catch {
    Write-Host "   ERROR: $_" -ForegroundColor Red
  }
}

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
