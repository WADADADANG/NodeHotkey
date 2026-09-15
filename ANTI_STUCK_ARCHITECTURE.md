# 🛡️ สถาปัตยกรรมระบบแก้ปัญหาปุ่มและเมาส์ค้างเวลาสลับหน้าต่าง (Root-Cause In-Page Anti-Stuck Engine)

## 📌 ที่มาและสาเหตุที่แท้จริง (Root Cause Analysis)

ในเกมออนไลน์บนเว็บ (HTML5 / WebGL Canvas เช่น Flyff Universe):
1. **การรับ Input ของ Windows OS**: สัญญาณฮาร์ดแวร์คีย์บอร์ดและเมาส์ (`KeyDown`, `KeyUp`, `MouseDown`, `MouseUp`) จะถูกส่งเข้าสู่ **หน้าต่างที่มี Focus (Active Window) เท่านั้น**
2. **จุดเกิดปัญหา**:
   - เมื่อผู้ใช้ใช้มือกดปุ่มเดินจริง (เช่น `W, A, S, D`) หรือกดคลิกขวาค้างเพื่อหมุนมุมกล้อง
   - จากนั้นใช้เมาส์คลิกสลับหน้าต่าง (Window Blur) หรือกด `Alt + Tab`
   - **จังหวะที่ผู้ใช้ยกนิ้วขึ้นจากปุ่ม/เมาส์** หน้าต่างเกมเดิมไม่ได้เป็น Active Window แล้ว สัญญาณปล่อยนิ้ว (`KeyUp` / `MouseUp`) จึงถูกส่งไปยังหน้าต่างใหม่แทน
   - หน้าต่างเกมเดิมจึง **ไม่เคยได้รับสัญญาณปล่อยปุ่มเลย**
   - ตัวเกมยังคงเก็บ State ภายในหน่วยความจำว่าปุ่มหรือเมาส์ยังถูกกดค้างอยู่ ส่งผลให้:
     - 🚶 ตัวละครเดินไม่หยุด
     - 🔄 มุมกล้องหมุนค้างตลอดเวลา
     - 🖱️ เมาส์ติดสถานะลาก / คลิกค้าง

---

## 🏗️ โครงสร้างการทำงานของระบบ (Architectural Flow)

ระบบนี้ถูกติดตั้งผ่าน `browserCtx.addInitScript()` ใน `bot.js` ซึ่งจะทำงานตั้งแต่ระดับ Injected JavaScript ภายในตัวเบราว์เซอร์ของแต่ละจอเกม:

```mermaid
flowchart TD
    Physical[ผู้ใช้กดปุ่มคีย์บอร์ด หรือคลิกเมาส์จริง] --> Track[ดักจับ e.isTrusted === true บันทึกปุ่มที่กำลัง Hold]
    
    Track --> Gaming[เล่นเกมตามปกติ]
    
    Gaming --> SwitchWin[ผู้ใช้สลับหน้าต่าง Alt+Tab หรือคลิกจออื่น]
    SwitchWin --> BlurDetected[เบราว์เซอร์ส่งสัญญาณ blur / focusout / visibilitychange]
    
    subgraph InPageEngine [In-Page Anti-Stuck Engine (ทำงานในระดับ DOM 0 ms)]
        BlurDetected --> ReleaseKeys[สังเคราะห์ Synthetic KeyUp ให้ครบทุกปุ่มที่เคยกดค้าง]
        BlurDetected --> ReleaseMouse[สังเคราะห์ Synthetic MouseUp ปล่อยปุ่มเมาส์ทุกปุ่ม]
        BlurDetected --> ReleasePointerLock[สั่ง document.exitPointerLock ปลดล็อกมุมกล้อง]
        BlurDetected --> ClearMem[ล้าง heldPhysicalKeys & heldPhysicalButtons]
    end
    
    ReleaseKeys --> SafeState[ตัวละครหยุดเดินทันที]
    ReleaseMouse --> SafeState2[เมาส์และมุมกล้องหยุดค้างทันที]
```

---

## 💻 รายละเอียดการทำงานของโค้ด ([bot.js](bot.js))

ฟังก์ชัน `injectClientInitScripts(browserCtx, clientIndex)` จะทำการฉีดสคริปต์นี้เข้าสู่ทุกจอเกม:

```javascript
// 1. แยกแยะเฉพาะการกดจากมือคนจริง (e.isTrusted === true)
window.addEventListener('keydown', (e) => {
    if (e.isTrusted) {
        heldPhysicalKeys.set(e.code, { key: e.key, code: e.code, keyCode: e.keyCode, which: e.which });
    }
}, true);

window.addEventListener('keyup', (e) => {
    if (e.isTrusted) heldPhysicalKeys.delete(e.code);
}, true);

// 2. ดักจับปุ่มเมาส์จริง
window.addEventListener('mousedown', (e) => {
    if (e.isTrusted) heldPhysicalButtons.add(e.button);
}, true);

window.addEventListener('mouseup', (e) => {
    if (e.isTrusted) heldPhysicalButtons.delete(e.button);
}, true);

// 3. ปลดล็อกทันทีเมื่อหน้าต่างสูญเสียโฟกัส (Window Blur / Tab Switch)
const releaseAllStuckPhysicalInputs = () => {
    // รวบรวม Target ทุกจุดในหน้าจอ (เน้นส่งตรงเข้า WebGL Canvas ทุกตัว)
    const targets = new Set();
    document.querySelectorAll('canvas').forEach(c => targets.add(c));
    if (document.activeElement) targets.add(document.activeElement);
    if (document.body) targets.add(document.body);
    targets.add(document);
    targets.add(window);

    // 3.1 ยิง KeyUp ให้ครบทุกปุ่มที่ค้าง (ครอบคลุม A-Z, 0-9 แถวบน, Numpad, ลูกศร, Space)
    if (heldPhysicalKeys.size > 0) {
        for (const [code, info] of heldPhysicalKeys.entries()) {
            const isNumpad = (info.code && info.code.startsWith('Numpad')) || info.location === 3;
            const locationVal = isNumpad ? 3 : (info.location || 0);

            let keyVal = info.key;
            let keyCodeVal = info.keyCode;

            // Normalize Numpad Keys (ส่ง location: 3 ให้เกมจำแนก Numpad ถูกต้อง)
            if (info.code && /^Numpad[0-9]$/.test(info.code)) {
                const digit = info.code.replace('Numpad', '');
                keyVal = digit;
                keyCodeVal = 96 + parseInt(digit, 10);
            }
            // Normalize Arrow Keys & Spacebar
            else if (info.code === 'ArrowUp') { keyVal = 'ArrowUp'; keyCodeVal = 38; }
            else if (info.code === 'ArrowDown') { keyVal = 'ArrowDown'; keyCodeVal = 40; }
            else if (info.code === 'ArrowLeft') { keyVal = 'ArrowLeft'; keyCodeVal = 37; }
            else if (info.code === 'ArrowRight') { keyVal = 'ArrowRight'; keyCodeVal = 39; }
            else if (info.code === 'Space') { keyVal = ' '; keyCodeVal = 32; }

            const keyUpEvent = new KeyboardEvent('keyup', {
                key: keyVal || info.key,
                code: info.code,
                keyCode: keyCodeVal || info.keyCode,
                which: keyCodeVal || info.which || info.keyCode,
                location: locationVal,
                bubbles: true,
                cancelable: true,
                composed: true
            });

            try {
                Object.defineProperty(keyUpEvent, 'keyCode', { value: keyCodeVal || info.keyCode, configurable: true });
                Object.defineProperty(keyUpEvent, 'which', { value: keyCodeVal || info.which || info.keyCode, configurable: true });
                Object.defineProperty(keyUpEvent, 'location', { value: locationVal, configurable: true });
            } catch (err) { }

            targets.forEach(t => {
                try { t.dispatchEvent(keyUpEvent); } catch (e) { }
            });
        }
        heldPhysicalKeys.clear();
    }

    // 3.2 ยิง MouseUp และปลด PointerLock ส่งตรงเข้า Canvas
    if (heldPhysicalButtons.size > 0) {
        if (document.pointerLockElement) {
            try { document.exitPointerLock?.(); } catch (e) { }
        }
        for (const button of heldPhysicalButtons) {
            const mouseUpEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                composed: true,
                button: button,
                buttons: 0,
                clientX: lastMousePos.x,
                clientY: lastMousePos.y
            });
            targets.forEach(t => {
                try { t.dispatchEvent(mouseUpEvent); } catch (e) { }
            });
        }
        heldPhysicalButtons.clear();
    }
};

window.addEventListener('blur', releaseAllStuckPhysicalInputs, true);
window.addEventListener('focusout', releaseAllStuckPhysicalInputs, true);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllStuckPhysicalInputs();
}, true);
```

---

## 🎯 จุดเด่นของการแก้ไขด้วยวิธีนี้

1. **ครอบคลุมทั้งคีย์บอร์ดและเมาส์ 100%**: ปัญหาวิ่งไม่หยุด หรือมุมกล้องหมุนค้างจากการคลิกขวา ถูกแก้ไขพร้อมกัน
2. **ความเร็วระดับ 0 ms**: ทำงานภายใน JavaScript Runtime ของหน้าเกมทันทีที่หลุด Focus ไม่ต้องรอรับส่งข้อมูลผ่าน IPC หรือ CDP ข้าม Process
3. **ไม่กระทบต่อการกดค้างของบอท (`⚓ Key Hold`)**:
   - การตรวจสอบ `e.isTrusted === true` ทำให้ระบบตัดเฉพาะ **ปุ่มที่ผู้ใช้กดด้วยมือตนเอง**
   - คำสั่งที่บอทสั่งกดค้างไว้ผ่าน CDP จะไม่มี `e.isTrusted` จึงไม่ถูกสั่งปลดปล่อย ทำให้บอทยังคงกดค้างปุ่มหรือทำตามเงื่อนไขต่อไปได้อย่างราบรื่น 100%
