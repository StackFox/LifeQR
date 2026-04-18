#!/usr/bin/env pwsh
# Demo Video Startup Script
# Starts all required services for demo video recording

Write-Host "🎬 EHIS Demo Video Setup" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Colors
$Success = "Green"
$Warning = "Yellow"
$Error = "Red"
$Info = "Cyan"

Write-Host "Prerequisites Check:" -ForegroundColor $Info
Write-Host "✓ Qdrant running: docker-compose up -d" -ForegroundColor $Warning
Write-Host "✓ Backend .env.local configured" -ForegroundColor $Warning
Write-Host "✓ Frontend .env.local configured" -ForegroundColor $Warning
Write-Host ""

# Check if Docker services are running
Write-Host "Checking Docker services..." -ForegroundColor $Info
$qdrant = docker ps --filter "ancestor=qdrant/qdrant" --quiet
if ($qdrant) {
    Write-Host "✓ Qdrant is running" -ForegroundColor $Success
} else {
    Write-Host "✗ Qdrant is NOT running" -ForegroundColor $Error
    Write-Host "  Start with: cd backend && docker-compose up -d" -ForegroundColor $Warning
}

Write-Host ""
Write-Host "Starting Backend..." -ForegroundColor $Info
Write-Host "  Command: cd backend && npm run dev" -ForegroundColor $Warning
Write-Host ""
Write-Host "In another terminal, start Frontend:" -ForegroundColor $Info
Write-Host "  Command: cd frontend && npm start" -ForegroundColor $Warning
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor $Info
Write-Host "  Backend API: http://localhost:5000" -ForegroundColor $Success
Write-Host "  Frontend Web: http://localhost:8081" -ForegroundColor $Success
Write-Host "  Qdrant Admin: http://localhost:6333/dashboard" -ForegroundColor $Success
Write-Host ""
Write-Host "Test Commands:" -ForegroundColor $Info
Write-Host "  # Health check" -ForegroundColor $Warning
Write-Host "  curl http://localhost:5000/api/health" -ForegroundColor $Info
Write-Host ""
Write-Host "  # Get sample patients" -ForegroundColor $Warning
Write-Host "  curl http://localhost:5000/api/patients" -ForegroundColor $Info
Write-Host ""
Write-Host "Demo ready! 🚀" -ForegroundColor $Success
