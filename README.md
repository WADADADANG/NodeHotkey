# 🚀 NodeHotkey (v3.1.0) - Node-Based Visual Workflow Automation Suite - Background WebGL Multi-Client Automation Suite

เครื่องมืออัตโนมัติช่วยกดปุ่มคีย์บอร์ดและเมาส์ในเบราว์เซอร์แบบพื้นหลัง (Background Automation) ออกแบบมาสำหรับเกม HTML5 / WebGL เช่น **Flyff Universe** รองรับหลายจอพร้อมกัน ไม่แย่งเมาส์ ไม่กวนการทำงานของคอมพิวเตอร์

> 🧭 **แผนผังและสถาปัตยกรรมระบบ (System Architecture & Dev Guide):**  
> ศึกษาการทำงานของโหนด, สายไฟ Wires, Bot Engine และโครงสร้างโปรเจกต์ฉบับเต็มได้ที่ [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)  
> 💻 **การรองรับระบบปฏิบัติการ (OS Compatibility Guide):**  
> ดูข้อมูลความเข้ากันได้กับ Windows, macOS และ Linux ได้ที่ [docs/OS_COMPATIBILITY.md](docs/OS_COMPATIBILITY.md)

---

## 🔥 ความสามารถหลัก (Features)

| Feature | รายละเอียด |
|---------|-----------|
| 🎮 **Client Control Center (1-8)** | สั่งเปิด (`Launch`), สลับหยุดชั่วคราว (`Pause`), หรือปิด (`Close`) แต่ละจอได้อย่างอิสระ พร้อมบันทึกพิกัดหน้าจออัตโนมัติ |
| 🛡️ **Per-Client Anti-Detect & Proxy** | ตั้งค่า **User-Agent** สุ่ม และใส่ **HTTP/SOCKS5 Proxy IP** แยกประจำแต่ละจอได้อิสระ ป้องกันการโดนตรวจจับ IP ซ้ำ |
| 🎨 **Visual Blueprint Node Canvas** | ออกแบบลำดับการทำงานสไตล์ **Unreal Engine Blueprints** ลากสายไฟ Wires เชื่อมต่อพอร์ต Exec / Data พร้อมเส้นทางโค้ง Bezier นุ่มนวล |
| ⚡ **29 Modular Workflow Nodes** | ครบครัน 6 หมวดหมู่: **Triggers** (3 โหนด), **Actions & Input** (5 โหนด), **Logic & Flow** (8 โหนด), **Vision & Party** (5 โหนด), **Variables & Data** (4 โหนด), และ **Safety & Utilities** (4 โหนด) |
| 👁️ **Computer Vision & Party Scanner** | สแกนหลอดเลือด Party สมาชิก 1-8 แบบเรียลไทม์ ตรวจจับสถานะเลือดต่ำเพื่อสั่งฮีลหรือบัฟเฉพาะเป้าหมายอัตโนมัติ |
| 📚 **Interactive Node Docs & Wiki** | คู่มือเอกสารอธิบายการใช้งานโหนดทั้ง 29 ตัวอย่างละเอียด พร้อมแผนผัง Pin, Code Snippet, และ Blueprint Example ในตัว (`/docs.html`) |
| 🌿 **Condition Branch & Logic Flow** | ตรวจสอบสถานะและค่าตัวแปรเพื่อแยกสายการทำงาน (`onTrue` / `onFalse`), Loop Scheduler, Step Sequencer, และ Reroute Pins |
| 🔍 **Profile Integrity & 1-Click Fix** | ระบบสแกนหาข้อผิดพลาดในโปรไฟล์ (สายไฟขาด, โหนดลอย, ค่าพารามิเตอร์ไม่ครบ) พร้อมปุ่ม **`⚡ Auto-Fix`** จัดสายอัตโนมัติ |
| 🖱️ **Ghost Mouse Jitter & Anti-AFK** | สุ่มขยับเมาส์ในแท็บเกมพื้นหลังเพื่อสร้าง `mousemove` event ป้องกันการตัดการเชื่อมต่อจากระบบ AFK |
| 🖥️ **Desktop Launcher & Overlay** | โปรแกรมควบคุม Desktop แบบ Dark Theme ไร้หน้าต่างดำ พร้อมหน้าต่าง Overlay ลอยแสดงสถานะแบบ Single-Instance |
| 📂 **Modular Config & Safe Upgrade** | แยกเก็บ `configs/global.json` และ `configs/profiles/*.json` พร้อมระบบป้องกันข้อมูลสูญหาย ติดตั้งทับเพื่ออัปเดตได้ปลอดภัย 100% |

---

## 🛠️ การติดตั้ง (Installation)

1. ติดตั้ง **Node.js v18+** จาก [nodejs.org](https://nodejs.org/)
2. ดับเบิลคลิก **`1 install.bat`** *(ระบบจะติดตั้งแพ็คเกจ, Playwright Browser และสร้าง Template ค่าเริ่มต้นให้อัตโนมัติ)*

---

## 💡 วิธีใช้งาน (Usage Workflow)

### 🚀 1. วิธีรันโปรแกรม (เลือกได้ 2 แบบตามความสะดวก)

- **วิธีที่ 1 (แนะนำสำหรับผู้ใช้ทั่วไป):** ดับเบิลคลิก **`NodeHotkey Launcher.bat`**
  - ระบบจะเปิดหน้าต่าง **Control Center Dashboard** สีเข้มสวยงาม ควบคุมจอเกม 1-8, ดู Log สด, และมี Node Canvas Editor ฝังในตัว
- **วิธีที่ 2 (สำหรับสายพัฒนา / CLI):** ดับเบิลคลิก **`2 start.bat`** หรือรัน `npm start`
  - ทำงานผ่าน Engine โดยตรง และเปิด Web Studio ได้ที่ **[http://localhost:3088](http://localhost:3088)**

### 🎮 2. ขั้นตอนการใช้งานระบบ
1. **เปิดหน้าจอเกม:** ที่แท็บ **Clients** ใน Launcher หรือหน้าเว็บ **[http://localhost:3088](http://localhost:3088)** ตั้งค่า Proxy/User-Agent (ถ้ามี) แล้วกดปุ่ม **`➕ Launch`** บนการ์ดจอที่ต้องการ
2. **สร้างหรือเลือกโปรไฟล์:** ไปที่แท็บ **Node Studio** เลือกโปรไฟล์ที่ต้องการใช้งาน หรือสร้างใหม่ด้วยการลากวางโหนดจาก Palette ด้านข้าง
3. **ตรวจสอบและบันทึก:** กดปุ่ม **`🔍 Validate`** เพื่อตรวจเช็คความถูกต้องของสายไฟ และกดปุ่มลอย **`💾 Save Profile`**
4. **เปิด/ปิดบอท:** กดปุ่ม **`▶️ Start Engine`** ใน Launcher หรือกดคีย์ลัด **`END`** เพื่อหยุด/ทำงานต่อชั่วคราว

---

### 📦 วิธีสร้างตัวติดตั้ง Standalone Windows Installer (.exe)
หากต้องการส่งโปรแกรมให้คนอื่นใช้งานโดยที่**ผู้ใช้ปลายทางไม่ต้องลง Node.js ในเครื่องเลย**:
1. ดับเบิลคลิก **`4 build-installer.bat`**
2. ระบบจะแพ็คไฟล์โปรแกรม + Node.js Portable Runtime ลงในโฟลเดอร์ `dist/NodeHotkey`
3. สคริปต์จะใช้ **Inno Setup** คอมไพล์ออกมาเป็นไฟล์ติดตั้งตัวเดียวจบ **`dist/NodeHotkey-Setup-v3.1.0.exe`**
   - 🔒 **Data Protection:** ตัวสร้างตัวติดตั้งจะกรองโปรไฟล์ส่วนตัวออก และใช้ Default Config ที่สะอาด (ไม่ติดพิกัดหน้าจอลบหรือ Proxy ส่วนตัว)
   - 🔄 **Safe Upgrade:** ผู้ใช้ปลายทางสามารถดาวน์โหลดเวอร์ชันใหม่ไป **"ติดตั้งทับ"** ได้ทันที โดยที่พิกัดจอ, พ็อกซี่, และโปรไฟล์ที่สร้างไว้จะไม่หาย 100%

---

## 🛡️ ความปลอดภัยและการหลบเลี่ยงการตรวจจับ (Anti-Detection)

- ✅ **Firefox CDP Layer:** ไร้ร่องรอย `navigator.webdriver = true` ที่ระบบป้องกันส่วนใหญ่ใช้ตรวจจับ
- ✅ **CDP Native Key Events:** ส่งคำสั่งกดค้าง/ปล่อยผ่าน Playwright CDP ระดับเบราว์เซอร์ เหมือนคนกดจริง
- ✅ **Human-Like Jitter:** สุ่มเวลา Delay และ Hold Time อัตโนมัติ ป้องกัน Pattern การกดที่สม่ำเสมอเกินไป
- ✅ **Per-Client Proxy & UA Fingerprint:** สุ่ม User-Agent และแยก IP Address อิสระในแต่ละจอ

---

## 🔧 ปัญหาที่พบและวิธีแก้ไขเชิงเทคนิค (Known Issues & Architectural Solutions)

### 1. 🕹️ ปัญหาปุ่มคีย์บอร์ดและเมาส์ค้างเวลาสลับหน้าต่าง (Physical Key & Mouse Stuck on Window Blur)
- **สาเหตุ:** เมื่อผู้ใช้ใช้มือกดปุ่มเดินหรือคลิกขวาหมุนมุมกล้องในหน้าจอเกม แล้วคลิกสลับหน้าต่าง (Window Blur หรือ Alt+Tab) สัญญาณปล่อยนิ้ว (`KeyUp` / `MouseUp`) จะถูกส่งไปให้หน้าต่างใหม่แทน หน้าจอเกมเดิมจึงไม่เคยได้รับ Event ปล่อยปุ่ม ทำให้ตัวเกมจำสถานะค้างไว้ (เดินไม่หยุด หรือมุมกล้องหมุนค้าง)
- **วิธีแก้ไข (Root-Cause Solution):** ติดตั้งระบบ **In-Page Anti-Stuck Engine** ฉีดเข้าสู่เบราว์เซอร์ผ่าน `addInitScript` ใน [bot.js](bot.js) คอยดักจับ Event จริงของผู้ใช้ (`e.isTrusted === true`) ทั้งคีย์บอร์ดและเมาส์ เมื่อหน้าต่างเกมสูญเสียโฟกัส (`blur`, `focusout`, หรือ `visibilitychange`) ตัวระบบจะสั่งปล่อยปุ่มที่ค้างอยู่ทั้งหมด (Synthetic `KeyUp`, `MouseUp`, และปลด `PointerLock`) ในระดับ DOM ทันทีใน 0 ms โดยไม่กระทบต่อโหมดกดค้างของบอท (`⚓ Key Hold`)

### 2. 📦 ปัญหาระบบอัปเดตแจ้งว่าสำเร็จแต่ไฟล์ในเครื่องไม่อัปเดต (Updater File Lock Conflict)
- **สาเหตุ:** ในระบบปฏิบัติการ Windows การดาวน์โหลดไฟล์แพ็กเกจ `.zip` ผ่าน Stream เดิม ยังไม่ทันคลาย File Handle ปิดสนิท ทำให้คำสั่งแตกไฟล์ของ PowerShell ติด Error *"The process cannot access the file because it is being used by another process"* ส่งผลให้แตกไฟล์ไม่สำเร็จ และโค้ดเดิมมีข้อผิดพลาดที่ข้ามการก๊อปปี้ไฟล์ไปเงียบๆ แล้วบันทึกว่าอัปเดตสำเร็จ
- **วิธีแก้ไข:** ปรับปรุง [launcher/updater.js](launcher/updater.js) ให้ดาวน์โหลดไฟล์เข้า In-Memory Buffer เต็มก้อนแล้วเขียนลงดิสก์แบบ Synchronous (ไร้ปัญหา File Lock 100%) พร้อมเปลี่ยนมาใช้ **Windows .NET `ZipFile::ExtractToDirectory` Engine** แตกไฟล์ความเร็วสูง และเพิ่มระบบ **Error Guard & File Counter** ตรวจนับไฟล์ที่อัปเดตจริงก่อนบันทึกเวอร์ชัน พร้อมแสดง Log ทุกขั้นตอนอย่างโปร่งใส

### 3. 🧩 สถาปัตยกรรม Action Nodes แบบแยกโมดูล (Modular Node Registry)
- **โครงสร้าง:** ขยายความสามารถของ Action Node ได้อย่างอิสระผ่านโฟลเดอร์ `nodes/*.node.js` โดยไม่ต้องแก้ไขโค้ดแกนกลาง
- **ความเสถียร:** รองรับ Dynamic Hot-Reload และระบบ Safe Lazy-Loading ช่วยป้องกัน Node ล้มเหลวแม้ในสภาพแวดล้อมที่ไม่มีโมดูลเสริมติดตั้งไว้

