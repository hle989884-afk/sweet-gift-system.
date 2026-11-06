# Sweet Gift — Integrated Store + Admin

Gói này kết nối website khách hàng Sweet Gift với trang quản trị bằng **một Supabase project dùng chung**.

## Thư mục

- `store/`: Website khách hàng (giữ giao diện pastel gốc).
- `admin/`: Dashboard quản trị professional.
- `supabase/schema.sql`: Database, RLS, checkout RPC và 8 sản phẩm mẫu.

## 1. Tạo database dùng chung

1. Tạo một project tại https://supabase.com/dashboard.
2. Vào **SQL Editor → New query**.
3. Dán và chạy toàn bộ `supabase/schema.sql`.
4. Script tạo các bảng `profiles`, `products`, `customers`, `orders`, `order_items`; bật RLS; tạo hàm checkout an toàn `place_order`; đồng thời thêm 8 sản phẩm demo.
5. Vào **Project Settings → API** và sao chép Project URL cùng Publishable key (hoặc anon key legacy).

Nếu bạn đã chạy schema phiên bản trước đó, chạy lại file này để thêm catalog demo. Các sản phẩm mẫu được upsert theo SKU.

## 2. Cấu hình cả hai website

Cùng một Project URL và Publishable/anon key phải được điền vào hai file:

- `store/script.js`
- `admin/assets/app.js`

Thay `YOUR_SUPABASE_URL` và `YOUR_SUPABASE_ANON_KEY`.

**Không bao giờ** đưa `service_role` key vào frontend, GitHub hoặc mã nguồn công khai.

## 3. Tạo tài khoản quản trị

1. Supabase → Authentication → Users → Add user.
2. Tạo email và mật khẩu cho chủ shop.
3. SQL Editor chạy câu lệnh (thay email):

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

4. Đăng nhập tại website Admin. Tài khoản chưa có role `admin` sẽ bị từ chối.

## 4. Chạy thử cục bộ

Dùng VS Code Live Server hoặc chạy static server từ thư mục gói:

```bash
python -m http.server 5500
```

- Store: `http://localhost:5500/store/`
- Admin: `http://localhost:5500/admin/`

## 5. Deploy lên Render

Tạo hai Static Site riêng, cùng trỏ đến repository:

### Sweet Gift Store
- Publish directory: `store`
- Build command: để trống

### Sweet Gift Admin
- Publish directory: `admin`
- Build command: để trống

Hai trang có thể dùng hai URL riêng nhưng vẫn kết nối cùng một Supabase project. Không cần tạo database thứ hai.

## 6. Luồng dữ liệu đã tích hợp

1. Admin thêm/sửa sản phẩm → bảng `products`.
2. Store đọc các sản phẩm `is_active = true` từ `products`.
3. Khách thêm sản phẩm vào giỏ → giỏ hàng tạm thời lưu ở trình duyệt.
4. Khi checkout, Store gọi RPC `place_order` với UUID sản phẩm và số lượng.
5. PostgreSQL tự đọc giá chuẩn, khóa/kiểm tra tồn kho, trừ kho và tạo `orders` + `order_items` trong một transaction.
6. Admin đọc dữ liệu từ các bảng trên và hiển thị đơn mới.

Đơn hàng không còn lưu trong `localStorage`. `localStorage` chỉ còn dùng cho giỏ hàng, để khách không mất giỏ khi tải lại trang.

## 7. Danh mục Store

Bộ lọc trên website dùng các mã danh mục:
- `box` — Hộp quà
- `plush` — Thú bông
- `flower` — Hoa & phụ kiện
- `custom` — Cá nhân hóa

Trang Admin đã dùng cùng danh sách này để tránh sản phẩm bị tạo sai danh mục và không xuất hiện trong bộ lọc.

## 8. Lưu ý vận hành

- RLS giới hạn thao tác quản trị vào profile có role `admin`.
- Khách ẩn danh chỉ đọc được sản phẩm đang hoạt động và gọi RPC checkout; không được insert trực tiếp vào bảng đơn hàng.
- RPC kiểm tra giá và tồn kho ở phía database, không tin giá từ trình duyệt.
- Khi khách tạo đơn, tồn kho được trừ ngay. Hiện tại thao tác chuyển đơn sang `cancelled` trong Admin **chưa tự hoàn kho**; cần bổ sung quy trình hoàn kho có kiểm soát trước khi vận hành quy mô lớn.
- Dashboard doanh thu là tổng đơn `completed`, chưa trừ chi phí/hoàn tiền.
- Đây là nền tảng MVP có bảo vệ cơ bản; trước khi vận hành thực tế nên bổ sung CAPTCHA/rate limiting, sao lưu, chính sách vận chuyển/hoàn tiền và kiểm thử quyền truy cập.

## 9. Kiểm thử sau khi triển khai

- Thêm sản phẩm mới trong Admin và kiểm tra Store có hiển thị không.
- Đặt thử một đơn với số lượng hợp lệ.
- Kiểm tra đơn xuất hiện trong Admin → Đơn hàng.
- Kiểm tra tồn kho giảm đúng.
- Thử đặt quá số lượng tồn để xác nhận database từ chối đơn.
- Đổi trạng thái đơn và tải lại Admin để xác nhận dữ liệu được lưu.
