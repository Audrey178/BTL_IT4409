---
description: # Agent Workflow — Senior Frontend Engineer
---

# Agent Workflow — Frontend Engineer
> React · TypeScript · Vite · TailwindCSS · shadcn/ui · Zustand · Socket.IO · WebRTC · TensorFlow.js

---

## Luồng tổng quan

```
BRAINSTORM ──► PLAN ──► plan.md ──► CODE ──► TEST ──► REVIEW ──► update plan.md
   👤 human      👤 human
```

> ⛔ Không CODE khi chưa có plan.md được human approve.  
> 📝 Cập nhật plan.md sau mỗi task hoàn thành.

---

## Skill sử dụng

Trước khi bắt đầu bất kỳ phase nào, agent **đọc skill phù hợp**:

| Khi nào | Skill cần đọc |
|---------|---------------|
| Bắt đầu task mới, cần nắm architecture | `/.agents/skills/meeting-clone-frontend-skill/SKILL.md` |
| Implement WebRTC / Socket signaling | `references/webrtc-signaling.md` trong skill trên |
| Implement face recognition | `references/face-recognition.md` trong skill trên |
| Tạo UI component | `references/ui-components.md` + `/.agents/skills/frontend-ui-engineering/SKILL.md` |
| Làm việc với API, types | `references/api-contracts.md` trong skill trên |

---

## Phase 1 — BRAINSTORM 👤

Agent hỏi human **5 câu**, chờ trả lời từng câu:

```
1. Tính năng là gì? Ai dùng, dùng khi nào?
2. Mới hay sửa code cũ? (nếu sửa: file nào?)
3. Có mockup / mô tả UI không?
4. API đã có chưa? (endpoint, request/response shape)
5. Edge case đặc biệt nào cần xử lý?
```

Sau khi có đủ thông tin, agent tổng hợp nhanh:

```
Components mới:    [danh sách]
Components sửa:    [danh sách]
Hooks / store:     [danh sách]
Socket events:     [danh sách]
Rủi ro:           [danh sách]
```

**→ Chờ human: "OK brainstorm" để tiếp tục.**

---

## Phase 2 — PLAN 👤

Agent đọc `SKILL.md` rồi phân rã thành tasks theo đúng thứ tự:

```
types → api → stores → hooks → components (nhỏ→lớn) → router → integration
```

Mỗi task gồm: tên, file(s), mô tả ngắn, acceptance criteria.

**→ Chờ human: "OK plan, viết plan.md" để tiếp tục.**

---

## Phase 3 — WRITE PLAN.MD

Agent tạo `plan.md` tại root repo:

```markdown
# Plan — [Tên feature]
> Cập nhật: [timestamp] | Trạng thái: 🔄 In progress

## Checklist
| ID  | Task | Status | File(s) |
|-----|------|--------|---------|
| T01 | ... | ⬜ | src/... |
| T02 | ... | ⬜ | src/... |

## Progress Log
| Thời gian | Event |
|-----------|-------|
| [timestamp] | 🟢 Plan approved |

## Blocked
_(trống nếu không có)_
```

**Status legend:** `⬜ Todo` · `🔄 In progress` · `✅ Done` · `🔴 Blocked`

---

## Phase 4 — CODE

Với mỗi task, agent làm theo vòng lặp:

```
1. Đọc skill liên quan (xem bảng ở đầu)
2. plan.md: T_n → 🔄
3. Implement
4. Chạy self-review checklist (bên dưới)
5. plan.md: T_n → ✅
6. Báo cáo ngắn cho human
```

**Self-review nhanh trước khi báo done:**
```
[ ] Không còn any, TODO, console.log
[ ] useEffect có cleanup (socket off, stream stop, clearInterval)
[ ] Zustand selector narrow (không subscribe cả store)
[ ] Loading / error / empty state đã có
[ ] cn() cho className điều kiện, không inline style
```

**Báo cáo sau mỗi task:**
```
✅ T_n — [Tên task]
+ src/path/NewFile.tsx  (tạo mới)
~ src/path/Edited.tsx   (sửa: [thay đổi gì])
Tiếp theo: T_(n+1) — [tên]
```

---

## Phase 5 — TEST

Agent sinh test script, human chạy thử:

```
Happy path:   [bước 1] → [kết quả mong đợi]
Edge cases:   API lỗi → toast error, không crash
Responsive:   375px / 768px / 1280px không vỡ layout
WebRTC:       2 tabs join cùng phòng → thấy nhau
Socket:       ngắt mạng rồi reconnect → không crash
```

Nếu có bug → agent fix và ghi vào Progress Log trong plan.md.

---

## Phase 6 — REVIEW

Agent tự review rồi báo cáo human:

```
Files thay đổi: [N] | +[X] dòng / -[Y] dòng

✅ Không có issue blocking
⚠️ Cần xem: [file:line — lý do]  (nếu có)
💡 Đề xuất (không bắt buộc): [...]

→ "OK merge" để kết thúc
```

---

## Phase 7 — UPDATE PLAN.MD

Agent cập nhật lần cuối:

```markdown
## Post-implementation Notes
Estimate: ~Xh | Thực tế: ~Yh
Quyết định kỹ thuật: [...]
TODO sprint sau: [...]
```

Đổi header: `Trạng thái: ✅ Done`

---

## Quy tắc hỏi human

Hỏi khi: requirements mơ hồ · có 2+ cách implement · thêm dependency mới · ảnh hưởng nhiều file quan trọng.

```
[DECISION NEEDED]
Context: [1 dòng]
Option A: [...] — Ưu/Nhược
Option B: [...] — Ưu/Nhược
Khuyến nghị: Option X vì [lý do]
```