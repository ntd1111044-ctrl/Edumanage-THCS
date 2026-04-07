# GIAO DIỆN — Hướng dẫn Agent tạo UI đẹp với Google Stitch MCP

> **Mục đích:** File này là tài liệu tham khảo cho AI Agent trong Antigravity. Khi được yêu cầu tạo hoặc cải thiện giao diện, Agent PHẢI đọc file này và tuân theo quy trình bên dưới.

---

## 1. NGUYÊN TẮC THIẾT KẾ

### 1.1 Phong cách tổng quát
- **Clean & Modern**: Ưu tiên khoảng trắng, bố cục rõ ràng, không rối mắt
- **Mobile-first**: Mọi giao diện phải responsive, ưu tiên hiển thị tốt trên điện thoại vì học sinh/giáo viên Việt Nam chủ yếu dùng điện thoại
- **Thân thiện giáo dục**: Màu sắc tươi sáng nhưng không chói, font dễ đọc, icon trực quan
- **Hỗ trợ tiếng Việt**: Font phải hiển thị tốt dấu tiếng Việt (Inter, Be Vietnam Pro, Nunito)

### 1.2 Bảng màu gợi ý theo loại app

| Loại app | Primary | Secondary | Accent | Ghi chú |
|----------|---------|-----------|--------|---------|
| Quiz / Game (Rung Chuông Vàng) | `#6366F1` (Indigo) | `#F59E0B` (Amber) | `#EF4444` (Red) | Năng động, kích thích thi đấu |
| Tạo đề thi / Bài tập | `#2563EB` (Blue) | `#10B981` (Emerald) | `#8B5CF6` (Violet) | Chuyên nghiệp, đáng tin cậy |
| Công cụ giáo viên (Giáo án, SKKN) | `#0D9488` (Teal) | `#F97316` (Orange) | `#EC4899` (Pink) | Ấm áp, hỗ trợ |
| Portal học sinh | `#7C3AED` (Purple) | `#06B6D4` (Cyan) | `#F59E0B` (Amber) | Trẻ trung, hiện đại |
| Quản lý (MediCare, Inventory) | `#1E40AF` (Dark Blue) | `#64748B` (Slate) | `#22C55E` (Green) | Nghiêm túc, rõ ràng |

### 1.3 Typography
- **Heading**: `Be Vietnam Pro` hoặc `Inter` — font-weight 700
- **Body**: `Inter` hoặc `Nunito` — font-weight 400–500
- **Code / Data**: `JetBrains Mono` hoặc `Fira Code`
- **Size tối thiểu**: 14px cho body text trên mobile

### 1.4 Spacing & Layout
- Padding container: `px-4 md:px-6 lg:px-8`
- Gap giữa các card/section: `gap-4 md:gap-6`
- Border radius: `rounded-xl` cho card, `rounded-lg` cho button
- Shadow: `shadow-sm` mặc định, `shadow-lg` cho modal/popup

---

## 2. QUY TRÌNH SỬ DỤNG STITCH MCP

### Bước 1: Tạo design trên Stitch
Dùng Stitch MCP để generate UI mockup trước khi code:

```
Prompt mẫu gửi cho Stitch:
"Design a [loại app] interface for Vietnamese [teachers/students]. 
The app is about [mô tả chức năng]. 
Style: modern, clean, mobile-friendly. 
Color scheme: [chọn từ bảng màu ở mục 1.2].
Include: [liệt kê các thành phần UI cần có]."
```

**Ví dụ cụ thể:**
```
"Design a quiz game interface for Vietnamese students. 
The app is a real-time classroom quiz game called 'Rung Chuông Vàng' where teachers host and students join via PIN code.
Style: modern, energetic, gamified, mobile-friendly.
Color scheme: Indigo primary (#6366F1), Amber secondary (#F59E0B), Red accent (#EF4444).
Include: lobby screen with PIN input, question display with countdown timer, 
leaderboard, elimination notification, teacher control panel."
```

### Bước 2: Lấy design về workspace
```
"Use Stitch MCP to fetch the design for [tên project]. 
Extract the color palette, typography, spacing tokens, and component styles. 
Generate a DESIGN.md and a tailwind theme config."
```

### Bước 3: Chuyển design thành code
```
"Convert the Stitch design into React components with Tailwind CSS.
Follow the design tokens exactly. 
Make all components modular and reusable.
Ensure Vietnamese text renders correctly with proper font."
```

### Bước 4: Kiểm tra & tinh chỉnh
```
"Compare the current UI with the original Stitch design.
Fix any visual discrepancies in spacing, color, or typography.
Test responsive layout on 375px (mobile) and 1024px (tablet)."
```

---

## 3. CÁC COMPONENT PATTERN THƯỜNG DÙNG

### 3.1 Header / Navbar
```
- Logo + Tên app bên trái
- Navigation links ở giữa (desktop) hoặc hamburger menu (mobile)
- User avatar / Login button bên phải
- Dùng sticky top, backdrop-blur khi scroll
- Height: h-14 (mobile), h-16 (desktop)
```

### 3.2 Hero Section (Landing page)
```
- Tiêu đề lớn (text-3xl md:text-5xl), font-bold
- Mô tả ngắn 1-2 dòng (text-lg, text-muted)
- CTA button nổi bật (bg-primary, text-white, px-6 py-3, rounded-xl)
- Illustration hoặc screenshot app bên phải (desktop)
- Gradient background nhẹ hoặc pattern
```

### 3.3 Card Component
```
- Border: border border-gray-200 dark:border-gray-700
- Radius: rounded-xl
- Padding: p-4 md:p-6
- Hover: hover:shadow-md transition-shadow
- Header card: font-semibold text-lg
- Footer card: flex justify-between items-center
```

### 3.4 Form / Input
```
- Label: text-sm font-medium text-gray-700
- Input: w-full px-4 py-2.5 rounded-lg border border-gray-300
         focus:ring-2 focus:ring-primary/50 focus:border-primary
- Error: text-red-500 text-sm mt-1
- Button submit: w-full bg-primary text-white py-2.5 rounded-lg font-medium
                  hover:bg-primary/90 transition-colors
```

### 3.5 Quiz / Game UI
```
- Câu hỏi: text-xl md:text-2xl font-semibold text-center
- Đáp án: grid grid-cols-1 md:grid-cols-2 gap-3
  + Mỗi đáp án là button lớn (py-4 px-6 rounded-xl)
  + Màu phân biệt: A=blue, B=green, C=amber, D=red
  + Hover: scale-[1.02] transition-transform
- Timer: vòng tròn countdown hoặc progress bar animate
- Điểm số: badge nổi bật góc trên
- Bảng xếp hạng: numbered list với avatar, tên, điểm
```

### 3.6 Dashboard / Bảng điều khiển
```
- Sidebar: w-64 (desktop), drawer (mobile)
- Stat cards: grid grid-cols-2 md:grid-cols-4 gap-4
  + Icon + Số lớn + Label nhỏ
  + Background gradient nhẹ
- Bảng dữ liệu: overflow-x-auto, striped rows
- Chart: dùng Recharts, đặt trong card có padding
```

### 3.7 Loading & Empty State
```
- Loading: skeleton animation (animate-pulse) thay vì spinner
- Empty state: illustration đơn giản + text hướng dẫn + CTA button
- Error state: icon cảnh báo + message rõ ràng + nút thử lại
```

---

## 4. DARK MODE

Luôn hỗ trợ dark mode bằng Tailwind `dark:` prefix:
- Background: `bg-white dark:bg-gray-900`
- Text: `text-gray-900 dark:text-gray-100`
- Card: `bg-white dark:bg-gray-800`
- Border: `border-gray-200 dark:border-gray-700`
- Dùng CSS variable hoặc Tailwind config để switch

---

## 5. ANIMATION & MICRO-INTERACTION

Sử dụng có chọn lọc, không lạm dụng:
- **Page transition**: fade-in nhẹ (opacity 0→1, duration 300ms)
- **Button**: hover:scale-[1.02], active:scale-[0.98], transition 150ms
- **Card appear**: slide-up nhẹ khi scroll vào viewport
- **Toast/Notification**: slide-in từ top-right, auto-dismiss 3s
- **Countdown timer**: animate mượt, đổi màu khi sắp hết giờ (xanh→vàng→đỏ)
- **Correct/Wrong answer**: flash màu xanh/đỏ + icon ✓/✗ với scale animation
- **Leaderboard update**: number counting animation, position slide

---

## 6. RESPONSIVE BREAKPOINTS

```
Mobile:    < 640px   → 1 cột, compact padding, hamburger menu
Tablet:    640-1024px → 2 cột, sidebar collapse
Desktop:   > 1024px   → full layout, sidebar visible, multi-column
```

Luôn test với các kích thước: **375px** (iPhone SE), **390px** (iPhone 14), **768px** (iPad), **1024px** (iPad landscape), **1440px** (Desktop).

---

## 7. CHECKLIST TRƯỚC KHI HOÀN THÀNH

Agent PHẢI kiểm tra tất cả các mục sau:

- [ ] Font tiếng Việt hiển thị đúng (có dấu, không bị cắt)
- [ ] Responsive trên mobile 375px
- [ ] Dark mode hoạt động (nếu app hỗ trợ)
- [ ] Các button có hover/active state
- [ ] Loading state cho mọi async operation
- [ ] Empty state cho danh sách trống
- [ ] Error state với message rõ ràng
- [ ] Contrast ratio đạt WCAG AA (4.5:1 cho text thường)
- [ ] Touch target tối thiểu 44x44px trên mobile
- [ ] Không có text bị overflow hoặc bị cắt
- [ ] MathJax/LaTeX render đúng (nếu app có công thức toán)
- [ ] Transition mượt, không giật

---

## 8. STITCH MCP — PROMPT TEMPLATES

Dưới đây là các prompt mẫu để Agent dùng với Stitch MCP cho từng loại app:

### App Quiz / Game
```
"Design a gamified quiz interface with:
- Join screen: large PIN input, fun illustrations
- Game screen: question card with 4 answer buttons (A/B/C/D in distinct colors)
- Animated countdown timer (circular)
- Live leaderboard sidebar
- Elimination splash screen
- Victory/podium screen for top 3
Style: energetic, playful, mobile-optimized
Colors: indigo + amber + red accents"
```

### App Tạo đề thi
```
"Design an exam generator dashboard with:
- Sidebar navigation (grade selector, exam type)
- Main area: exam preview with numbered questions
- Math formula display (LaTeX style)
- Export toolbar (Word, PDF buttons)
- Settings panel (difficulty, question count, time limit)
Style: professional, educational, clean
Colors: blue + emerald + white"
```

### App Công cụ giáo viên
```
"Design a teacher toolkit interface with:
- Dashboard with quick-action cards (create lesson, analyze, generate)
- File upload area (drag & drop .docx)
- AI processing progress indicator
- Side-by-side view: original doc vs AI suggestions
- Clean toolbar with save/export/share
Style: warm, supportive, professional
Colors: teal + orange + soft backgrounds"
```

### Landing Page / Portal
```
"Design a modern landing page for a Vietnamese education platform with:
- Hero section with headline, subtitle, CTA button
- Feature cards (3-4 features with icons)
- Testimonial section
- App screenshots carousel
- Footer with links and contact
Style: modern, trustworthy, inviting
Colors: [chọn phù hợp từ bảng màu mục 1.2]"
```

---

## 9. LƯU Ý QUAN TRỌNG

1. **Không dùng ảnh placeholder** kiểu `unsplash` hoặc `lorem picsum` cho production. Dùng icon (Lucide, Heroicons) hoặc illustration SVG thay thế.
2. **Tech stack ưu tiên**: React + TypeScript + Tailwind CSS + Vite. Đây là stack chính của project.
3. **Component library phụ**: shadcn/ui nếu cần component phức tạp (Dialog, Dropdown, Toast).
4. **Icon**: Lucide React là lựa chọn mặc định.
5. **Deploy target**: Vercel — đảm bảo build output tương thích.
6. **Không hardcode text**: Mọi label/text tiếng Việt nên đặt trong constant hoặc i18n-ready structure để dễ maintain.
7. **Performance**: Lazy load component nặng, optimize image, dùng `React.memo` cho list items.
