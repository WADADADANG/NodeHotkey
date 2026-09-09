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
        const partyState = await visionService.scanClientPage(page, targetClientId, action.scanRegion);

        if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
            console.warn(`⚠️ [PartyScanner] Client ${targetClientId}: ไม่พบหน้าต่างปาร์ตี้บนจอ`);
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

    // สแกนเพื่อหาตำแหน่งเริ่มต้น
    visionService.resetClientCalibration(targetClientId);
    const partyState = await visionService.scanClientPage(page, targetClientId, action.scanRegion);

    if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
        console.warn(`⚠️ [PartyBuff] Client ${targetClientId}: ไม่พบหน้าต่างปาร์ตี้`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const totalMembers = partyState.members.length;
    console.log(`🚀 [PartyBuff] Client ${targetClientId}: เริ่มต้นวนแจกบัฟสมาชิกปาร์ตี้ทั้งหมด ${totalMembers} คน...`);

    let lastTargetY = 0;
    let lastTargetX = Math.round((partyState.members[0].startX || 25) + (partyState.members[0].barWidth || 70) / 2);

    for (let i = 0; i < totalMembers; i++) {
        if (global.isSuspended) {
            console.log(`⏸️ [PartyBuff] Client ${targetClientId}: ระบบถูกสั่งหยุดชั่วคราว`);
            break;
        }

        let target = null;
        let currentPartyState = partyState;

        if (i === 0) {
            target = partyState.members[0];
        } else {
            // หลบเมาส์ก่อนสแกนป้องกัน Tooltip บัง
            try {
                await page.mouse.move(350, 250);
            } catch (e) {}
            await new Promise(r => setTimeout(r, 60));

            // สแกนสดใหม่เพื่อให้ได้พิกัด Y ที่แท้จริง (หลังไอคอนบัฟของคนก่อนหน้าขยาย)
            const freshState = await visionService.scanClientPage(page, targetClientId, action.scanRegion);
            if (freshState && Array.isArray(freshState.members) && freshState.members.length > 0) {
                currentPartyState = freshState;
                const candidatesBelow = freshState.members.filter(m => m.barY > lastTargetY + 20);
                if (candidatesBelow.length > 0) {
                    target = candidatesBelow[0];
                } else if (freshState.members[i]) {
                    target = freshState.members[i];
                } else {
                    target = freshState.members[freshState.members.length - 1];
                }
            }

            // Fallback
            if (!target || !target.click) {
                const estimatedY = lastTargetY + 50;
                target = {
                    slot: i + 1,
                    barY: estimatedY,
                    click: { x: lastTargetX, y: estimatedY }
                };
            }
        }

        if (!target || !target.click) continue;

        lastTargetY = target.barY || target.click.y;
        lastTargetX = target.click.x;

        // 🛡️ ข้ามสมาชิกที่อยู่นอกระยะ (out_of_range), คนตาย (dead), หรือออฟไลน์ (offline)
        if (!target.isAlive || target.statusCode === 'out_of_range' || target.statusCode === 'dead' || target.statusCode === 'offline') {
            console.log(`⏩ [PartyBuff] Client ${targetClientId}: [คนที่ ${i + 1}/${totalMembers}] ข้าม Slot ${target.slot || i + 1} เนื่องจากอยู่นอกระยะ/ไม่อยู่ (${target.statusCode || 'inactive'})`);
            continue;
        }

        console.log(`🎯 [PartyBuff] Client ${targetClientId}: [บัฟคนที่ ${i + 1}/${totalMembers}] คลิก Slot ${target.slot || i + 1} ที่ (${target.click.x}, ${target.click.y})`);

        // วาด HUD Overlay
        if (showOverlay && visionService.VisualOverlay) {
            await visionService.VisualOverlay.render(page, {
                ...currentPartyState,
                lastClick: { x: target.click.x, y: target.click.y }
            });
        }

        // คลิกเลือกเป้าหมายคนนี้
        await simulateRealisticClick(page, target.click.x, target.click.y);

        // สะบัดเมาส์หลบออกไปทางขวา 250px
        try {
            await page.mouse.move(target.click.x + 250, target.click.y);
        } catch (e) {}

        if (delayAfterClick > 0) {
            const ok = await (global.abortableSleep ? global.abortableSleep(delayAfterClick) : new Promise(r => setTimeout(r, delayAfterClick)));
            if (!ok || global.isSuspended) break;
        }

        // ส่งสัญญาณให้ Action ร่ายสกิลบัฟ และรอให้ร่ายเสร็จ
        if (typeof global.fireChain === 'function' && !global.isSuspended) {
            await global.fireChain(action, 'onNextMember', new Set());
        }

        if (global.isSuspended) break;

        // หน่วงเวลาระหว่างสมาชิกเล็กน้อย
        const ok = await (global.abortableSleep ? global.abortableSleep(200) : new Promise(r => setTimeout(r, 200)));
        if (!ok || global.isSuspended) break;
    }

    console.log(`🏁 [PartyBuff] Client ${targetClientId}: วนแจกบัฟครบสมาชิกทุกคนแล้ว!`);
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

module.exports = {
    runPartyScannerAction,
    runSelectPartySlotAction,
    runPartyHealAction,
    runPartyBuffAction,
    runPartyTargetRouterAction
};
