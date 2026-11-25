@echo off
title TRAINING - Mi Bitacora Personal de Entrenamiento
echo =======================================================
echo     TRAINING - Bitacora y Calendario Personal
echo =======================================================
echo Iniciando servidor en http://localhost:5000 ...
echo Presiona Ctrl + C en esta ventana para detener.
echo.
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py -3 app.py
) else (
    python app.py
)
pause
