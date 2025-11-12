@echo off
REM 🚀 Script de Setup Automático - Clínica ETEMFL (Windows)

setlocal enabledelayedexpansion

echo.
echo ================================
echo.  CLINICA ETEMFL - Setup
echo ================================
echo.

REM Passo 1: Verificar Node.js
echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js nao encontrado!
    echo Baixe em: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js encontrado: %NODE_VERSION%
echo.

REM Passo 2: Instalar dependências
echo [2/4] Instalando dependências npm...
call npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências!
    pause
    exit /b 1
)
echo ✓ Dependências instaladas
echo.

REM Passo 3: Verificar/Criar .env
echo [3/4] Configurando .env...
if not exist .env (
    if exist .env.example (
        copy .env.example .env
        echo ⚠️  .env criado com valores de exemplo!
        echo    Edite .env com suas credenciais do MySQL
    ) else (
        (
            echo DB_HOST=localhost
            echo DB_USER=root
            echo DB_PASSWORD=Emo071427
            echo DB_NAME=clinica_db
            echo PORT=3000
            echo NODE_ENV=development
            echo API_SECRET=seu_secret_super_seguro_aqui
        ) > .env
        echo ⚠️  .env criado com valores padrao!
    )
) else (
    echo ✓ .env ja existe
)
echo.

REM Passo 4: Inicializar banco de dados
echo [4/4] Inicializando banco de dados...
call npm run init-db
if errorlevel 1 (
    echo ❌ Erro ao inicializar banco!
    echo.
    echo Verifique:
    echo   1. MySQL esta rodando?
    echo   2. Credenciais em .env estao corretas?
    pause
    exit /b 1
)

echo.
echo ================================
echo ✅ SETUP COMPLETO!
echo ================================
echo.
echo Proximos passos:
echo.
echo   npm run dev
echo   Inicia o servidor com nodemon (desenvolvimento)
echo.
echo   http://localhost:3000/gestor/index.html
echo   Acesse a interface do gestor
echo.
echo   http://localhost:3000/usuario/index.html
echo   Acesse a interface do usuario
echo.
echo ================================
echo.
pause
