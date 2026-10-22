@echo off
setlocal
rem This profile applies only to this process and its child server.
set "ZK_MODEL=F22"
set "ZK_IP=192.168.100.201"
set "ZK_PORT=80"
set "ZK_TIMEZONE=Asia/Riyadh"
set "TZ=Asia/Riyadh"
set "EDARA_DATA_DIR=%LOCALAPPDATA%\ZK-Integration-Saudi"
set "EDARA_IMPORT_LEGACY=false"
set "EDARA_SEED_ON_EMPTY=false"
call "%~dp0START_SERVER.bat"
