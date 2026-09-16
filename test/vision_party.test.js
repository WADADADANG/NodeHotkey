/**
 * test/vision_party.test.js - Party Vision & OCR Diagnostic Test Tool
 * 
 * วิธีใช้งาน:
 * 1. สแกนภาพล่าสุดจากเกม (พร้อมอ่านชื่อ OCR):
 *    node test/vision_party.test.js
 * 
 * 2. สแกนภาพที่ระบุ:
 *    node test/vision_party.test.js "C:\path\to\screenshot.jpg"
 * 
 * 3. รันทดสอบความแม่นยำทุกภาพในโฟลเดอร์ Screenshots ทั้งหมด (Batch Benchmark):
 *    node test/vision_party.test.js --all
 */

const fs = require('fs');
const path = require('path');
const visionService = require('../vision-service');

const DEFAULT_SCREENSHOT_DIR = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\WADADADANG\\AppData\\Local',
  'NodeHotkey', 'screenshots', 'client_4'
);

async function run() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const targetFileArg = args.find(a => !a.startsWith('--'));

  console.log('===============================================================');
  console.log('       🛡️  NodeHotkey Party Vision & OCR Diagnostic Tool       ');
  console.log('===============================================================\n');

  if (isAll) {
    await runBatchBenchmark();
  } else {
    await runSingleImageTest(targetFileArg);
  }

  process.exit(0);
}

async function runSingleImageTest(specifiedFile) {
  let targetFile = specifiedFile;

  if (!targetFile) {
    if (!fs.existsSync(DEFAULT_SCREENSHOT_DIR)) {
      console.error(`❌ ไม่พบโฟลเดอร์ Screenshot ที่: ${DEFAULT_SCREENSHOT_DIR}`);
      return;
    }
    const files = fs.readdirSync(DEFAULT_SCREENSHOT_DIR)
      .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
      .sort((a, b) => {
        const tA = fs.statSync(path.join(DEFAULT_SCREENSHOT_DIR, a)).mtimeMs;
        const tB = fs.statSync(path.join(DEFAULT_SCREENSHOT_DIR, b)).mtimeMs;
        return tB - tA;
      });

    if (files.length === 0) {
      console.error(`❌ ไม่พบไฟล์ Screenshot ในโฟลเดอร์ ${DEFAULT_SCREENSHOT_DIR}`);
      return;
    }
    targetFile = path.join(DEFAULT_SCREENSHOT_DIR, files[0]);
  }

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ ไม่พบไฟล์: ${targetFile}`);
    return;
  }

  console.log(`📸 กำลังทดสอบภาพ: ${path.basename(targetFile)}`);
  console.log(`📁 พาธ: ${targetFile}\n`);

  const imageBuffer = fs.readFileSync(targetFile);
  const scanner = visionService.getScanner('diag_single');

  const startTime = Date.now();
  console.log('⏳ กำลังสแกนตรวจจับหลอดเลือดและอ่านชื่อ OCR...');
  const result = await scanner.scan(imageBuffer, { readNames: true });
  const duration = Date.now() - startTime;

  if (!result.success) {
    console.log(`\n❌ การสแกนล้มเหลว: ${result.reason}`);
    return;
  }

  console.log(`\n✅ สแกนสำเร็จในเวลา ${duration}ms!`);
  console.log(`🎯 พิกัดคอลัมน์ปาร์ตี้: StartX = ${result.autoAnchor.startX}, BarWidth = ${result.autoAnchor.detectedBarWidth}px`);
  console.log(`👥 ตรวจพบสมาชิกทั้งหมด: ${result.members.length} สล็อต\n`);

  // Print Formatted Table
  console.log('+------+----------------------+-------+---------+---------------+------------------+');
  console.log('| Slot | Character Name       | Level | HP %    | Status        | Click Coordinates|');
  console.log('+------+----------------------+-------+---------+---------------+------------------+');

  for (const m of result.members) {
    const slotStr = String(m.slot).padStart(4, ' ');
    const nameStr = (m.name || '-').padEnd(20, ' ').slice(0, 20);
    const levelStr = m.level ? String(m.level).padStart(5, ' ') : '    -';
    const hpStr = (m.hpPercent + '%').padStart(7, ' ');
    const statusStr = (m.status || m.statusCode).padEnd(13, ' ');
    const coordStr = `(${m.click.x}, ${m.click.y})`.padEnd(16, ' ');

    console.log(`| ${slotStr} | ${nameStr} | ${levelStr} | ${hpStr} | ${statusStr} | ${coordStr} |`);
  }
  console.log('+------+----------------------+-------+---------+---------------+------------------+\n');

  const activeCount = result.members.filter(m => m.statusCode === 'active').length;
  console.log(`📊 สรุปผล: มีผู้เล่นในระยะพร้อมรับบัฟ ${activeCount} จากทั้งหมด ${result.members.length} คน`);
  if (activeCount === result.members.length) {
    console.log('🎉 สถานะ: พร้อมบัฟครบทุกคน 100%!');
  } else {
    console.log(`⚠️ สถานะ: สมาชิกที่อยู่นอกระยะ/ออฟไลน์: ${result.members.filter(m => m.statusCode !== 'active').map(m => m.name || `Slot_${m.slot}`).join(', ')}`);
  }
}

async function runBatchBenchmark() {
  if (!fs.existsSync(DEFAULT_SCREENSHOT_DIR)) {
    console.error(`❌ ไม่พบโฟลเดอร์: ${DEFAULT_SCREENSHOT_DIR}`);
    return;
  }

  const files = fs.readdirSync(DEFAULT_SCREENSHOT_DIR)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

  console.log(`🚀 กำลังรัน Batch Benchmark ทดสอบความแม่นยำกับภาพจริงทั้งหมด ${files.length} รูป...\n`);

  let perfect = 0;
  let partial = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const buf = fs.readFileSync(path.join(DEFAULT_SCREENSHOT_DIR, f));
    const scanner = visionService.getScanner('bench_' + i);
    const res = await scanner.scan(buf, { readNames: false });

    if (!res.success) {
      failed++;
    } else {
      const activeCount = res.members.filter(m => m.statusCode === 'active').length;
      if (activeCount === res.members.length && res.members.length >= 4) {
        perfect++;
      } else {
        partial++;
      }
    }

    if ((i + 1) % 20 === 0 || i === files.length - 1) {
      process.stdout.write(`⏳ ประมวลผลแล้ว: ${i + 1}/${files.length} ภาพ...\r`);
    }
  }

  console.log('\n\n===============================================================');
  console.log(`📊 ผลการทดสอบ Benchmark (ทั้งหมด ${files.length} ภาพ):`);
  console.log(`   ✅ ตรวจจับสมบูรณ์ (Active ครบทุกสล็อต): ${perfect} ภาพ (${((perfect / files.length) * 100).toFixed(1)}%)`);
  console.log(`   ⚠️ หลุดบางสล็อต (Partial/Out-of-range):  ${partial} ภาพ (${((partial / files.length) * 100).toFixed(1)}%)`);
  console.log(`   ❌ ไม่พบคอลัมน์ปาร์ตี้ (Failed):       ${failed} ภาพ (${((failed / files.length) * 100).toFixed(1)}%)`);
  console.log('===============================================================');
}

run().catch(err => {
  console.error('❌ เกิดข้อผิดพลาด:', err);
  process.exit(1);
});
