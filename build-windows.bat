@echo off
echo.
echo  ============================================
echo   AuraBot — Gerando instalador para Windows
echo  ============================================
echo.

:: Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale em: https://nodejs.org
    pause
    exit /b 1
)

echo [1/5] Instalando dependencias do backend...
cd backend
call npm install
if %errorlevel% neq 0 ( echo [ERRO] Falha ao instalar deps do backend & pause & exit /b 1 )

echo.
echo [2/5] Gerando Prisma client...
call npx prisma generate
if %errorlevel% neq 0 ( echo [ERRO] Falha ao gerar Prisma client & pause & exit /b 1 )

echo.
echo [3/5] Compilando backend (TypeScript)...
call npm run build
if %errorlevel% neq 0 ( echo [ERRO] Falha ao compilar backend & pause & exit /b 1 )

echo.
echo [4/5] Compilando frontend (React)...
cd ..\frontend
call npm install
if %errorlevel% neq 0 ( echo [ERRO] Falha ao instalar deps do frontend & pause & exit /b 1 )
set BUILD_TARGET=electron
call npm run build:electron:win
if %errorlevel% neq 0 ( echo [ERRO] Falha ao compilar frontend & pause & exit /b 1 )

echo.
echo [5/5] Gerando instalador .exe...
cd ..\electron
call npm install
if %errorlevel% neq 0 ( echo [ERRO] Falha ao instalar deps do Electron & pause & exit /b 1 )
call npm run build:win
if %errorlevel% neq 0 ( echo [ERRO] Falha ao gerar instalador & pause & exit /b 1 )

echo.
echo  ============================================
echo   Concluido! O instalador esta em:
echo   electron\dist\AuraBot-Setup-1.0.0.exe
echo  ============================================
echo.
cd ..
explorer electron\dist
pause
