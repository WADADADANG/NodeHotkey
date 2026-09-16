/**
 * party-target-handler.js - Decoupled Central Vision & Consumer Actions for NodeHotkey
 * 
 * สถาปัตยกรรมแบบแยกส่วน (Decoupled Vision Architecture):
 * 1. `runPartyScannerAction`: สแกนหน้าจอเพื่อเก็บข้อมูล Slot 1-8 และ HP % เข้า Memory กลาง (ไม่คลิกเมาส์ 100%)
 * 2. `runSelectPartySlotAction`: คลิกเลือกสมาชิกตาม Slot ที่ระบุ (เช่น Slot 1 หัวตี้) เพื่อกดเดินตาม Follow (Z)
 * 3. `runPartyHealAction`: ดึงข้อมูลจากตัวสแกนกลางเพื่อคลิกเลือกคนเลือดต่ำสุดที่ <= เกณฑ์
 * 4. `runPartyBuffAction`: ดึงข้อมูลจากตัวสแกนกลางเพื่อคลิกวนแจกบัฟทีละคน (Downward Tracking + Tooltip Evasion)
 * 5. `runScreenshotAction`: จับภาพหน้าจอเฉพาะส่วนหรือทั้งจอ
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
        console.warn(`[PartyScanner] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    try {
        // Scan live page once via VisionService (OCR readNames defaults to false to eliminate 100% CPU bottleneck)
        const readNames = action.readNames === true;
        const partyState = await visionService.scanClientPage(page, targetClientId, action.scanRegion, { readNames });

        if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
            console.warn(`[PartyScanner] Client ${targetClientId}: Party window not found on screen.`);
            visionService.saveVisionDebugDump(targetClientId, 'party_not_found').catch(() => {});
            if (showOverlay && visionService.VisualOverlay) {
                await visionService.VisualOverlay.clear(page).catch(() => {});
            }
            if (typeof global.fireChain === 'function') {
                await global.fireChain(action, 'onError', callStack);
            }
            return;
        }

        // Render HUD overlay if enabled
        if (showOverlay && visionService.VisualOverlay) {
            await visionService.VisualOverlay.render(page, partyState);
        }

        // Prepare data outputs
        const count = partyState.members.length;
        const namesList = partyState.members.map(m => m.name || `Slot_${m.slot}`);
        const namesStr = namesList.join(', ');
        const memberSummaries = partyState.members.map(m => {
            const hpStr = m.hpPercent !== null ? `${m.hpPercent}%` : (m.isAlive ? '100%' : 'Dead');
            const statusStr = m.statusCode === 'active' ? '' : ` [${m.statusCode}]`;
            return `Slot ${m.slot}: ${m.name || 'Slot_' + m.slot} (${hpStr}${statusStr})`;
        });
        const summaryInfo = `Found ${count} members: ${memberSummaries.join(', ')}`;

        // Set action properties for data wire routing
        action.names_out = namesStr;
        action.count_out = count;
        action.info_out = summaryInfo;
        action.slot_out = count;
        action.name_out = namesStr;
        action.value = summaryInfo;
        action.members_out = partyState.members;

        console.log(`[PartyScanner] Client ${targetClientId}: ${summaryInfo}`);

        // Check low HP members to trigger onLowHp signal
        const lowHpThresh = parseInt(action.lowHpThreshold, 10) || 70;
        const lowHpMembers = partyState.members.filter(m => m.isAlive && m.hpPercent !== null && m.hpPercent <= lowHpThresh);

        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onScanned', callStack);
            if (lowHpMembers.length > 0) {
                await global.fireChain(action, 'onLowHp', callStack);
            }
        }
    } catch (err) {
        console.error(`[PartyScanner Error] Client ${targetClientId}:`, err.message);
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
        console.warn(`[SelectPartySlot] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const targetSlotNum = parseInt(action.targetSlot || '1', 10);
    const slotIndex = Math.max(0, targetSlotNum - 1);
    const delayAfterClick = parseInt(action.delayAfterClick, 10) || 80;

    // Check central cache first
    let partyState = visionService.getLatestPartyState(targetClientId);
    if (!partyState || !Array.isArray(partyState.members) || partyState.members.length <= slotIndex || (Date.now() - (partyState.timestamp || 0)) > 2000) {
        partyState = await visionService.scanClientPage(page, targetClientId);
    }

    if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
        console.warn(`[SelectPartySlot] Client ${targetClientId}: Party window not found on screen.`);
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

    console.log(`[SelectPartySlot] Client ${targetClientId}: Selected Slot ${targetSlotNum} at (${target.click.x}, ${target.click.y})`);

    // Draw click target on game overlay
    if (showOverlay && visionService.VisualOverlay) {
        await visionService.VisualOverlay.render(page, {
            ...partyState,
            lastClick: { x: target.click.x, y: target.click.y }
        });
    }

    // Click on target slot
    await simulateRealisticClick(page, target.click.x, target.click.y);

    // Flick mouse cursor away by 250px to prevent tooltip staying open
    try {
        await page.mouse.move(target.click.x + 250, target.click.y);
    } catch (e) {}

    if (delayAfterClick > 0) {
        await new Promise(r => setTimeout(r, delayAfterClick));
    }

    // Trigger subsequent execution flow
    if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'next', callStack);
        await global.fireChain(action, 'onSelected', callStack);
        await global.fireChain(action, 'onComplete', callStack);
    }
}

/**
 * 3. runPartyHealAction (Consumer Action)
 * Click lowest HP member <= threshold to trigger healing skill
 */
async function runPartyHealAction(action, callStack) {
    if (global.isSuspended) return;

    const targetClientId = String(action.targetClient || '1');
    const page = global.clientPages ? global.clientPages[targetClientId] : null;
    const showOverlay = action.showOverlay !== false;

    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
        console.warn(`[PartyHeal] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const lowHpThreshold = parseInt(action.lowHpThreshold, 10) || 70;
    const delayAfterClick = parseInt(action.delayAfterClick, 10) || 80;

    let partyState = visionService.getLatestPartyState(targetClientId);
    if (!partyState || !Array.isArray(partyState.members) || (Date.now() - (partyState.timestamp || 0)) > 1500) {
        partyState = await visionService.scanClientPage(page, targetClientId);
    }

    if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
        console.warn(`[PartyHeal] Client ${targetClientId}: No party members found.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    // Find damaged members
    const damagedMembers = partyState.members.filter(m => m.isAlive && m.hpPercent !== null && m.hpPercent <= lowHpThreshold);

    if (damagedMembers.length === 0) {
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onNoTarget', callStack);
        }
        return;
    }

    damagedMembers.sort((a, b) => (a.hpPercent ?? 100) - (b.hpPercent ?? 100));
    const target = damagedMembers[0];

    console.log(`[PartyHeal] Client ${targetClientId}: Low HP detected on Slot ${target.slot} (${target.hpPercent}%), clicking target...`);

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
        console.warn(`[PartyBuff] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    const delayAfterClick = parseInt(action.delayAfterClick, 10) || 80;
    const scanRegion = action.scanRegion || 'auto';

    // First scan to find party window and member names (readNames: true for initial scan)
    const initialScan = await visionService.scanClientPage(page, targetClientId, scanRegion, { readNames: true });

    if (!initialScan || !Array.isArray(initialScan.members) || initialScan.members.length === 0) {
        console.warn(`[PartyBuff] Client ${targetClientId}: Party window not found on screen.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    // Cache initial member names and statuses
    const slotNames = new Map();
    const slotIsLeader = new Map();
    initialScan.members.forEach(m => {
        slotNames.set(m.slot, m.name || `Slot_${m.slot}`);
        if (m.isLeader) slotIsLeader.set(m.slot, true);
    });

    // Filter active members in range
    const activeSlots = initialScan.members
        .filter(m => m.isAlive && m.statusCode === 'active')
        .map(m => m.slot);
    const totalToBuff = activeSlots.length;

    console.log(`[PartyBuff] Client ${targetClientId}: Starting buff cycle (${totalToBuff} ready out of ${initialScan.members.length} total: ${activeSlots.map(s => slotNames.get(s)).join(', ')})...`);

    if (totalToBuff === 0) {
        console.warn(`[PartyBuff] Client ${targetClientId}: No members in range or ready for buff.`);
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
            console.log(`[PartyBuff] Client ${targetClientId}: Paused.`);
            break;
        }

        const targetSlot = activeSlots[i];
        const memberName = slotNames.get(targetSlot) || `Slot_${targetSlot}`;
        const isLeader = slotIsLeader.get(targetSlot) || false;

        // Refresh coordinates for subsequent members
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

        let target = currentPartyState.members.find(m => m.slot === targetSlot);
        if (!target) {
            target = initialScan.members.find(m => m.slot === targetSlot);
        }

        if (!target) {
            console.warn(`[PartyBuff] Client ${targetClientId}: Coordinates not found for Slot ${targetSlot} ("${memberName}"), skipping.`);
            continue;
        }

        if (target.statusCode && target.statusCode !== 'active') {
            console.log(`[PartyBuff] Client ${targetClientId}: Skipping Slot ${targetSlot} ("${memberName}") - status: ${target.statusCode}`);
            continue;
        }

        console.log(`[PartyBuff] Client ${targetClientId}: [Buffing ${i + 1}/${totalToBuff}] Slot ${targetSlot} "${memberName}" ${isLeader ? '(Leader)' : ''} at (${target.click.x}, ${target.click.y})`);

        // Set action output values for downstream nodes
        action.slot_out = targetSlot;
        action.name_out = memberName;
        action.info_out = `Slot ${targetSlot}: ${memberName} [${i + 1}/${totalToBuff}]`;
        action.index_out = i + 1;
        action.total_out = totalToBuff;
        action.value = memberName;

        if (showOverlay && visionService.VisualOverlay) {
            await visionService.VisualOverlay.render(page, {
                ...currentPartyState,
                lastClick: { x: target.click.x, y: target.click.y }
            });
        }

        await simulateRealisticClick(page, target.click.x, target.click.y);

        try {
            const awayX = target.click.x > 500 ? target.click.x - 220 : target.click.x + 220;
            await page.mouse.move(awayX, target.click.y);
        } catch (e) {}

        if (delayAfterClick > 0) {
            const ok = await (global.abortableSleep ? global.abortableSleep(delayAfterClick) : new Promise(r => setTimeout(r, delayAfterClick)));
            if (!ok || global.isSuspended) break;
        }

        if (typeof global.fireChain === 'function' && !global.isSuspended) {
            await global.fireChain(action, 'onNextMember', new Set());
        }

        buffedSlots.add(targetSlot);
        buffedMemberSummaries.push(memberName);

        if (global.isSuspended) break;

        const ok = await (global.abortableSleep ? global.abortableSleep(200) : new Promise(r => setTimeout(r, 200)));
        if (!ok || global.isSuspended) break;
    }

    const completeSummary = `Completed buff cycle (${buffedSlots.size}/${totalToBuff} members: ${buffedMemberSummaries.join(', ')})`;
    action.info_out = completeSummary;
    action.value = `Complete (${buffedSlots.size}/${totalToBuff})`;

    console.log(`[PartyBuff] Client ${targetClientId}: ${completeSummary}`);
    if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onComplete', callStack);
    }
}

/**
 * 5. runScreenshotAction (Utility / Vision Diagnostic)
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
            console.warn(`[Screenshot] Client ${targetClientId}: Failed to capture screenshot.`);
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

        console.log(`[Screenshot] Client ${targetClientId}: Saved screenshot (${region}) -> ./screenshots/${subfolder}/${filename}`);

        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onComplete', callStack);
        }
    } catch (err) {
        console.error(`[Screenshot Error] Client ${targetClientId}:`, err.message);
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
    runScreenshotAction
};
