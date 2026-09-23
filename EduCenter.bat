@echo off
echo ==========================================
echo    Starting Educational Center Project...
echo ==========================================

:: Start Backend
start "EduCenter Backend" cmd /k "cd /d C:\Users\Paragon\Desktop\EduCenter\server && npm run dev"

:: Start Frontend
start "EduCenter Frontend" cmd /k "cd /d C:\Users\Paragon\Desktop\EduCenter\Frontend && npm run dev"

:: Wait for servers
echo Waiting for servers to start...
timeout /t 5 /nobreak >nul

:: Open Frontend
echo Opening browser...
start http://localhost:3000

exit