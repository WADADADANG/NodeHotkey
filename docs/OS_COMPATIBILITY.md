# 💻 การรองรับระบบปฏิบัติการ (Operating System Compatibility Guide)

เอกสารนี้สรุปสถานะความเข้ากันได้ของ **NodeHotkey** กับระบบปฏิบัติการต่างๆ (Windows, macOS, Linux) รวมถึงจุดที่ผูกติดกับ Windows และแนวทางการปรับปรุงให้รองรับ Cross-Platform เต็มรูปแบบในอนาคต

---

## 📌 1. สรุปสถานะปัจจุบัน (Executive Summary)

* **Windows 10 / 11:** **รองรับ 100% (Production Ready)** — โปรแกรมถูกออกแบบ, คอมไพล์ Native Modules และทดสอบบนสภาพแวดล้อม Windows เป็นหลัก
* **macOS:** **รองรับบางส่วน (~85%)** — รัน Core Engine, Web Canvas, Vision OCR, และ Playwright ได้ทันที แต่ยังติดเรื่อง Global Mouse Hook และคำสั่งเล่นเสียง PowerShell
* **Linux (Ubuntu/Debian):** **รองรับบางส่วน (~80%)** — รัน Web Dashboard, Automation Engine, และ Vision ได้ แต่ Global Hook มีข้อจำกัดกับ Wayland และต้องมีเครื่องมือเล่นเสียงภายนอก

---

## 📊 2. ตารางเปรียบเทียบฟีเจอร์แยกตาม OS (Compatibility Matrix)

| ส่วนประกอบ / โมดูล | Windows 10/11 | macOS | Linux (X11 / Wayland) | รายละเอียดทางเทคนิค |
| :--- | :---: | :---: | :---: | :--- |
| **Electron Launcher UI** | ✅ รองรับ | ✅ รองรับ | ✅ รองรับ | เทคโนโลยี Electron รองรับ Cross-Platform |
| **Web Dashboard & Node Canvas** | ✅ รองรับ | ✅ รองรับ | ✅ รองรับ | รันผ่าน HTML5, Vanilla CSS และ SVG Canvas |
| **Playwright Multi-Client (CDP)** | ✅ รองรับ | ✅ รองรับ | ✅ รองรับ | คุม Chromium/Firefox ข้ามจอผ่าน CDP ได้ทุก OS |
| **Computer Vision & OCR** | ✅ รองรับ | ✅ รองรับ | ✅ รองรับ | `sharp` และ `tesseract.js` รองรับ Cross-Platform |
| **Node Execution Engine** | ✅ รองรับ | ✅ รองรับ | ✅ รองรับ | ตรรกะ Blueprint, Action Chaining, Data Wires รันบน Node.js 100% |
| **Global Keyboard Hook** | ✅ รองรับ | ⚠️ ต้องขอสิทธิ์ | ⚠️ เฉพาะ X11 | `node-global-key-listener` บน Mac ต้องเปิด Accessibility; Linux ยังไม่รองรับ Wayland สมบูรณ์ |
| **Global Mouse Hook** | ✅ รองรับ | ❌ ไม่รองรับ | ❌ ไม่รองรับ | `global-mouse-events` ผูกกับ Win32 C++ API (`SetWindowsHookEx`) โดยตรง |
| **Sound Alert & TTS Playback** | ✅ รองรับ | ❌ ต้องแก้โค้ด | ❌ ต้องแก้โค้ด | ปัจจุบันโค้ดเรียกใช้ `spawn('powershell')` เพื่อเปิดไฟล์เสียง |
| **Auto Updater (Zip Extraction)** | ✅ รองรับ | ❌ ต้องแก้โค้ด | ❌ ต้องแก้โค้ด | ปัจจุบันใช้คำสั่ง PowerShell `[System.IO.Compression.ZipFile]` |

---

## 🔍 3. จุดที่ผูกติดกับ Windows ในปัจจุบัน (Windows-Specific Code Analysis)

### 3.1 Global Mouse Events (`global-mouse-events`)
* **ไฟล์ที่เกี่ยวข้อง:** [`bot.js`](../bot.js)
* **ปัญหา:** ตัวโมดูลคอมไพล์ Native Addon ด้วย Win32 API (`windows.h`, `SetWindowsHookEx(WH_MOUSE_LL)`)
* **ผลกระทบ:** บน Mac และ Linux โมดูลนี้จะ `require` ไม่ผ่าน หรือจับคลิกเมาส์นอกจอไม่ได้ (แต่ระบบมี Fallback ปิดการใช้งานเมาส์ให้อัตโนมัติ บอทไม่แครช คีย์บอร์ดยังทำงานได้)

### 3.2 ระบบเล่นเสียงแจ้งเตือนและสังเคราะห์เสียง (Audio & TTS)
* **ไฟล์ที่เกี่ยวข้อง:** [`bot.js`](../bot.js), [`tts-service.js`](../tts-service.js)
* **โค้ดปัจจุบัน:**
  ```javascript
  // bot.js: เรียก SoundPlayer ของ .NET ผ่าน PowerShell
  nativeAudioWorker = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
  
  // tts-service.js: เล่นไฟล์ MP3 ผ่าน Media.MediaPlayer ของ PowerShell
  const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ...]);
  ```
* **ปัญหา:** macOS และ Linux ไม่มีโปรแกรม `powershell` ติดตั้งมาพร้อมกับระบบปฏิบัติการ

### 3.3 ตัวคลายไฟล์อัปเดตอัตโนมัติ (Auto Updater)
* **ไฟล์ที่เกี่ยวข้อง:** [`launcher/updater.js`](../launcher/updater.js)
* **โค้ดปัจจุบัน:** ใช้คำสั่ง PowerShell เพื่อแตกไฟล์ ZIP อัปเดตทับไฟล์ระบบ
  ```javascript
  powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory(...)"
  ```

### 3.4 การจัดการปิดโพรเซส (Process Termination)
* **ไฟล์ที่เกี่ยวข้อง:** [`launcher/main.js`](../launcher/main.js)
* **สถานะ:** มีการเช็ค `process.platform === 'win32'` ใช้ `taskkill /f /t` และมี fallback `SIGTERM` / `SIGKILL` สำหรับ Unix-like OS อยู่แล้ว

---

## 🚀 4. แนวทางการปรับปรุงให้รองรับ macOS / Linux ในอนาคต (Cross-Platform Roadmap)

หากในอนาคตต้องการทำให้ NodeHotkey รันได้สมบูรณ์แบบบนทุกระบบปฏิบัติการ สามารถปรับปรุงเพียง **10-15%** ของโค้ดดังนี้:

### 1. ระบบเสียง Cross-Platform Audio Player:
ปรับให้ตรวจสอบ `process.platform`:
```javascript
function playAudioFile(filePath) {
  if (process.platform === 'win32') {
    return spawn('powershell', ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`]);
  } else if (process.platform === 'darwin') {
    return spawn('afplay', [filePath]); // macOS native audio CLI
  } else {
    return spawn('aplay', [filePath]);  // Linux ALSA / PulseAudio
  }
}
```

### 2. ตัวแตกไฟล์ ZIP แบบ Native Node.js:
เปลี่ยนจากการเรียก PowerShell มาใช้แพ็กเกจ Node.js เช่น `adm-zip` หรือโมดูล `decompress` เพื่อให้แตกไฟล์อัปเดตได้ทุก OS โดยไม่ต้องพึ่งพาคำสั่งระบบภายนอก

### 3. สิทธิ์การดักจับ Input บน macOS / Linux:
* **macOS:** แนะนำให้สร้างตัวแจ้งเตือน Prompt ให้ผู้ใช้เข้าไปติ๊กเปิดสิทธิ์ **Accessibility (การช่วยการเข้าถึง)** ใน *System Settings -> Privacy & Security*
* **Linux:** แนะนำให้รันบน Session แบบ **X11 (Xorg)** แทน Wayland เพื่อให้ดักจับ Global Hotkeys ได้อย่างเสถียร

---

## 💡 สรุปคำแนะนำการใช้งาน
* **สำหรับผู้ใช้งานทั่วไปในปัจจุบัน:** แนะนำให้รันบน **Windows 10 หรือ Windows 11** เพื่อประสิทธิภาพสูงสุดและการทำงานที่สมบูรณ์ 100% ในทุกฟังก์ชัน
* **โครงสร้างโปรเจกต์:** ได้รับการจัดวางแบบ Modular และแยก Service ไว้ชัดเจน หากต้องการพอร์ตข้าม OS ในอนาคตสามารถทำได้สะดวกรวดเร็วโดยไม่กระทบสถาปัตยกรรมหลัก
