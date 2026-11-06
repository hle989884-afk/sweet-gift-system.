# Sweet Gift Admin — Professional

Bộ quản trị cửa hàng dùng HTML/CSS/JavaScript + Supabase PostgreSQL/Auth + Chart.js.

## 1. Cấu trúc

- `index.html`: giao diện đăng nhập và Admin.
- `assets/style.css`: giao diện responsive.
- `assets/app.js`: logic Supabase, dashboard, CRUD và quản lý đơn.
- `supabase/schema.sql`: cấu trúc database, RLS policies và RPC checkout an toàn.

## 2. Tạo Supabase

1. Tạo project tại https://supabase.com/dashboard.
2. Mở **SQL Editor → New query**.
3. Dán toàn bộ `supabase/schema.sql` rồi Run.
4. Vào **Project Settings → API** và sao chép:
   - Project URL
   - Publishable key (hoặc anon key legacy)
5. Mở `assets/app.js`, thay:
   - `YOUR_SUPABASE_URL`
   - `YOUR_SUPABASE_ANON_KEY`

> Chỉ dùng publishable/anon key ở frontend. Tuyệt đối không đưa `service_role` key vào website, GitHub hoặc JavaScript.

## 3. Tạo tài khoản Admin

1. Vào Supabase → Authentication → Users → Add user.
2. Tạo email và mật khẩu quản trị.
3. Sau khi tạo, mở SQL Editor và chạy câu lệnh dưới đây, thay email bằng email admin của bạn:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

4. Mở website Admin, đăng nhập bằng tài khoản vừa tạo.

Không có chức năng tự đăng ký Admin trên giao diện. Chỉ người có quyền truy cập Supabase mới có thể cấp role admin.

## 4. Chạy thử trên máy

Có thể dùng VS Code Live Server hoặc chạy một static server trong thư mục này. Không nên mở trực tiếp bằng `file://`.

Ví dụ Python:

```bash
python -m http.server 5500
```

Mở `http://localhost:5500`.

## 5. Deploy Admin lên Render

1. Tạo GitHub repository riêng, ví dụ `sweet-gift-admin`.
2. Upload toàn bộ nội dung thư mục này lên repository.
3. Render → New → Static Site → kết nối repository.
4. Build command: để trống.
5. Publish directory: `.`
6. Deploy. Sau đó có thể gắn custom domain riêng cho trang quản trị.

Admin và Store là hai frontend riêng, nhưng cùng dùng một Supabase project.

## 6. Kết nối website Sweet Gift Store hiện tại

### A. Dùng chung Supabase project
Trong code website Store, khởi tạo Supabase client bằng cùng Project URL và publishable/anon key như Admin.

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const supabaseClient = window.supabase.createClient(
    "YOUR_SUPABASE_URL",
    "YOUR_SUPABASE_ANON_KEY"
  );
</script>
```

### B. Đọc danh sách sản phẩm

```javascript
const { data: products, error } = await supabaseClient
  .from("products")
  .select("id,name,description,category,price,stock_quantity,image_url")
  .eq("is_active", true)
  .gt("stock_quantity", 0)
  .order("created_at", { ascending: false });

if (error) console.error(error);
```

### C. Gửi đơn hàng khi khách checkout

Không gửi giá do trình duyệt tự tính lên database. Gọi RPC `place_order`; PostgreSQL sẽ tự đọc giá, tính tổng tiền và kiểm tra/trừ kho.

```javascript
const { data, error } = await supabaseClient.rpc("place_order", {
  p_customer_name: "Nguyễn Văn A",
  p_customer_phone: "0900000000",
  p_shipping_address: "Quận 1, TP.HCM",
  p_customer_email: "customer@example.com",
  p_note: "Giao giờ hành chính",
  p_items: [
    { product_id: "UUID_SAN_PHAM_1", quantity: 2 },
    { product_id: "UUID_SAN_PHAM_2", quantity: 1 }
  ]
});

if (error) {
  alert(error.message);
} else {
  alert("Đặt hàng thành công! Mã đơn: " + data.order_code);
  // Xóa giỏ hàng sau khi RPC trả về thành công.
}
```

### D. Luồng hoạt động

1. Admin thêm/sửa sản phẩm → dữ liệu lưu trong `products`.
2. Store đọc sản phẩm đang hoạt động từ `products`.
3. Khách đặt hàng → Store gọi RPC `place_order`.
4. Database kiểm tra tồn kho, lấy giá chính thức, tạo `orders` và `order_items`.
5. Admin tải lại dữ liệu → đơn hàng mới xuất hiện trong trang Đơn hàng.
6. Admin đổi trạng thái → thay đổi được lưu trong database.

## 7. Trạng thái đơn hàng

- `pending`: Chờ xác nhận
- `confirmed`: Đã xác nhận
- `processing`: Đang chuẩn bị
- `shipping`: Đang giao
- `completed`: Hoàn thành
- `cancelled`: Đã hủy

## 8. Lưu ý quan trọng trước khi bán thật

- Bật xác thực email / chính sách mật khẩu phù hợp trong Supabase Auth.
- Chỉ cấp role `admin` cho tài khoản chủ shop đáng tin cậy.
- Không bao giờ đưa service-role key vào frontend.
- Nên bổ sung quy trình hoàn kho khi hủy đơn; hiện tại RPC trừ kho khi tạo đơn và việc đổi trạng thái hủy không tự cộng kho trở lại.
- Thêm CAPTCHA/rate limiting hoặc lớp backend/Edge Function nếu website nhận nhiều đơn công khai.
- Kiểm tra kỹ phí giao hàng, phương thức thanh toán và chính sách đổi/trả trước khi vận hành.
- Dashboard doanh thu hiện tính từ đơn `completed`, không phải lợi nhuận ròng.

## 9. Những điểm cần map theo website Store hiện tại

Nếu website Store hiện tại dùng tên cột hoặc cấu trúc giỏ hàng khác, cần chỉnh phần checkout để gửi đúng `product_id` (UUID) và `quantity`. Không nên tạo một database thứ hai cho Admin.
