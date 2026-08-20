# 🚀 NodeHotkey (v3.0.0) - Node-Based Visual Workflow Automation Suite - Background WebGL Multi-Client Automation Suite

เครื่องมืออัตโนมัติช่วยกดปุ่มคีย์บอร์ดและเมาส์ในเบราว์เซอร์แบบพื้นหลัง (Background Automation) ออกแบบมาสำหรับเกม HTML5 / WebGL เช่น **Flyff Universe** รองรับหลายจอพร้อมกัน ไม่แย่งเมาส์ ไม่กวนการทำงานของคอมพิวเตอร์

---

## 🔥 ความสามารถหลัก (Features)

| Feature | รายละเอียด |
|---------|-----------|
| 🎮 **Client Control Center (1-8)** | สั่งเปิด (`Launch`), สลับหยุดชั่วคราว (`Pause`), หรือปิด (`Close`) แต่ละจอได้อย่างอิสระผ่าน Web Dashboard |
| 🛡️ **Per-Client Anti-Detect & Proxy** | ตั้งค่า **User-Agent** สุ่ม และใส่ **HTTP/SOCKS5 Proxy IP** แยกประจำแต่ละจอได้อิสระ ป้องกันการโดนตรวจจับ IP ซ้ำ |
| 🌐 **Background Control** | ส่งปุ่มเข้าแท็บเกมพื้นหลังแบบ CDP Input แท้ เกมคิดว่าเปิดจออยู่ตลอดเวลา ไม่แย่งเมาส์ |
| ⚡ **8 Multi-Action Modes** | รองรับ **Loop** (กดวนซ้ำ + First Steps), **Buff Sequence** (กดสกิลตามคูลดาวน์), **Single Key Press**, **Timer / Delay**, **Key Forwarder**, **Key Hold**, **Action Control**, และ **Branch (If / Else)** |
| 🌿 **Condition Branch (If / Else)** | ตรวจสอบสถานะ Action อ้างอิงแล้วแยกสายการทำงาน (`onTrue` / `onFalse`) ช่วยควบคุมลูปได้อย่างชาญฉลาด |
| 🔍 **Profile Integrity Inspector & 1-Click Auto-Fix** | ระบบสแกนหาข้อผิดพลาดในโปรไฟล์ (ปุ่ม Trigger ชนกัน, สาย Chain ขาด, ลืมเลือกเป้าหมาย) พร้อมปุ่ม **`⚡ Auto-Fix`** ซ่อมแซมอัตโนมัติใน 1 คลิก |
| 🔗 **Action Chaining & Cooldown Guards** | ตั้งค่าลูกโซ่เชื่อม Action อัตโนมัติ พร้อมระบบเช็ค Cooldown และ Cooldown Presets ป้องกันกดทับซ้อน |
| 🖱️ **Ghost Mouse Jitter** | สุ่มขยับเมาส์ในแท็บเกมพื้นหลังเพื่อสร้าง `mousemove` event หลีกเลี่ยง AFK Detection |
| 🖥️ **Single-Instance Desktop Overlay** | หน้าต่างลอยแสดงสถานะ Real-time ติดตามบอท ลากย้ายได้ พร้อมระบบ Socket Lock ป้องกันหน้าต่างซ้อน |
| 📂 **Modular Config (configs/)** | แยกเก็บไฟล์ตั้งค่า `configs/global.json` (ค่าระบบ/Proxy) และ `configs/profiles/*.json` (ไฟล์ละ 1 โปรไฟล์) แชร์โปรไฟล์ขึ้น GitHub ง่าย ปลอดภัย ไม่ปะปนกับ IP ส่วนตัว |

---

## 🛠️ การติดตั้ง (Installation)

1. ติดตั้ง **Node.js v18+** จาก [nodejs.org](https://nodejs.org/)
2. ดับเบิลคลิก `1 install.bat` *(ระบบจะติดตั้งแพ็คเกจ และ Playwright Browser ครบจบในคลิกเดียว)*

---

## 💡 วิธีใช้งาน (Usage)

### 🚀 วิธีรันใช้งาน (เลือกได้ 2 แบบตามความสะดวก)

- **วิธีที่ 1 (แนะนำสำหรับผู้ใช้ทั่วไป):** ดับเบิลคลิก **`NodeHotkey Launcher.bat`**
  - ระบบจะเด้งหน้าต่างโปรแกรมสีเข้มสวยงาม **ไร้หน้าต่างดำ CMD** เป็น All-in-One Dashboard พร้อมหน้าจอควบคุมและ Canvas Editor ในตัว!
- **วิธีที่ 2 (สำหรับสายพัฒนา/CMD):** รันคำสั่ง `npm start` ใน Terminal

---

### 📦 วิธีสร้างตัวติดตั้ง Standalone Windows Installer (.exe)
หากต้องการส่งไฟล์ให้คนอื่นใช้งานโดยที่**ผู้ใช้ปลายทางไม่ต้องลง Node.js ในเครื่องเลย**:
1. ดับเบิลคลิก **`4 build-installer.bat`**
2. ระบบจะแพ็คไฟล์ทั้งหมด + Runtime ลงในโฟลเดอร์ `dist/NodeHotkey`
3. หากลงโปรแกรมฟรี **Inno Setup** ไว้ในเครื่อง สามารถคอมไพล์ออกมาเป็นไฟล์ติดตั้ง **`dist/NodeHotkey-Setup-v3.0.0.exe`** ได้ทันที!

---

1. เปิดหน้าเว็บควบคุม **[http://localhost:3000](http://localhost:3000)**
2. ตั้งค่า Proxy IP / User-Agent ประจำจอ (ถ้ามี) แล้วกดปุ่ม **`➕ Launch`** บนการ์ดจอนั้นๆ เพื่อเปิดเกมได้ทันที!
3. ปรับแต่งโปรไฟล์คำสั่ง และกดปุ่ม **`🔍 Validate Profile`** เพื่อสแกนตรวจสอบความถูกต้อง และกดปุ่มลอย **`💾`** เพื่อบันทึกใช้งาน!

---

## 🛡️ ความปลอดภัยและการหลบเลี่ยงการตรวจจับ (Anti-Detection)

- ✅ **Firefox CDP Layer:** ไร้ร่องรอย `navigator.webdriver = true` ที่ระบบป้องกันส่วนใหญ่ใช้ตรวจจับ
- ✅ **CDP Native Key Events:** ส่งคำสั่งกดค้าง/ปล่อยผ่าน Playwright CDP ระดับเบราว์เซอร์ เหมือนคนกดจริง
- ✅ **Human-Like Jitter:** สุ่มเวลา Delay และ Hold Time อัตโนมัติ ป้องกัน Pattern การกดที่สม่ำเสมอเกินไป
- ✅ **Per-Client Proxy & UA Fingerprint:** สุ่ม User-Agent และแยก IP Address อิสระในแต่ละจอ

---

## 🔧 ปัญหาที่พบและวิธีแก้ไขเชิงเทคนิค (Known Issues & Architectural Solutions)

### 1. 🕹️ ปัญหาปุ่มกดจริงค้างเวลาสลับหน้าต่าง (Physical Key Stuck on Window Blur)
- **สาเหตุ:** ตัวเบราว์เซอร์ Chromium / Chrome / Edge เมื่อทำงานร่วมกับระบบ Automation CDP จะปิดระบบตัดปุ่มค้างของ Windows (`WM_KILLFOCUS`) โดยอัตโนมัติ ทำให้เมื่อผู้ใช้ใช้มือกดปุ่มเดินจริงในหน้าจอเกมแล้วคลิกสลับหน้าต่าง สัญญาณปล่อยปุ่ม (`UP`) จะถูกส่งไปให้หน้าต่างใหม่แทน หน้าจอเกมจึงไม่รับรู้ว่าปล่อยนิ้วแล้วและเดินค้าง
- **วิธีแก้ไข:** สร้างระบบ **Global Anti-Stuck Key Watchdog** ใน [bot.js](bot.js) โดยใช้ตัวดักจับสัญญาณคีย์บอร์ดระดับ OS ดักจับจังหวะยกนิ้วขึ้น (`isUp`) แล้วส่งคำสั่ง `page.keyboard.up()` ตรงเข้าทุกจอเกมทันทีใน 0 ms (พร้อมระบบป้องกันไม่ให้ไปรบกวนโหมด `⚓ Key Hold` ที่ผู้ใช้สั่งบอทกดค้างไว้)

### 2. 📦 ปัญหาระบบอัปเดตแจ้งว่าสำเร็จแต่ไฟล์ในเครื่องไม่อัปเดต (Updater File Lock Conflict)
- **สาเหตุ:** ในระบบปฏิบัติการ Windows การดาวน์โหลดไฟล์แพ็กเกจ `.zip` ผ่าน Stream เดิม ยังไม่ทันคลาย File Handle ปิดสนิท ทำให้คำสั่งแตกไฟล์ของ PowerShell ติด Error *"The process cannot access the file because it is being used by another process"* ส่งผลให้แตกไฟล์ไม่สำเร็จ และโค้ดเดิมมีข้อผิดพลาดที่ข้ามการก๊อปปี้ไฟล์ไปเงียบๆ แล้วบันทึกว่าอัปเดตสำเร็จ
- **วิธีแก้ไข:** ปรับปรุง [launcher/updater.js](launcher/updater.js) ให้ดาวน์โหลดไฟล์เข้า In-Memory Buffer เต็มก้อนแล้วเขียนลงดิสก์แบบ Synchronous (ไร้ปัญหา File Lock 100%) พร้อมเปลี่ยนมาใช้ **Windows .NET `ZipFile::ExtractToDirectory` Engine** แตกไฟล์ความเร็วสูง และเพิ่มระบบ **Error Guard & File Counter** ตรวจนับไฟล์ที่อัปเดตจริงก่อนบันทึกเวอร์ชัน พร้อมแสดง Log ทุกขั้นตอนอย่างโปร่งใส

