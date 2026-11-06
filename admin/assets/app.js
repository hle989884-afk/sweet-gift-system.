// Sweet Gift Admin — Supabase client configuration
// Replace these two values with your Supabase project values.
const SUPABASE_URL = "https://qiewzbyyukpxaiqpzabc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_raQDSCf827hnGl7o6H04Xg_724CDHRh";
const configured = !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(n||0));
const dateText = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";
const statusNames = {pending:"Chờ xác nhận",confirmed:"Đã xác nhận",processing:"Đang chuẩn bị",shipping:"Đang giao",completed:"Hoàn thành",cancelled:"Đã hủy"};
let products=[], orders=[], customers=[], revenueChart=null, statusChart=null, activePage="overview";

function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function fail(message){throw new Error(message)}
function showLogin(){ $("login-screen").classList.remove("hidden");$("app").classList.add("hidden"); }
function showApp(user){$("login-screen").classList.add("hidden");$("app").classList.remove("hidden");$("admin-email").textContent=user.email||"Admin";loadAll();}
function categoryName(value){return ({box:"Hộp quà",plush:"Thú bông",flower:"Hoa & phụ kiện",custom:"Cá nhân hóa"})[value]||value||"Khác"}
function statusBadge(status){return `<span class="badge ${status}">${statusNames[status]||status}</span>`}
function emptyRow(cols,msg="Chưa có dữ liệu"){return `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`}
function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function checkAdmin(user){
  const {data,error}=await db.from("profiles").select("role").eq("id",user.id).single();
  if(error) throw error;
  if(data?.role!=="admin") throw new Error("Tài khoản này chưa được cấp quyền quản trị.");
}
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();$("login-error").textContent="";
  if(!db){$("login-error").textContent="Bạn chưa cấu hình SUPABASE_URL và SUPABASE_ANON_KEY trong assets/app.js.";return}
  const {data,error}=await db.auth.signInWithPassword({email:$("login-email").value,password:$("login-password").value});
  if(error){$("login-error").textContent=error.message;return}
  try{await checkAdmin(data.user);showApp(data.user)}catch(err){await db.auth.signOut();$("login-error").textContent=err.message}
});
$("logout-btn").addEventListener("click",async()=>{await db.auth.signOut();showLogin()});

async function init(){
  if(!db){$("login-error").textContent="Cấu hình Supabase trước khi đăng nhập.";return}
  const {data:{session}}=await db.auth.getSession();
  if(session){try{await checkAdmin(session.user);showApp(session.user)}catch{await db.auth.signOut();showLogin()}}
  db.auth.onAuthStateChange(async(_event,session)=>{
    if(!session){showLogin();return}
    try{await checkAdmin(session.user);showApp(session.user)}catch{showLogin()}
  });
}
async function loadAll(){
  try{
    const [p,o,c]=await Promise.all([
      db.from("products").select("*").order("created_at",{ascending:false}),
      db.from("orders").select("*, customers(full_name,email,phone,address), order_items(id,product_name,quantity,unit_price,line_total)").order("created_at",{ascending:false}),
      db.from("customers").select("*").order("created_at",{ascending:false})
    ]);
    if(p.error)throw p.error;if(o.error)throw o.error;if(c.error)throw c.error;
    products=p.data||[];orders=o.data||[];customers=c.data||[];
    renderOverview();renderOrders();renderProducts();renderCustomers();renderInventory();
  }catch(err){toast("Không tải được dữ liệu: "+err.message);console.error(err)}
}
function renderOverview(){
  const completed=orders.filter(o=>o.status==="completed");
  const revenue=completed.reduce((s,o)=>s+Number(o.total_amount||0),0);
  const pending=orders.filter(o=>["pending","confirmed","processing"].includes(o.status)).length;
  $("stat-revenue").textContent=money(revenue);$("stat-orders").textContent=orders.length;
  $("stat-pending").textContent=pending;$("stat-products").textContent=products.filter(p=>p.is_active).length;
  $("pending-count").textContent=pending;
  $("recent-orders").innerHTML=orders.slice(0,6).map(o=>`<tr><td><b>${escapeHtml(o.order_code)}</b></td><td>${escapeHtml(o.customers?.full_name||o.customer_name||"Khách hàng")}</td><td>${dateText(o.created_at)}</td><td><b>${money(o.total_amount)}</b></td><td>${statusBadge(o.status)}</td></tr>`).join("")||emptyRow(5);
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d});
  const values=days.map(d=>completed.filter(o=>new Date(o.created_at).toDateString()===d.toDateString()).reduce((s,o)=>s+Number(o.total_amount||0),0));
  if(revenueChart)revenueChart.destroy();
  revenueChart=new Chart($("revenue-chart"),{type:"line",data:{labels:days.map(d=>d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})),datasets:[{data:values,borderColor:"#cf8299",backgroundColor:"#f6e6ec",fill:true,tension:.38,pointRadius:3,pointBackgroundColor:"#cf8299"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>new Intl.NumberFormat("vi-VN",{notation:"compact"}).format(v)},grid:{color:"#f0f0f3"}}}}});
  const orderStatuses=Object.keys(statusNames),counts=orderStatuses.map(s=>orders.filter(o=>o.status===s).length);
  if(statusChart)statusChart.destroy();
  statusChart=new Chart($("status-chart"),{type:"doughnut",data:{labels:orderStatuses.map(s=>statusNames[s]),datasets:[{data:counts,backgroundColor:["#e8b6c4","#8e8acb","#b9b4e3","#8eb6d6","#83b99d","#d9a0a8"],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:"70%",plugins:{legend:{display:false}}}});
  $("status-legend").innerHTML=orderStatuses.map((s,i)=>`<span style="--c:${["#e8b6c4","#8e8acb","#b9b4e3","#8eb6d6","#83b99d","#d9a0a8"][i]}">${statusNames[s]}: ${counts[i]}</span>`).join("");
}
function renderOrders(){
  const q=($("order-search")?.value||"").toLowerCase(),f=$("order-filter")?.value||"all";
  const list=orders.filter(o=>(f==="all"||o.status===f)&&(`${o.order_code} ${o.customers?.full_name||o.customer_name||""} ${o.customers?.phone||o.customer_phone||""}`).toLowerCase().includes(q));
  $("orders-table").innerHTML=list.map(o=>`<tr><td><b>${escapeHtml(o.order_code)}</b></td><td>${escapeHtml(o.customers?.full_name||o.customer_name||"—")}</td><td>${escapeHtml(o.customers?.phone||o.customer_phone||"—")}</td><td>${dateText(o.created_at)}</td><td><b>${money(o.total_amount)}</b></td><td>${statusBadge(o.status)}</td><td><button class="mini-btn" data-order="${o.id}">Chi tiết</button></td></tr>`).join("")||emptyRow(7);
  $("orders-table").querySelectorAll("[data-order]").forEach(b=>b.addEventListener("click",()=>openOrder(b.dataset.order)));
}
function renderProducts(){
  const q=($("product-search")?.value||"").toLowerCase(),f=$("product-filter")?.value||"all";
  const list=products.filter(p=>(f==="all"||(f==="active"&&p.is_active)||(f==="inactive"&&!p.is_active))&&p.name.toLowerCase().includes(q));
  $("products-table").innerHTML=list.map(p=>`<tr><td><div class="product-cell"><img class="product-thumb" src="${escapeHtml(p.image_url||"https://placehold.co/80x80/f5edf0/9b7180?text=SG")}" onerror="this.src='https://placehold.co/80x80/f5edf0/9b7180?text=SG'"><div><span class="product-name">${escapeHtml(p.name)}</span><span class="sub-cell">${escapeHtml(p.sku||"Chưa có SKU")}</span></div></div></td><td>${escapeHtml(categoryName(p.category))}</td><td><b>${money(p.price)}</b></td><td>${p.stock_quantity}</td><td>${p.is_active?'<span class="badge active">Đang bán</span>':'<span class="badge inactive">Đã ẩn</span>'}</td><td><div class="row-actions"><button class="mini-btn" data-edit="${p.id}">Sửa</button><button class="mini-btn" data-delete="${p.id}">Xóa</button></div></td></tr>`).join("")||emptyRow(6);
  $("products-table").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(b.dataset.edit)));
  $("products-table").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProduct(b.dataset.delete)));
}
function renderCustomers(){
  const q=($("customer-search")?.value||"").toLowerCase();
  $("customers-table").innerHTML=customers.filter(c=>`${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(q)).map(c=>{
    const os=orders.filter(o=>o.customer_id===c.id),spent=os.filter(o=>o.status==="completed").reduce((s,o)=>s+Number(o.total_amount||0),0);
    return `<tr><td><b>${escapeHtml(c.full_name)}</b></td><td>${escapeHtml(c.email||"—")}</td><td>${escapeHtml(c.phone||"—")}</td><td>${escapeHtml(c.address||"—")}</td><td>${os.length}</td><td><b>${money(spent)}</b></td></tr>`
  }).join("")||emptyRow(6);
}
function renderInventory(){
  $("inventory-total").textContent=products.length;
  $("inventory-low").textContent=products.filter(p=>p.is_active&&p.stock_quantity<=5).length;
  $("inventory-table").innerHTML=products.map(p=>`<tr><td><b>${escapeHtml(p.name)}</b></td><td>${escapeHtml(p.sku||"—")}</td><td>${p.stock_quantity<=5?'<span class="badge pending">Sắp hết</span>':"Đủ hàng"} · ${p.stock_quantity}</td><td><div class="row-actions"><input aria-label="Số lượng mới" type="number" min="0" value="${p.stock_quantity}" id="stock-${p.id}" style="width:80px;padding:6px;border:1px solid #eee;border-radius:7px"><button class="mini-btn" data-stock="${p.id}">Cập nhật</button></div></td></tr>`).join("")||emptyRow(4);
  $("inventory-table").querySelectorAll("[data-stock]").forEach(b=>b.addEventListener("click",()=>updateStock(b.dataset.stock)));
}
function openOrder(id){
  const o=orders.find(x=>x.id===id);if(!o)return;
  $("order-detail-content").innerHTML=`<div class="order-info-grid"><div class="info-box"><b>Thông tin khách hàng</b>${escapeHtml(o.customers?.full_name||o.customer_name||"—")}<br>${escapeHtml(o.customers?.phone||o.customer_phone||"—")}<br>${escapeHtml(o.customers?.email||"")}</div><div class="info-box"><b>Giao hàng</b>${escapeHtml(o.shipping_address||o.customers?.address||"—")}<br>Ngày đặt: ${dateText(o.created_at)}<br>${statusBadge(o.status)}</div></div><div class="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>SL</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th></tr></thead><tbody>${(o.order_items||[]).map(i=>`<tr><td>${escapeHtml(i.product_name)}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`).join("")||emptyRow(4,"Chưa có chi tiết sản phẩm")}</tbody></table></div><div class="order-info-grid"><div class="info-box"><b>Ghi chú</b>${escapeHtml(o.note||"Không có")}</div><div class="info-box"><b>Tổng thanh toán</b><strong>${money(o.total_amount)}</strong></div></div><label>Cập nhật trạng thái<select id="detail-status">${Object.entries(statusNames).map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")}</select></label><div class="modal-actions"><button class="btn primary" id="save-order-status">Lưu trạng thái</button></div>`;
  $("order-dialog").showModal();
  $("save-order-status").addEventListener("click",async()=>{await updateOrderStatus(id,$("detail-status").value);$("order-dialog").close()});
}
async function updateOrderStatus(id,status){
  const {error}=await db.from("orders").update({status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){toast(error.message);return}toast("Đã cập nhật trạng thái đơn hàng");await loadAll();
}
function resetProductForm(p){
  $("product-form").reset();$("product-id").value=p?.id||"";$("product-dialog-title").textContent=p?"Chỉnh sửa sản phẩm":"Thêm sản phẩm";
  $("p-name").value=p?.name||"";$("p-price").value=p?.price??"";$("p-stock").value=p?.stock_quantity??0;
  $("p-category").value=p?.category||"box";$("p-sku").value=p?.sku||"";$("p-image").value=p?.image_url||"";
  $("p-description").value=p?.description||"";$("p-active").checked=p?.is_active??true;$("product-error").textContent="";
  $("product-dialog").showModal();
}
function editProduct(id){const p=products.find(x=>x.id===id);if(p)resetProductForm(p)}
async function deleteProduct(id){
  if(!confirm("Xóa sản phẩm này? Nếu sản phẩm đã nằm trong đơn hàng, hãy ẩn sản phẩm thay vì xóa."))return;
  const {error}=await db.from("products").delete().eq("id",id);
  if(error){toast("Không thể xóa: "+error.message);return}toast("Đã xóa sản phẩm");await loadAll();
}
async function saveProduct(e){
  e.preventDefault();const id=$("product-id").value;
  const payload={name:$("p-name").value.trim(),price:Number($("p-price").value),stock_quantity:Number($("p-stock").value),category:$("p-category").value.trim()||"Khác",sku:$("p-sku").value.trim()||null,image_url:$("p-image").value.trim()||null,description:$("p-description").value.trim()||null,is_active:$("p-active").checked,updated_at:new Date().toISOString()};
  const q=id?db.from("products").update(payload).eq("id",id):db.from("products").insert(payload);
  const {error}=await q;if(error){$("product-error").textContent=error.message;return}
  $("product-dialog").close();toast(id?"Đã cập nhật sản phẩm":"Đã thêm sản phẩm");await loadAll();
}
async function updateStock(id){
  const qty=Number($("stock-"+id).value);if(!Number.isInteger(qty)||qty<0){toast("Số lượng không hợp lệ");return}
  const {error}=await db.from("products").update({stock_quantity:qty,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){toast(error.message);return}toast("Đã cập nhật tồn kho");await loadAll();
}
function navigate(page){
  activePage=page;document.querySelectorAll(".page").forEach(el=>el.classList.add("hidden"));
  $("page-"+page).classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
  $("page-heading").textContent=({overview:"Tổng quan",orders:"Đơn hàng",products:"Sản phẩm",customers:"Khách hàng",inventory:"Kho hàng"})[page];
  $("sidebar").classList.remove("open");
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));
$("menu-toggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("add-product").addEventListener("click",()=>resetProductForm());
$("product-form").addEventListener("submit",saveProduct);
$("close-product").addEventListener("click",()=>$("product-dialog").close());
$("cancel-product").addEventListener("click",()=>$("product-dialog").close());
$("close-order").addEventListener("click",()=>$("order-dialog").close());
$("order-search").addEventListener("input",renderOrders);$("order-filter").addEventListener("change",renderOrders);
$("product-search").addEventListener("input",renderProducts);$("product-filter").addEventListener("change",renderProducts);
$("customer-search").addEventListener("input",renderCustomers);
["refresh-overview","refresh-orders","refresh-inventory"].forEach(id=>$(id).addEventListener("click",loadAll));
init();
