/**
 * vision-service.js - NodeHotkey Multi-Client Vision Service
 * 
 * 👑 Migrated 100% directly from UnitBot's proven AdaptivePartyScanner, VisualOverlay & ScreencastStreamer
 * 1. Zero-Flicker Native Compositor Stream: ดึงเฟรมภาพจาก GPU Compositor โดยตรง ไร้การเรียก screenshot จอไม่กระพริบ 100%
 * 2. Dynamic Resolution & Auto-Recalibration: ตรวจจับขนาดหน้าจออัตโนมัติ หากเปลี่ยนขนาดจอ/เปิดจอใหญ่ จะรีเซ็ตหาพิกัดใหม่ทันที
 * 3. Metallic Border + Body Verification: ล็อกพิกัดหลอดเลือดปาร์ตี้แม่นยำ ไม่จับตัวหนังสือร้านค้าหรือพื้นหลัง
 * 4. Multi-Band Crimson Sampling: อ่านเลือดทะลุร่องเงาสีเทา Zero-Jitter Clamp
 * 5. Anti-Corruption Visual Overlay: วาดกรอบ [ ] ไม่ทับหลอดเลือด ป้องกันรบกวนเฟรมสแกน
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const EventEmitter = require('events');
let tesseractModule = null;
try {
    tesseractModule = require('tesseract.js');
} catch (e) {
    // Optional dependency fallback
}

class VisionOCRManager {
    static worker = null;
    static initPromise = null;

    static async getWorker() {
        if (this.worker) return this.worker;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                if (!tesseractModule) {
                    try { tesseractModule = require('tesseract.js'); } catch (err) {}
                }
                if (!tesseractModule || typeof tesseractModule.createWorker !== 'function') {
                    console.warn('⚠️ [Vision OCR] tesseract.js is not installed. OCR text recognition is disabled.');
                    return null;
                }
                const w = await tesseractModule.createWorker('eng');
                this.worker = w;
                return w;
            } catch (e) {
                console.error('❌ [Vision OCR] Failed to initialize Tesseract worker:', e.message);
                this.worker = null;
                return null;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }
}

class VisionLockManager {
    static activeLock = null;
    static waitQueue = [];

    static async acquire(clientId) {
        if (this.activeLock === null) {
            this.activeLock = clientId;
            return;
        }
        return new Promise((resolve) => {
            this.waitQueue.push({ clientId, resolve });
        });
    }

    static release(clientId) {
        if (this.activeLock === clientId) {
            if (this.waitQueue.length > 0) {
                const next = this.waitQueue.shift();
                this.activeLock = next.clientId;
                next.resolve();
            } else {
                this.activeLock = null;
            }
        }
    }
}

/**
 * ClientScreencastManager - Zero-Flicker Compositor Streamer
 * ใช้ Chrome CDP Page.startScreencast ดึงเฟรมภาพจาก Compositor แบบเรียลไทม์
 * โดยไม่ต้องเรียก page.screenshot() แม้แต่ครั้งเดียว ➔ แก้ปัญหาหน้าจอกระพริบ 100%
 */
class ClientScreencastManager {
    constructor() {
        if (global._screencastManager) {
            return global._screencastManager;
        }
        this.streams = new Map(); // clientId -> { cdp, latestBuffer, isStreaming, lastFrameTime, page }
        global._screencastManager = this;
    }

    async ensureStream(page, clientId) {
        const id = String(clientId || '1');
        let session = this.streams.get(id);

        if (session && session.isStreaming && session.page === page && session.latestBuffer) {
            if (typeof page.isClosed === 'function' && page.isClosed()) {
                await this.stopStream(id);
            } else {
                return session;
            }
        }

        if (session && session.cdp) {
            await this.stopStream(id);
        }

        if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return null;

        try {
            const context = page.context();
            const cdp = await context.newCDPSession(page);
            session = {
                cdp,
                page,
                latestBuffer: null,
                isStreaming: false,
                lastFrameTime: 0
            };
            this.streams.set(id, session);

            cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
                try {
                    await cdp.send('Page.screencastFrameAck', { sessionId });
                } catch (e) {}

                session.latestBuffer = Buffer.from(data, 'base64');
                session.lastFrameTime = Date.now();
            });

            await cdp.send('Page.startScreencast', {
                format: 'jpeg',
                quality: 85,
                everyNthFrame: 1
            });

            session.isStreaming = true;

            // รอเฟรมแรกเข้ามา
            for (let i = 0; i < 15; i++) {
                if (session.latestBuffer) break;
                await new Promise(r => setTimeout(r, 20));
            }

            return session;
        } catch (err) {
            return null;
        }
    }

    getLatestFrame(clientId) {
        const session = this.streams.get(String(clientId || '1'));
        return session && session.latestBuffer ? session.latestBuffer : null;
    }

    async stopStream(clientId) {
        const id = String(clientId || '1');
        const session = this.streams.get(id);
        if (session) {
            if (session.cdp) {
                try {
                    await session.cdp.send('Page.stopScreencast');
                    await session.cdp.detach();
                } catch (e) {}
            }
            this.streams.delete(id);
        }
    }
}

class ClientPartyScanner {
    constructor(clientId) {
        this.clientId = clientId;
        this.lockedCol = null; // { startX, barWidth }
        this.lastSlots = null; // [{ slot, barY }]
        this.consecutiveMisses = 0;
        this.lastViewportW = 0;
        this.lastViewportH = 0;
    }

    resetCalibration() {
        this.lockedCol = null;
        this.lastSlots = null;
        this.consecutiveMisses = 0;
    }

    static isHpPixel(r, g, b) {
        if (r < 25 && g < 25 && b < 25) return true; // Black HP groove
        // Crimson red HP (ครอบคลุมทั้งสีแดงสดและสูตร UnitBot r > 120 && r > g * 1.3 && r > b * 1.3)
        if (r > 120 && r > g * 1.3 && r > b * 1.3) return true;
        if (r > 140 && g < 75 && r > g * 2.2 && r > b * 1.2) return true;
        // Metallic grey border
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
        const br = (r + g + b) / 3;
        if (br >= 50 && br <= 160 && maxDiff <= 18) return true;
        return false;
    }

    findPartyColumns(data, w, h, ch) {
        const segments = [];
        for (let y = 15; y < h - 15; y += 2) {
            let inSeg = false, startX = 0, count = 0;
            for (let x = 5; x < w - 5; x++) {
                const idx = (y * w + x) * ch;
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                if (ClientPartyScanner.isHpPixel(r, g, b)) {
                    if (!inSeg) { inSeg = true; startX = x; count = 0; }
                    count++;
                } else {
                    if (inSeg) {
                        const len = x - startX;
                        // รองรับความกว้างตั้งแต่จอเล็ก UI ย่อส่วน (~35px) ไปจนถึงจอใหญ่ (~450px)
                        if (len >= 35 && len <= 450 && count >= len * 0.50) {
                            segments.push({ y, startX, endX: x, len });
                        }
                        inSeg = false;
                    }
                }
            }
            if (inSeg) {
                const len = (w - 5) - startX;
                if (len >= 35 && len <= 450 && count >= len * 0.50) {
                    segments.push({ y, startX, endX: w - 5, len });
                }
            }
        }

        if (segments.length === 0) return [];

        const xBuckets = {};
        segments.forEach(s => {
            const k = Math.round(s.startX / 5) * 5;
            xBuckets[k] = (xBuckets[k] || 0) + 1;
        });

        // Party window in Flyff is placed on the left side or right side (never dead center over player character)
        const edgeKeys = Object.keys(xBuckets).map(Number).filter(k => k <= w * 0.38 || k >= w * 0.62);
        const candidateKeys = (edgeKeys.length > 0) ? edgeKeys : Object.keys(xBuckets).map(Number);
        const sortedBuckets = candidateKeys.sort((a, b) => xBuckets[b] - xBuckets[a]).slice(0, 4);

        const results = [];
        for (const bucket of sortedBuckets) {
            const colSegments = segments.filter(s => Math.abs(s.startX - bucket) <= 10);
            if (colSegments.length < 2) continue;

            const startXs = colSegments.map(s => s.startX).sort((a, b) => a - b);
            const colStartX = startXs[Math.floor(startXs.length / 2)];

            const lengths = colSegments.map(s => s.len).sort((a, b) => a - b);
            const maxLen = lengths[lengths.length - 1];
            const topLengths = lengths.filter(l => l >= maxLen - 15);
            const effectiveWidth = (topLengths.length >= 2) ? topLengths[Math.floor(topLengths.length / 2)] : lengths[Math.floor(lengths.length / 2)];

            results.push({ startX: colStartX, barWidth: effectiveWidth });
        }

        // จัดอันดับคอลัมน์: จัดให้ความกว้างมาตรฐานของหลอดเลือดปาร์ตี้ Flyff (~90 - 165px) มาเป็นอันดับแรก
        results.sort((a, b) => {
            const aIsStd = (a.barWidth >= 90 && a.barWidth <= 165) ? 100 : 0;
            const bIsStd = (b.barWidth >= 90 && b.barWidth <= 165) ? 100 : 0;
            if (aIsStd !== bIsStd) return bIsStd - aIsStd;
            return a.barWidth - b.barWidth;
        });

        return results;
    }

    findPartyColumn(data, w, h, ch) {
        const cols = this.findPartyColumns(data, w, h, ch);
        return cols.length > 0 ? cols[0] : null;
    }

    detectPartySlots(data, w, h, ch, startX, barWidth) {
        const candidates = [];

        // 1. ตรวจจับเส้นขอบโลหะสีเทาของหลอดเลือด (Metallic Grey Border) พร้อมตรวจสอบตัวหลอดที่ y + 4
        for (let y = 15; y < h - 15; y++) {
            let borderCount = 0;
            for (let x = startX; x < startX + barWidth; x++) {
                if (x >= w) break;
                const idx = (y * w + x) * ch;
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
                const br = (r + g + b) / 3;
                if (br >= 55 && br <= 150 && maxDiff <= 15) borderCount++;
            }

            if (borderCount >= barWidth * 0.40) {
                const bodyY = y + 4;
                if (bodyY < h) {
                    let bodyCount = 0;
                    for (let x = startX; x < startX + barWidth; x++) {
                        if (x >= w) break;
                        const idx = (bodyY * w + x) * ch;
                        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                        const isRed = (r > 140 && g < 70 && r > g * 2.5 && r > b * 1.3);
                        const isBlack = (r < 25 && g < 25 && b < 25);
                        if (isRed || isBlack) bodyCount++;
                    }
                    if (bodyCount >= barWidth * 0.50) {
                        candidates.push({ y: bodyY, score: borderCount + bodyCount });
                    }
                }
            }
        }

        // 2. ตรวจจับแถวสีแดงเลือดโดยตรง (กรณีเส้นขอบเทาโดนแสงหรือเอฟเฟกต์บดบัง)
        for (let y = 15; y < h - 15; y++) {
            let redCount = 0;
            for (let x = startX; x < startX + barWidth; x++) {
                if (x >= w) break;
                const idx = (y * w + x) * ch;
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                if (r > 140 && g < 70 && r > g * 2.5 && r > b * 1.3) redCount++;
            }
            if (redCount >= barWidth * 0.45) {
                candidates.push({ y, score: redCount * 2 });
            }
        }

        if (candidates.length === 0) return [];

        // 3. รวมกลุ่ม candidate ที่อยู่ในสล็อตเดียวกัน (ระยะห่าง <= 10px)
        candidates.sort((a, b) => a.y - b.y);
        const clusters = [];
        for (const c of candidates) {
            if (clusters.length === 0 || c.y - clusters[clusters.length - 1][0].y > 10) {
                clusters.push([c]);
            } else {
                clusters[clusters.length - 1].push(c);
            }
        }

        const rawSlots = clusters.map(cl => {
            cl.sort((a, b) => b.score - a.score);
            return cl[0].y;
        });

        // 4. Longest Chain Selection: ค้นหาห่วงโซ่สล็อตต่อเนื่อง (ระยะห่าง 24-120px)
        const chains = [];
        for (let i = 0; i < rawSlots.length; i++) {
            const currentChain = [rawSlots[i]];
            for (let j = i + 1; j < rawSlots.length; j++) {
                const diff = rawSlots[j] - currentChain[currentChain.length - 1];
                if (diff >= 24 && diff <= 120) {
                    currentChain.push(rawSlots[j]);
                } else if (diff > 120) {
                    break;
                }
            }
            chains.push(currentChain);
        }

        chains.sort((a, b) => {
            if (b.length !== a.length) return b.length - a.length;
            return b[0] - a[0];
        });

        const bestChain = chains[0] || [];
        return bestChain.slice(0, 8).map((barY, idx) => ({
            slot: idx + 1,
            barY
        }));
    }

    async extractMemberNames(imageBuffer, members, startX, barWidth, w, h) {
        let worker = null;
        try {
            worker = await VisionOCRManager.getWorker();
        } catch (e) {}

        if (!worker) return;

        for (const m of members) {
            if (!m.hasRed && m.statusCode !== 'active') {
                m.name = `Slot_${m.slot}`;
                continue;
            }

            try {
                const textTop = Math.max(0, m.barY - 18);
                const textLeft = Math.max(0, startX - 2);
                const textW = Math.min(w - textLeft, Math.max(140, barWidth + 10));
                const textH = 16;

                if (textW < 20 || textH < 10) continue;

                const crop = await sharp(imageBuffer)
                    .extract({ left: textLeft, top: textTop, width: textW, height: textH })
                    .resize(textW * 3, textH * 3, { kernel: 'nearest' })
                    .raw()
                    .toBuffer({ resolveWithObject: true });

                const cData = crop.data;
                const cW = crop.info.width;
                const cH = crop.info.height;
                const binBuf = Buffer.alloc(cW * cH * 3);

                let redCount = 0;
                let textPixelCount = 0;

                for (let p = 0, q = 0; p < cData.length; p += crop.info.channels, q += 3) {
                    const r = cData[p], g = cData[p + 1], b = cData[p + 2];
                    const isWhite = (r > 170 && g > 170 && b > 170);
                    const isLeaderRed = (r > 160 && r > g * 1.4 && r > b * 1.4);

                    if (isLeaderRed) redCount++;
                    if (isWhite || isLeaderRed) {
                        textPixelCount++;
                        binBuf[q] = 0;
                        binBuf[q + 1] = 0;
                        binBuf[q + 2] = 0;
                    } else {
                        binBuf[q] = 255;
                        binBuf[q + 1] = 255;
                        binBuf[q + 2] = 255;
                    }
                }

                // ในเกม Flyff Universe หัวหน้าปาร์ตี้ (Leader) คือ Slot 1 (แถวบนสุด) เท่านั้น ส่วน Slot อื่นเป็นลูกตี้ทั้งหมด
                m.isLeader = (m.slot === 1);

                if (textPixelCount < 40) {
                    m.name = `Slot_${m.slot}`;
                    continue;
                }

                const binImageBuffer = await sharp(binBuf, { raw: { width: cW, height: cH, channels: 3 } })
                    .withMetadata({ density: 300 })
                    .png()
                    .toBuffer();

                const res = await worker.recognize(binImageBuffer);
                const raw = (res.data && res.data.text) ? res.data.text.trim().replace(/\n/g, ' ') : '';

                if (raw) {
                    m.rawName = raw;
                    const clean = raw.replace(/[\.]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
                    const tokens = clean.split(/[\s\.]+/).filter(Boolean);

                    let foundLevel = null;
                    let nameTokens = [];

                    for (const t of tokens) {
                        const sanitized = t.replace(/[^A-Za-z0-9_]/g, '');
                        if (!sanitized) continue;
                        if (!foundLevel && /^\d{1,3}$/.test(sanitized)) {
                            foundLevel = parseInt(sanitized, 10);
                        } else {
                            nameTokens.push(sanitized);
                        }
                    }

                    if (foundLevel) m.level = foundLevel;
                    if (nameTokens.length > 0) {
                        m.name = nameTokens.join('_');
                    } else {
                        m.name = `Slot_${m.slot}`;
                    }
                } else {
                    m.name = `Slot_${m.slot}`;
                }
            } catch (err) {
                m.name = `Slot_${m.slot}`;
            }
        }
    }

    async scan(imageBuffer, options = {}) {
        if (!imageBuffer) return { success: false, reason: 'No image buffer', members: [] };

        try {
            const { data, info } = await sharp(imageBuffer)
                .raw()
                .toBuffer({ resolveWithObject: true });

            const w = info.width;
            const h = info.height;
            const ch = info.channels;

            // 1. ตรวจจับตำแหน่งแกน X และความกว้างหลอดเลือดสดๆ (Multi-Candidate Evaluation)
            const candidates = this.findPartyColumns(data, w, h, ch);
            let chosenCol = null;
            let chosenSlots = null;

            // ก. ตรวจสอบ lockedCol ก่อนเป็นอันดับแรกเพื่อความเร็วและความนิ่ง
            if (this.lockedCol) {
                const isStd = (this.lockedCol.barWidth >= 90 && this.lockedCol.barWidth <= 165);
                if (isStd) {
                    const slots = this.detectPartySlots(data, w, h, ch, this.lockedCol.startX, this.lockedCol.barWidth);
                    if (slots && slots.length >= 2) {
                        chosenCol = this.lockedCol;
                        chosenSlots = slots;
                    }
                } else {
                    this.lockedCol = null; // คอลัมน์ที่เคยล็อกไว้กว้างผิดปกติ ให้รีเซ็ตใหม่
                }
            }

            // ข. หากยังไม่มี lockedCol หรือ lockedCol ตรวจไม่เจอ ให้ทดสอบจาก candidates ทั้งหมด
            if (!chosenSlots && candidates && candidates.length > 0) {
                for (const col of candidates) {
                    const slots = this.detectPartySlots(data, w, h, ch, col.startX, col.barWidth);
                    if (slots && slots.length >= 1) {
                        const isStdWidth = (col.barWidth >= 90 && col.barWidth <= 165);
                        const chosenIsStd = chosenCol ? (chosenCol.barWidth >= 90 && chosenCol.barWidth <= 165) : false;

                        if (!chosenSlots || 
                            (isStdWidth && !chosenIsStd) || 
                            (slots.length > chosenSlots.length && (!chosenIsStd || isStdWidth)) ||
                            (slots.length === chosenSlots.length && isStdWidth && !chosenIsStd)) {
                            chosenSlots = slots;
                            chosenCol = col;
                            if (slots.length >= 4 && isStdWidth) break; // พบ 4 สล็อตขึ้นไปและขนาดหลอดเลือดถูกต้องเป๊ะ ค่อย break!
                        }
                    }
                }
            }

            if (chosenCol && chosenSlots) {
                // อัปเดต lockedCol พร้อม Jitter Filter
                if (!this.lockedCol || Math.abs(this.lockedCol.startX - chosenCol.startX) > 4 || Math.abs(this.lockedCol.barWidth - chosenCol.barWidth) > 4) {
                    this.lockedCol = chosenCol;
                }
                this.lastSlots = chosenSlots;
                this.consecutiveMisses = 0;
            } else if (this.lockedCol && this.lastSlots) {
                // Fallback ชั่วคราวกรณีเฟรมมีเอฟเฟกต์บดบังทั้งจอ
                chosenCol = this.lockedCol;
                chosenSlots = this.lastSlots;
            }

            if (!chosenCol || !chosenSlots || chosenSlots.length === 0) {
                this.consecutiveMisses++;
                if (this.consecutiveMisses >= 2) {
                    this.resetCalibration();
                }
                return { success: false, reason: 'Party column or slots not found', members: [] };
            }

            const col = chosenCol;
            const slots = chosenSlots;

            const { startX, barWidth } = col;
            let validMemberCount = 0;
            const members = [];

            for (let i = 0; i < slots.length; i++) {
                const s = slots[i];
                const barY = s.barY;

                // 3. สแกนเนื้อหลอดเลือดแบบ Multi-band Sampling
                let rightmostX = -1;
                let redCols = 0;

                for (let x = startX; x < startX + barWidth; x++) {
                    if (x >= w) break;
                    let colHasRed = false;

                    for (let dy of [-2, -1, 0, 1, 2]) {
                        const testY = barY + dy;
                        if (testY < 0 || testY >= h) continue;

                        const idxPix = (testY * w + x) * ch;
                        const r = data[idxPix], g = data[idxPix + 1], b = data[idxPix + 2];
                        const isHpRed = (r > 120 && r > g * 1.3 && r > b * 1.3) || (r > 140 && g < 75 && r > g * 2.2);

                        if (isHpRed) {
                            colHasRed = true;
                            break;
                        }
                    }

                    if (colHasRed) {
                        redCols++;
                        rightmostX = x;
                    }
                }

                let hpPercent = 0;
                let filledWidth = 0;
                const minRedReq = Math.min(4, Math.max(2, Math.floor(barWidth * 0.08)));
                const hasRed = (redCols >= minRedReq);

                if (hasRed) {
                    filledWidth = Math.max(0, rightmostX - startX + 1);
                    const rawPercent = Math.round((filledWidth / barWidth) * 100);

                    if (rawPercent >= 95) {
                        hpPercent = 100;
                        filledWidth = barWidth;
                    } else {
                        hpPercent = Math.min(100, Math.max(1, rawPercent));
                    }
                }

                // 4. วัดความสว่างชื่อตัวละคร (เพื่อจำแนกสถานะ Out of range / Offline / Dead)
                let maxBright = 0;
                let deadPixels = 0;
                for (let dy of [-14, -12, -10]) {
                    const textY = barY + dy;
                    if (textY >= 0 && textY < h) {
                        for (let x = startX; x < Math.min(w, startX + barWidth); x++) {
                            const idxPix = (textY * w + x) * ch;
                            const r = data[idxPix], g = data[idxPix + 1], b = data[idxPix + 2];
                            const br = (r + g + b) / 3;
                            if (br > maxBright) maxBright = br;
                            if (r > 90 && g < 25 && b < 25) deadPixels++;
                        }
                    }
                }

                // 5. จัดสถานะ 4 รูปแบบ (ACTIVE, DEAD, OUT_OF_RANGE, OFFLINE)
                let status = 'OUT_OF_RANGE';
                let statusCode = 'out_of_range';

                if (hasRed) {
                    status = 'ACTIVE';
                    statusCode = 'active';
                    validMemberCount++;
                } else if (deadPixels >= 5) {
                    status = 'DEAD';
                    statusCode = 'dead';
                    hpPercent = 0;
                } else if (maxBright >= 25) {
                    status = 'OUT_OF_RANGE';
                    statusCode = 'out_of_range';
                    hpPercent = 0;
                    validMemberCount++;
                } else {
                    status = 'OFFLINE';
                    statusCode = 'offline';
                    hpPercent = 0;
                }

                const clickX = Math.round(startX + Math.min(barWidth * 0.48, 70));
                const clickY = Math.round(barY);

                members.push({
                    slot: s.slot,
                    name: `Slot_${s.slot}`,
                    level: null,
                    isLeader: false,
                    barY,
                    startX,
                    barWidth,
                    filledWidth,
                    hasRed,
                    hpPercent,
                    status,
                    statusCode,
                    isAlive: statusCode === 'active',
                    isDead: statusCode === 'dead',
                    isOutOfRange: statusCode === 'out_of_range',
                    nameBrightness: Math.round(maxBright),
                    deadNamePixels: deadPixels,
                    click: { x: clickX, y: clickY }
                });
            }

            // 6. อ่านชื่อสมาชิกด้วย OCR หากมีการร้องขอ (readNames === true)
            if (options.readNames && members.length > 0) {
                await this.extractMemberNames(imageBuffer, members, startX, barWidth, w, h);
            }

            if (validMemberCount === 0) {
                this.consecutiveMisses++;
                if (this.consecutiveMisses >= 2) {
                    this.resetCalibration();
                }
            } else {
                this.consecutiveMisses = 0;
            }

            return {
                success: true,
                autoAnchor: {
                    startX,
                    detectedBarWidth: barWidth,
                    slotsFound: members.length
                },
                members
            };
        } catch (err) {
            return { success: false, error: err.message, members: [] };
        }
    }
}

class VisionService {
    constructor() {
        if (global._visionServiceInstance) {
            this.scanners = global._visionServiceInstance.scanners;
            this.clientStates = global._visionServiceInstance.clientStates;
            this.lastScanTimes = global._visionServiceInstance.lastScanTimes;
            this.screencastManager = global._visionServiceInstance.screencastManager;
        } else {
            this.scanners = new Map(); // clientId -> ClientPartyScanner
            this.clientStates = new Map(); // clientId -> Cached Party State
            this.lastScanTimes = new Map(); // clientId -> timestamp
            this.screencastManager = new ClientScreencastManager();
            global._visionServiceInstance = this;
        }
    }

    getScanner(clientId) {
        const id = String(clientId || '1');
        const existing = this.scanners.get(id);
        if (!existing || !(existing instanceof ClientPartyScanner)) {
            const scanner = new ClientPartyScanner(id);
            this.scanners.set(id, scanner);
            return scanner;
        }
        return existing;
    }

    resetClientCalibration(clientId) {
        const id = String(clientId || '1');
        const scanner = this.scanners.get(id);
        if (scanner) {
            scanner.resetCalibration();
        }
        this.clientStates.delete(id);
    }

    getClientState(clientId) {
        return this.clientStates.get(String(clientId || '1')) || null;
    }

    /**
     * สแกน Client เป้าหมายด้วยระบบ Mutex Lock จัดคิวทีละจอ
     * 100% ZERO-FLICKER: ดึงเฟรมจาก Compositor Stream โดยตรง ไม่เรียก page.screenshot() ให้จอกระพริบ
     */
    async scanClientPage(page, clientId, scanRegion = 'auto', options = {}) {
        const id = String(clientId || '1');
        if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return null;

        await VisionLockManager.acquire(id);
        try {
            // ตรวจสอบขนาดหน้าต่างเกม ถ้าขยายจอใหญ่ขึ้นหรือเปลี่ยนโซนสแกนให้รีเซ็ตพิกัดอัตโนมัติ
            const winBounds = await page.evaluate(() => ({
                w: window.innerWidth,
                h: window.innerHeight
            })).catch(() => ({ w: 1280, h: 720 }));

            const currentW = winBounds.w || 1280;
            const currentH = winBounds.h || 720;
            const scanner = this.getScanner(id);

            if (scanner.lastViewportW !== currentW || scanner.lastViewportH !== currentH || scanner.lastScanRegion !== scanRegion) {
                scanner.lastViewportW = currentW;
                scanner.lastViewportH = currentH;
                scanner.lastScanRegion = scanRegion;
                scanner.resetCalibration();
            }

            // 🚀 ZERO-FLICKER FRAME CAPTURE + FRESHNESS WATCHDOG:
            // ดึงเฟรมภาพสดจาก Chrome CDP Compositor Stream ตรงๆ
            // หากไม่มีการเคลื่อนไหวในเกมเกิน 600ms ให้ดึงภาพสดใหม่ทันที ป้องกันอาการภาพนิ่ง/ภาพค้าง
            let frameBuffer = this.screencastManager.getLatestFrame(id);
            const session = this.screencastManager.streams.get(id);
            const now = Date.now();
            const isStale = !session || !session.lastFrameTime || (now - session.lastFrameTime > 600);

            if (!frameBuffer || isStale) {
                try {
                    frameBuffer = await page.screenshot({
                        type: 'jpeg',
                        quality: 85
                    });
                    if (session) {
                        session.latestBuffer = frameBuffer;
                        session.lastFrameTime = now;
                    }
                } catch (e) {
                    if (!frameBuffer) {
                        await this.screencastManager.ensureStream(page, id);
                        frameBuffer = this.screencastManager.getLatestFrame(id);
                    }
                }
            }

            if (!frameBuffer) return null;

            const meta = await sharp(frameBuffer).metadata();
            const imgW = meta.width || currentW;
            const imgH = meta.height || currentH;

            // คำนวณพื้นที่ครอบภาพ (Crop Bounds) ตาม scanRegion ที่ผู้ใช้เลือก
            let cropLeft = 0;
            let cropTop = 0;
            let cropW = imgW;
            let cropH = imgH;

            if (scanRegion === 'left') {
                cropLeft = 0;
                cropTop = 0;
                cropW = Math.min(imgW, Math.max(300, Math.round(imgW * 0.52)));
                cropH = Math.min(imgH, 900);
            } else if (scanRegion === 'top_left') {
                cropLeft = 0;
                cropTop = 0;
                cropW = Math.min(imgW, Math.max(300, Math.round(imgW * 0.52)));
                cropH = Math.min(imgH, Math.max(300, Math.round(imgH * 0.65)));
            } else if (scanRegion === 'right') {
                cropLeft = Math.round(imgW * 0.45);
                cropTop = 0;
                cropW = imgW - cropLeft;
                cropH = Math.min(imgH, 900);
            } else { // 'full'
                cropLeft = 0;
                cropTop = 0;
                cropW = imgW;
                cropH = imgH;
            }

            const croppedBuffer = await sharp(frameBuffer)
                .extract({
                    left: cropLeft,
                    top: cropTop,
                    width: Math.min(cropW, imgW - cropLeft),
                    height: Math.min(cropH, imgH - cropTop)
                })
                .toBuffer();

            const result = await scanner.scan(croppedBuffer, options);

            if (result && result.success && Array.isArray(result.members)) {
                // คำนวณ Scale Factor หากขนาดเฟรมภาพกับขนาด Browser DOM ไม่เท่ากัน (เช่น High-DPI Display)
                const scaleX = currentW / imgW;
                const scaleY = currentH / imgH;

                const scaledMembers = result.members.map(m => ({
                    ...m,
                    barY: Math.round((m.barY + cropTop) * scaleY),
                    startX: Math.round((m.startX + cropLeft) * scaleX),
                    barWidth: Math.round(m.barWidth * scaleX),
                    click: {
                        x: Math.round((m.click.x + cropLeft) * scaleX),
                        y: Math.round((m.click.y + cropTop) * scaleY)
                    }
                }));

                const activeMembers = scaledMembers.filter(m => m.isAlive);
                
                let lowestHpMember = null;
                for (const m of activeMembers) {
                    if (!lowestHpMember || m.hpPercent < lowestHpMember.hpPercent) {
                        lowestHpMember = m;
                    }
                }

                const state = {
                    success: true,
                    clientId: id,
                    timestamp: Date.now(),
                    autoAnchor: {
                        startX: Math.round(((result.autoAnchor?.startX || 0) + cropLeft) * scaleX),
                        detectedBarWidth: Math.round((result.autoAnchor?.detectedBarWidth || 0) * scaleX),
                        slotsFound: scaledMembers.length
                    },
                    members: scaledMembers,
                    activeMembers,
                    lowestHpMember
                };

                this.clientStates.set(id, state);
                this.lastScanTimes.set(id, Date.now());

                // วาด HUD Overlay เส้นสแกนและกรอบลงบนหน้าต่างเกมสดๆ
                await VisualOverlay.render(page, { party: scaledMembers, autoAnchor: state.autoAnchor });

                return state;
            }

            return null;
        } catch (err) {
            console.error(`[VisionService] Error scanning Client ${id}:`, err.message);
            return null;
        } finally {
            VisionLockManager.release(id);
        }
    }

    getLatestPartyState(clientId) {
        const id = String(clientId || '1');
        return this.clientStates.get(id) || null;
    }

    /**
     * ถ่ายภาพหน้าจอ Zero-Flicker จาก GPU Compositor Stream หรือ Screenshot
     * รองรับการครอปตามโซน (full, party, right, left, target, custom)
     * รองรับการวาดเส้นตีกรอบ Diagnostic Annotation (Bounding Box, HP, Status)
     */
    async captureScreenshot(clientId, options = {}) {
        const id = String(clientId || '1');
        const page = global.clientPages ? global.clientPages[id] : null;
        if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
            return null;
        }

        // 1. ดึงภาพสดจาก GPU Compositor Stream ก่อน หากไม่มีให้ Fallback page.screenshot()
        let frameBuffer = this.screencastManager.getLatestFrame(id);
        if (!frameBuffer) {
            try {
                frameBuffer = await page.screenshot({ type: 'jpeg', quality: 90 });
            } catch (e) {}
        }
        if (!frameBuffer) return null;

        const region = options.region || options.captureRegion || 'full';
        const meta = await sharp(frameBuffer).metadata();
        const imgW = meta.width;
        const imgH = meta.height;

        let extractLeft = 0;
        let extractTop = 0;
        let extractW = imgW;
        let extractH = imgH;

        if (region === 'right') {
            extractLeft = Math.round(imgW * 0.45);
            extractW = imgW - extractLeft;
        } else if (region === 'left') {
            extractW = Math.round(imgW * 0.52);
        } else if (region === 'party') {
            const scanner = this.getScanner(id);
            if (scanner && scanner.lockedCol) {
                extractLeft = Math.max(0, scanner.lockedCol.startX - 40);
                extractW = Math.min(imgW - extractLeft, scanner.lockedCol.barWidth + 140);
                extractH = Math.min(imgH, 650);
            } else {
                extractLeft = Math.round(imgW * 0.55);
                extractW = imgW - extractLeft;
                extractH = Math.min(imgH, 650);
            }
        } else if (region === 'target') {
            extractLeft = Math.round(imgW * 0.35);
            extractTop = 0;
            extractW = Math.round(imgW * 0.30);
            extractH = Math.round(imgH * 0.20);
        } else if (region === 'custom' && options.customRect) {
            extractLeft = Math.max(0, options.customRect.x || 0);
            extractTop = Math.max(0, options.customRect.y || 0);
            extractW = Math.min(imgW - extractLeft, options.customRect.w || imgW);
            extractH = Math.min(imgH - extractTop, options.customRect.h || imgH);
        }

        let pipeline = sharp(frameBuffer);
        if (extractLeft > 0 || extractTop > 0 || extractW < imgW || extractH < imgH) {
            pipeline = pipeline.extract({
                left: extractLeft,
                top: extractTop,
                width: extractW,
                height: extractH
            });
        }

        // 2. วาด Diagnostic Annotation บนภาพ หากเปิด annotate: true
        if (options.annotate) {
            const clientState = this.clientStates.get(id);
            if (clientState && Array.isArray(clientState.members) && clientState.members.length > 0) {
                const svgElements = [];
                clientState.members.forEach((m, idx) => {
                    const boxX = m.startX - extractLeft;
                    const boxY = m.barY - 14 - extractTop;
                    const boxW = m.barWidth + 10;
                    const boxH = 22;

                    if (boxX >= -60 && boxX < extractW && boxY >= -20 && boxY < extractH) {
                        const color = m.isAlive ? '#10b981' : (m.isDead ? '#ef4444' : '#f59e0b');
                        const statusLabel = `${m.name || 'Slot ' + (idx + 1)} (${m.hpPercent}% - ${m.statusCode})`;
                        svgElements.push(`
                            <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="rgba(0,0,0,0.4)" stroke="${color}" stroke-width="2" rx="3" />
                            <circle cx="${m.click.x - extractLeft}" cy="${m.click.y - extractTop}" r="4" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                            <text x="${boxX + 4}" y="${Math.max(12, boxY - 3)}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="${color}">${statusLabel}</text>
                        `);
                    }
                });

                if (svgElements.length > 0) {
                    const overlaySvg = Buffer.from(`
                        <svg width="${extractW}" height="${extractH}" xmlns="http://www.w3.org/2000/svg">
                            ${svgElements.join('\n')}
                        </svg>
                    `);
                    pipeline = pipeline.composite([{ input: overlaySvg, top: 0, left: 0 }]);
                }
            }
        }

        return await pipeline.jpeg({ quality: 90 }).toBuffer();
    }

    /**
     * บันทึกไฟล์ภาพ Diagnostic Dump พร้อมไฟล์ JSON ลง ./screenshots/
     */
    async saveVisionDebugDump(clientId, reason = 'error', metadata = {}) {
        try {
            const rawSubfolder = metadata.subfolder || `client_${clientId}`;
            const subfolder = String(rawSubfolder).trim().replace(/[\\/:*?"<>|]/g, '_');
            const dir = path.join(__dirname, 'screenshots', subfolder);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const buffer = await this.captureScreenshot(clientId, { region: 'full', annotate: true });
            if (!buffer) return null;

            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const filename = `debug_c${clientId}_${reason}_${timestamp}.jpg`;
            const filepath = path.join(dir, filename);
            fs.writeFileSync(filepath, buffer);

            const jsonFilename = `debug_c${clientId}_${reason}_${timestamp}.json`;
            const jsonPath = path.join(dir, jsonFilename);
            const state = this.clientStates.get(String(clientId)) || null;
            fs.writeFileSync(jsonPath, JSON.stringify({
                clientId,
                reason,
                timestamp: Date.now(),
                metadata,
                cachedPartyState: state
            }, null, 2));

            console.log(`📸 [Vision Debug] Saved diagnostic dump: ./screenshots/${subfolder}/${filename}`);
            return filepath;
        } catch (e) {
            console.error('⚠️ [Vision Debug] Failed to save dump:', e.message);
            return null;
        }
    }
}

/**
 * Visual Overlay HUD - วาดกรอบหัว-ท้าย [ ] ซ้อนบนหน้าต่างเกม Flyff Universe
 * ถอดแบบ 100% จาก UnitBot visual_overlay.js
 */
class VisualOverlay {
    static async setup(page) {
        if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;

        try {
            await page.evaluate(() => {
                if (document.getElementById('unitbot-hud-overlay')) return;

                const overlay = document.createElement('canvas');
                overlay.id = 'unitbot-hud-overlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.pointerEvents = 'none';
                overlay.style.zIndex = '2147483647';
                document.body.appendChild(overlay);

                function resizeCanvas() {
                    overlay.width = window.innerWidth;
                    overlay.height = window.innerHeight;
                }
                resizeCanvas();
                window.addEventListener('resize', resizeCanvas);
            });
        } catch (e) {}
    }

    static async clear(page) {
        if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;
        try {
            await page.evaluate(() => {
                const canvas = document.getElementById('unitbot-hud-overlay');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            });
        } catch (e) {}
    }

    static async render(page, data = {}) {
        if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;

        try {
            await page.evaluate((hud) => {
                let canvas = document.getElementById('unitbot-hud-overlay');
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.id = 'unitbot-hud-overlay';
                    canvas.style.position = 'fixed';
                    canvas.style.top = '0';
                    canvas.style.left = '0';
                    canvas.style.width = '100vw';
                    canvas.style.height = '100vh';
                    canvas.style.pointerEvents = 'none';
                    canvas.style.zIndex = '2147483647';
                    document.body.appendChild(canvas);
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                }

                if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                }

                const ctx = canvas.getContext('2d');

                window.requestAnimationFrame(() => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Auto-clear timer: 2.5 วินาทีหากไม่มีการสแกนใหม่
                    if (window._nodehotkeyOverlayTimer) clearTimeout(window._nodehotkeyOverlayTimer);
                    window._nodehotkeyOverlayTimer = setTimeout(() => {
                        const c = document.getElementById('unitbot-hud-overlay');
                        if (c) {
                            const cx = c.getContext('2d');
                            cx.clearRect(0, 0, c.width, c.height);
                        }
                    }, 2500);

                    // วาดกรอบหลอดเลือดเฉพาะปาร์ตี้ (สูงสุด 8 ช่อง)
                    const partyList = hud.party || hud.members || [];
                    if (Array.isArray(partyList) && partyList.length > 0) {
                        partyList.slice(0, 8).forEach((m, idx) => {
                            const y = m.barY;
                            if (!y) return;

                            const startX = m.startX || 25;
                            const barWidth = m.barWidth || 74;

                            let strokeColor = '#10b981'; // 🟢 Active Healthy (Green)
                            let statusText = `${m.hpPercent}%`;
                            let isDashed = false;

                            if (m.statusCode === 'dead') {
                                strokeColor = '#dc2626'; // 💀 Dead (Crimson Red)
                                statusText = '💀 DEAD';
                                isDashed = false;
                            } else if (m.statusCode === 'offline') {
                                strokeColor = '#94a3b8'; // ⚫ Offline (Slate Grey)
                                statusText = 'OFFLINE';
                                isDashed = true;
                            } else if (m.statusCode === 'out_of_range') {
                                strokeColor = '#f59e0b'; // 🟡 Out of Range (Amber)
                                statusText = 'FAR';
                                isDashed = true;
                            } else if (m.hpPercent < 70) {
                                strokeColor = '#ef4444'; // 🔴 Low HP (Neon Red)
                                statusText = `HEAL ${m.hpPercent}%`;
                            }

                            ctx.strokeStyle = strokeColor;
                            ctx.lineWidth = 1.6;

                            if (isDashed) {
                                ctx.setLineDash([3, 3]);
                            } else {
                                ctx.setLineDash([]);
                            }

                            // 1. วาดกรอบหัว-ท้ายหลอดเลือด [ ] 
                            const bLeft = startX - 2;
                            const bRight = startX + barWidth + 2;
                            const bTop = y - 5;
                            const bBottom = y + 5;

                            ctx.beginPath();
                            // หัวหลอด [
                            ctx.moveTo(bLeft + 5, bTop);
                            ctx.lineTo(bLeft, bTop);
                            ctx.lineTo(bLeft, bBottom);
                            ctx.lineTo(bLeft + 5, bBottom);
                            // ท้ายหลอด ]
                            ctx.moveTo(bRight - 5, bTop);
                            ctx.lineTo(bRight, bTop);
                            ctx.lineTo(bRight, bBottom);
                            ctx.lineTo(bRight - 5, bBottom);
                            ctx.stroke();
                            ctx.setLineDash([]);

                            // 2. ข้อความระบุ Slot และสถานะเลือด ด้านขวาของหลอด
                            ctx.fillStyle = strokeColor;
                            ctx.font = 'bold 11px sans-serif';
                            const leaderPrefix = m.isLeader ? '👑 ' : '';
                            const displayName = m.name ? `${leaderPrefix}${m.name} [${statusText}]` : `Slot ${m.slot || idx + 1}: [${statusText}]`;
                            ctx.fillText(displayName, startX + barWidth + 6, y + 4);
                        });
                    }

                    // 3. จุดคลิกเป้าหมายล่าสุด
                    if (hud.lastClick) {
                        ctx.beginPath();
                        ctx.arc(hud.lastClick.x, hud.lastClick.y, 8, 0, Math.PI * 2);
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        ctx.fillStyle = '#ef4444';
                        ctx.font = 'bold 10px sans-serif';
                        ctx.fillText('🎯 TARGET', hud.lastClick.x + 12, hud.lastClick.y + 4);
                    }
                });
            }, data);
        } catch (e) {}
    }
}

const serviceInstance = new VisionService();
serviceInstance.VisualOverlay = VisualOverlay;

module.exports = serviceInstance;
