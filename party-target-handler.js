/**
 * party-target-handler.js - NodeHotkey Party Target Router Action Runner
 * 
 * หน้าที่หลัก:
 * 1. ควบคุมการสแกนผ่าน vision-service ตามรอบเวลา scanIntervalMs
 * 2. โหมด 'heal_priority': ตรวจหาคนที่เลือดต่ำสุด <= lowHpThreshold -> คลิกเลือกเป้าหมาย -> ส่งสัญญาณออกทาง 'onMemberLowHp'
 * 3. โหมด 'buff_loop': วนคลิกสมาชิกทีละคน (ข้ามคนตาย/นอกระยะ) -> ส่งสัญญาณออกทาง 'onNextMember' -> เมื่อครบทุกคนส่ง 'onComplete'
 * 4. ซิงค์สถานะสดส่งต่อไปยัง Overlay หลัก (Native HUD) ของ NodeHotkey แบบ Real-time
 * 5. ปิด/เปิด และเคลียร์เส้น HUD บนหน้าจอเกมอัตโนมัติ ไม่ให้มีเส้นค้าง
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

async function runPartyTargetRouterAction(action, callStack) {
    if (global.isSuspended) return;

    const targetClientId = String(action.targetClient || '1');
    const page = global.clientPages ? global.clientPages[targetClientId] : null;
    const showOverlay = action.showOverlay !== false;

    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
        console.warn(`⚠️ [PartyTargetRouter] Client ${targetClientId} is not active or closed.`);
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
        return;
    }

    // อัปเดตสถานะขึ้น Overlay หลัก: กำลังสแกน
    if (!global.activePartyTargetRouters) global.activePartyTargetRouters = {};
    global.activePartyTargetRouters[action.id] = {
        name: action.name || 'Party Target',
        type: 'party_target',
        detail: `Scanning Cl ${targetClientId}...`
    };
    if (typeof global.sendOverlayUpdate === 'function') global.sendOverlayUpdate();

    // ตรวจสอบรอบเวลาสแกน (scanIntervalMs)
    const scanInterval = parseInt(action.scanIntervalMs, 10) || 250;
    const now = Date.now();
    const lastExec = lastExecutionTimes.get(action.id) || 0;
    
    // หากถูกเรียกซ้ำเร็วเกินรอบเวลาที่ตั้งไว้ ให้หน่วงเวลาเล็กน้อย
    if (now - lastExec < scanInterval) {
        const waitTime = scanInterval - (now - lastExec);
        if (waitTime > 10) {
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
    lastExecutionTimes.set(action.id, Date.now());

    try {
        // 1. สแกนหน้าจอของ Client นี้ผ่าน VisionService (รีเซ็ต Calibration เพื่อหาขนาดและตำแหน่งสดๆ ทุกครั้งที่กด)
        visionService.resetClientCalibration(targetClientId);
        const partyState = await visionService.scanClientPage(page, targetClientId);

        if (!partyState || !Array.isArray(partyState.members) || partyState.members.length === 0) {
            console.warn(`⚠️ [PartyTargetRouter] Client ${targetClientId}: ไม่พบหน้าต่างปาร์ตี้บนจอ (กรุณาเปิดหน้าต่างปาร์ตี้ในเกมให้เห็นหลอดเลือด)`);
            if (showOverlay && visionService.VisualOverlay) {
                await visionService.VisualOverlay.clear(page);
            }
            if (typeof global.fireChain === 'function') {
                await global.fireChain(action, 'onError', callStack);
            }
            return;
        }

        console.log(`👁️ [PartyTargetRouter] Client ${targetClientId}: สแกนพบสมาชิกปาร์ตี้ ${partyState.members.length} ช่อง (พร้อมทำงาน: ${partyState.activeMembers ? partyState.activeMembers.length : 0})`);

        // จัดการแสดงผลเส้น HUD บนหน้าจอเกม
        if (!showOverlay && visionService.VisualOverlay) {
            await visionService.VisualOverlay.clear(page);
        } else if (showOverlay && visionService.VisualOverlay) {
            await visionService.VisualOverlay.render(page, partyState);
        }

        const mode = action.targetMode || 'heal_priority';
        const delayAfterClick = parseInt(action.delayAfterClick, 10) || 80;

        // =========================================================================
        // โหมด 1: HEAL PRIORITY (ตรวจหาคนเลือดต่ำสุดที่ต้องฮีล)
        // =========================================================================
        if (mode === 'heal_priority') {
            const threshold = parseInt(action.lowHpThreshold, 10) || 70;
            const activeMembers = partyState.members.filter(m => m.isAlive);
            
            // หาคนที่มีเลือดต่ำกว่าเกณฑ์ และมีเลือดน้อยที่สุด
            let criticalMember = null;
            for (const m of activeMembers) {
                if (m.hpPercent <= threshold) {
                    if (!criticalMember || m.hpPercent < criticalMember.hpPercent) {
                        criticalMember = m;
                    }
                }
            }

            if (criticalMember && criticalMember.click) {
                console.log(`🚑 [PartyTargetRouter] Client ${targetClientId}: เลือกเป้าหมาย Slot ${criticalMember.slot} (HP: ${criticalMember.hpPercent}%) ที่พิกัด (${criticalMember.click.x}, ${criticalMember.click.y})`);
                
                // อัปเดตสถานะขึ้น Overlay หลัก: เล็งเป้าฮีล
                global.activePartyTargetRouters[action.id] = {
                    name: action.name || 'Party Target',
                    type: 'party_target',
                    detail: `🚑 Slot ${criticalMember.slot} (${criticalMember.hpPercent}%)`
                };
                if (typeof global.sendOverlayUpdate === 'function') global.sendOverlayUpdate();

                // วาดเป้าหมายจุดคลิกบนหน้าจอเกม (เฉพาะเมื่อเปิด Show Overlay)
                if (showOverlay && visionService.VisualOverlay) {
                    await visionService.VisualOverlay.render(page, {
                        ...partyState,
                        lastClick: { x: criticalMember.click.x, y: criticalMember.click.y }
                    });
                }

                // คลิกเลือกสมาชิกคนนั้นแบบเสมือนจริง
                await simulateRealisticClick(page, criticalMember.click.x, criticalMember.click.y);
                
                if (delayAfterClick > 0) {
                    await new Promise(r => setTimeout(r, delayAfterClick));
                }

                // ส่งสัญญาณต่อให้ Action Node เดิม (เช่น Single Press ปุ่ม 1 ฮีล)
                if (typeof global.fireChain === 'function') {
                    await global.fireChain(action, 'onMemberLowHp', callStack);
                }
            }
        } 
        // =========================================================================
        // โหมด 2: BUFF LOOP (วนคลิกสมาชิกทีละคนเพื่อแจกบัฟ)
        // =========================================================================
        else if (mode === 'buff_loop') {
            const validTargets = partyState.members.filter(m => m.isAlive);

            if (validTargets.length === 0) {
                console.log(`⚠️ [PartyTargetRouter] Client ${targetClientId}: ไม่มีสมาชิกปาร์ตี้ที่ออนไลน์หรืออยู่ในระยะ`);
                if (typeof global.fireChain === 'function') {
                    await global.fireChain(action, 'onComplete', callStack);
                }
                return;
            }

            console.log(`🚀 [PartyTargetRouter] Client ${targetClientId}: เริ่มต้นวนแจกบัฟสมาชิกปาร์ตี้ทั้งหมด ${validTargets.length} คน...`);

            for (let i = 0; i < validTargets.length; i++) {
                if (global.isSuspended) {
                    console.log(`⏸️ [PartyTargetRouter] Client ${targetClientId}: ระบบถูกสั่งหยุดชั่วคราว (Suspended) ยกเลิกการวนบัฟ`);
                    break;
                }

                // สแกนภาพสดใหม่ก่อนคลิกแต่ละคน เพื่อให้ได้พิกัด Y และความกว้างที่อัปเดตล่าสุด (เผื่อถูกไอคอนบัฟดันเลื่อนลงหรือปรับขนาด)
                let currentPartyState = partyState;
                if (i > 0) {
                    visionService.resetClientCalibration(targetClientId);
                    const freshState = await visionService.scanClientPage(page, targetClientId);
                    if (freshState && Array.isArray(freshState.members) && freshState.members.length > 0) {
                        currentPartyState = freshState;
                    }
                }

                const currentAlive = currentPartyState.members.filter(m => m.isAlive);
                const target = (i < currentAlive.length) ? currentAlive[i] : (currentPartyState.members[i] || validTargets[i]);
                if (!target || !target.click) continue;

                console.log(`🎯 [PartyTargetRouter] Client ${targetClientId}: [บัฟคนที่ ${i + 1}/${validTargets.length}] เลือก Slot ${target.slot} ที่ (${target.click.x}, ${target.click.y})`);

                // อัปเดตสถานะขึ้น Overlay หลัก: สมาชิกคนที่กำลังถูกเลือก
                global.activePartyTargetRouters[action.id] = {
                    name: action.name || 'Party Target',
                    type: 'party_target',
                    detail: `Slot ${target.slot} (${i + 1}/${validTargets.length})`
                };
                if (typeof global.sendOverlayUpdate === 'function') global.sendOverlayUpdate();

                // วาดเป้าหมายจุดคลิกบนหน้าจอเกม (เฉพาะเมื่อเปิด Show Overlay)
                if (showOverlay && visionService.VisualOverlay) {
                    await visionService.VisualOverlay.render(page, {
                        ...currentPartyState,
                        lastClick: { x: target.click.x, y: target.click.y }
                    });
                }

                // คลิกเลือกเป้าหมายคนนี้แบบเสมือนจริงที่พิกัดอัปเดตล่าสุด
                await simulateRealisticClick(page, target.click.x, target.click.y);

                if (delayAfterClick > 0) {
                    await new Promise(r => setTimeout(r, delayAfterClick));
                }

                // ส่งสัญญาณให้ Action Node บัฟ (เช่น Cast Sequencer) และ "AWAIT" ให้ร่ายสกิลเสร็จก่อนไปคนต่อไป
                if (typeof global.fireChain === 'function') {
                    await global.fireChain(action, 'onNextMember', new Set());
                }

                // หน่วงเวลาระหว่างคนเล็กน้อย (200ms) เพื่อให้เกมประมวลผลทัน
                await new Promise(r => setTimeout(r, 200));
            }

            console.log(`✨ [PartyTargetRouter] Client ${targetClientId}: วนแจกบัฟครบทุกคนในปาร์ตี้เรียบร้อยแล้ว (${validTargets.length} คน)`);

            // ล้างเส้น HUD บนจอเกมทันทีเมื่อจบการทำงาน
            if (visionService.VisualOverlay) {
                await visionService.VisualOverlay.clear(page);
            }

            // ส่งสัญญาณแจ้งเสร็จสิ้นกระบวนการทั้งหมด (เช่น สั่งให้ส่งเสียงเตือน Ding)
            if (typeof global.fireChain === 'function') {
                await global.fireChain(action, 'onComplete', callStack);
            }
        }
    } catch (err) {
        console.error(`❌ [PartyTargetRouter Error] Client ${targetClientId}:`, err.message);
        if (visionService.VisualOverlay) {
            await visionService.VisualOverlay.clear(page).catch(() => {});
        }
        if (typeof global.fireChain === 'function') {
            await global.fireChain(action, 'onError', callStack);
        }
    } finally {
        // เมื่อจบงานในรอบนี้ ให้ปลดสถานะออกจาก Overlay หลัก
        if (global.activePartyTargetRouters && global.activePartyTargetRouters[action.id]) {
            delete global.activePartyTargetRouters[action.id];
            if (typeof global.sendOverlayUpdate === 'function') {
                global.sendOverlayUpdate();
            }
        }
    }
}

module.exports = {
    runPartyTargetRouterAction
};
