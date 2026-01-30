#!/usr/bin/env batch
@echo off
REM Quick start script para ADL

echo.
echo ========================================
echo   ADL - Sistema de Experimentos
echo ========================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist "server.js" (
    echo Error: Este script debe ejecutarse desde c:\Users\woire\adl
    echo.
    pause
    exit /b 1
)

REM Mostrar opciones
echo Selecciona cómo iniciar:
echo.
echo 1. npm start (Automático - Recomendado)
echo 2. Node.js solamente
echo 3. Flask solamente
echo 4. Validar sistema
echo 5. Limpiar y reconstruir
echo.

set /p choice="Opción [1-5]: "

if "%choice%"=="1" (
    echo.
    echo Iniciando npm start (Node + Flask)...
    echo.
    call npm start
    goto end
)

if "%choice%"=="2" (
    echo.
    echo Iniciando Node.js...
    call node server.js
    goto end
)

if "%choice%"=="3" (
    echo.
    echo Iniciando Flask...
    call py -3.10 server\app.py
    goto end
)

if "%choice%"=="4" (
    echo.
    echo Validando sistema...
    call node validate-system.js
    goto end
)

if "%choice%"=="5" (
    echo.
    echo Limpiando build...
    if exist "build" (
        rmdir /s /q build
        echo Build limpiado.
    )
    echo Recompilando React...
    call npm run build
    goto end
)

echo Opción inválida.

:end
echo.
pause
