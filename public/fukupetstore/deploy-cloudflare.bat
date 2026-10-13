@echo off
REM Fukupetstore - Cloudflare Deploy for Windows
REM Requires: npx wrangler, npx wrangler login

echo === Fukupetstore Cloudflare Deploy (Windows) ===
echo.

echo Step 1: Check wrangler login
call npx wrangler whoami
if errorlevel 1 (
  echo Please login: npx wrangler login
  pause
  exit /b 1
)

echo.
echo Step 2: Create D1 Database
call npx wrangler d1 create fukupetstore-db
echo.
echo ^! IMPORTANT: Copy the database_id from above and paste into wrangler.toml
echo    Replace XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX with real ID
echo    Then press any key to continue...
pause

echo.
echo Step 3: Create R2 Bucket
call npx wrangler r2 bucket create fukupetstore-images
echo.

echo Step 4: Apply Schema
call npx wrangler d1 execute fukupetstore-db --file=./schema-d1.sql --remote
echo.

echo Step 5: Seed Data
call npx wrangler d1 execute fukupetstore-db --file=./seed-d1.sql --remote
echo.

echo Step 6: Deploy (exclude api.php)
if exist api.php (
  move api.php %TEMP%\api.php.bak >nul
  set API_MOVED=1
) else set API_MOVED=0
call npx wrangler deploy
set DEPLOY_STATUS=%ERRORLEVEL%
if "%API_MOVED%"=="1" move %TEMP%\api.php.bak api.php >nul
if %DEPLOY_STATUS% neq 0 exit /b %DEPLOY_STATUS%
echo.
echo Deploy complete! Check URL above.
pause
