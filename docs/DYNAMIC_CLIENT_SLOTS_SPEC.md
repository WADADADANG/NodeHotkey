# 🧭 แผนผังและข้อกำหนด: ระบบ Dynamic Client Slots (ขยายจอไม่จำกัด & Fixed Slot ID)
*(Dynamic Multi-Client Slot Architecture Specification - NodeHotkey v3.2)*

เอกสารนี้ระบุข้อกำหนดและสถาปัตยกรรมระบบการจัดการหน้าจอเกมแบบ **Dynamic Slots** สำหรับโปรเจกต์ **NodeHotkey** เพื่อปลดล็อคข้อจำกัดเดิมที่มี 8 จอตายตัว ให้ผู้เล่นสามารถเพิ่ม-ลดหน้าจอได้อย่างอิสระตามกำลังเครื่อง โดยที่ตัวเลขประจำจอ (Slot ID) ยังคงมีตำแหน่งที่แน่นอน ไม่กระทบกับ Action Node เดิมใน Canvas

---

## 1. หลักการทำงานหัวใจสำคัญ (Core Principles)

### 1.1 Fixed Slot ID (รหัส Slot คงที่ถาวร)
* จอแต่ละจอจะยึดตาม **Slot Number** เสมอ:
  * Slot 1 = Client 1
  * Slot 2 = Client 2
  * Slot 3 = Client 3
  * Slot N = Client N
* **ห้ามทำการขยับรหัส (No Auto Re-index):** การลบจอที่อยู่ตรงกลางแถว จะไม่ทำให้จอที่อยู่ด้านหลังถูกเปลี่ยนเลข เพราะจะทำให้ Action Node ที่ผูก `targetClient: "3"` ไว้ ยิงคำสั่งผิดตัว

### 1.2 Empty Slot State (สถานะช่องว่างเมื่อลบจอ)
* เมื่อผู้ใช้กดลบจอตรงกลาง (เช่น ลบจอ 2 ออก):
  * ช่องของจอ 2 จะไม่หายไปจนเลขกระโดด
  * ช่องนั้นจะถูกแปลงสภาพเป็น **"การ์ดช่องว่าง"** `[ ➕ สร้างจอ 2 ]`
* **ตัวอย่างการแสดงผลบนหน้าต่าง Launcher:**
```
+------------------+  +------------------+  +------------------+  +------------------+
|  🎮 Client 1     |  |  ➕ เพิ่มจอ 2    |  |  🎮 Client 3     |  |  ➕ เพิ่มจอใหม่   |
|  (กำลังทำงาน)    |  |  (ช่องว่างที่ลบ) |  |  (กำลังทำงาน)    |  |  (สร้างจอ 4)     |
+------------------+  +------------------+  +------------------+  +------------------+
```

### 1.3 อิสระในการเพิ่มจอ (Flexible Creation)
ผู้ใช้สามารถเลือกได้ 2 ทาง:
1. กดที่ปุ่ม **`[ ➕ เพิ่มจอ X ]`** ในช่องว่างตรงกลาง เพื่อเปิด Slot เดิมกลับคืนมา
2. หรือกดปุ่ม **`[ ➕ เพิ่มจอใหม่ (จอ N+1) ]`** ท้ายแถว เพื่อสร้างจอใหม่ลำดับถัดไป

---

## 2. โครงสร้างข้อมูล (Data Model & Schema)

### ไฟล์ `configs/global.json`
เพิ่มฟิลด์ `clientSlots` ใน `globalSettings`:
```json
{
  "globalSettings": {
    "clientSlots": [1, 3, 4],
    "clientAliases": {
      "1": "#1 Main",
      "2": "RM Buffer",
      "3": "Knight Tank",
      "4": "Solo Farm"
    },
    "clientProxies": {},
    "clientBrowsers": {},
    "clientUserAgents": {},
    "clientWindowBounds": {}
  }
}
```
* `clientSlots`: อาเรย์ตัวเลขบอกว่าปัจจุบันมี Slot ใดบ้างที่ "ถูกสร้างและเปิดใช้งาน" (หากเลขใดไม่อยู่ในอาเรย์นี้ แต่มีค่าน้อยกว่าค่าสูงสุด จะถือว่าเป็น Empty Slot)
* ข้อมูลจำเพาะ (`clientAliases`, `clientProxies`, `clientBrowsers`, `clientUserAgents`) จะถูกบันทึกแยกตามเลข Slot ID อย่างถาวร แม้ Slot นั้นจะถูกลบชั่วคราว ข้อมูลตั้งค่าก็จะไม่สูญหาย

---

## 3. รายละเอียดการทำงานของแต่ละส่วน (Component Breakdown)

### 3.1 หน้าต่าง Launcher (`launcher/ui/launcher.js`, `index.html`, `launcher.css`)
1. **การเรนเดอร์การ์ดจอ (`renderLauncherClientCards`):**
   * หา `maxSlot = Math.max(...clientSlots, 1)`
   * วนลูปตั้งแต่ `i = 1` ถึง `maxSlot`:
     * ถ้า `clientSlots.includes(i)`: แสดงการ์ดจอปกติ (Client `i`, ไอคอนเบราว์เซอร์, ช่องฉายา, ปุ่ม Pause / Launch / Close)
       * สำหรับจอที่อยู่ในสถานะ **OFFLINE** จะมีปุ่ม `[🗑️ ลบจอ]` บนหัวการ์ด
     * ถ้า `!clientSlots.includes(i)`: แสดงการ์ดว่างเปล่า สไตล์เส้นประโปร่งแสง มีปุ่ม `[ ➕ เพิ่มจอ i ]`
   * ท้ายลูป: แสดงการ์ดปุ่มกด `[ ➕ เพิ่มจอใหม่ (จอ maxSlot+1) ]`
2. **ปุ่ม Launch All / Stop All:**
   * `Launch All`: สั่งเปิดเฉพาะจอที่มีอยู่จริงใน `clientSlots` (ข้ามช่องว่าง)
   * `Stop All`: สั่งปิดทุกจอที่รันอยู่
3. **หัวข้อแถบควบคุม:**
   * เปลี่ยนข้อความจาก `CLIENT CONTROL MATRIX (1 - 8)` เป็น `CLIENT CONTROL MATRIX`
   * ป้ายบอกจำนวน: แสดง `${activeCount} / ${totalConfiguredSlots}`

### 3.2 เซิร์ฟเวอร์และเอนจินหลัก (`test-server.js` & `bot.js`)
1. **API Endpoints ปลดล็อคเพดานเลข 8:**
   * `/api/client-stream/(\d+)` — รองรับตัวเลขไม่จำกัด
   * `/api/client-frame/(\d+)` — รองรับตัวเลขไม่จำกัด
   * `/api/client-focus/(\d+)` — รองรับตัวเลขไม่จำกัด
2. **Puppeteer Instance ใน `bot.js`:**
   * แก้ไขฟังก์ชัน `launchSingleClient` เอาเงื่อนไข `clientIndex > 8` ออก
   * โปรไฟล์ Chrome ของแต่ละจอจะถูกจัดเก็บลงใน `profiles/client_${clientIndex}` โดยอัตโนมัติ

### 3.3 ระบบหน้าต่างจอลอย PiP (`launcher/ui/pip.js`, `pip.html`, `pip.css`)
1. ปลดล็อค `isClientId(v)`: เปลี่ยน Regex จาก `^[1-8]$` เป็น `^\d+$`
2. Dynamic Grid Layout ปรับสัดส่วนอัตโนมัติตามจำนวนจอที่กำลังเปิดจริง:
   * 1 จอ = เต็มจอ (Single View)
   * 2 จอ = 2 คอลัมน์ (1x2)
   * 3 - 4 จอ = 2x2
   * 5 - 8 จอ = 4x2
   * 9 - 12 จอ = 4x3

### 3.4 หน้า Web Canvas Node Editor (`public/js/canvas-inspector.js`, `actions.js`)
1. **Dropdown เลือก Target Client ในกล่อง Action Node:**
   * โหลดรายการตาม `clientSlots` ที่มีอยู่จริง + ตัวเลือก `All (ทุกจอ)` + ตัวเลือกกำหนดเลขเอง
2. **Safe Execution Guard:**
   * หากมี Node ที่สั่งไปยัง Slot ที่ไม่ได้เปิดทำงาน บอทจะข้ามการกดไปอย่างปลอดภัย ไม่ค้าง และไม่ทำให้ Engine แครช

---

## 4. สถานะและขั้นตอนถัดไป
- [x] ออกแบบและตกลงรูปแบบความต้องการกับผู้ใช้ (User Confirmed)
- [x] จัดทำเอกสารสถาปัตยกรรมระบบ (`docs/DYNAMIC_CLIENT_SLOTS_SPEC.md`)
- [ ] ลงมือปรับปรุง Backend (`test-server.js`, `bot.js`)
- [ ] ลงมือปรับปรุง Launcher UI & CSS (`launcher.js`, `index.html`, `launcher.css`)
- [ ] ลงมือปรับปรุง PiP Window (`pip.js`)
- [ ] ตรวจสอบและรันชุดทดสอบ (Automated Unit Tests)
