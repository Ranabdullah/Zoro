@echo off
cd /d "%~dp0"
echo Kora local preview: http://127.0.0.1:4173
echo Keep this window open while using the preview.
call npm start
pause
