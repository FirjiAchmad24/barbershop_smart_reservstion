@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\Wbem;%PATH%"

if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%~dp0.runtime\node\node.exe" set "PATH=%~dp0.runtime\node;%PATH%"

if /I "%~1"=="--help" goto :help
set "INSTALL_ONLY=0"
if /I "%~1"=="--install-only" set "INSTALL_ONLY=1"

title Setup Pangkas Rambut Anda
echo.
echo =====================================================
echo   Setup Pangkas Rambut Anda
echo =====================================================
echo.

call :ensure_node
if not "!ERRORLEVEL!"=="0" goto :failed

if not exist "package-lock.json" (
  echo [ERROR] package-lock.json tidak ditemukan.
  goto :failed
)

echo Menghentikan proses development lama jika masih aktif...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-project-processes-windows.ps1"
if not "!ERRORLEVEL!"=="0" goto :failed

echo [1/4] Memasang dependency aplikasi...
if exist "node_modules\.package-lock.json" (
  echo       Instalasi lama ditemukan, memperbarui dependency secara inkremental...
  call npm install --no-audit --no-fund
) else (
  echo       Instalasi baru, memasang dependency dari lockfile...
  call npm ci
)
set "NPM_INSTALL_EXIT=!ERRORLEVEL!"
if not "!NPM_INSTALL_EXIT!"=="0" (
  echo.
  echo Instalasi dependency gagal dengan kode !NPM_INSTALL_EXIT!. Mencoba pemulihan...
  call npm install --no-audit --no-fund
  set "NPM_RECOVERY_EXIT=!ERRORLEVEL!"
  if not "!NPM_RECOVERY_EXIT!"=="0" goto :failed
)

echo [2/4] Menyiapkan konfigurasi environment...
if not exist ".env" (
  node --input-type=commonjs -e "const fs=require('node:fs');const crypto=require('node:crypto');const source=fs.readFileSync('.env.example','utf8');const value=source.replace('ganti-dengan-secret-acak-yang-panjang',crypto.randomBytes(48).toString('hex'));fs.writeFileSync('.env',value);"
  if not "!ERRORLEVEL!"=="0" goto :failed
  echo       File .env dibuat dengan JWT_SECRET acak.
) else (
  echo       File .env sudah ada, konfigurasi dipertahankan.
)

echo [3/4] Menjalankan pengujian...
call npm test
if not "!ERRORLEVEL!"=="0" goto :failed

echo [4/4] Membuat build production...
call npm run build
if not "!ERRORLEVEL!"=="0" goto :failed

echo.
echo =====================================================
echo   Instalasi selesai tanpa error.
echo =====================================================
echo.

if "%INSTALL_ONLY%"=="1" (
  echo Jalankan npm run dev saat ingin membuka aplikasi.
  exit /b 0
)

echo Website akan tersedia di http://localhost:5173
echo API akan tersedia di http://127.0.0.1:3001
echo Tekan Ctrl+C untuk menghentikan aplikasi.
echo.
call npm run dev
exit /b %ERRORLEVEL%

:ensure_node
echo Memeriksa Node.js dan npm...
where node >nul 2>&1
if errorlevel 1 goto :install_node

for /f "delims=" %%V in ('node -p "Number(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto :install_node
if !NODE_MAJOR! LSS 22 (
  echo Node.js !NODE_MAJOR! ditemukan, tetapi versi minimum adalah 22.
  goto :install_node
)

where npm >nul 2>&1
if errorlevel 1 goto :install_node
echo Node.js:
node --version
echo npm:
call npm --version
exit /b 0

:install_node
echo Node.js 22+ belum tersedia.
echo Mengunduh Node.js LTS portable resmi dari nodejs.org...
set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%POWERSHELL_EXE%" (
  echo [ERROR] Windows PowerShell tidak tersedia.
  echo Pasang Node.js 22+ dari https://nodejs.org lalu jalankan setup.cmd kembali.
  exit /b 1
)

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-node-windows.ps1"
if not "!ERRORLEVEL!"=="0" exit /b 1
set "PATH=%~dp0.runtime\node;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js portable selesai diunduh tetapi tidak dapat dijalankan.
  exit /b 1
)

for /f "delims=" %%V in ('node -p "Number(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo [ERROR] Versi Node.js tidak dapat diperiksa.
  exit /b 1
)
if !NODE_MAJOR! LSS 22 (
  echo [ERROR] Node.js 22+ diperlukan. Versi aktif masih:
  node --version
  exit /b 1
)
exit /b 0

:help
echo Penggunaan:
echo   setup.cmd                 Instalasi, verifikasi, lalu jalankan aplikasi
echo   setup.cmd --install-only  Instalasi dan verifikasi tanpa menjalankan aplikasi
echo   setup.cmd --help          Tampilkan bantuan
exit /b 0

:failed
echo.
echo [GAGAL] Setup belum selesai. Periksa pesan error di atas.
pause
exit /b 1
