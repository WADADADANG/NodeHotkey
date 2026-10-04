/**
 * public/js/components/node-docs-data.js
 * NodeHotkey Interactive Documentation Catalog
 * 
 * Reusable data-driven catalog for all 30 Action Nodes.
 * Categorized into 6 official categories matching the Canvas Studio:
 * 1. triggers  (Triggers & Events)
 * 2. actions   (Actions & Input)
 * 3. flow      (Logic & Flow Control)
 * 4. vision    (Vision & Party System)
 * 5. data      (Variables & Logic Data)
 * 6. safety    (Safety & System Utilities)
 */

(function(global) {
  'use strict';

  const NODE_DOCS_CATEGORIES = [
    { id: 'all', icon: 'layout-grid', labelTh: 'ทุกหมวดหมู่ (All)', labelEn: 'All Categories', color: '#3b82f6' },
    { id: 'triggers', icon: 'zap', labelTh: 'ทริกเกอร์ & สัญญาณ', labelEn: 'Triggers & Events', color: '#f59e0b' },
    { id: 'actions', icon: 'gamepad-2', labelTh: 'การกระทำ & ป้อนข้อมูล', labelEn: 'Actions & Input', color: '#ef4444' },
    { id: 'flow', icon: 'git-branch', labelTh: 'ตรรกะ & ควบคุมโฟลว์', labelEn: 'Logic & Flow', color: '#10b981' },
    { id: 'vision', icon: 'eye', labelTh: 'ตรวจจับภาพ & ปาร์ตี้', labelEn: 'Vision & Party', color: '#06b6d4' },
    { id: 'data', icon: 'database', labelTh: 'ตัวแปร & จัดการข้อมูล', labelEn: 'Variables & Data', color: '#8b5cf6' },
    { id: 'safety', icon: 'shield-check', labelTh: 'ความปลอดภัย & ระบบ', labelEn: 'Safety & Utilities', color: '#3b82f6' }
  ];

  const NODE_DOCS_CATALOG = [
    // ═════════════════════════════════════════════════════════════
    // ⚡ 1. TRIGGERS & EVENTS (ทริกเกอร์ & สัญญาณ)
    // ═════════════════════════════════════════════════════════════
    {
      type: 'trigger',
      titleTh: 'ปุ่มกดเริ่มต้น (Global Trigger)',
      titleEn: 'Global Trigger',
      category: 'triggers',
      icon: 'zap',
      badge: 'Entry Point',
      color: '#f59e0b',
      descTh: 'จุดเริ่มต้นหลักของผังงาน (Workflow Entry Point) ตรวจจับการกดปุ่มคีย์บอร์ดจริง เมาส์ หรือสัญญาณภายนอก เพื่อเริ่มส่งสัญญาณทำงานไปยังโหนดถัดไป',
      descEn: 'Primary entry point of the workflow graph. Listens for physical keyboard keystrokes, mouse events, or external signals to begin graph execution.',
      inputs: [],
      outputs: [
        { name: 'next', type: 'flow', descTh: 'สัญญาณเริ่มทำงานทันทีที่กดปุ่มทริกเกอร์', descEn: 'Fires execution signal upon trigger activation' }
      ],
      parameters: [
        { key: 'triggerType', nameTh: 'ประเภททริกเกอร์', nameEn: 'Trigger Source', type: 'select', default: 'keyboard', descTh: 'keyboard (คีย์บอร์ด), mouse (เมาส์), auto (เริ่มทันที)', descEn: 'Trigger source (keyboard / mouse / auto)' },
        { key: 'triggerValue', nameTh: 'ปุ่มลัด (Hotkey)', nameEn: 'Trigger Key', type: 'string', default: 'INSERT', descTh: 'ชื่อปุ่มลัด เช่น INSERT, F1, NUMPAD 1', descEn: 'Hotkey identifier (e.g. INSERT, F1)' },
        { key: 'delayActivation', nameTh: 'หน่วงเวลาเริ่ม', nameEn: 'Delay Activation', type: 'boolean', default: false, descTh: 'เปิดใช้การหน่วงเวลาก่อนเริ่มส่งสัญญาณจริง', descEn: 'Enable delay before triggering downstream' }
      ],
      bestPracticeTh: 'นิยมใช้เป็นโหนดแรกสุดของกราฟเพื่อรับปุ่ม INSERT หรือ F-Keys ในการเปิด/ปิด สวิตช์การทำงาน หรือเริ่มลูปของบอท',
      bestPracticeEn: 'Commonly used as the root node to bind physical keys like INSERT or F-keys to start workflows.',
      exampleBlueprint: `[Global Trigger: INSERT] ──▶ [Variable Branch: isScanning] ──(False)──▶ [Set isScanning = True]`
    },
    {
      type: 'emit_event',
      titleTh: 'ส่งสัญญาณบรอดแคสต์ (Emit Event)',
      titleEn: 'Emit Workflow Event',
      category: 'triggers',
      icon: 'radio',
      badge: 'Event Bus',
      color: '#f59e0b',
      descTh: 'ส่งสัญญาณเหตุการณ์ไปยัง Event Bus กลางของโปรแกรม เพื่อกระตุ้นโหนดหรือกราฟที่กำลังรอรับฟังเหตุการณ์นี้ให้เริ่มทำงานพร้อมกัน',
      descEn: 'Broadcasts a named event across the NodeHotkey event bus, immediately triggering any listener nodes registered for this event.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งให้ยิงเหตุการณ์', descEn: 'Execution input' }
      ],
      outputs: [
        { name: 'onFired', type: 'flow', descTh: 'ส่งสัญญาณออกหลังบรอดแคสต์เหตุการณ์เสร็จ', descEn: 'Fires after event is emitted' }
      ],
      parameters: [
        { key: 'eventName', nameTh: 'ชื่อเหตุการณ์', nameEn: 'Event Name', type: 'string', default: 'party_heal', descTh: 'ชื่ออีเวนต์ เช่น party_heal, boss_spawn, low_mana', descEn: 'Event identifier to broadcast' }
      ],
      bestPracticeTh: 'ใช้สื่อสารข้ามโมดูลหรือข้ามลูป เช่น เมื่อจอฮีลตรวจพบเลือดลด ให้ส่งอีเวนต์ `party_heal` เพื่อสั่งให้ทุกจอป้องกันตัว',
      bestPracticeEn: 'Great for decoupling modules: emit `party_heal` when low HP is detected to trigger coordinated actions.',
      exampleBlueprint: `[Party Heal Needed] ──▶ [Emit Event: "party_heal"] ──▶ [TTS Alert]`
    },
    {
      type: 'webhook_out',
      titleTh: 'ส่งเว็บฮุคแจ้งเตือน (Discord / Webhook)',
      titleEn: 'Webhook Notification',
      category: 'triggers',
      icon: 'webhook',
      badge: 'HTTP Webhook',
      color: '#f59e0b',
      descTh: 'ส่งข้อความแจ้งเตือนผ่าน HTTP POST Webhook ไปยัง Discord, LINE Notify หรือ Server ภายนอก พร้อมรองรับข้อความแบบไดนามิก',
      descEn: 'Dispatches HTTP POST JSON webhook notifications to Discord channel, LINE, or external servers with dynamic message payload.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งยิง Webhook', descEn: 'Execution input' },
        { name: 'msg_in', type: 'data', descTh: 'รับข้อความไดนามิกที่ต้องการส่ง', descEn: 'Dynamic message input' }
      ],
      outputs: [
        { name: 'onSent', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อส่ง Webhook สำเร็จ', descEn: 'Fires upon successful HTTP dispatch' },
        { name: 'onError', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อเกิดข้อผิดพลาดในการเชื่อมต่อ', descEn: 'Fires on network or HTTP error' }
      ],
      parameters: [
        { key: 'webhookUrl', nameTh: 'URL ของ Webhook', nameEn: 'Webhook URL', type: 'string', default: '', descTh: 'เช่น https://discord.com/api/webhooks/...', descEn: 'Target HTTP webhook URL' },
        { key: 'message', nameTh: 'ข้อความ', nameEn: 'Message Body', type: 'string', defaultTh: 'บอทแจ้งเตือนเหตุการณ์สำคัญ', defaultEn: 'Important alert notification', default: 'Important alert notification', descTh: 'ข้อความที่จะส่งเข้าห้องแชท', descEn: 'Payload message body' }
      ],
      bestPracticeTh: 'ใช้แจ้งเตือนเข้ามือถือผ่าน Discord เมื่อตัวละครตาย หรือเมื่อปาร์ตี้หลุด',
      bestPracticeEn: 'Send notifications to your phone via Discord whenever party wipe occurs or boss appears.',
      exampleBlueprint: `[Emergency Stop] ──▶ [Webhook: Discord Alert "Bot Halted!"]`
    },

    // ═════════════════════════════════════════════════════════════
    // 🎮 2. ACTIONS & INPUT (การกระทำ & ป้อนข้อมูล)
    // ═════════════════════════════════════════════════════════════
    {
      type: 'key_press',
      titleTh: 'กดปุ่มคีย์บอร์ด (Key Press)',
      titleEn: 'Single Key Press',
      category: 'actions',
      icon: 'keyboard',
      badge: 'Direct Keystroke',
      color: '#ef4444',
      descTh: 'สั่งกดปุ่มคีย์บอร์ด 1 ครั้งไปยังหน้าต่างเกมเป้าหมายที่เลือก รองรับปุ่มตัวอักษร ตัวเลข ปุ่มฟังก์ชัน (F1-F12) และปุ่มพิเศษ',
      descEn: 'Dispatches a single keystroke to target game client window (supports letters, digits, F-keys, and special keys).',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งกดปุ่ม', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'next', type: 'flow', descTh: 'ส่งสัญญาณออกทันทีหลังกดปุ่มเสร็จ', descEn: 'Fires immediately after key press dispatch' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'เลือกจอที่ต้องการกด (Client 1 - 8 หรือ all)', descEn: 'Target client index (1-8) or all' },
        { key: 'keys', nameTh: 'ปุ่มที่กด', nameEn: 'Key(s) to Press', type: 'key_input', default: ['1'], descTh: 'เช่น Z, 1, SPACE, ENTER, F1', descEn: 'Key name array' }
      ],
      bestPracticeTh: 'ใช้สั่งโจมตี, กดสกิล, เก็บของ (ปุ่ม Z), หรือกดใช้ไอเทมตามช่องคีย์ลัด',
      bestPracticeEn: 'Standard action for firing skills, jump, loot (Z key), or using consumable hotkeys.',
      exampleBlueprint: `[Party Slot 1 Selected] ──▶ [Key Press: Z (Follow Leader)]`
    },
    {
      type: 'key_hold',
      titleTh: 'กดปุ่มค้าง (Key Hold / Release)',
      titleEn: 'Key Hold & Release',
      category: 'actions',
      icon: 'timer',
      badge: 'Hold & Release',
      color: '#ef4444',
      descTh: 'สั่งกดปุ่มคีย์บอร์ดค้างไว้ตามระยะเวลาที่กำหนด หรือสั่งกดค้างรอจนกว่าจะมีสัญญาณ Release เข้ามาปลด',
      descEn: 'Holds down a key for a specified duration or until an explicit release signal arrives.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งเริ่มกดค้าง', descEn: 'Start holding key' },
        { name: 'release', type: 'flow', descTh: 'รับสัญญาณสั่งปล่อยปุ่ม', descEn: 'Release held key' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกหลังปล่อยปุ่มเรียบร้อย', descEn: 'Fires after key release' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'จอที่ต้องการส่งคีย์ไป', descEn: 'Target client screen' },
        { key: 'targetKey', nameTh: 'ปุ่มที่ต้องการกดค้าง', nameEn: 'Key to Hold', type: 'string', default: 'W', descTh: 'เช่น W (เดินหน้า), SPACE (กระโดดค้าง)', descEn: 'Key to hold down' },
        { key: 'holdDurationMs', nameTh: 'ระยะเวลากดค้าง (ms)', nameEn: 'Hold Duration (ms)', type: 'number', default: 1500, descTh: 'เวลาที่ต้องการกดค้าง (ms)', descEn: 'Hold duration in ms' }
      ],
      bestPracticeTh: 'เหมาะสำหรับสกิลชาร์จยิง หรือการสั่งเดินหน้า (ปุ่ม W) ค้างตามระยะเวลา',
      bestPracticeEn: 'Useful for charging skills or moving forward continuously.',
      exampleBlueprint: `[Key Hold: W (2000ms)] ──▶ [Delay: 200ms] ──▶ [Key Press: Space]`
    },
    {
      type: 'buff_sequence',
      titleTh: 'ชุดบัฟต่อเนื่อง (Buff Sequence Routine)',
      titleEn: 'Buff Sequence Routine',
      category: 'actions',
      icon: 'shield-plus',
      badge: 'Self-Buff Cast',
      color: '#ef4444',
      descTh: 'สั่งร่ายสกิลบัฟของตัวเองเป็นชุดต่อเนื่องตามลำดับปุ่มที่กำหนด พร้อมหน่วงเวลาระหว่างท่าอัตโนมัติ',
      descEn: 'Executes a sequential list of self-buff keystrokes with delay between casts.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งเริ่มชุดบัฟ', descEn: 'Start buff sequence' }
      ],
      outputs: [
        { name: 'onStart', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อเริ่มร่ายสกิลแรก', descEn: 'Fires when buff sequence begins' },
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อร่ายครบทุกสกิลแล้ว', descEn: 'Fires when all buffs finish casting' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'จอตัวละครที่ต้องการให้บัฟ', descEn: 'Target client screen' },
        { key: 'keys', nameTh: 'ปุ่มสกิลบัฟ', nameEn: 'Buff Hotkeys', type: 'key_input', default: ['1', '2', '3'], descTh: 'รายการปุ่มสกิลบัฟที่ต้องการกดตามลำดับ', descEn: 'Ordered array of buff keys' },
        { key: 'delayBuff', nameTh: 'หน่วงระหว่างสกิล (ms)', nameEn: 'Delay Between Buffs (ms)', type: 'number', default: 800, descTh: 'เวลารอ Animation ร่ายสกิลของแต่ละท่า', descEn: 'Animation delay between skills' }
      ],
      bestPracticeTh: 'เหมาะสำหรับสกิลบัฟประจำตัว เช่น บัฟเพิ่มพลังโจมตี ป้องกัน หรือความเร็ววิ่ง',
      bestPracticeEn: 'Ideal for character self-buff rotations (attack power, defense, speed buffs).',
      exampleBlueprint: `[Trigger: F1] ──▶ [Buff Sequence: Keys 1,2,3 (800ms)] ──▶ [TTS "Self Buffed"]`
    },
    {
      type: 'macro_group',
      titleTh: 'กลุ่มชุดคำสั่ง (Macro Group)',
      titleEn: 'Macro Sequence Group',
      category: 'actions',
      icon: 'layers',
      badge: 'Combo Sequence',
      color: '#ef4444',
      descTh: 'รวมรายการคำสั่งกดปุ่มและหน่วงเวลาเป็นชุดต่อเนื่องภายในโหนดเดียว ช่วยลดความรกของผังงานและจัดระเบียบคอมโบสกิล',
      descEn: 'Executes an ordered combo sequence of keystrokes and delays encapsulated in a single node.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณเริ่มรันชุดมาโคร', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อทำครบทุกขั้นตอนในมาโคร', descEn: 'Fires when entire macro finishes' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'จอเกมที่ต้องการรันมาโคร', descEn: 'Target client screen' },
        { key: 'steps', nameTh: 'ขั้นตอนมาโคร', nameEn: 'Macro Steps', type: 'macro_table', default: [], descTh: 'รายการ Key Press และ Delay เป็นลำดับชั้น', descEn: 'List of key actions and pauses' }
      ],
      bestPracticeTh: 'เหมาะกับชุดคอมโบสกิลที่กดต่อกันแน่นอน เช่น กด 1 -> หน่วง 300ms -> กด 2 -> หน่วง 500ms -> กด 3',
      bestPracticeEn: 'Ideal for fixed skill rotation combos that always execute in the same order.',
      exampleBlueprint: `[Trigger: F2] ──▶ [Macro Group: Buff Combo 1-2-3] ──▶ [TTS "Combo Ready"]`
    },
    {
      type: 'forwarder',
      titleTh: 'ส่งต่อคำสั่งหลายจอ (Key Forwarder)',
      titleEn: 'Multi-Client Key Forwarder',
      category: 'actions',
      icon: 'share-2',
      badge: 'Multi-Cast',
      color: '#ef4444',
      descTh: 'ส่งต่อการกดปุ่มคีย์บอร์ดไปยังจอเกมอื่นๆ ในพื้นหลังพร้อมกันหรือตามลำดับ ช่วยควบคุมหลายจอได้ในคลิกเดียว',
      descEn: 'Forwards a key press across one or more background game clients simultaneously or sequentially.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งส่งต่อคีย์', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกหลังส่งปุ่มไปยังทุกจอครบแล้ว', descEn: 'Fires after all clients receive key' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: 'all', descTh: 'all (ทุกจอที่เชื่อมต่อ) หรือระบุจอ 1-8', descEn: 'Target client index or all' },
        { key: 'targetKey', nameTh: 'ปุ่มที่ต้องการส่งต่อ', nameEn: 'Forwarded Key', type: 'string', default: 'SPACE', descTh: 'เช่น SPACE (กระโดดพร้อมกัน), Z (เก็บของ)', descEn: 'Key to forward to clients' }
      ],
      bestPracticeTh: 'ใช้สั่งให้ตัวละครทุกจอเก็บของพร้อมกัน (ปุ่ม Z) หรือกดกระโดด (SPACE) หลบสกิลบอส',
      bestPracticeEn: 'Perfect for synchronized actions like pressing Z (loot) or SPACE (jump) across all active clients.',
      exampleBlueprint: `[Trigger: Z] ──▶ [Forwarder: All Clients -> Z] ──▶ [Next]`
    },

    // ═════════════════════════════════════════════════════════════
    // 🌿 3. LOGIC & FLOW CONTROL (ตรรกะ & ควบคุมโฟลว์)
    // ═════════════════════════════════════════════════════════════
    {
      type: 'delay',
      titleTh: 'หน่วงเวลา (Delay Timer)',
      titleEn: 'Delay Timer',
      category: 'flow',
      icon: 'timer',
      badge: 'Timing & Jitter',
      color: '#10b981',
      descTh: 'หยุดพักการทำงานชั่วคราวตามระยะเวลาที่กำหนด (มิลลิวินาที) พร้อมระบบสุ่มหน่วงเวลา (Human Jitter) เพื่อเลียนแบบการกดของมนุษย์อย่างเป็นธรรมชาติ',
      descEn: 'Pauses workflow execution for a specified duration in milliseconds with optional human-like jitter simulation.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งการทำงาน', descEn: 'Execution flow in' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อครบกำหนดเวลาหน่วง', descEn: 'Fires after delay completes' }
      ],
      parameters: [
        { key: 'delayMs', nameTh: 'ระยะเวลา (ms)', nameEn: 'Duration (ms)', type: 'number', default: 1000, descTh: 'เวลาที่ต้องการหยุดพัก เช่น 1000 = 1 วินาที', descEn: 'Delay duration in milliseconds' },
        { key: 'jitter', nameTh: 'สุ่มแกว่งเวลา (±ms)', nameEn: 'Jitter Offset (±ms)', type: 'number', default: 0, descTh: 'เวลาสุ่มแกว่งบวกลบ เช่น ±50ms เพื่อป้องกันการตรวจจับบอท', descEn: 'Random time fluctuation' }
      ],
      bestPracticeTh: 'ควรใส่คั่นระหว่างการกดสกิลเพื่อรอ Animation ของตัวละคร หรือรอให้หน้าต่างเกมตอบสนอง',
      bestPracticeEn: 'Place between actions to account for skill cast animations or server response latency.',
      exampleBlueprint: `[Key Press: 1] ──▶ [Delay: 850ms (±30ms)] ──▶ [Key Press: 2]`
    },
    {
      type: 'branch',
      titleTh: 'แยกเงื่อนไข (Condition Branch)',
      titleEn: 'Condition Branch',
      category: 'flow',
      icon: 'git-branch',
      badge: 'If-Else Router',
      color: '#10b981',
      descTh: 'โหนดแยกทางเดินสัญญาณตามเงื่อนไข (If-Else) ตรวจสอบสถานะการทำงานของเป้าหมาย หรือเปรียบเทียบค่า เพื่อเลือกว่าจะส่งสัญญาณออกทาง True หรือ False',
      descEn: 'Routes execution flow conditionally (If-Else) based on target state or condition checks, firing True or False branch.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งการทำงาน', descEn: 'Execution flow input' }
      ],
      outputs: [
        { name: 'onTrue', type: 'flow', descTh: 'สัญญาณออกเมื่อเงื่อนไขเป็นจริง (True)', descEn: 'Fires if condition evaluates to TRUE' },
        { name: 'onFalse', type: 'flow', descTh: 'สัญญาณออกเมื่อเงื่อนไขไม่เป็นจริง (False)', descEn: 'Fires if condition evaluates to FALSE' }
      ],
      parameters: [
        { key: 'conditionTargetId', nameTh: 'เป้าหมายที่ตรวจ', nameEn: 'Target Node / State', type: 'select', default: '', descTh: 'โหนดหรือตัวแปรเป้าหมายที่ต้องการตรวจสอบสถานะ', descEn: 'Target node or variable to evaluate' },
        { key: 'conditionRule', nameTh: 'กฎเงื่อนไข', nameEn: 'Evaluation Rule', type: 'select', default: 'is_running', descTh: 'เช่น is_running, is_active, equals, not_equals', descEn: 'Evaluation rule' }
      ],
      bestPracticeTh: 'ใช้ควบคุมความปลอดภัย เช่น ตรวจสอบว่าบอทกำลังทำงานอยู่หรือไม่ก่อนส่งคีย์ หรือใช้ตรวจสอบว่าหน้าต่างเกมเปิดอยู่หรือไม่',
      bestPracticeEn: 'Ideal for flow gating, e.g. checking whether a loop is already running before triggering it again.',
      exampleBlueprint: `[Branch] ──(True)──▶ [Do Action]\n         └──(False)─▶ [Log "Skipped"]`
    },
    {
      type: 'condition_group',
      titleTh: 'กลุ่มเงื่อนไขรวม (Condition Group)',
      titleEn: 'Condition Group (Multi-Condition)',
      category: 'flow',
      icon: 'git-merge',
      badge: 'AND / OR Gate',
      color: '#8b5cf6',
      descTh: 'รวมการตรวจสอบหลายเงื่อนไขไว้ในโหนดเดียว (รองรับตัวแปร, สถานะโหนด, และจอไคลเอนต์) พร้อมเลือกตรรกะ AND (ต้องผ่านทั้งหมด) หรือ OR (ผ่านข้อใดข้อหนึ่ง) เพื่อแยกสาย True / False โดยไม่ต้องต่อโหนดซ้อนกันยาวๆ',
      descEn: 'Evaluates multiple simultaneous conditions (Variables, Action Statuses, Client Screens) inside a single node with AND / OR boolean logic, routing execution to True or False without messy node chains.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งการทำงาน', descEn: 'Execution flow in' }
      ],
      outputs: [
        { name: 'onTrue', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อเงื่อนไขผ่านตามตรรกะที่กำหนด', descEn: 'Fires if condition group logic evaluates to TRUE' },
        { name: 'onFalse', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อเงื่อนไขไม่ผ่าน (ปล่อยว่างได้)', descEn: 'Fires if condition group logic evaluates to FALSE' }
      ],
      parameters: [
        { key: 'logicMode', nameTh: 'โหมดตรรกะ', nameEn: 'Logic Mode', type: 'select', default: 'AND', descTh: 'AND (ต้องผ่านครบทุกข้อ) หรือ OR (ผ่านข้อใดข้อหนึ่ง)', descEn: 'AND (all must match) or OR (any match)' },
        { key: 'conditions', nameTh: 'รายการเงื่อนไข', nameEn: 'Condition Rules', type: 'array', default: [], descTh: 'รายการตรวจสอบตัวแปร, สถานะการทำงานของ Action หรือสถานะจอ Client 1-5', descEn: 'List of variable, action status, or client screen conditions' }
      ],
      bestPracticeTh: 'เหมาะสำหรับกรณีที่ต้องเช็กหลายตัวแปรพร้อมกัน เช่น ตรวจทั้ง (HP < 50% AND จอ Client 1 กำลังแอ็กทีฟ) หรือ (Mana < 30% OR Buff หมด) ช่วยให้กราฟอ่านง่าย ไม่รกสายเชื่อมต่อ',
      bestPracticeEn: 'Ideal for compound decisions like (HP < 50 AND Client 1 is active), replacing messy multi-node branch cascades with one compact gate.',
      exampleBlueprint: `[Trigger] ──▶ [Condition Group (HP < 50 AND Client 1 Active)] ──(True)──▶ [Use Potion]\n                                                               └──(False)─▶ [Next Check]`
    },
    {
      type: 'control',
      titleTh: 'ควบคุมสวิตช์โหนด (Action Controller)',
      titleEn: 'Action Controller',
      category: 'flow',
      icon: 'sliders',
      badge: 'Flow Gate',
      color: '#10b981',
      descTh: 'สั่งควบคุมสถานะของโหนดอื่นในผังงานโดยตรง เช่น สั่ง Start, Stop หรือ Toggle การทำงานของลูปหรือมาโครเป้าหมาย',
      descEn: 'Controls other actions or loop nodes in the graph directly (start, stop, toggle) without rewiring.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งควบคุม', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกหลังสั่งการเสร็จสิ้น', descEn: 'Fires after control operation' }
      ],
      parameters: [
        { key: 'controlOperation', nameTh: 'คำสั่งควบคุม', nameEn: 'Operation', type: 'select', default: 'toggle', descTh: 'toggle (สลับเปิด/ปิด), start (เปิด), stop (หยุด)', descEn: 'Operation (toggle / start / stop)' },
        { key: 'controlTargetIds', nameTh: 'โหนดเป้าหมาย', nameEn: 'Target Node(s)', type: 'select', default: [], descTh: 'เลือกโหนดที่ต้องการควบคุม', descEn: 'Target nodes to control' }
      ],
      bestPracticeTh: 'ใช้ผูกกับปุ่มทริกเกอร์เพื่อสั่ง เปิด/ปิด ลูปหลักของบอทด้วยปุ่มเดียวแบบ Toggle',
      bestPracticeEn: 'Bind to a trigger key to cleanly toggle main bot scheduler on/off with one keystroke.',
      exampleBlueprint: `[Trigger: F10] ──▶ [Control: Toggle "Main Loop"] ──▶ [TTS "Loop Toggled"]`
    },
    {
      type: 'loop',
      titleTh: 'วนลูปตามจำนวน (Loop Counter)',
      titleEn: 'Loop Counter',
      category: 'flow',
      icon: 'repeat',
      badge: 'Bounded Loop',
      color: '#10b981',
      descTh: 'วนซ้ำการทำงานตามจำนวนรอบที่ระบุ (For-Loop) ทุกรอบจะยิงสัญญาณออกทาง Loop Body และเมื่อครบทุกรอบจะยิงออกทาง onComplete',
      descEn: 'Executes downstream actions repeatedly for a fixed count (For-loop), firing loop body per iteration and onComplete at the end.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณเริ่มวนลูป', descEn: 'Start loop flow' }
      ],
      outputs: [
        { name: 'body', type: 'flow', descTh: 'สัญญาณสำหรับคำสั่งภายในลูป (วนซ้ำ N ครั้ง)', descEn: 'Fires for each iteration loop body' },
        { name: 'onComplete', type: 'flow', descTh: 'สัญญาณออกเมื่อวนซ้ำครบทุกรอบแล้ว', descEn: 'Fires when all loop iterations finish' }
      ],
      parameters: [
        { key: 'repeatCount', nameTh: 'จำนวนรอบ (Count)', nameEn: 'Repeat Count', type: 'number', default: 3, descTh: 'จำนวนครั้งที่ต้องการให้วนซ้ำ', descEn: 'Total iteration count' },
        { key: 'delayAfter', nameTh: 'หน่วงระหว่างรอบ (ms)', nameEn: 'Delay Per Loop (ms)', type: 'number', default: 200, descTh: 'ระยะเวลาพักในแต่ละรอบ', descEn: 'Pause between iterations' }
      ],
      bestPracticeTh: 'เหมาะสำหรับงานที่ต้องทำซ้ำแน่นอน เช่น ปั๊มยา 3 ขวด หรือกดสแปมคีย์ 5 ครั้ง',
      bestPracticeEn: 'Best for repetitive bounded operations, like applying multiple consumables.',
      exampleBlueprint: `[Loop: 5x] ──(Body)───────▶ [Key Press: Space (Jump)]\n           └──(Complete)──▶ [TTS "Done Jumping"]`
    },
    {
      type: 'loop_scheduler',
      titleTh: 'ลูปวนรอบต่อเนื่อง (Loop Scheduler)',
      titleEn: 'Loop Scheduler',
      category: 'flow',
      icon: 'hourglass',
      badge: 'Heartbeat Timer',
      color: '#10b981',
      descTh: 'ตัวตั้งเวลาวนลูปอัตโนมัติ (Timer Interval) สั่งทำงานซ้ำทุกๆ X มิลลิวินาที พร้อมระบบ Collision Guard ป้องกันการกดซ้อนทับหากรอบก่อนหน้ายังทำไม่เสร็จ',
      descEn: 'Periodic interval timer that executes downstream workflow continuously with collision guard protection.',
      inputs: [
        { name: 'start', type: 'flow', descTh: 'รับสัญญาณเพื่อเริ่มรันลูป', descEn: 'Starts the scheduled loop' },
        { name: 'stop', type: 'flow', descTh: 'รับสัญญาณเพื่อหยุดรันลูป', descEn: 'Stops the scheduled loop' }
      ],
      outputs: [
        { name: 'tick', type: 'flow', descTh: 'สัญญาณยิงออกตามรอบเวลา (Interval)', descEn: 'Fires periodically at interval cadence' }
      ],
      parameters: [
        { key: 'interval', nameTh: 'ช่วงเวลา (ms)', nameEn: 'Interval (ms)', type: 'number', default: 2000, descTh: 'ความถี่ในการยิงสัญญาณซ้ำ เช่น 2000 = ทุก 2 วินาที', descEn: 'Interval frequency in ms' },
        { key: 'collisionGuardMs', nameTh: 'กันชนคำสั่งค้าง (ms)', nameEn: 'Collision Guard (ms)', type: 'number', default: 800, descTh: 'ระยะเวลาป้องกันการรันซ้อนทับหากรอบเก่ายังค้างอยู่', descEn: 'Collision guard window' }
      ],
      bestPracticeTh: 'ใช้เป็นหัวใจหลักของบอทเพื่อวนสแกนจอ, วนเช็คปาร์ตี้ หรือบัฟตัวเองตามเวลา',
      bestPracticeEn: 'Core heartbeat for continuous automation, such as auto-buff timers or radar checks.',
      exampleBlueprint: `[Trigger: F10] ──▶ [Loop Scheduler: 3000ms] ──(Tick)──▶ [Party Scanner]`
    },
    {
      type: 'sequencer',
      titleTh: 'ลำดับขั้นตอน (Step Sequencer)',
      titleEn: 'Step Sequencer',
      category: 'flow',
      icon: 'list-ordered',
      badge: 'Step Ladder',
      color: '#10b981',
      descTh: 'โหนดแยกขั้นตอนการทำงานเป็นลำดับทีละ Step (Step 1 -> Step 2 -> Step 3 ...) ทำงานตามคิวอย่างเป็นระเบียบ',
      descEn: 'Step sequencer that routes signals through sequential output ports in precise chronological order.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งเริ่มลำดับขั้นตอน', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'step_1', type: 'flow', descTh: 'สัญญาณออกขั้นตอนที่ 1', descEn: 'Fires Step 1' },
        { name: 'step_2', type: 'flow', descTh: 'สัญญาณออกขั้นตอนที่ 2', descEn: 'Fires Step 2' },
        { name: 'step_3', type: 'flow', descTh: 'สัญญาณออกขั้นตอนที่ 3', descEn: 'Fires Step 3' }
      ],
      parameters: [
        { key: 'delayBetween', nameTh: 'หน่วงระหว่างสเต็ป (ms)', nameEn: 'Delay Between Steps (ms)', type: 'number', default: 100, descTh: 'เวลาพักคั่นก่อนเริ่มสเต็ปถัดไป', descEn: 'Delay between consecutive steps' }
      ],
      bestPracticeTh: 'ช่วยให้จัดระเบียบกราฟง่ายขึ้น แทนที่จะต่อ Delay ต่อกันยาวๆ เป็นหางว่าว',
      bestPracticeEn: 'Replaces sprawling daisy-chains of delays with a clean multi-step ladder.',
      exampleBlueprint: `[Sequencer] ──(Step 1)──▶ [Buff A]\n            ├──(Step 2)──▶ [Buff B]\n            └──(Step 3)──▶ [Buff C]`
    },
    {
      type: 'reroute',
      titleTh: 'จุดดักสายไฟ (Reroute Knot)',
      titleEn: 'Reroute Knot',
      category: 'flow',
      icon: 'circle-dot',
      badge: 'Blueprint Waypoint',
      color: '#10b981',
      descTh: 'จุดดักสายไฟสไตล์ Unreal Engine Blueprints เป็นตัวส่งผ่านสัญญาณ 100% ไร้ความหน่วง ใช้จัดระเบียบสายไฟ รวมสายหลายเส้น และแก้ปัญหาสายพันกัน',
      descEn: 'Unreal Engine Blueprint style pass-through knot. Zero-latency waypoint to organize, bend, and consolidate wires.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณจากโหนดหรือ Knot อื่น', descEn: 'Waypoint input' }
      ],
      outputs: [
        { name: 'out', type: 'flow', descTh: 'ส่งต่อสัญญาณออกไปยังโหนดถัดไป', descEn: 'Waypoint output' }
      ],
      parameters: [],
      bestPracticeTh: 'ดับเบิลคลิกบนเส้นเชื่อมต่อเพื่อแทรก Knot ได้ทันที นิยมใช้วางเป็นจุดรวมสายหลายเส้นเข้าสู่โหนดปลายทาง',
      bestPracticeEn: 'Double-click any wire to insert a knot. Perfect for merging fan-in signals or routing backward curves cleanly.',
      exampleBlueprint: `[TTS 1] ──┐\n[TTS 2] ──┼──▶ (( Knot )) ──▶ [Set isScanning = False]\n[TTS 3] ──┘`
    },
    {
      type: 'client_check',
      titleTh: 'ตรวจสอบสถานะจอ (Client Check)',
      titleEn: 'Client Status Check',
      category: 'flow',
      icon: 'app-window',
      badge: 'Screen Gate',
      color: '#10b981',
      descTh: 'ตรวจสอบว่าหน้าต่างเกม/จอเป้าหมาย (Client 1 - 8) กำลังเปิดและเชื่อมต่ออยู่จริงหรือไม่ เพื่อแยกสายทำงานหรือข้ามจอที่ปิดอยู่',
      descEn: 'Checks whether a target client window (Clients 1-8) is open and connected, routing to onActive or onInactive.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งตรวจสอบ', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onActive', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อจอนั้นเปิดและเชื่อมต่ออยู่ (Active)', descEn: 'Fires if target client is open and connected' },
        { name: 'onInactive', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อจอนั้นปิดอยู่ (Skip/Fallback)', descEn: 'Fires if target client is offline or missing' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'เลือกจอที่ต้องการเช็ค (Client 1 - 8)', descEn: 'Target client window' },
        { key: 'checkRule', nameTh: 'กฎการตรวจสอบ', nameEn: 'Rule', type: 'select', default: 'is_active', descTh: 'is_active (เปิดอยู่) หรือ is_inactive (ปิดอยู่)', descEn: 'Validation condition rule' }
      ],
      bestPracticeTh: 'ใช้ต่อสายแบบ Waterfall Cascade สำหรับบอทหลายจอ: ถ้าจอ 1 เปิดอยู่ให้กดสกิล ถ้าปิดอยู่ให้ข้ามไปเช็คจอ 2 ทันที',
      bestPracticeEn: 'Essential for multi-client workflows: pass onInactive to check next client if current client is offline.',
      exampleBlueprint: `[Client Check 1] ──(Active)───▶ [Party Slot 1]\n                 └──(Inactive)─▶ [Client Check 2] ──(Active)──▶ [Party Slot 2]`
    },

    // ═════════════════════════════════════════════════════════════
    // 👁️ 4. VISION & PARTY SYSTEM (ตรวจจับภาพ & ปาร์ตี้)
    // ═════════════════════════════════════════════════════════════
    {
      type: 'party_scanner',
      titleTh: 'สแกนหน้าต่างปาร์ตี้ (Party Scanner)',
      titleEn: 'Party Vision Scanner',
      category: 'vision',
      icon: 'scan-face',
      badge: 'Vision AI',
      color: '#06b6d4',
      descTh: 'ตรวจจับและวิเคราะห์ตำแหน่งหน้าต่างสมาชิกปาร์ตี้ในเกม Flyff Universe ผ่าน Computer Vision ถอดพิกัดสมาชิก หลอด HP และข้อมูลชื่อ',
      descEn: 'Scans the screen using computer vision to locate party member frames, health bars, and slot coordinates in Flyff Universe.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งให้เริ่มสแกนหน้าจอ', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onFound', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อตรวจพบปาร์ตี้สำเร็จ', descEn: 'Fires when party is detected' },
        { name: 'onNotFound', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อไม่พบหน้าต่างปาร์ตี้', descEn: 'Fires when no party is found' },
        { name: 'count_out', type: 'data', descTh: 'จำนวนสมาชิกปาร์ตี้ที่ตรวจพบ (ตัวเลข)', descEn: 'Detected member count (number)' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'จอเกมที่ต้องการสแกน', descEn: 'Target client index' },
        { key: 'scanRegion', nameTh: 'โซนการสแกน', nameEn: 'Scan Region', type: 'select', default: 'auto', descTh: 'auto (ตรวจหาอัตโนมัติ), right (ครึ่งขวา), full (เต็มจอ)', descEn: 'Screen search region' },
        { key: 'showOverlay', nameTh: 'แสดงกรอบ HUD', nameEn: 'Show HUD Reticle', type: 'boolean', default: true, descTh: 'วาดกรอบสีเขียวรอบช่องสมาชิกบนหน้าจอสด', descEn: 'Render HUD bounding box' }
      ],
      bestPracticeTh: 'ตั้งค่า scanRegion เป็น "right" สำหรับหน้าต่างปาร์ตี้ที่วางไว้ฝั่งขวา เพื่อเพิ่มความเร็วในการสแกนขึ้น 2-3 เท่า',
      bestPracticeEn: 'Set scanRegion to "right" if your party window is docked on the right to speed up frame processing.',
      exampleBlueprintTh: `[Party Scanner] ──(Found)────▶ [TTS "พบปาร์ตี้แล้ว"]\n                └──(NotFound)─▶ [Screenshot Diagnostic]`,
      exampleBlueprintEn: `[Party Scanner] ──(Found)────▶ [TTS "Party Detected"]\n                └──(NotFound)─▶ [Screenshot Diagnostic]`,
      exampleBlueprint: `[Party Scanner] ──(Found)────▶ [TTS "Party Detected"]\n                └──(NotFound)─▶ [Screenshot Diagnostic]`
    },
    {
      type: 'party_slot',
      titleTh: 'เลือกช่องปาร์ตี้ (Party Slot Selector)',
      titleEn: 'Party Slot Selector',
      category: 'vision',
      icon: 'mouse-pointer-click',
      badge: 'Vision Clicker',
      color: '#06b6d4',
      descTh: 'คลิกเลือกสมาชิกในปาร์ตี้ตามหมายเลข Slot โดยตรง (เช่น Slot 1 = หัวหน้าปาร์ตี้) เพื่อตามหัวตี้ หรือเลือกเป้าหมายเพื่อซัพพอร์ต',
      descEn: 'Directly targets and clicks a specific party member slot index (e.g. Slot 1 for party leader) to follow or buff.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งคลิกเลือกช่อง', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'next', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อคลิกสำเร็จ', descEn: 'Fires upon successful click' },
        { name: 'onError', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อช่องว่าง หรือหาเป้าหมายไม่พบ', descEn: 'Fires if slot is empty or missing' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'จอเกมที่ต้องการสั่งคลิก', descEn: 'Target client screen' },
        { key: 'targetSlot', nameTh: 'หมายเลขช่อง (Slot)', nameEn: 'Slot Number', type: 'select', default: 1, descTh: 'ช่องสมาชิก 1 ถึง 8 (Slot 1 คือหัวหน้าปาร์ตี้)', descEn: 'Party slot number' },
        { key: 'delayAfterClick', nameTh: 'หน่วงหลังคลิก (ms)', nameEn: 'Delay After Click (ms)', type: 'number', default: 80, descTh: 'ระยะเวลาพักหลังเมาส์คลิก', descEn: 'Post-click delay in ms' },
        { key: 'showOverlay', nameTh: 'แสดงจุดคลิกบน HUD', nameEn: 'Show HUD Dot', type: 'boolean', default: true, descTh: 'แสดงเครื่องหมายเป้าเล็งสีแดงบนหน้าจอตอนคลิก', descEn: 'Show target reticle on HUD' }
      ],
      bestPracticeTh: 'นิยมต่อคู่กับ Key Press Z เพื่อทำระบบ "Follow Leader Party" (คลิกเลือกหัวตี้ในช่อง 1 แล้วกด Z เพื่อวิ่งตาม)',
      bestPracticeEn: 'Standard companion to Key Press Z for "Follow Leader": clicks Slot 1 then presses Z to follow.',
      exampleBlueprint: `[Party Slot 1 (Leader)] ──(Next)──▶ [Key Press: Z] ──▶ [TTS "Following"]`
    },
    {
      type: 'party_heal',
      titleTh: 'ฮีลปาร์ตี้อัตโนมัติ (Party Heal Routine)',
      titleEn: 'Party Heal Routine',
      category: 'vision',
      icon: 'heart-pulse',
      badge: 'Auto Medic',
      color: '#06b6d4',
      descTh: 'ตรวจจับหลอดเลือด (HP Bar) ของเพื่อนในปาร์ตี้แบบ Real-time หากพบใครเลือดลดต่ำกว่าเกณฑ์จะคลิกเลือกแล้วกดยาทันที',
      descEn: 'Continuously monitors party member HP bars via visual scanner and automatically targets & heals anyone below threshold.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งตรวจเช็คเลือด', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onHealed', type: 'flow', descTh: 'ส่งสัญญาณเมื่อฮีลเพื่อนสำเร็จ', descEn: 'Fires when heal skill is executed' },
        { name: 'onAllHealthy', type: 'flow', descTh: 'ส่งสัญญาณเมื่อทุกคนเลือดเต็มปกติ', descEn: 'Fires when everyone is full HP' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอหมอ (Healer)', nameEn: 'Healer Client', type: 'select', default: '2', descTh: 'จอตัวละครฮีล', descEn: 'Healer client' },
        { key: 'healKey', nameTh: 'ปุ่มสกิลฮีล', nameEn: 'Heal Skill Key', type: 'string', default: '1', descTh: 'เช่น ปุ่ม 1 สกิล Heal', descEn: 'Heal skill hotkey' },
        { key: 'hpThreshold', nameTh: 'เกณฑ์เลือดต่ำกว่า (%)', nameEn: 'HP Threshold (%)', type: 'number', default: 75, descTh: 'ถ้าเลือดน้อยกว่าเปอร์เซ็นต์นี้จะเริ่มฮีล', descEn: 'HP trigger percentage' }
      ],
      bestPracticeTh: 'ควรตั้งเกณฑ์ที่ 70-80% เพื่อให้ตัวละครเริ่มฮีลก่อนที่เพื่อนร่วมทีมจะเสียชีวิตจากดาเมจต่อเนื่อง',
      bestPracticeEn: 'Keep threshold around 75% so heals land safely before burst damage knocks out teammates.',
      exampleBlueprint: `[Loop Scheduler: 500ms] ──▶ [Party Heal: 75%] ──(Healed)──▶ [TTS "Healed Member"]`
    },
    {
      type: 'party_buff',
      titleTh: 'บัฟปาร์ตี้อัตโนมัติ (Party Buff Routine)',
      titleEn: 'Party Buff Routine',
      category: 'vision',
      icon: 'sparkles',
      badge: 'Auto Support',
      color: '#06b6d4',
      descTh: 'วนคลิกสมาชิกในปาร์ตี้ทุกคนทีละคน แล้วร่ายชุดสกิลบัฟที่กำหนดจนครบทุกคนอย่างอัตโนมัติ เหมาะสำหรับสายซัพพอร์ต (RM / Ringmaster)',
      descEn: 'Iteratively selects each member in the party and casts a configured set of buff skills sequentially.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณเริ่มรันชุดบัฟ', descEn: 'Start buff sequence' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อบัฟสมาชิกครบทุกคนแล้ว', descEn: 'Fires when all members are buffed' },
        { name: 'onError', type: 'flow', descTh: 'ส่งสัญญาณออกหากเกิดข้อผิดพลาดในการสแกน', descEn: 'Fires if party detection fails' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอสายบัฟ (RM)', nameEn: 'Buffer Client', type: 'select', default: '2', descTh: 'จอตัวละครที่มีสกิลบัฟ', descEn: 'Buffer client' },
        { key: 'keys', nameTh: 'คีย์สกิลบัฟ', nameEn: 'Buff Hotkeys', type: 'key_input', default: ['1', '2', '3'], descTh: 'ปุ่มสกิลบัฟที่ต้องการร่ายทีละสกิล', descEn: 'Buff skill hotkeys' },
        { key: 'delayBuff', nameTh: 'หน่วงระหว่างสกิล (ms)', nameEn: 'Delay Between Skills (ms)', type: 'number', default: 900, descTh: 'เวลารอ Animation ร่ายสกิลของแต่ละท่า', descEn: 'Cast animation delay' }
      ],
      bestPracticeTh: 'ตั้งเวลาหน่วง delayBuff ให้สอดคล้องกับความเร็วร่าย (Casting Time) ของตัวละคร เพื่อไม่ให้กดข้ามสกิล',
      bestPracticeEn: 'Match delayBuff with character cast speed to avoid skipping skills during casting animation.',
      exampleBlueprint: `[Loop Scheduler: 15m] ──▶ [Party Buff: Keys 1,2,3,4] ──▶ [TTS "Party Re-buffed"]`
    },
    {
      type: 'screenshot',
      titleTh: 'แคปรูปภาพหน้าจอ (Screenshot Diagnostic)',
      titleEn: 'Screenshot Diagnostic',
      category: 'vision',
      icon: 'camera',
      badge: 'Visual Snap',
      color: '#06b6d4',
      descTh: 'บันทึกภาพหน้าจอเกมหรือโซนเฉพาะลงในโฟลเดอร์ `screenshots/` เพื่อใช้ตรวจสอบข้อผิดพลาด (Debug) หรือเก็บหลักฐานการทำงาน',
      descEn: 'Captures game client screen or regional crop to disk in `screenshots/` folder for diagnostics and verification.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งแคปภาพหน้าจอ', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกหลังบันทึกรูปภาพสำเร็จ', descEn: 'Fires after screenshot file saved' }
      ],
      parameters: [
        { key: 'targetClient', nameTh: 'จอเป้าหมาย', nameEn: 'Target Client', type: 'select', default: '1', descTh: 'จอเกมที่ต้องการแคปรูป', descEn: 'Target client index' },
        { key: 'region', nameTh: 'บริเวณที่แคป', nameEn: 'Capture Region', type: 'select', default: 'full', descTh: 'full (เต็มจอ), party (เฉพาะตารางปาร์ตี้), custom', descEn: 'Capture region bounds' },
        { key: 'subfolder', nameTh: 'โฟลเดอร์ย่อย', nameEn: 'Subfolder', type: 'string', default: 'error_snap', descTh: 'ชื่อโฟลเดอร์ย่อยใน screenshots/', descEn: 'Subfolder inside screenshots/' }
      ],
      bestPracticeTh: 'ต่อไว้ที่กิ่ง onError ของ Party Slot หรือ Party Scanner เพื่อถ่ายรูปเก็บไว้ดูว่าทำไมถึงตรวจจับไม่เจอ',
      bestPracticeEn: 'Wire to the onError output of vision nodes to record visual snapshots whenever detection fails.',
      exampleBlueprint: `[Party Slot 1] ──(onError)──▶ [Screenshot: error_snap] ──▶ [TTS "Scan Failed"]`
    },

    // ═════════════════════════════════════════════════════════════
    // 📦 5. VARIABLES & LOGIC DATA (ตัวแปร & จัดการข้อมูล)
    // ═════════════════════════════════════════════════════════════
    {
      type: 'variable',
      titleTh: 'ตั้งค่าตัวแปร (Set Variable)',
      titleEn: 'Set Variable',
      category: 'data',
      icon: 'database',
      badge: 'State Mutator',
      color: '#8b5cf6',
      descTh: 'บันทึกหรือเปลี่ยนค่าตัวแปรในหน่วยความจำ (Boolean, Number, String) รองรับการเซ็ตค่าตรงๆ, สลับค่า (Toggle), หรือคำนวณบวกลบ',
      descEn: 'Sets or mutates state variables in memory (Boolean, Number, String). Supports set, toggle, or arithmetic increment.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งอัปเดตตัวแปร', descEn: 'Execution in' },
        { name: 'val_in', type: 'data', descTh: 'รับค่าตัวแปรใหม่จากโหนดอื่น', descEn: 'Dynamic value input' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกหลังอัปเดตค่าเสร็จ', descEn: 'Fires after variable is set' },
        { name: 'val_out', type: 'data', descTh: 'ส่งค่าตัวแปรล่าสุดออกเป็นพินข้อมูล Data', descEn: 'Outputs current variable value' }
      ],
      parameters: [
        { key: 'varName', nameTh: 'ชื่อตัวแปร', nameEn: 'Variable Name', type: 'string', default: 'isScanning', descTh: 'เช่น isScanning, potCount, partyLeaderName', descEn: 'Variable identifier name' },
        { key: 'varType', nameTh: 'ชนิดข้อมูล', nameEn: 'Data Type', type: 'select', default: 'boolean', descTh: 'boolean / number / string', descEn: 'Data type' },
        { key: 'operation', nameTh: 'การกระทำ', nameEn: 'Operation', type: 'select', default: 'set', descTh: 'set (กำหนดค่า), toggle (สลับจริง/เท็จ), add (บวกเพิ่ม)', descEn: 'Mutation operation' },
        { key: 'opValue', nameTh: 'ค่าที่ต้องการกำหนด', nameEn: 'Value', type: 'string', default: 'true', descTh: 'ค่าใหม่ที่ต้องการเซ็ตลงตัวแปร', descEn: 'Target value' }
      ],
      bestPracticeTh: 'ใช้เป็น Flag ตัวแปรสถานะ เช่น `isScanning = true` เมื่อเริ่มวนลูป และเซ็ตเป็น `false` เมื่อทำงานจบ',
      bestPracticeEn: 'Great for execution flags: set `isScanning = true` on start and `false` on completion/error.',
      exampleBlueprint: `[Trigger: INSERT] ──▶ [Set isScanning = True] ──▶ [Start Loop]`
    },
    {
      type: 'var_get',
      titleTh: 'อ่านค่าตัวแปร (Get Variable)',
      titleEn: 'Get Variable',
      category: 'data',
      icon: 'file-input',
      badge: 'State Reader',
      color: '#8b5cf6',
      descTh: 'อ่านค่าปัจจุบันของตัวแปรจากหน่วยความจำ แล้วส่งออกทางพิน Data (val_out) เพื่อนำไปป้อนให้โหนดข้อความหรือเงื่อนไข',
      descEn: 'Reads current value of a variable from state store and emits it through the data output pin (val_out).',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งให้อ่านค่า', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'next', type: 'flow', descTh: 'ส่งสัญญาณออกทำงานต่อเนื่อง', descEn: 'Execution next' },
        { name: 'val_out', type: 'data', descTh: 'ค่าตัวแปรที่อ่านได้ (Data Pin)', descEn: 'Variable data output' }
      ],
      parameters: [
        { key: 'varName', nameTh: 'ชื่อตัวแปร', nameEn: 'Variable Name', type: 'string', default: 'isScanning', descTh: 'ชื่อตัวแปรที่ต้องการอ่าน', descEn: 'Target variable name' }
      ],
      bestPracticeTh: 'ลากสายข้อมูลจาก val_out เข้าสู่พินรับข้อมูลของ Format Text เพื่อประกอบข้อความแจ้งเตือน',
      bestPracticeEn: 'Connect data pin `val_out` into `Format Text` template input pin.',
      exampleBlueprint: `[Get Variable: playerName] ──(val_out)──▶ [Format Text: Hello {name}]`
    },
    {
      type: 'var_branch',
      titleTh: 'แยกทางตามตัวแปร (Variable Branch)',
      titleEn: 'Variable Branch',
      category: 'data',
      icon: 'help-circle',
      badge: 'Data Comparator',
      color: '#8b5cf6',
      descTh: 'เปรียบเทียบค่าของตัวแปรโดยตรง (เช่น isScanning == true หรือ potCount > 10) แล้วแยกสายส่งสัญญาณออกทาง True หรือ False',
      descEn: 'Evaluates variable values against comparisons (equals, greater than, contains) and branches to True or False.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งตรวจสอบค่าตัวแปร', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onTrue', type: 'flow', descTh: 'สัญญาณออกเมื่อค่าตรงตามเงื่อนไข (True)', descEn: 'Fires if comparison is TRUE' },
        { name: 'onFalse', type: 'flow', descTh: 'สัญญาณออกเมื่อค่าไม่ตรงเงื่อนไข (False)', descEn: 'Fires if comparison is FALSE' }
      ],
      parameters: [
        { key: 'varName', nameTh: 'ชื่อตัวแปร', nameEn: 'Variable Name', type: 'string', default: 'isScanning', descTh: 'ชื่อตัวแปรที่ต้องการเปรียบเทียบ', descEn: 'Variable to compare' },
        { key: 'comparison', nameTh: 'ตัวดำเนินการ', nameEn: 'Operator', type: 'select', default: 'equals', descTh: 'equals (==), not_equals (!=), greater (>), less (<)', descEn: 'Comparison operator' },
        { key: 'targetValue', nameTh: 'ค่าเปรียบเทียบ', nameEn: 'Comparison Value', type: 'string', default: 'true', descTh: 'ค่าที่นำมาเทียบ', descEn: 'Comparison operand' }
      ],
      bestPracticeTh: 'ใช้ทำสวิตช์เปิด/ปิด: เมื่อกดปุ่ม ถ้าตัวแปรเป็น False ให้เปิดบอท แต่ถ้าเป็น True ให้สั่งหยุดบอท',
      bestPracticeEn: 'Perfect for single-hotkey toggles: If True -> Stop, If False -> Start.',
      exampleBlueprint: `[Trigger: INSERT] ──▶ [Var Branch: isScanning == True]\n                      ├──(True)──▶ [Emergency Stop]\n                      └──(False)─▶ [Start Workflow]`
    },
    {
      type: 'format_text',
      titleTh: 'จัดรูปแบบข้อความ (Format Text)',
      titleEn: 'Format Text Template',
      category: 'data',
      icon: 'file-text',
      badge: 'Text Builder',
      color: '#8b5cf6',
      descTh: 'รวมสายข้อมูลหลายเส้นและแทนค่าลงในเทมเพลตข้อความ เช่น "จอ {client}: สมาชิกปาร์ตี้ {name} เลือดเหลือน้อย" เพื่อส่งให้ TTS หรือ Log',
      descEn: 'Interpolates multiple incoming data pins into a template string (e.g. "Client {c}: {name} is low HP") for TTS or Discord.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งประกอบข้อความ', descEn: 'Execution in' },
        { name: 'val_a', type: 'data', descTh: 'รับข้อมูลตัวแปรตัวที่ 1', descEn: 'Variable pin A' },
        { name: 'val_b', type: 'data', descTh: 'รับข้อมูลตัวแปรตัวที่ 2', descEn: 'Variable pin B' }
      ],
      outputs: [
        { name: 'next', type: 'flow', descTh: 'ส่งสัญญาณออกทำงานต่อเนื่อง', descEn: 'Execution next' },
        { name: 'msg_out', type: 'data', descTh: 'ข้อความที่ประกอบเสร็จเรียบร้อยแล้ว', descEn: 'Formatted string output' }
      ],
      parameters: [
        { key: 'template', nameTh: 'ข้อความเทมเพลต', nameEn: 'Template String', type: 'string', defaultTh: 'สมาชิก {val_a} อยู่ในสถานะ {val_b}', defaultEn: 'Party member {val_a} is currently {val_b}', default: 'Party member {val_a} is currently {val_b}', descTh: 'ใส่ชื่อพินในวงเล็บปีกกา เช่น {val_a}', descEn: 'Template string with {pins}' }
      ],
      bestPracticeTh: 'ต่อสาย msg_out เข้าสู่พิน text_in ของโหนด Text-To-Speech เพื่อให้อ่านเสียงข้อความไดนามิกตามสถานการณ์จริง',
      bestPracticeEn: 'Pipe `msg_out` into the `text_in` pin of TTS to speak dynamic game status.',
      exampleBlueprintTh: `[Format Text: "เตือนภัย จอ {val_a}"] ──(msg_out)──▶ [Text To Speech]`,
      exampleBlueprintEn: `[Format Text: "Alert Screen {val_a}"] ──(msg_out)──▶ [Text To Speech]`,
      exampleBlueprint: `[Format Text: "Alert Screen {val_a}"] ──(msg_out)──▶ [Text To Speech]`
    },

    // ═════════════════════════════════════════════════════════════
    // 🛡️ 6. SAFETY & SYSTEM UTILITIES (ความปลอดภัย & ระบบ)
    // ═════════════════════════════════════════════════════════════
    {
      type: 'emergency_stop',
      titleTh: 'หยุดฉุกเฉิน (Emergency Stop)',
      titleEn: 'Emergency Stop',
      category: 'safety',
      icon: 'octagon-x',
      badge: 'Safety Killswitch',
      color: '#3b82f6',
      descTh: 'สวิตช์ตัดการทำงานฉุกเฉิน สั่งหยุดลูปทั้งหมด ปลดปล่อยปุ่มคีย์บอร์ดที่กดค้างไว้ และล้างคิวคำสั่งทันทีเพื่อความปลอดภัยสูงสุด',
      descEn: 'Emergency safety interrupter that instantly halts active loops, releases stuck held keys, and clears action queues.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งตัดการทำงานทันที', descEn: 'Trigger emergency stop' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'สัญญาณออกหลังจากเคลียร์ระบบเสร็จสิ้น', descEn: 'Fires after emergency cleanup finishes' }
      ],
      parameters: [
        { key: 'stopScope', nameTh: 'ขอบเขตการหยุด', nameEn: 'Interruption Scope', type: 'select', default: 'all', descTh: 'all (หยุดทั้งโปรแกรม), client (เฉพาะจอปัจจุบัน), loops (เฉพาะลูป)', descEn: 'Interruption scope' },
        { key: 'showOverlayNotice', nameTh: 'แจ้งเตือนบน HUD', nameEn: 'Show HUD Notice', type: 'boolean', default: true, descTh: 'แสดงข้อความเตือนตัวสีแดงบนหน้าจอเกม', descEn: 'Display red alert on HUD' }
      ],
      bestPracticeTh: 'ควรผูกไว้กับปุ่ม Hotkey ฉุกเฉิน (เช่น ปุ่ม END หรือ ESC) หรือต่อสายไว้ที่กิ่ง onError ของคำสั่งสำคัญ',
      bestPracticeEn: 'Wire to physical kill-switch hotkeys like END or to error pins of critical actions.',
      exampleBlueprint: `[Global Trigger: END] ──▶ [Emergency Stop: All] ──▶ [Sound: Warning Beep]`
    },
    {
      type: 'tts',
      titleTh: 'อ่านออกเสียง (Text-To-Speech)',
      titleEn: 'Text-To-Speech Alert',
      category: 'safety',
      icon: 'mic',
      badge: 'Voice Engine',
      color: '#3b82f6',
      descTh: 'แปลงข้อความเป็นเสียงพูดภาษาไทยหรืออังกฤษด้วย Microsoft Edge Neural Voice พร้อมระบบคิวเสียง waitForPrevious ป้องกันเสียงซ้อนกัน',
      descEn: 'Speaks text using natural Neural TTS voices (Thai/English) with `waitForPrevious` sequential queue synchronization.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งอ่านข้อความ', descEn: 'Execution in' },
        { name: 'text_in', type: 'data', descTh: 'รับข้อความไดนามิกจาก Format Text หรือตัวแปร', descEn: 'Dynamic text input pin' }
      ],
      outputs: [
        { name: 'onSpoken', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อพูดข้อความจบประโยค', descEn: 'Fires after voice speech completes' },
        { name: 'onError', type: 'flow', descTh: 'ส่งสัญญาณออกเมื่อระบบเสียงผิดพลาด', descEn: 'Fires if audio playback fails' }
      ],
      parameters: [
        { key: 'text', nameTh: 'ข้อความที่จะพูด', nameEn: 'Speech Text', type: 'string', defaultTh: 'บอทเริ่มทำงานแล้ว', defaultEn: 'Bot started successfully', default: 'Bot started successfully', descTh: 'ข้อความภาษาไทยหรืออังกฤษที่ต้องการให้อ่าน', descEn: 'Text to speak' },
        { key: 'voice', nameTh: 'เสียงพากย์', nameEn: 'Voice Persona', type: 'select', default: 'th-TH-PremwadeeNeural', descTh: 'เลือกเสียง (เปรมวดี / นิวัฒน์ / เสียงอังกฤษ)', descEn: 'Neural voice persona' },
        { key: 'waitForPrevious', nameTh: 'รอให้เสียงก่อนหน้าจบก่อน', nameEn: 'Wait For Previous', type: 'boolean', default: true, descTh: 'ป้องกันเสียงพูดตีกันเมื่อมีหลายโหนดยิงพร้อมกัน', descEn: 'Queue voice to avoid overlaps' }
      ],
      bestPracticeTh: 'เปิดสวิตช์ "waitForPrevious: true" ไว้เสมอ เมื่อมีโหนด TTS หลายจอ เพื่อให้ระบบเข้าคิวพูดทีละประโยคอย่างชัดเจน',
      bestPracticeEn: 'Keep `waitForPrevious: true` enabled across multi-client flows to ensure clear, sequential speech.',
      exampleBlueprintTh: `[Key Press: Z] ──▶ [TTS: "กำลังวิ่งตามหัวหน้าตี้ (waitForPrevious: True)"]`,
      exampleBlueprintEn: `[Key Press: Z] ──▶ [TTS: "Following party leader (waitForPrevious: True)"]`,
      exampleBlueprint: `[Key Press: Z] ──▶ [TTS: "Following party leader (waitForPrevious: True)"]`
    },
    {
      type: 'sound',
      titleTh: 'เล่นเสียงเตือน (Sound Alert)',
      titleEn: 'Audio Sound Alert',
      category: 'safety',
      icon: 'volume-2',
      badge: 'Audio Beeper',
      color: '#3b82f6',
      descTh: 'ส่งเสียงเตือนสั้นๆ ผ่านลำโพง เช่น เสียงบี๊บ, เสียงระฆัง, เสียงไซเรน หรือไฟล์เสียง .mp3 / .wav ในเครื่อง',
      descEn: 'Plays short notification sound effects (Preset chime, bell, siren, or custom mp3/wav files).',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งเล่นเสียง', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกหลังเล่นเสียงเสร็จ', descEn: 'Fires after audio finishes' }
      ],
      parameters: [
        { key: 'soundSource', nameTh: 'แหล่งที่มาเสียง', nameEn: 'Sound Source', type: 'select', default: 'preset', descTh: 'preset (เสียงในตัว) หรือ custom (ไฟล์ในเครื่อง)', descEn: 'Preset or custom file' },
        { key: 'soundPreset', nameTh: 'เสียงพรีเซ็ต', nameEn: 'Preset Sound', type: 'select', default: 'ding', descTh: 'ding, alert, levelup, coin, siren', descEn: 'Preset audio choice' },
        { key: 'volume', nameTh: 'ระดับเสียง (%)', nameEn: 'Volume (%)', type: 'number', default: 100, descTh: 'ความดังเสียง 0 ถึง 100', descEn: 'Audio volume 0-100' }
      ],
      bestPracticeTh: 'ใช้ส่งเสียงเตือนเหตุการณ์สำคัญ เช่น เมื่อบอทติดบั๊ก หรือเมื่อมีผู้เล่นอื่นเข้ามาใกล้',
      bestPracticeEn: 'Great for immediate auditory feedback upon errors or player proximity.',
      exampleBlueprint: `[Emergency Stop] ──▶ [Sound: Siren Alert (100%)]`
    },
    {
      type: 'step_log',
      titleTh: 'บันทึกข้อความ (Step Logger)',
      titleEn: 'Step Logger',
      category: 'safety',
      icon: 'file-text',
      badge: 'Diagnostics',
      color: '#3b82f6',
      descTh: 'พิมพ์ข้อความตรวจสอบและเวลาลงใน Console Terminal ของ Launcher และบันทึกลงไฟล์ประจำวันใน `logs/`',
      descEn: 'Logs formatted diagnostic messages with timestamp and custom step tag to console and disk log files.',
      inputs: [
        { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งบันทึกข้อความ', descEn: 'Execution in' }
      ],
      outputs: [
        { name: 'next', type: 'flow', descTh: 'ส่งสัญญาณออกทำงานต่อเนื่อง', descEn: 'Execution next' }
      ],
      parameters: [
        { key: 'text', nameTh: 'ข้อความบันทึก', nameEn: 'Log Message', type: 'string', defaultTh: 'ผ่านขั้นตอนที่ 1 เรียบร้อย', defaultEn: 'Step 1 completed successfully', default: 'Step 1 completed successfully', descTh: 'ข้อความที่ต้องการบันทึก', descEn: 'Log text content' },
        { key: 'stepTag', nameTh: 'แท็กหัวข้อ', nameEn: 'Step Tag', type: 'string', default: 'STEP', descTh: 'แท็กกำกับ เช่น [PARTY], [BUFF], [DEBUG]', descEn: 'Log tag prefix' }
      ],
      bestPracticeTh: 'ใส่ไว้ตามจุดแยกสำคัญเพื่อตรวจเช็คย้อนหลังในหน้า Logs ว่าบอทวิ่งผ่านเส้นไหนบ้าง',
      bestPracticeEn: 'Place at branch junctions to trace execution path in the log viewer.',
      exampleBlueprint: `[Step Logger: "[PARTY] Slot 1 Clicked"] ──▶ [Key Press: Z]`
    }
  ];

  // Helper dictionary lookup map by node type
  const CATALOG_MAP = new Map();
  NODE_DOCS_CATALOG.forEach(node => {
    CATALOG_MAP.set(node.type, node);
  });

  function getNodeDoc(type) {
    if (!type) return null;
    const cleanType = String(type).trim().toLowerCase();
    
    if (CATALOG_MAP.has(cleanType)) {
      return CATALOG_MAP.get(cleanType);
    }

    return {
      type: cleanType,
      titleTh: `โหนด ${cleanType}`,
      titleEn: `Node: ${cleanType}`,
      category: 'actions',
      icon: 'layers',
      badge: 'Modular Node',
      color: '#38bdf8',
      descTh: `โหนดโมดูลาร์ "${cleanType}" ทำงานในระบบ Node Workflow`,
      descEn: `Modular action node "${cleanType}" in Node Workflow architecture.`,
      inputs: [{ name: 'in', type: 'flow', descTh: 'รับสัญญาณคำสั่ง', descEn: 'Execution in' }],
      outputs: [{ name: 'next', type: 'flow', descTh: 'ส่งสัญญาณออก', descEn: 'Execution next' }],
      parameters: [],
      bestPracticeTh: 'ต่อพิน in เพื่อรับคำสั่ง และต่อพิน next ไปยังโหนดถัดไป',
      bestPracticeEn: 'Wire the in pin to trigger execution and next pin downstream.',
      exampleBlueprint: `[Trigger] ──▶ [${cleanType}] ──▶ [Next]`
    };
  }

  function registerCustomNodeDoc(nodeDoc) {
    if (!nodeDoc || !nodeDoc.type) return;
    const cleanType = String(nodeDoc.type).trim().toLowerCase();
    CATALOG_MAP.set(cleanType, nodeDoc);
    const existingIdx = NODE_DOCS_CATALOG.findIndex(n => n.type === cleanType);
    if (existingIdx >= 0) {
      NODE_DOCS_CATALOG[existingIdx] = nodeDoc;
    } else {
      NODE_DOCS_CATALOG.push(nodeDoc);
    }
  }

  const REGISTRY_CATEGORY_MAP = {
    'triggers': 'triggers',
    'trigger': 'triggers',
    'actions & input': 'actions',
    'action': 'actions',
    'actions': 'actions',
    'logic & flow': 'flow',
    'flow': 'flow',
    'control': 'flow',
    'vision & party': 'vision',
    'vision': 'vision',
    'party': 'vision',
    'variables & data': 'data',
    'data': 'data',
    'variable': 'data',
    'safety & utilities': 'safety',
    'utility & debug': 'safety',
    'safety': 'safety',
    'utility': 'safety',
    'system': 'safety'
  };

  /**
   * Synchronize Wiki Catalog with Live Node Registry
   * Single Source of Truth: Ingests modular node definitions from /nodes/*.node.js
   * @param {Array<Object>} nodesList - Node definitions from NodeRegistry / /api/nodes
   */
  function syncWithRegistry(nodesList) {
    if (!Array.isArray(nodesList)) return;

    for (const node of nodesList) {
      if (!node || !node.type) continue;
      const cleanType = String(node.type).trim().toLowerCase();
      const doc = node.doc || {};

      let catId = 'actions';
      if (node.category) {
        const lowerCat = String(node.category).trim().toLowerCase();
        catId = REGISTRY_CATEGORY_MAP[lowerCat] || 'actions';
      }

      // Format Inputs
      const formattedInputs = [];
      if (doc.inputs && Array.isArray(doc.inputs) && doc.inputs.length > 0) {
        formattedInputs.push(...doc.inputs);
      } else if (Array.isArray(node.inputs)) {
        node.inputs.forEach(pinName => {
          const isDataPin = pinName.endsWith('_in') || pinName === 'data' || pinName === 'val_in' || pinName === 'msg_in';
          formattedInputs.push({
            name: pinName,
            type: isDataPin ? 'data' : 'flow',
            descTh: isDataPin ? `รับข้อมูล Data Wire (${pinName})` : 'รับสัญญาณกระตุ้นการทำงาน',
            descEn: isDataPin ? `Data input pin (${pinName})` : 'Execution flow input'
          });
        });
      }

      // Format Outputs
      const formattedOutputs = [];
      if (doc.outputs && Array.isArray(doc.outputs) && doc.outputs.length > 0) {
        formattedOutputs.push(...doc.outputs);
      } else {
        if (Array.isArray(node.outputs)) {
          node.outputs.forEach(pinName => {
            const isDataPin = pinName.endsWith('_out') || pinName === 'val_out';
            let thDesc = `สัญญาณ ${pinName}`;
            if (pinName === 'onComplete') thDesc = 'ทำงานสำเร็จ ส่งสัญญาณต่อไป';
            else if (pinName === 'onError') thDesc = 'ส่งสัญญาณเมื่อเกิดข้อผิดพลาด';
            else if (pinName === 'onTrue') thDesc = 'ส่งสัญญาณเมื่อเงื่อนไขเป็นจริง';
            else if (pinName === 'onFalse') thDesc = 'ส่งสัญญาณเมื่อเงื่อนไขเป็นเท็จ';
            else if (pinName === 'val_out') thDesc = 'ส่งค่าตัวแปรออกผ่านสาย Data Wire';

            formattedOutputs.push({
              name: pinName,
              type: isDataPin ? 'data' : 'flow',
              descTh: thDesc,
              descEn: `Flow / Data signal (${pinName})`
            });
          });
        }
        if (Array.isArray(node.dataOutputs)) {
          node.dataOutputs.forEach(pin => {
            const pinName = typeof pin === 'string' ? pin : pin.name;
            const pinLabel = (typeof pin === 'object' && pin.label) ? pin.label : pinName;
            formattedOutputs.push({
              name: pinName,
              type: 'data',
              descTh: `ส่งค่า Data Wire: ${pinLabel}`,
              descEn: `Data output pin: ${pinLabel}`
            });
          });
        }
      }

      // Format Parameters
      const formattedParams = [];
      if (doc.parameters && Array.isArray(doc.parameters) && doc.parameters.length > 0) {
        formattedParams.push(...doc.parameters);
      } else if (Array.isArray(node.schema) && node.schema.length > 0) {
        node.schema.forEach(field => {
          formattedParams.push({
            key: field.key,
            nameTh: field.label || field.key,
            nameEn: field.labelKey || field.key,
            type: field.component === 'checkbox' ? 'boolean' : (field.component === 'number' ? 'number' : (field.component === 'select' ? 'select' : 'string')),
            default: (node.defaultData && node.defaultData[field.key] !== undefined) ? node.defaultData[field.key] : '',
            descTh: field.placeholder || (field.label || field.key),
            descEn: field.labelKey || field.key
          });
        });
      }

      const existing = CATALOG_MAP.get(cleanType);
      if (existing) {
        if (doc.titleTh) existing.titleTh = doc.titleTh;
        if (doc.titleEn) existing.titleEn = doc.titleEn;
        if (doc.descTh) existing.descTh = doc.descTh;
        if (doc.descEn) existing.descEn = doc.descEn;
        if (doc.badge) existing.badge = doc.badge;
        if (doc.bestPracticeTh) existing.bestPracticeTh = doc.bestPracticeTh;
        if (doc.exampleBlueprint) existing.exampleBlueprint = doc.exampleBlueprint;
        if (doc.exampleBlueprintTh) existing.exampleBlueprintTh = doc.exampleBlueprintTh;
        if (doc.exampleBlueprintEn) existing.exampleBlueprintEn = doc.exampleBlueprintEn;
        if (node.icon) existing.icon = node.icon;
        if (node.color) existing.color = node.color;
        if (formattedInputs.length > 0) existing.inputs = formattedInputs;
        if (formattedOutputs.length > 0) existing.outputs = formattedOutputs;
        if (formattedParams.length > 0) existing.parameters = formattedParams;
      } else {
        const newNodeEntry = {
          type: cleanType,
          titleTh: doc.titleTh || node.title || `โหนด ${cleanType}`,
          titleEn: doc.titleEn || node.title || cleanType,
          category: doc.category || catId,
          icon: node.icon || 'layers',
          badge: doc.badge || 'Modular Node',
          color: node.color || '#3b82f6',
          descTh: doc.descTh || `โหนดประมวลผล ${node.title || cleanType} ในระบบ Action Node Workflow`,
          descEn: doc.descEn || `Action node ${node.title || cleanType} executed in the node workflow graph.`,
          inputs: formattedInputs.length > 0 ? formattedInputs : [{ name: 'in', type: 'flow', descTh: 'รับสัญญาณคำสั่ง', descEn: 'Execution in' }],
          outputs: formattedOutputs.length > 0 ? formattedOutputs : [{ name: 'next', type: 'flow', descTh: 'ส่งสัญญาณออกทำงานต่อเนื่อง', descEn: 'Execution next' }],
          parameters: formattedParams,
          bestPracticeTh: doc.bestPracticeTh || 'ต่อพิน in เพื่อรับคำสั่ง และต่อพินเอาต์พุตไปยังโหนดที่ต้องการให้ทำงานถัดไป',
          bestPracticeEn: doc.bestPracticeEn || 'Wire input flow to start execution and output pins to downstream nodes.',
          exampleBlueprint: doc.exampleBlueprint || `[In] ──▶ [${node.title || cleanType}] ──▶ [Next]`,
          exampleBlueprintTh: doc.exampleBlueprintTh || undefined,
          exampleBlueprintEn: doc.exampleBlueprintEn || undefined
        };
        registerCustomNodeDoc(newNodeEntry);
      }
    }
  }

  // Auto-connect with window.clientNodeRegistry if available
  if (typeof window !== 'undefined') {
    const setupRegistrySync = () => {
      if (window.clientNodeRegistry) {
        if (window.clientNodeRegistry.isLoaded) {
          syncWithRegistry(window.clientNodeRegistry.getAll());
        }
        window.clientNodeRegistry.onUpdate((allNodes) => {
          syncWithRegistry(allNodes);
          if (global._activeNodeDocsInstance) {
            try {
              global._activeNodeDocsInstance.renderCategorySelect();
              global._activeNodeDocsInstance.renderNodeList();
              global._activeNodeDocsInstance.renderNodeDetails(global._activeNodeDocsInstance.selectedType);
            } catch (e) {}
          }
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupRegistrySync);
    } else {
      setupRegistrySync();
    }
  }

  const NodeDocsData = {
    categories: NODE_DOCS_CATEGORIES,
    catalog: NODE_DOCS_CATALOG,
    getNodeDoc: getNodeDoc,
    registerCustomNodeDoc: registerCustomNodeDoc,
    syncWithRegistry: syncWithRegistry
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeDocsData;
  }
  global.NodeDocsData = NodeDocsData;
  global.NodeDocsCatalog = CATALOG_MAP;

})(typeof window !== 'undefined' ? window : global);
