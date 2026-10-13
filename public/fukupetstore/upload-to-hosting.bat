@echo off
setlocal enabledelayedexpansion
title Fukupetstore - Upload changed files to hosting (DB untouched)

REM ============================================================
REM  FTP CREDENTIALS
REM ============================================================
set "FTP_HOST=147.50.254.11"
set "FTP_USER=fukupet"
set "FTP_PASS=ds8c5bImHmb$Se8%%"

REM Files changed in this round (leave the database alone!)
set "FILES=api.php admin.html index.html design.html default_data.json initdatabase.sql style.css patch.js patch2.js"
REM ============================================================

echo ============================================================
echo  Fukupetstore incremental deploy
echo  Host  : %FTP_HOST%
echo  Files : %FILES%
echo  NOTE  : FILES ONLY. The database is NOT modified by this
echo          script. The new nullable column "shipping_carrier"
echo          is added automatically by the app when first needed
echo          (additive, existing rows untouched).
echo ============================================================
echo.
set /p CONFIRM=Type Y to continue: 
if /i not "%CONFIRM%"=="Y" (
  echo Cancelled.
  pause
  exit /b 0
)

if not exist backup_server mkdir backup_server

REM ------------------------------------------------------------
REM  AUTO-DETECT target folder: httpdocs -> public_html -> root
REM ------------------------------------------------------------
set "TARGET_DIR="
set "FOUND=0"

echo [CHECK] Trying folder: /httpdocs/ ...
curl --ftp-pasv -s -S --user "%FTP_USER%:%FTP_PASS%" "ftp://%FTP_HOST%/httpdocs/" >"%TEMP%\ftp_list.txt" 2>&1
findstr /i /c:"api.php" /c:"index.html" "%TEMP%\ftp_list.txt" >nul 2>&1
if not errorlevel 1 (
  set "TARGET_DIR=httpdocs"
  set "FOUND=1"
  goto :found
)

echo [CHECK] Trying folder: /public_html/ ...
curl --ftp-pasv -s -S --user "%FTP_USER%:%FTP_PASS%" "ftp://%FTP_HOST%/public_html/" >"%TEMP%\ftp_list.txt" 2>&1
findstr /i /c:"api.php" /c:"index.html" "%TEMP%\ftp_list.txt" >nul 2>&1
if not errorlevel 1 (
  set "TARGET_DIR=public_html"
  set "FOUND=1"
  goto :found
)

echo [CHECK] Trying FTP home root ...
curl --ftp-pasv -s -S --user "%FTP_USER%:%FTP_PASS%" "ftp://%FTP_HOST%/" >"%TEMP%\ftp_list.txt" 2>&1
findstr /i /c:"api.php" /c:"index.html" "%TEMP%\ftp_list.txt" >nul 2>&1
if not errorlevel 1 (
  set "TARGET_DIR="
  set "FOUND=1"
  goto :found
)

:found
if "%FOUND%"=="0" (
  echo.
  echo [ERROR] Cannot reach the FTP server or cannot find the web root.
  echo         - Check internet / FTP enabled for this hosting
  echo         - If the host requires SFTP, use WinSCP instead
  echo           ^(see DEPLOY-GUIDE.md, section 4^)
  echo.
  echo Last listing attempt:
  type "%TEMP%\ftp_list.txt"
  pause
  exit /b 1
)

if defined TARGET_DIR (
  echo.
  echo [OK] Web root found: /%TARGET_DIR%/
) else (
  echo.
  echo [OK] Web root found: FTP home root
)
echo.

REM ------------------------------------------------------------
REM  BACKUP server copies, then UPLOAD the new files
REM ------------------------------------------------------------
for %%F in (%FILES%) do (
  echo [BACKUP] Downloading server copy of %%F ...
  if defined TARGET_DIR (
    curl --ftp-pasv -s -S --user "%FTP_USER%:%FTP_PASS%" -o "backup_server\%%F" "ftp://%FTP_HOST%/%TARGET_DIR%/%%F"
  ) else (
    curl --ftp-pasv -s -S --user "%FTP_USER%:%FTP_PASS%" -o "backup_server\%%F" "ftp://%FTP_HOST%/%%F"
  )
  if exist "backup_server\%%F" (
    echo          saved to backup_server\%%F
  ) else (
    echo          no previous copy on server ^(new file^).
  )

  echo [UPLOAD] %%F ...
  if defined TARGET_DIR (
    curl --ftp-pasv -S --user "%FTP_USER%:%FTP_PASS%" -T "%%F" "ftp://%FTP_HOST%/%TARGET_DIR%/%%F"
  ) else (
    curl --ftp-pasv -S --user "%FTP_USER%:%FTP_PASS%" -T "%%F" "ftp://%FTP_HOST%/%%F"
  )
  if errorlevel 1 (
    echo          FAILED: %%F  ^(see error above^)
  ) else (
    echo          OK.
  )
  echo.
)

echo ============================================================
echo  DONE.
echo  - Previous server files are backed up in backup_server\
echo  - To roll back: upload those backup copies to the server
echo  - Database: nothing was touched. See DEPLOY-GUIDE.md
echo    section 5 for the (safe, additive) DB notes.
echo ============================================================
pause
