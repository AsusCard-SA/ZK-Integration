# دليل نشر التطبيق على السيرفر (192.168.1.177)
# Publishing Guide to Windows Server (192.168.1.177)

تم تجهيز التطبيق ليعمل كـ **حزمة إنتاجية موحدة (Unified Production App)** حيث يقوم السيرفر الخلفي (Backend) بتقديم الواجهة الأمامية (Frontend) والـ API في وقت واحد عبر منفذ واحد (**Port 5000**).

---

## 🎯 المتطلبات على السيرفر (192.168.1.177)
1. **Node.js**: تثبيت Node.js (الإصدار v18 أو أحدث) من [nodejs.org](https://nodejs.org).

---

## 🚀 خطوات النشر (طريقتان):

### الطريقة الأولى: عبر سطح المكتب البعيد (Remote Desktop - RDP) - *الأسهل*
1. افتح **Remote Desktop Connection (mstsc)** من جهازك واتصل بالسيرفر `192.168.1.177`.
2. انسخ مجلد المشروع بالكامل `ZK - Integration` والصقه في السيرفر (مثلاً داخل `C:\ZK - Integration`).
3. افتح المجلد على السيرفر واضغط مرتين على الملف:
   ```cmd
   START_SERVER.bat
   ```
4. سيبدأ السيرفر ويعمل تلقائياً، وسيقوم بالجدولة اليومية وإتاحة لوحة التحكم.

---

### الطريقة الثانية: تشغيل التطبيق كخدمة دائمة في الخلفية عبر PM2 (موصى بها للإنتاج)
على السيرفر `192.168.1.177`، افتح موجه الأوامر (Command Prompt كمسؤول):

```cmd
# 1. تثبيت مدير العمليات PM2 عالمياً
npm install -g pm2

# 2. الدخول لمجلد backend
cd C:\ZK - Integration\backend

# 3. تشغيل السيرفر
pm2 start src/server.js --name "zk-app"

# 4. جعل السيرفر يعمل تلقائياً عند إعادة تشغيل الويندوز
pm2 save
pm2 startup
```

---

## 🌐 فتح جدار الحماية (Firewall) على السيرفر 192.168.1.177
ليتمكن باقي الموظفين في الشبكة من فتح لوحة التحكم، نفذ هذا الأمر في **PowerShell (Run as Administrator)** على السيرفر `192.168.1.177`:

```powershell


---

## 🔗 روابط الوصول بعد النشر:
- **لوحة التحكم للمستخدمين**: `http://192.168.1.177`
- **واجهة الـ API**: `http://192.168.1.177/api`

---

## 🔐 Edara server configuration & credentials (Production)

Edara destination servers (including API keys) are stored in `edaraServers.json`, which is **not** in Git.

1. **Before pulling this version on the server**, back up `backend\data\edaraServers.json`
   (the commit removes it from Git tracking, so `git pull` deletes the tracked copy).
2. Create a data directory outside the checkout, e.g. `C:\ProgramData\ZK-Integration`, and grant
   only the app's service account (and Administrators) access:
   ```cmd
   icacls "C:\ProgramData\ZK-Integration" /inheritance:r /grant:r "<APP_USER>:(OI)(CI)M" "Administrators:(OI)(CI)F"
   ```
3. Set `EDARA_DATA_DIR=C:\ProgramData\ZK-Integration` in `backend\.env` (or the PM2 environment).
   On first start, an existing `backend\data\edaraServers.json` is **copied** (never overwritten) into it.
4. Optional `EDARA_API_URL` / `EDARA_API_KEY` only seed the primary server when no config file exists.
5. API keys are never returned by the API; leaving the key blank when editing keeps the stored key.
6. New destinations are created **disabled** and excluded from scheduled sync until enabled
   (per-server "Include in scheduled auto-sync" flag).
