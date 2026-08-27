# 🚀 UI Redesign Master Plan: Unified Dev Studio Workspace

เอกสารฉบับนี้เป็น **Master Plan** สำหรับส่งต่องานไปยังแชทถัดไป เพื่อดำเนินการปรับโฉมหน้าตา UI ของระบบ **NodeHotkey Control Center** ให้เป็นสไตล์ **Unified Dev / Linear Desktop Workspace** อย่างสมบูรณ์แบบ โดยไม่มีการแตะต้องหรือรื้อระบบ Core Engine ของ Action Node Canvas เดิมแม้แต่นิดเดียว (100% Zero-Breakage)

---

## 🎯 1. สรุปเป้าหมายและความต้องการของผู้ใช้ (Core Requirements)

1. **📱 Left Sidebar Navigation (~190px สไตล์ Unified Dev / Linear)**:
   - แถบเมนูด้านซ้ายสุด กะทัดรัด แบ่งเป็น 3 เมนูหลัก:
     - 🏠 **Dashboard**: หน้าควบคุมหลัก, เปิด/ปิดจอ 1-8, และ Terminal Logs
     - 🎮 **Action Node Studio**: หน้ารวมเครื่องมือหลัก! **รวม Profile Manager เต็มรูปแบบ + Canvas Studio ไว้ด้วยกันในหน้าเดียว**
     - ⚙️ **Settings & HUD**: หน้าตั้งค่าระบบ (Overlay HUD, Global Pause Hotkey `[END]`, Ghost Mouse Jitter)
   - ด้านล่างของ Sidebar: ปุ่มกด **Pause / Resume Bot Engine** แบบ Master Switch
2. **🌐 Topbar Header ขวาบน**:
   - 🐙 **ปุ่ม GitHub** (มีไอคอน Octocat SVG + ข้อความ GitHub เด่นชัด คลิกเปิด Repo)
   - 🌐 **ปุ่มสลับภาษา `TH / EN`** แบบ Toggle สวยงาม
   - ─ 🗖 ✕ ปุ่มควบคุมหน้าต่าง Windows
3. **🏠 หน้าแรก (Dashboard & Clients)**:
   - จัดกล่องอยู่กึ่งกลางหน้าจอ (Centered Container ~1080px) ขนาดกะทัดรัด ไม่ยืดจนโล่งเวิ้งว้าง
   - **Client Matrix (จอ 1 - 8)**: เรียงเป็น Grid 4 คอลัมน์ x 2 แถว พร้อมปุ่ม Focus / Restart แต่ละจอ
   - **Live Terminal Logs**: กล่องสตรีมข้อความ Logs คมชัด สูง 240px
4. **🎮 หน้า Action Node Studio (ห้ามรื้อ Canvas เด็ดขาด!)**:
   - **ด้านบน**: มี **Profile Manager เต็มรูปแบบ (ตรงตามรูปภาพเป๊ะๆ)**: ปุ่ม `+ New`, `Rename`, `Export`, `Import`, `Validate`, `Delete`, แถบสลับโปรไฟล์, และ Drawer Accordion สลับกลุ่มโปรไฟล์ CW/Dg/Ex
   - **ด้านล่าง**: พื้นที่ **Visual Canvas Studio เต็มจอ 100%** สำหรับลากต่อสายไฟ
5. **🛡️ ไฟล์ตัวอย่างที่ผ่านการพรีวิวแล้ว**:
   - ดูตัวอย่างโค้ด HTML/CSS ที่ลงตัวได้จากไฟล์: `preview-ui-redesign.html`

---

## 🛡️ 2. กฎเหล็กและการรับประกันความปลอดภัย (Safety & Integrity)

> [!CAUTION]
> **ห้ามรื้อหรือเขียนระบบ Action Node Canvas ใหม่เด็ดขาด!**
> โค้ดใน `public/js/canvas.js`, `public/js/cooldown.js`, `execution-engine.js`, `converter.js`, และ `bot.js` ได้รับการพัฒนาและทดสอบจนเสร็จสมบูรณ์แล้ว
> **งานนี้คือการเปลี่ยนเฉพาะ "เปลือกนอก (Shell Layout / HTML / CSS Containers)" เท่านั้น**

- ✅ **Canvas Nodes & Wires**: ระบบลากวางโหนด, สายไฟ Bezier curve, พอร์ต `onCooldown` Pin, Skill Cooldown Guard จะต้องทำงานได้ตามปกติ 100%
- ✅ **Profile Data**: ไฟล์โปรไฟล์ Config ในโฟลเดอร์ `configs/profiles/` จะต้องอ่าน-เขียนได้ตามปกติ
- ✅ **Bot Runtime**: บอทยังคงส่งคีย์ CDP และตอบสนองต่อ Hotkey F1-F12 และ Emergency Key `END` ได้เหมือนเดิม 100%

---

## 📋 3. แผนการดำเนินงานแบ่งเป็น 5 Phase (Step-by-Step)

### 🔹 Phase 1: วางโครงสร้าง Layout & Left Sidebar
- **ไฟล์**: `public/index.html`, `public/css/main.css`
- **เนื้องาน**:
  - ปรับโครงสร้างหลักของ `index.html` ให้เป็น 2 ส่วน:
    1. `<aside class="unified-sidebar">` (เมนูซ้าย Dashboard, Action Node, Settings + ปุ่ม Pause Bot)
    2. `<main class="main-content-layout">` (พื้นที่ทำงานฝั่งขวา)
  - เพิ่มฟังก์ชันสลับหน้า `switchNavTab(pageId)`

### 🔹 Phase 2: จัดหน้า Dashboard & Client Matrix (จอ 1-8)
- **ไฟล์**: `public/index.html`, `public/css/main.css`, `public/js/app.js`
- **เนื้องาน**:
  - ย้ายแผง Client Control Matrix (จอ 1-8) เข้ามาอยู่ในหน้า Dashboard
  - จัดเรียงเป็นกล่อง Centered Container (4x2 Grid)
  - เชื่อมต่อ Live Terminal Logs Console ให้แสดงผลอย่างเป็นระเบียบ

### 🔹 Phase 3: รวม Action Node Canvas & Profile Manager ในหน้าเดียว
- **ไฟล์**: `public/index.html`, `public/js/canvas.js`, `public/css/canvas.css`
- **เนื้องาน**:
  - นำแผง **Profile Manager เต็มรูปแบบ** (ปุ่ม CRUD, แถบสรุป และ Multi-Select Drawer) มาวางไว้ด้านบนของหน้า Studio
  - นำ **Visual Canvas Container** มาวางไว้เต็มพื้นที่ด้านล่าง
  - ปรับขนาด Canvas Viewport ให้อัปเดตและ Resize ตัวเองได้อย่างสมบูรณ์

### 🔹 Phase 4: สร้างหน้า Settings & Topbar Header Utilities
- **ไฟล์**: `public/index.html`, `public/js/i18n.js`, `public/css/main.css`
- **เนื้องาน**:
  - เพิ่ม **ปุ่ม GitHub** และ **ปุ่มสลับภาษา `TH / EN`** ที่ Topbar ขวาบน
  - จัดทำหน้า **Settings** (ตั้งค่า Emergency Pause Hotkey `[END]`, Desktop Overlay HUD, Anti-Detect Ghost Jitter)

### 🔹 Phase 5: ทดสอบฟังก์ชันและตรวจสอบความถูกต้อง (E2E Testing)
- **เนื้องาน**:
  1. ทดสอบการสลับเมนู Sidebar ซ้าย ➔ Dashboard ➔ Action Node ➔ Settings
  2. ทดสอบการเปิด-ปิดจอ Client 1-8 และการคลิกปุ่ม Start/Pause บอท
  3. ทดสอบการสร้าง/สลับโปรไฟล์ใน Profile Manager และการลากต่อสายไฟใน Canvas
  4. ทดสอบพอร์ต `onCooldown` และ Skill Cooldown Guard
  5. ทดสอบปุ่มสลับภาษา TH / EN

---

## 🚀 4. วิธีการเริ่มงานในแชทใหม่ (Prompt for New Chat)

เมื่อเปิดแชทใหม่ สามารถคัดลอกข้อความด้านล่างนี้ส่งให้ AI เพื่อเริ่มงานต่อได้ทันที:

```text
สวัสดีครับ เราจะดำเนินการ Redesign UI ของ NodeHotkey Control Center ตามแผนการใน docs/UI_REDESIGN_MASTER_PLAN.md โดยใช้ตัวอย่างสไตล์ Unified Dev Workspace จากไฟล์ preview-ui-redesign.html 

ช่วยเริ่มดำเนินการ Phase 1 และ Phase 2 ตามลำดับได้เลยครับ (ย้ำ: ห้ามรื้อ Action Node Canvas เดิมเด็ดขาด ใช้ของเดิมทั้งหมด ปรับแค่ UI Shell ภายนอกเท่านั้น)
```
