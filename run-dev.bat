@echo off
echo Iniciando servidor con hot-reload usando nodemon...
cd /d "%~dp0"

REM Verificar si node_modules existe
if not exist node_modules (
    echo Instalando dependencias...
    call npm install
)

REM Ejecutar nodemon
node node_modules\nodemon\bin\nodemon.js server.js

pause
