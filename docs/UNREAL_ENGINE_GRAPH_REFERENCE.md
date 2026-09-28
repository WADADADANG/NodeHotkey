# 📚 Unreal Engine Graph Editor & Spline Wiring Reference

เอกสารฉบับนี้จัดทำขึ้นเพื่อบันทึกโครงสร้างทางสถาปัตยกรรม, ตำแหน่งซอร์สโค้ดใน Unreal Engine, คลาส, ฟังก์ชัน และสูตรคณิตศาสตร์ที่ใช้ในการเรนเดอร์เส้นเชื่อมต่อ (Spline Wires) และ Reroute Nodes (Knots) สำหรับใช้เป็นมาตรฐานอ้างอิงของโปรเจกต์ NodeHotkey

---

## 1. ตำแหน่งไฟล์ใน Unreal Engine Source Code

| รายการ | พาธไฟล์ใน Unreal Engine Source Code | หน้าที่และความรับผิดชอบ |
|---|---|---|
| **Connection Policy Header** | `Engine/Source/Editor/GraphEditor/Public/ConnectionDrawingPolicy.h` | ประกาศโครงสร้างคลาส `FConnectionDrawingPolicy` และฟังก์ชันคำนวณ Tangent |
| **Connection Policy Implementation** | `Engine/Source/Editor/GraphEditor/Private/ConnectionDrawingPolicy.cpp` | ตัวขับเคลื่อนหลักในการเลือกทิศทาง, คำนวณ Tangent Clearance, และเรนเดอร์เส้น |
| **Graph Editor Settings** | `Engine/Source/Editor/GraphEditor/Classes/GraphEditorSettings.h` | ประกาศคลาส `UGraphEditorSettings` กำหนดค่าความโค้งมนของเส้นใน Preferences |
| **Slate Spline Renderer** | `Engine/Source/Runtime/SlateCore/Public/Rendering/DrawElementTypes.h` | ฟังก์ชันเรนเดอร์ระดับต่ำ `FSlateDrawElement::MakeSpline` (Cubic Hermite/Bézier Spline) |
| **Blueprint Specific Policy** | `Engine/Source/Editor/Kismet/Private/BlueprintConnectionDrawingPolicy.cpp` | คลาสลูกเฉพาะสำหรับ Blueprint/Kismet (`FKismetConnectionDrawingPolicy`) |
| **Reroute Node Definition** | `Engine/Source/Editor/BlueprintGraph/Classes/K2Node_Knot.h` | นิยามของก้อน Reroute Knot (`K2Node_Knot`) |

---

## 2. ฟังก์ชันและ APIs หลัก (Key Functions)

### 2.1 `FConnectionDrawingPolicy`
- **`ComputeSplineTangent(const FVector2D& Start, const FVector2D& End)`**:
  คำนวณเวกเตอร์ Tangent เพื่อกำหนดแรงดึงและความโค้งมนของ Handle หัว-ท้าย
- **`DrawConnection(int32 LayerId, const FVector2D& Start, const FVector2D& End, const FConnectionParams& Params)`**:
  ฟังก์ชันหลักที่คำนวณสไตล์ของเส้น (Forward/Backward), จัดการ Clearance และส่งต่อให้ Slate ทำการวาด
- **`DrawSplineWithArrow(...)`**:
  วาดเส้นพร้อมหัวลูกศรบอกทิศทางของ Execution Flow

### 2.2 `FSlateDrawElement::MakeSpline`
```cpp
static void MakeSpline(
    FSlateWindowElementList& ElementList,
    uint32 InLayer,
    const FPaintGeometry& PaintGeometry,
    const FVector2D InStart,
    const FVector2D InStartDir,     // Tangent ขาออก (+X)
    const FVector2D InEnd,
    const FVector2D InEndDir,       // Tangent ขาเข้า (-X)
    float InThickness,
    ESlateDrawEffect InDrawEffects,
    const FLinearColor& InTint
);
```

---

## 3. ตัวแปรปรับแต่งมาตรฐาน (`UGraphEditorSettings`)
เข้าถึงได้ใน Unreal Engine ผ่าน: **Edit > Editor Preferences > Content Editors > Graph Editors > Splines**

1. `ForwardSplineTangentFromHorizontalDelta`
   - ค่าสัมประสิทธิ์ที่ระยะแนวนอน ($\Delta x$) ส่งผลต่อแรงดึง Tangent เมื่อลากไปข้างหน้า
2. `ForwardSplineTangentFromVerticalDelta`
   - **จุดสำคัญที่สุดของ Unreal:** นำระยะแนวตั้ง ($|\Delta y|$) มาร่วมคำนวณด้วย เพื่อป้องกันไม่ให้เส้นหักงอหรือเป็นมุมแหลมเมื่อกล่อง Node อยู่เยื้องบน-ล่าง
3. `ForwardSplineHorizontalDeltaRange` / `ForwardSplineVerticalDeltaRange`
   - ขอบเขตจำกัด (Clamp) ระยะห่างสูงสุดในการคำนวณ Tangent ขาไป
4. `BackwardSplineTangentFromHorizontalDelta` / `BackwardSplineTangentFromVerticalDelta`
   - ค่าสัมประสิทธิ์เมื่อเป้าหมายอยู่ด้านหลัง ต้องวนลูปรูปตัว C/S อ้อมกลับมารับ
5. `BackwardSplineHorizontalDeltaRange` / `BackwardSplineVerticalDeltaRange`
   - ขอบเขตจำกัดขนาดของลูปถอยหลัง ไม่ให้เส้นยื่นป่องออกไปไกลเกินจริง

---

## 4. หลักการคณิตศาสตร์ที่นำมาประยุกต์ใช้กับ NodeHotkey (`public/js/canvas.js`)

1. **Directional Normal ของ Pin:**
   - **Output Pin** ชี้ออกขวา $(+X)$ เสมอ $\rightarrow C_1 = (x_1 + T_1, y_1)$
   - **Input Pin** ชี้เข้ารับจากซ้าย $(-X)$ เสมอ $\rightarrow C_2 = (x_2 - T_2, y_2)$
   - *ข้อห้าม:* ห้ามสลับเครื่องหมายจนดึง Handle ถอยหลังเข้าไปในตัว Pin เอง

2. **สูตรเดินหน้า (Forward Flow: $\Delta x \ge 0$):**
   $$\text{BaseTension} = \Delta x \times 0.45 + |\Delta y| \times 0.22$$
   - ปรับ Tangent ของ Node ปกติ: $\text{clamp}(\text{BaseTension}, 30, 140)$

3. **หลักการของ Reroute Node (Knot):**
   - ตัว Knot เป็นเพียงจุดหมุด ไม่มีกล่องการ์ด Node มาขวางทาง
   - Tangent ของ Knot จะลดสเกลลงเหลือเพียง **$45\%$** ของ Node ปกติ เพื่อให้เส้นไหลเข้าหรือพุ่งออกจากจุดหมุดได้อย่างกระชับสวยงาม:
     $$T_{\text{knot}} = \text{clamp}(\text{BaseTension} \times 0.45, 15, 60)$$

4. **สูตรวนอ้อมหลัง (Backward Loop: $\Delta x < 0$):**
   - เมื่อเป้าหมายอยู่เยื้องหลังหรือด้านซ้ายของตัวส่ง จะใช้ลูปที่ Clamp รัศมีไว้อย่างรัดกุม:
     $$\text{LoopTension} = \text{clamp}(35 + |\Delta y| \times 0.12 + |\Delta x| \times 0.10, \; 35, \; 95)$$
