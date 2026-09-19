@echo off
echo ==========================================
echo    Starting Educational Center Project...
echo ==========================================

:: 1. تشغيل السيرفر (Backend) في نافذة مستقلة
:: (عدل مسار مجلد الـ backend حسب مكان وجوده لديك)
start cmd /k "cd /d E:\projects\EduCenter\server && npm run dev"

:: 2. تشغيل الفرونت إند (Next.js) في نافذة مستقلة
start cmd /k "cd /d E:\projects\EduCenter\Frontend && npm run dev"

:: 3. الانتظار لمدة 5 ثوانٍ حتى يعمل السيرفر بكفاءة
echo Waiting for servers to start...
timeout /t 5 /nobreak > nul

:: 4. فتح المتصفح تلقائياً على رابط المشروع المحلي
echo Opening browser...
start http://localhost:3000

exit
