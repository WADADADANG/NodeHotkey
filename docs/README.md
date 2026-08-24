# 📚 NodeHotkey Developer Documentation (คู่มือนักพัฒนา)

ยินดีต้อนรับสู่ศูนย์รวมเอกสารและคู่มือเชิงลึกสำหรับนักพัฒนา (**Developer Guides & Architecture Handbook**) ของ **NodeHotkey v3.1.0**

---

## 📑 สารบัญเอกสาร (Documentation Index)

### 1. 🏛️ [ภาพรวมสถาปัตยกรรมและการทำงานภายในของระบบ (Architecture Overview)](ARCHITECTURE_OVERVIEW.md)
- โครงสร้างและแผนผัง Data Flow เชื่อมต่อระหว่าง Electron Launcher, Bot Engine, Web Canvas Studio, และ Playwright CDP
- การแบ่งหน้าที่ของแต่ละโมดูลหลัก (`launcher/`, `bot.js`, `execution-engine.js`, `public/`)
- โครงสร้างการจัดเก็บไฟล์โปรไฟล์และการตั้งค่า (`configs/`)
- วงจรการทำงานตั้งแต่กดปุ่มคีย์บอร์ดจนถึงเกมและ Overlay (Execution Lifecycle)

---

### 2. 🛠️ [คู่มือการเพิ่ม Action Node ชนิดใหม่ลงในระบบ (How to Add a New Action Node)](HOW_TO_ADD_ACTION_NODE.md)
- แนะนำขั้นตอนการสร้างโหนดใหม่ Step-by-Step ตั้งแต่หน้าบ้านจนถึงหลังบ้าน
- การลงทะเบียนโหนด, กำหนดพอร์ต Input/Output, และสร้างแผง Inspector บน Canvas ([public/js/canvas.js](../public/js/canvas.js))
- การแมป Schema ข้อมูล ([converter.js](../converter.js) & [execution-engine.js](../execution-engine.js))
- การเขียนฟังก์ชัน Execute และยิง Chaining Events ใน Bot Engine ([bot.js](../bot.js))
- การเพิ่ม Rule ตรวจจับข้อผิดพลาดใน Inspector ([public/js/validator.js](../public/js/validator.js))

---

*เอกสารชุดนี้จัดทำขึ้นสำหรับการพัฒนาและต่อยอดระบบ NodeHotkey โดยเฉพาะ*
