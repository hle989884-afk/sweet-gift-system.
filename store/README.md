# Sweet Gift — Website bán quà tặng

## Chạy thử
1. Giải nén `sweet-gift.zip`.
2. Mở thư mục `sweet-gift`.
3. Mở `index.html` bằng trình duyệt. Khuyến nghị dùng VS Code + extension Live Server.

## Tính năng
- Responsive cho điện thoại, tablet và desktop.
- Danh sách sản phẩm mẫu, lọc theo danh mục.
- Giỏ hàng tăng/giảm số lượng, xóa sản phẩm.
- Lưu giỏ hàng bằng localStorage.
- Form đặt hàng, tạo mã đơn và lưu đơn demo trong localStorage.
- Newsletter demo.

## Lưu ý quan trọng
Đây là bản frontend chạy độc lập. Đơn hàng chỉ được lưu trong trình duyệt của thiết bị hiện tại; chưa gửi về cửa hàng, chưa có cơ sở dữ liệu, tài khoản khách hàng, quản trị viên, vận chuyển hoặc cổng thanh toán thật. Không dùng để nhận đơn thật cho đến khi kết nối backend/API và cổng thanh toán an toàn.

## Deploy miễn phí bằng Netlify
1. Truy cập https://app.netlify.com/ và đăng nhập.
2. Chọn **Add new site** → **Deploy manually**.
3. Kéo thả thư mục `sweet-gift` (sau khi giải nén) vào vùng deploy.
4. Netlify cấp cho bạn một đường link website. Có thể đổi tên site trong Site settings.

## Deploy bằng GitHub Pages
1. Tạo repository GitHub mới và upload 3 file `index.html`, `style.css`, `script.js`.
2. Vào **Settings** → **Pages**.
3. Chọn **Deploy from a branch**, chọn `main` và thư mục `/ (root)`, rồi Save.
4. Chờ GitHub Pages xuất bản website.

## Tùy chỉnh nhanh
- Sản phẩm, giá, ảnh: chỉnh mảng `products` trong `script.js`.
- Màu sắc, font, bố cục: chỉnh biến CSS ở đầu `style.css`.
- Nội dung, logo, banner: chỉnh `index.html`.
