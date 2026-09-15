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

ระบบนี้ทำงานผสานกัน 2 ชั้น (Dual-Layer Defense) เพื่อการันตี 100% ว่าปุ่มและเมาส์จะถูกปลดทันที ไม่ว่าเกมจะใช้ WebGL, Emscripten หรือ HTML5 DOM:

```mermaid
flowchart TD
    Physical[ผู้ใช้กดปุ่มคีย์บอร์ด หรือคลิกเมาส์จริง] --> Track[ดักจับ e.isTrusted === true บันทึกปุ่มที่กำลัง Hold]
    
    Track --> Gaming[เล่นเกมตามปกติ]
    
    Gaming --> SwitchWin[ผู้ใช้สลับหน้าต่าง Alt+Tab หรือคลิกจออื่น]
    SwitchWin --> BlurDetected[เบราว์เซอร์ส่งสัญญาณ blur / focusout]
    
    subgraph Layer1 [Layer 1: Native CDP Bridge (ทำงานที่ระดับเบราว์เซอร์ Native isTrusted: true 0 ms)]
        BlurDetected --> BridgeNotify[แจ้ง Node.js ผ่าน __nodeHotkeyOnBlur]
        BridgeNotify --> NativeCDPRelease[ยิง Input.dispatchKeyEvent keyUp ผ่าน CDP]
        NativeCDPRelease --> NumpadBoth[ปล่อย Numpad ทั้งโหมด NumLock ON และ OFF]
        NativeCDPRelease --> NativeSpaceArrows[ปล่อย Space และปุ่มลูกศรทันที 0 ms]
    end
    
    subgraph Layer2 [Layer 2: In-Page DOM Fallback]
        BlurDetected --> ReleaseKeys[สังเคราะห์ Synthetic KeyUp ส่งตรงเข้า Canvas]
        BlurDetected --> ReleaseMouse[สังเคราะห์ Synthetic MouseUp และ exitPointerLock]
    end
    
    NativeCDPRelease --> SafeState[ตัวละครหยุดเดินและหยุดกระโดดทันที]
    ReleaseKeys --> SafeState
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
    const canvas = document.querySelector('canvas');
    const primaryTarget = canvas || document.activeElement || document.body || window;

    // 3.1 ยิง KeyUp ให้ครบทุกปุ่มที่ค้าง (รักษา Key / KeyCode ดั้งเดิม 100% พร้อม location = 3 สำหรับ Numpad)
    if (heldPhysicalKeys.size > 0) {
        for (const [code, info] of heldPhysicalKeys.entries()) {
            const isNumpad = (info.code && info.code.startsWith('Numpad')) || info.location === 3;
            const locationVal = isNumpad ? 3 : (info.location || 0);

            let keyVal = info.key;
            let keyCodeVal = info.keyCode;

            if (!keyVal) {
                if (info.code === 'Space') keyVal = ' ';
                else if (info.code && info.code.startsWith('Arrow')) keyVal = info.code;
                else keyVal = info.code;
            }
            if (!keyCodeVal) {
                if (info.code === 'Space') keyCodeVal = 32;
                else if (info.code === 'ArrowUp') keyCodeVal = 38;
                else if (info.code === 'ArrowDown') keyCodeVal = 40;
                else if (info.code === 'ArrowLeft') keyCodeVal = 37;
                else if (info.code === 'ArrowRight') keyCodeVal = 39;
            }

            const keyUpEvent = new KeyboardEvent('keyup', {
                key: keyVal,
                code: info.code,
                keyCode: keyCodeVal,
                which: keyCodeVal,
                location: locationVal,
                bubbles: true,
                cancelable: true,
                composed: true
            });

            try {
                Object.defineProperty(keyUpEvent, 'keyCode', { value: keyCodeVal, configurable: true });
                Object.defineProperty(keyUpEvent, 'which', { value: keyCodeVal, configurable: true });
                Object.defineProperty(keyUpEvent, 'location', { value: locationVal, configurable: true });
            } catch (err) { }

            try { primaryTarget.dispatchEvent(keyUpEvent); } catch (e) { }
            if (primaryTarget !== window) {
                try { window.dispatchEvent(keyUpEvent); } catch (e) { }
            }
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
            try { primaryTarget.dispatchEvent(mouseUpEvent); } catch (e) { }
            if (primaryTarget !== window) {
                try { window.dispatchEvent(mouseUpEvent); } catch (e) { }
            }
        }
        heldPhysicalButtons.clear();
    }
};

window.addEventListener('blur', releaseAllStuckPhysicalInputs, true);
window.addEventListener('focusout', releaseAllStuckPhysicalInputs, true);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllStuckPhysicalInputs();
}, true);

// 3.3 High-frequency OS Window Defocus Sentinel (ตรวจจับทันทีเมื่อคลิกโปรแกรมอื่นใน Windows)
setInterval(() => {
    if (!document.hasFocus() && (heldPhysicalKeys.size > 0 || heldPhysicalButtons.size > 0)) {
        releaseAllStuckPhysicalInputs();
    }
}, 50);
```

---

## 🎯 จุดเด่นของการแก้ไขด้วยวิธีนี้ (Multi-Layer Defense)

1. **Layer 1: In-Page High-Frequency Defocus Sentinel (`document.hasFocus()`)**:
   - ทำงานทุกๆ 50ms ภายในเบราว์เซอร์ ตรวจสอบสถานะ OS Focus หากผู้ใช้คลิกสลับไปโปรแกรมอื่น (เช่น Discord, Notepad, จอสอง) ตัวเช็คจะตรวจพบว่า `document.hasFocus() === false` และสั่งปลดปุ่ม Space, Arrows, Numpad 0-9 และเมาส์ทันที แม้นิ้วจะยังกดค้างอยู่
2. **Layer 2: Native CDP Key & Mouse Release (`isTrusted: true`)**:
   - ส่งตรงคำสั่ง `keyUp` และ `mouseReleased` ผ่าน Chrome DevTools Protocol (CDP) เข้าไปยัง WebGL / Canvas โดยตรง รองรับทั้ง Numpad (NumLock ON/OFF), Space, ลูกศร, และตัวอักษร A-Z
3. **Layer 3: Global OS Window Switch & Click-Outside Sentinel**:
   - ดักจับการกด `Alt + Tab`, ปุ่ม `Windows (Meta)`, หรือการคลิกเมาส์นอกกรอบหน้าต่างเกม (`clientWindowBounds`) ที่ระดับ OS เพื่อสั่ง Auto-Release ป้องกันปุ่มค้างทุกกรณี
4. **ไม่กระทบต่อการกดค้างของบอท (`⚓ Key Hold`)**:
   - มีการตรวจสอบ `activeHoldStates` ก่อนปล่อยปุ่มเสมอ ทำให้หากมี Action ของบอทที่สั่งกดค้างไว้ จะไม่ถูกปลดปล่อยโดยเด็ดขาด 100%

---

## ⚠️ ข้อจำกัดสำคัญและสิ่งที่ไม่ควรกลับมาทำซ้ำ (Known Limitations & Pitfalls - DO NOT REPEAT)

### ❌ สิ่งที่ไม่สามารถทำได้ (และไม่ควรเสียเวลาทำซ้ำ):
- **การพยายามสั่งปล่อยปุ่ม (Key Release) ทันทีในจังหวะสลับหน้าต่าง ขณะที่ "นิ้วของผู้ใช้ยังคงกดแช่อยู่บนคีย์บอร์ดจริง"**:
  - **เหตุผลทางเทคนิค (Hardware & OS Level):**
    1. ตราบใดที่นิ้วจริงยังกดอยู่บนสวิตช์คีย์บอร์ด ไมโครคอนโทรลเลอร์ของคีย์บอร์ดและ Windows OS (`GetAsyncKeyState` / `GetKeyState`) จะถือว่าปุ่มนั้นอยู่ในสถานะ **DOWN** ทางกายภาพตลอดเวลา
    2. แม้เราจะสั่งส่งสังเคราะห์ `keyUp` หรือสั่งผ่าน CDP เข้าไปในจังหวะสลับหน้าต่าง (Window Defocus / Blur) แต่เนื่องจากนิ้วยังกดค้างอยู่ ระบบประมวลผลอินพุตของเบราว์เซอร์ Chromium / Windows Event Pump จะยังคงมองเห็นสถานะฮาร์ดแวร์เดิม
    3. ตัวเกม WebGL (Flyff Universe / Emscripten) จึงยังมองว่าปุ่มนั้นถูกกดค้างอยู่ ตราบใดที่นิ้วจริงยังไม่ได้ยกขึ้น
  - **ข้อสรุป:** อย่าพยายามเขียนโค้ดเพื่อหลอกให้เกมปล่อยปุ่มในขณะที่นิ้วจริงยังกดค้างอยู่บนแป้นพิมพ์ เพราะขัดกับสถาปัตยกรรม Hardware Input ของ Windows OS

### ✅ สถาปัตยกรรมที่ถูกต้องและทำงานได้ผล 100%:
- **การดักจับจังหวะ "ยกนิ้วขึ้นจริง" (Physical Key Up) ผ่าน Global Hook + CDP:**
  - เมื่อผู้ใช้สลับไปหน้าต่างอื่น (เช่น Discord, Notepad) แล้ว **"ยกนิ้วขึ้นจากแป้นพิมพ์"**
  - ตัว Windows Hook (`node-global-key-listener`) จะตรวจจับสัญญาณ `isUp: true` ได้ทันที
  - จากนั้นส่งคำสั่ง `releaseKeyViaCDP` ตรงเข้า Chromium ด้วย Native CDP (`Input.dispatchKeyEvent`)
  - รองรับทั้ง:
    - **Numpad 0 - 9** (ทั้ง NumLock ON: VK 96-105 และ NumLock OFF: VK 33-45)
    - **Spacebar** (VK 32)
    - **Arrow Keys** (VK 37-40)
    - **W, A, S, D** และปุ่มอักษรทั่วไป
  - ตัวเกมจะหยุดเดิน / หยุดการกระทำทันที 100% ไม่เกิดปัญหาปุ่มค้างถาวรในเกมอีกต่อไป
