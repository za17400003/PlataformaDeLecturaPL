@echo off
echo ================================================
echo   Iniciando sistema completo RxReading
echo   - Flask (Python 3.10)
echo   - Node.js (server.js)
echo ================================================
echo.

REM === 1) Ir al directorio del proyecto ===
cd /d "C:\Users\CASA\Desktop\Agustin\Tesis\React-Lectura\AsistenteDeLecturaADL"

echo --------------------------------
echo   Iniciando Node.js (server.js)
echo --------------------------------
start "NODE SERVER" cmd /k "cd /d C:\Users\CASA\Desktop\Agustin\Tesis\React-Lectura\AsistenteDeLecturaADL && node server.js"

echo.
echo --------------------------------
echo   Iniciando Flask con Python 3.10
echo --------------------------------
start "FLASK SERVER" cmd /k "cd /d C:\Users\CASA\Desktop\Agustin\Tesis\React-Lectura\AsistenteDeLecturaADL\server && C:\Users\CASA\AppData\Local\Programs\Python\Python310\python.exe app.py"

echo.
echo ================================================
echo   Ambos servidores han sido iniciados correctamente.
echo   Puedes cerrar esta ventana si deseas.
echo ================================================
pause
