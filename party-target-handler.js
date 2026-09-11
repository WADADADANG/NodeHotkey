/**
 * party-target-handler.js - Decoupled Central Vision & Consumer Actions for NodeHotkey
 * 
 * สถาปัตยกรรมแบบแยกส่วน (Decoupled Vision Architecture):
 * 1. `runPartyScannerAction`: สแกนหน้าจอเพื่อเก็บข้อมูล Slot 1-8 และ HP % เข้า Memory กลาง (ไม่คลิกเมาส์ 100%)
 * 2. `runSelectPartySlotAction`: คลิกเลือกสมาชิกตาม Slot ที่ระบุ (เช่น Slot 1 หัวตี้) เพื่อกดเดินตาม Follow (Z)
 * 3. `runPartyHealAction`: ดึงข้อมูลจากตัวสแกนกลางเพื่อคลิกเลือกคนเลือดต่ำสุดที่ <= เกณฑ์
 * 4. `runPartyBuffAction`: ดึงข้อมูลจากตัวสแกนกลางเพื่อคลิกวนแจกบัฟทีละคน (Downward Tracking + Tooltip Evasion)
 * 5. `runPartyTargetRouterAction`: ฟังก์ชันรองรับย้อนหลังสำหรับ Profile เดิม
 */

const fs = require('fs');
const path = require('path');
const visionService = require('./vision-service');

const buffLoopIndices = new Map(); // actionId -> current member index
const lastExecutionTimes = new Map(); // actionId -> timestamp

async function simulateRealisticClick(page, x, y) {
    try {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 60));
        await page.mouse.up();
    } catch (e) {
        await page.mouse.click(x, y).catch(() => {});
    }
}

/**
 * 1. runPartyScannerAction (Vision Scanner Only)
 * ทำหน้าที่สแกนหน้าต่างปาร์ตี้ของ Client ที่ระบุ อัปเดตพิกัดและสถานะ HP ลงในแคชกลาง
 * *ไม่มีการคลิกเมาส์เด็ดขาด* ป้องกันการแย่งเมาส์และลดอาการแลค
 */
async function runPartyScannerAction(action, callStack) {
    if (global.isSuspended) return;

    const targetClientId = String(action.targetClient || '1');
    const page = global.clientPages ? global.clientPages[targetClientId] : null;
    const showOverlay = action.showOverlay !== false;

    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
        console.warn(`⚠️ [PartyScanner] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    try {
        // สแกนหน้าจอสด 1 รอบผ่าน VisionService และเก็บแคชไว้ส่วนกลาง
        const readNames = action.readNames !== false;
        const partyState = await visionService.scanClientPage(page, targetClientId, action.scanRegion, { readNames });

        if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
            console.warn(`⚠️ [PartyScanner] Client ${targetClientId}: ไม่พบหน้าต่างปาร์ตี้บนจอ`);
            visionService.saveVisionDebugDump(targetClientId, 'party_not_found').catch(() => {});
            if (showOverlay && visionService.VisualOverlay) {
                await visionService.VisualOverlay.clear(page).catch(() => {});
            }
            if (typeof global.fireChain === 'function') {
                await global.fireChain(action, 'onError', callStack);
            }
            return;
        }

        // วาด HUD Overlay หากเปิดไว้
        if (showOverlay && visionService.VisualOverlay) {
            await visionService.VisualOverlay.render(page, partyState);
        }

        // ตรวจสอบว่ามีคนเลือดต่ำกว่าเกณฑ์หรือไม่ เพื่อส่งสัญญาณ onLowHp
        const lowHpThresh = parseInt(action.lowHpThreshold, 10) || 70;
        const lowHpMembers = partyState.members.filter(m => m.isAlive && m.hpPercent !== null && m.hpPercent <= lowHpThresh);

        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onScanned', callStack);
            if (lowHpMembers.length > 0) {
                await global.fireChain(action, 'onLowHp', callStack);
            }
        }
    } catch (err) {
        console.error(`❌ [PartyScanner Error] Client ${targetClientId}:`, err.message);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
    }
}

/**
 * 2. runSelectPartySlotAction (Consumer Action)
 * คลิกเลือกสล็อตที่ระบุ (เช่น Slot 1 หัวตี้) เพื่อกดเดินตาม (Z) หรือคำสั่งเฉพาะ
 */
async function runSelectPartySlotAction(action, callStack) {
    if (global.isSuspended) return;

    const targetClientId = String(action.targetClient || '1');
    const page = global.clientPages ? global.clientPages[targetClientId] : null;
    const showOverlay = action.showOverlay !== false;

    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
        console.warn(`⚠️ [SelectPartySlot] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const targetSlotNum = parseInt(action.targetSlot || '1', 10);
    const slotIndex = Math.max(0, targetSlotNum - 1);
    const delayAfterClick = parseInt(action.delayAfterClick, 10) || 80;

    // ตรวจสอบแคชกลางก่อน หากมีแคชสดใหม่ไม่เกิน 2000ms ใช้งานได้ทันที ไม่ต้องแคปเจอร์จอใหม่
    let partyState = visionService.getLatestPartyState(targetClientId);
    if (!partyState || !Array.isArray(partyState.members) || partyState.members.length <= slotIndex || (Date.now() - (partyState.timestamp || 0)) > 2000) {
        partyState = await visionService.scanClientPage(page, targetClientId);
    }

    if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
        console.warn(`⚠️ [SelectPartySlot] Client ${targetClientId}: ไม่พบหน้าต่างปาร์ตี้บนจอ`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const target = (slotIndex < partyState.members.length) ? partyState.members[slotIndex] : partyState.members[partyState.members.length - 1];
    if (!target || !target.click) {
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    console.log(`🎯 [SelectPartySlot] Client ${targetClientId}: คลิกเลือก Slot ${targetSlotNum} ที่พิกัด (${target.click.x}, ${target.click.y})`);

    // วาดเป้าหมายจุดคลิกบนหน้าจอเกม
    if (showOverlay && visionService.VisualOverlay) {
        await visionService.VisualOverlay.render(page, {
            ...partyState,
            lastClick: { x: target.click.x, y: target.click.y }
        });
    }

    // คลิกเลือก Slot นั้น
    await simulateRealisticClick(page, target.click.x, target.click.y);

    // สะบัดเมาส์หลบออกไปทางขวา 250px ป้องกัน Tooltip เด้งค้าง
    try {
        await page.mouse.move(target.click.x + 250, target.click.y);
    } catch (e) {}

    if (delayAfterClick > 0) {
        await new Promise(r => setTimeout(r, delayAfterClick));
    }

    // ส่งสัญญาณต่อไปยัง Action ถัดไป (เช่น Key Press ปุ่ม Z เพื่อเดินตาม)
    if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'next', callStack);
        await global.fireChain(action, 'onSelected', callStack);
        await global.fireChain(action, 'onComplete', callStack);
    }
}

/**
 * 3. runPartyHealAction (Consumer Action)
 * คลิกเลือกสมาชิกที่มีเลือดต่ำสุดที่ <= เกณฑ์ เพื่อส่งสัญญาณยิงสกิลฮีล
 */
async function runPartyHealAction(action, callStack) {
    if (global.isSuspended) return;

    const targetClientId = String(action.targetClient || '1');
    const page = global.clientPages ? global.clientPages[targetClientId] : null;
    const showOverlay = action.showOverlay !== false;

    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
        console.warn(`⚠️ [PartyHeal] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const lowHpThreshold = parseInt(action.lowHpThreshold, 10) || 70;
    const delayAfterClick = parseInt(action.delayAfterClick, 10) || 80;

    // ตรวจสอบแคชกลางก่อน
    let partyState = visionService.getLatestPartyState(targetClientId);
    if (!partyState || !Array.isArray(partyState.members) || (Date.now() - (partyState.timestamp || 0)) > 1500) {
        partyState = await visionService.scanClientPage(page, targetClientId);
    }

    if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
        console.warn(`⚠️ [PartyHeal] Client ${targetClientId}: ไม่พบสมาชิกปาร์ตี้`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    // ค้นหาเฉพาะคนที่ยังมีชีวิตอยู่และเลือดต่ำกว่าเกณฑ์
    const damagedMembers = partyState.members.filter(m => m.isAlive && m.hpPercent !== null && m.hpPercent <= lowHpThreshold);

    if (damagedMembers.length === 0) {
        // ทุกคนเลือดปกติ/ปลอดภัย ไม่ต้องทำอะไร
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onNoTarget', callStack);
        }
        return;
    }

    // เรียงหาคนที่เลือดน้อยที่สุด
    damagedMembers.sort((a, b) => (a.hpPercent ?? 100) - (b.hpPercent ?? 100));
    const target = damagedMembers[0];

    console.log(`🚑 [PartyHeal] Client ${targetClientId}: พบ Slot ${target.slot} เลือดต่ำ (${target.hpPercent}%) กำลังคลิกช่วยเหลือ...`);

    // วาดจุดคลิก
    if (showOverlay && visionService.VisualOverlay) {
        await visionService.VisualOverlay.render(page, {
            ...partyState,
            lastClick: { x: target.click.x, y: target.click.y }
        });
    }

    // คลิกเลือกเป้าหมาย
    await simulateRealisticClick(page, target.click.x, target.click.y);

    // สะบัดเมาส์หลบออกไปทางขวา 250px
    try {
        await page.mouse.move(target.click.x + 250, target.click.y);
    } catch (e) {}

    if (delayAfterClick > 0) {
        await new Promise(r => setTimeout(r, delayAfterClick));
    }

    // ส่งสัญญาณไปยิงสกิลฮีล
    if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onHealTarget', callStack);
        await global.fireChain(action, 'onMemberLowHp', callStack);
    }
}

/**
 * 4. runPartyBuffAction (Consumer Action)
 * วนคลิกแจกบัฟสมาชิกทุกคนทีละคน (Downward Tracking + Tooltip Evasion)
 */
/**
 * 4. runPartyBuffAction (Name-Based Party Buffing Engine)
 * วนคลิกแจกบัฟสมาชิกทุกคนโดยอ้างอิงจากชื่อตัวละครจริง (Name-Based Tracking)
 * แก้ปัญหาไอคอนบัฟดันหลอดเลื่อน และข้ามคนนอกระยะ/ออฟไลน์ทันที 0ms ไม่บัฟตัวเอง
 */
async function runPartyBuffAction(action, callStack) {
    if (global.isSuspended) return;

    const targetClientId = String(action.targetClient || '1');
    const page = global.clientPages ? global.clientPages[targetClientId] : null;
    const showOverlay = action.showOverlay !== false;

    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
        console.warn(`⚠️ [PartyBuff] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const delayAfterClick = parseInt(action.delayAfterClick, 10) || 80;
    const scanRegion = action.scanRegion || 'auto';

    // สแกนรอบแรกเพื่อค้นหาหน้าต่างปาร์ตี้และอ่านรายชื่อสมาชิก (เปิด OCR รอบแรกเพื่อให้ได้ชื่อจริง)
    const initialScan = await visionService.scanClientPage(page, targetClientId, scanRegion, { readNames: true });

    if (!initialScan || !Array.isArray(initialScan.members) || initialScan.members.length === 0) {
        console.warn(`⚠️ [PartyBuff] Client ${targetClientId}: ไม่พบหน้าต่างปาร์ตี้`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    // จัดเก็บชื่อและสถานะเริ่มต้นของแต่ละ Slot
    const slotNames = new Map();
    const slotIsLeader = new Map();
    initialScan.members.forEach(m => {
        slotNames.set(m.slot, m.name || `Slot_${m.slot}`);
        if (m.isLeader) slotIsLeader.set(m.slot, true);
    });

    // กรองเฉพาะ Slot ที่เป็นสมาชิกที่อยู่ในระยะและพร้อมรับบัฟ (active)
    const activeSlots = initialScan.members
        .filter(m => m.isAlive && m.statusCode === 'active')
        .map(m => m.slot);
    const totalToBuff = activeSlots.length;

    console.log(`🚀 [PartyBuff] Client ${targetClientId}: เริ่มต้นวนแจกบัฟสมาชิกปาร์ตี้ (พบในระยะพร้อมบัฟ ${totalToBuff} คน จากทั้งหมด ${initialScan.members.length} คน: ${activeSlots.map(s => slotNames.get(s)).join(', ')})...`);

    if (totalToBuff === 0) {
        console.warn(`⚠️ [PartyBuff] Client ${targetClientId}: ไม่มีสมาชิกที่พร้อมรับบัฟ (ทั้งหมดไม่อยู่ในระยะหรือ Offline)`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onComplete', callStack);
        }
        return;
    }

    const buffedSlots = new Set();
    const buffedMemberSummaries = [];
    let currentPartyState = initialScan;

    for (let i = 0; i < activeSlots.length; i++) {
        if (global.isSuspended) {
            console.log(`⏸️ [PartyBuff] Client ${targetClientId}: ระบบถูกสั่งหยุดชั่วคราว`);
            break;
        }

        const targetSlot = activeSlots[i];
        const memberName = slotNames.get(targetSlot) || `Slot_${targetSlot}`;
        const isLeader = slotIsLeader.get(targetSlot) || false;

        // ถ้าไม่ใช่คนแรก (i > 0) ให้สแกนตำแหน่งสดใหม่เพื่ออัปเดตแกน Y (เพราะไอคอนบัฟของคนก่อนหน้าจะดันหลอดเลือดคนล่างๆ เลื่อนลง)
        // ใช้ readNames: false เพื่อความรวดเร็วระดับมิลลิวินาที ไม่ต้องรอ Tesseract OCR และป้องกันชื่อเพี้ยน
        if (i > 0) {
            try {
                const safeX = (currentPartyState?.startX && currentPartyState.startX > 500) ? currentPartyState.startX - 220 : 350;
                await page.mouse.move(safeX, 250);
            } catch (e) {}
            await new Promise(r => setTimeout(r, 60));

            const freshState = await visionService.scanClientPage(page, targetClientId, scanRegion, { readNames: false });
            if (freshState && Array.isArray(freshState.members) && freshState.members.length > 0) {
                currentPartyState = freshState;
            }
        }

        // ค้นหาพิกัดของ slot เป้าหมายใน state ปัจจุบัน
        let target = currentPartyState.members.find(m => m.slot === targetSlot);
        if (!target) {
            // Fallback ใช้พิกัดเดิมจาก initialScan
            target = initialScan.members.find(m => m.slot === targetSlot);
        }

        if (!target) {
            console.warn(`⚠️ [PartyBuff] Client ${targetClientId}: ไม่พบพิกัดของ Slot ${targetSlot} ("${memberName}") ข้ามไปยังคนถัดไป`);
            continue;
        }

        // ตรวจสอบว่าสมาชิกยัง active อยู่หรือไม่
        if (target.statusCode && target.statusCode !== 'active') {
            console.log(`⏩ [PartyBuff] Client ${targetClientId}: ข้าม Slot ${targetSlot} ("${memberName}") เนื่องจากสถานะเป็น ${target.statusCode}`);
            continue;
        }

        console.log(`🎯 [PartyBuff] Client ${targetClientId}: [บัฟคนที่ ${i + 1}/${totalToBuff}] เลือก "${memberName}" ${isLeader ? '👑 (หัวตี้)' : ''} ที่ (${target.click.x}, ${target.click.y})`);

        // วาด HUD Overlay
        if (showOverlay && visionService.VisualOverlay) {
            await visionService.VisualOverlay.render(page, {
                ...currentPartyState,
                lastClick: { x: target.click.x, y: target.click.y }
            });
        }

        // คลิกเลือกสมาชิกคนนี้
        await simulateRealisticClick(page, target.click.x, target.click.y);

        // สะบัดเมาส์หลบออกไปด้านข้าง 220px ทันทีเพื่อป้องกัน Tooltip บัง
        try {
            const awayX = target.click.x > 500 ? target.click.x - 220 : target.click.x + 220;
            await page.mouse.move(awayX, target.click.y);
        } catch (e) {}

        if (delayAfterClick > 0) {
            const ok = await (global.abortableSleep ? global.abortableSleep(delayAfterClick) : new Promise(r => setTimeout(r, delayAfterClick)));
            if (!ok || global.isSuspended) break;
        }

        // ส่งสัญญาณให้ Action ร่ายสกิลบัฟ และรอให้ร่ายเสร็จ
        if (typeof global.fireChain === 'function' && !global.isSuspended) {
            await global.fireChain(action, 'onNextMember', new Set());
        }

        // บันทึกว่าสล็อตนี้บัฟสำเร็จแล้ว
        buffedSlots.add(targetSlot);
        buffedMemberSummaries.push(memberName);

        if (global.isSuspended) break;

        // หน่วงเวลาระหว่างสมาชิกเล็กน้อย
        const ok = await (global.abortableSleep ? global.abortableSleep(200) : new Promise(r => setTimeout(r, 200)));
        if (!ok || global.isSuspended) break;
    }

    console.log(`🏁 [PartyBuff] Client ${targetClientId}: วนแจกบัฟครบทุกคนแล้ว! (บัฟสำเร็จทั้งหมด ${buffedSlots.size}/${totalToBuff} คน: ${buffedMemberSummaries.join(', ')})`);
    if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onComplete', callStack);
    }
}

/**
 * 5. runPartyTargetRouterAction (Backwards Compatibility Fallback)
 */
async function runPartyTargetRouterAction(action, callStack) {
    const targetMode = action.targetMode || 'heal_priority';
    if (targetMode === 'select_slot') {
        return await runSelectPartySlotAction(action, callStack);
    } else if (targetMode === 'buff_loop') {
        return await runPartyBuffAction(action, callStack);
    } else {
        return await runPartyHealAction(action, callStack);
    }
}

/**
 * 6. runScreenshotAction (Utility / Vision Diagnostic)
 * ถ่ายภาพหน้าจอตามโซนที่กำหนด (full, party, right, left, target, custom) และบันทึกลง ./screenshots/
 */
async function runScreenshotAction(action, callStack) {
    if (global.isSuspended) return;

    const targetClientId = String(action.targetClient || '1');
    const region = action.captureRegion || action.region || 'full';
    const annotate = action.annotate !== false;
    const prefix = (action.prefix || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawSubfolder = (action.subfolder !== undefined && action.subfolder !== '') ? action.subfolder : (action.folder || `client_${targetClientId}`);
    const subfolder = String(rawSubfolder).trim().replace(/[\\/:*?"<>|]/g, '_');

    try {
        const dir = path.join(__dirname, 'screenshots', subfolder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const buffer = await visionService.captureScreenshot(targetClientId, {
            region,
            annotate,
            customRect: action.customRect
        });

        if (!buffer) {
            console.warn(`⚠️ [Screenshot] Client ${targetClientId}: ไม่สามารถดึงภาพหน้าจอได้`);
            if (typeof global.fireChain === 'function') {
                await global.fireChain(action, 'onError', callStack);
            }
            return;
        }

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const filename = `screenshot_c${targetClientId}_${prefix}_${timestamp}.jpg`;
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, buffer);

        console.log(`📸 [Screenshot] Client ${targetClientId}: บันทึกภาพเรียบร้อย (${region}) ➔ ./screenshots/${subfolder}/${filename}`);

        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onComplete', callStack);
        }
    } catch (err) {
        console.error(`❌ [Screenshot Error] Client ${targetClientId}:`, err.message);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
    }
}

module.exports = {
    runPartyScannerAction,
    runSelectPartySlotAction,
    runPartyHealAction,
    runPartyBuffAction,
    runPartyTargetRouterAction,
    runScreenshotAction
};
