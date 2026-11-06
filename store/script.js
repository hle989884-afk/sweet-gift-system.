// Sweet Gift Store — Supabase-connected storefront
// Use the SAME Supabase project URL and publishable/anon key as the Admin.
// Never put the service_role key in browser code.
const SUPABASE_URL = "https://qiewzbyyukpxaiqpzabc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_raQDSCf827hnGl7o6H04Xg_724CDHRh";
const supabaseClient = (!SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_"))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
let products = [];
let cart = JSON.parse(localStorage.getItem("sweetGiftCart") || "[]")
  .filter(x => x && typeof x.id === "string" && Number.isInteger(Number(x.qty)) && Number(x.qty) > 0);
let toastTimer;
let selectedCategory = "all";

function showToast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}
function saveCart() {
  localStorage.setItem("sweetGiftCart", JSON.stringify(cart));
  renderCart();
  updateCount();
}
function updateCount() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  $("#cartCount").textContent = count;
  $("#drawerCount").textContent = `(${count})`;
}
function categoryLabel(category) {
  return ({box:"HỘP QUÀ",plush:"THÚ BÔNG",flower:"HOA & PHỤ KIỆN",custom:"CÁ NHÂN HÓA"})[category] || "SWEET GIFT";
}
function productImage(p) {
  return p.image_url || "https://placehold.co/700x700/fff0f5/9b647b?text=Sweet+Gift";
}
function renderProducts(category = selectedCategory) {
  selectedCategory = category;
  const list = products.filter(p => category === "all" || p.category === category);
  $("#productGrid").innerHTML = list.length ? list.map(p => `
    <article class="product-card">
      <div class="product-image">
        <img src="${esc(productImage(p))}" alt="${esc(p.name)}" loading="lazy">
        <span class="product-tag">${esc(categoryLabel(p.category))}</span>
        <button class="quick-add" data-add="${esc(p.id)}" ${p.stock_quantity <= 0 ? "disabled" : ""}>
          ${p.stock_quantity > 0 ? "＋ Thêm vào giỏ" : "Tạm hết hàng"}
        </button>
      </div>
      <div class="product-info">
        <h3>${esc(p.name)}</h3>
        <div class="product-meta">
          <span class="price">${money(p.price)}</span>
          <span class="rating">${p.stock_quantity > 0 ? "Còn hàng" : "Hết hàng"}</span>
        </div>
      </div>
    </article>`).join("") : `<p class="muted" style="grid-column:1/-1;text-align:center;padding:35px 0">Chưa có sản phẩm trong danh mục này.</p>`;
}
function getCartLines() {
  return cart.map(item => {
    const p = products.find(x => x.id === item.id);
    return p ? { ...item, product:p } : null;
  }).filter(Boolean);
}
function cartTotal() {
  return getCartLines().reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);
}
function renderCart() {
  const root = $("#cartItems");
  const lines = getCartLines();
  if (!lines.length) {
    root.innerHTML = '<div class="empty-cart">Giỏ hàng đang chờ những món quà xinh xắn ♡</div>';
  } else {
    root.innerHTML = lines.map(item => `
      <div class="cart-row">
        <img src="${esc(productImage(item.product))}" alt="${esc(item.product.name)}">
        <div>
          <h4>${esc(item.product.name)}</h4>
          <span class="price">${money(item.product.price)}</span>
          <div class="quantity">
            <button data-qty="${esc(item.id)}" data-change="-1" aria-label="Giảm">−</button>
            <span>${item.qty}</span>
            <button data-qty="${esc(item.id)}" data-change="1" aria-label="Tăng"
              ${item.qty >= item.product.stock_quantity ? "disabled" : ""}>＋</button>
          </div>
        </div>
        <button class="remove-item" data-remove="${esc(item.id)}">Xóa</button>
      </div>`).join("");
  }
  $("#subtotal").textContent = money(cartTotal());
  $("#checkoutTotal").textContent = money(cartTotal());
  $("#checkoutBtn").disabled = !lines.length;
  $("#checkoutBtn").style.opacity = lines.length ? 1 : .5;
}
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.stock_quantity < 1) return showToast("Sản phẩm hiện đã hết hàng.");
  const found = cart.find(x => x.id === id);
  if (found) {
    if (found.qty >= p.stock_quantity) return showToast("Số lượng trong kho không đủ.");
    found.qty++;
  } else cart.push({ id, qty:1 });
  saveCart();
  showToast("Đã thêm món quà vào giỏ ♡");
}
function openCart() {
  $("#cartDrawer").classList.add("open");
  $("#drawerBackdrop").classList.add("show");
  $("#cartDrawer").setAttribute("aria-hidden","false");
}
function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#drawerBackdrop").classList.remove("show");
  $("#cartDrawer").setAttribute("aria-hidden","true");
}
function openCheckout() {
  if (!getCartLines().length) return;
  closeCart();
  $("#checkoutBackdrop").classList.add("show");
  $("#checkoutContent").hidden = false;
  $("#successState").hidden = true;
}
function closeCheckout() { $("#checkoutBackdrop").classList.remove("show"); }

async function loadProducts() {
  if (!supabaseClient) {
    $("#productGrid").innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;padding:35px 0">Website chưa được cấu hình Supabase. Hãy điền Project URL và Publishable Key trong script.js.</p>';
    return;
  }
  const { data, error } = await supabaseClient.from("products")
    .select("id,name,description,category,price,stock_quantity,image_url,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending:false });
  if (error) {
    console.error(error);
    $("#productGrid").innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;padding:35px 0">Không tải được sản phẩm. Vui lòng thử lại sau.</p>';
    showToast("Không thể tải sản phẩm từ cửa hàng.");
    return;
  }
  products = data || [];
  // Remove stale cart lines from the old local demo product IDs or deleted products.
  const before = cart.length;
  cart = cart.filter(item => products.some(p => p.id === item.id));
  if (cart.length !== before) localStorage.setItem("sweetGiftCart", JSON.stringify(cart));
  renderProducts();
  renderCart();
  updateCount();
}

$("#productGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-add]");
  if (b) addToCart(b.dataset.add);
});
$("#filters").addEventListener("click", e => {
  const b = e.target.closest("[data-category]");
  if (!b) return;
  document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  renderProducts(b.dataset.category);
});
$("#cartItems").addEventListener("click", e => {
  const q = e.target.closest("[data-qty]");
  const r = e.target.closest("[data-remove]");
  if (q) {
    const item = cart.find(x => x.id === q.dataset.qty);
    const product = products.find(x => x.id === q.dataset.qty);
    if (!item || !product) return;
    item.qty += Number(q.dataset.change);
    if (item.qty <= 0) cart = cart.filter(x => x.id !== item.id);
    else if (item.qty > product.stock_quantity) item.qty = product.stock_quantity;
    saveCart();
  }
  if (r) {
    cart = cart.filter(x => x.id !== r.dataset.remove);
    saveCart();
  }
});
$("#openCart").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#drawerBackdrop").addEventListener("click", closeCart);
$("#checkoutBtn").addEventListener("click", openCheckout);
$("#closeCheckout").addEventListener("click", closeCheckout);
$("#checkoutBackdrop").addEventListener("click", e => {
  if (e.target === $("#checkoutBackdrop")) closeCheckout();
});

$("#checkoutForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!supabaseClient) return showToast("Website chưa được kết nối database.");
  const lines = getCartLines();
  if (!lines.length) return showToast("Giỏ hàng đang trống.");
  const submitButton = e.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Đang gửi đơn hàng...";
  const form = Object.fromEntries(new FormData(e.currentTarget).entries());
  const items = lines.map(item => ({ product_id:item.id, quantity:item.qty }));

  // The database RPC looks up trusted prices, checks stock and creates the order atomically.
  const { data, error } = await supabaseClient.rpc("place_order", {
    p_customer_name: form.name,
    p_customer_phone: form.phone,
    p_shipping_address: form.address,
    p_items: items,
    p_note: form.note || null,
    p_customer_email: null
  });
  submitButton.disabled = false;
  submitButton.textContent = "Xác nhận đặt hàng ♡";
  if (error) {
    console.error(error);
    showToast(error.message || "Không thể tạo đơn hàng. Vui lòng thử lại.");
    // Refresh stock after a rejected checkout so the customer sees current availability.
    await loadProducts();
    return;
  }

  $("#successMessage").textContent = `Mã đơn hàng ${data.order_code}. Sweet Gift đã ghi nhận đơn hàng của bạn.`;
  $("#checkoutContent").hidden = true;
  $("#successState").hidden = false;
  cart = [];
  saveCart();
  e.currentTarget.reset();
  await loadProducts(); // refresh stock after the successful database transaction
});
$("#doneBtn").addEventListener("click", () => {
  closeCheckout();
  showToast("Cảm ơn bạn đã chọn Sweet Gift ♡");
});
$("#newsletterForm").addEventListener("submit", e => {
  e.preventDefault();
  $("#newsletterMessage").textContent = "Cảm ơn bạn! Tính năng đăng ký sẽ được kết nối trong phiên bản tiếp theo.";
  e.currentTarget.reset();
});
$("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
$("#mainNav").addEventListener("click", e => {
  if (e.target.tagName === "A") $("#mainNav").classList.remove("open");
});

renderCart();
updateCount();
loadProducts();
