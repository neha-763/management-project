/* ===== College Library – single page app (HTML + CSS + JS, data in localStorage) ===== */
const LOAN_DAYS = 14, MAX_LOANS = 3, FINE_PER_DAY = 2, MAX_FILE_KB = 1500;
const COLORS = ['#3b5bdb','#7048e8','#0ca678','#e8590c','#d6336c','#1098ad','#f08c00'];
const ICONS = {Computer:'💻',Science:'🔬',Mathematics:'➗',Literature:'📖',Engineering:'⚙️',Business:'💼',General:'📘'};
const CATEGORIES = Object.keys(ICONS);

/* ---------- storage ---------- */
const DB_KEY = 'college_lib_db_v1', SESSION_KEY = 'college_lib_session_v1';
let db = load();
let session = localStorage.getItem(SESSION_KEY);
let state = { page: 'home', q: '', cat: '', type: '', authTab: 'login', adminTab: 'approvals' };

function uid(p){ return p + Math.random().toString(36).slice(2, 9); }
function save(){
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch(e){ toast('Storage full – try a smaller file'); throw e; }
}
function load(){
  try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d) return d; } catch(e){}
  const sample = (title,author,category,type,copies,price,desc,text) =>
    ({id:uid('b'),title,author,category,type,copies,price,desc,text:text||'',status:'approved',submittedBy:'system'});
  const demoText = 'Chapter 1\n\nThis is a sample preview of the e-book. In a real deployment the full text or PDF would be served from the server.\n\nHappy reading!';
  const d = {
    users: [
      {id:'u_admin',name:'Librarian',email:'admin@college.edu',pass:'admin123',role:'admin',roll:'-'},
      {id:'u_demo',name:'Demo Student',email:'student@college.edu',pass:'student123',role:'student',roll:'CS2024-001'}
    ],
    books: [
      sample('Introduction to Algorithms','T. Cormen','Computer','physical',3,0,'Comprehensive guide to algorithms and data structures.'),
      sample('Clean Code','Robert C. Martin','Computer','physical',2,0,'A handbook of agile software craftsmanship.'),
      sample('Database System Concepts','Silberschatz','Computer','physical',4,0,'Fundamentals of relational databases and SQL.'),
      sample('Engineering Mathematics','B.S. Grewal','Mathematics','physical',5,0,'Standard textbook for engineering maths.'),
      sample('Concepts of Physics','H.C. Verma','Science','physical',2,0,'Physics fundamentals with problems.'),
      sample('Python Crash Course','Eric Matthes','Computer','ebook',999,199,'Hands-on, project-based introduction to Python.',demoText),
      sample('JavaScript: The Good Parts','Douglas Crockford','Computer','ebook',999,149,'Focus on the best features of JavaScript.',demoText),
      sample('Machine Learning Basics','A. Student Author','Computer','ebook',999,0,'Free introductory notes on machine learning.',demoText),
      sample('Startup Playbook','Steve Blank','Business','ebook',999,99,'Step-by-step guide for first-time entrepreneurs.',demoText),
      sample('Wings of Fire','A.P.J. Abdul Kalam','Literature','physical',3,0,'Autobiography of the Missile Man of India.')
    ],
    loans: [], purchases: [], carts: {}
  };
  localStorage.setItem(DB_KEY, JSON.stringify(d));
  return d;
}

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const user = () => db.users.find(u => u.id === session);
const isAdmin = () => user()?.role === 'admin';
const book = id => db.books.find(b => b.id === id);
const money = n => n ? '₹' + n : 'Free';
const today = () => new Date().toISOString().slice(0,10);
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
const daysBetween = (a,b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const approved = () => db.books.filter(b => b.status === 'approved');
const available = b => b.copies - db.loans.filter(l => l.bookId === b.id && !l.returned).length;
const owns = (uidv, bid) => db.purchases.some(p => p.userId === uidv && p.bookId === bid);
const cart = () => (db.carts[session] ||= []);
const fineOf = l => Math.max(0, daysBetween(l.due, l.returned || today())) * FINE_PER_DAY;
const cover = b => `<div class="cover" style="background:${COLORS[b.title.length % COLORS.length]}">${ICONS[b.category] || '📘'}</div>`;

function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600);
}
function openModal(html){ $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal(){ $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

function go(page){ state.page = page; render(); window.scrollTo(0,0); }

/* ---------- navigation ---------- */
function renderNav(){
  const u = user();
  const pend = db.books.filter(b => b.status === 'pending').length;
  const items = [['home','Home'],['catalog','Catalog']];
  if (u && !isAdmin()) items.push(['myloans','My Loans'],['mybooks','My E-Books'],['submit','Submit E-Book'],['cart','Cart' + (cart().length ? `<span class="badge">${cart().length}</span>` : '')]);
  if (isAdmin()) items.push(['admin','Admin' + (pend ? `<span class="badge">${pend}</span>` : '')]);
  $('#nav').innerHTML = items.map(([k,l]) => `<button class="${state.page===k?'active':''}" onclick="go('${k}')">${l}</button>`).join('') +
    (u ? `<button onclick="logout()">Logout (${esc(u.name.split(' ')[0])})</button>` : `<button class="active" onclick="go('auth')">Login / Register</button>`);
}

/* ---------- auth ---------- */
function logout(){ session = null; localStorage.removeItem(SESSION_KEY); toast('Logged out'); go('home'); }
function doLogin(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const u = db.users.find(x => x.email === f.get('email').trim().toLowerCase() && x.pass === f.get('pass'));
  if (!u) return toast('Wrong email or password');
  session = u.id; localStorage.setItem(SESSION_KEY, session);
  toast('Welcome, ' + u.name); go(u.role === 'admin' ? 'admin' : 'catalog');
}
function doRegister(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const email = f.get('email').trim().toLowerCase();
  if (db.users.some(x => x.email === email)) return toast('Email already registered');
  if (f.get('pass').length < 6) return toast('Password must be at least 6 characters');
  const u = {id:uid('u'), name:f.get('name').trim(), email, pass:f.get('pass'), role:'student', roll:f.get('roll').trim()};
  db.users.push(u); save();
  session = u.id; localStorage.setItem(SESSION_KEY, session);
  toast('Account created'); go('catalog');
}
function needLogin(){ toast('Please login first'); go('auth'); }

function pageAuth(){
  const login = state.authTab === 'login';
  return `<div class="panel auth">
    <div class="tabs">
      <button class="btn ${login?'':'sec'}" onclick="state.authTab='login';render()">Login</button>
      <button class="btn ${login?'sec':''}" onclick="state.authTab='register';render()">Register</button>
    </div>
    ${login ? `
    <form onsubmit="doLogin(event)">
      <label>College Email</label><input name="email" type="email" required>
      <label>Password</label><input name="pass" type="password" required>
      <button class="btn" style="width:100%;margin-top:16px">Login</button>
    </form>
    <p class="note"><b>Demo accounts</b><br>Student: student@college.edu / student123<br>Admin: admin@college.edu / admin123</p>` : `
    <form onsubmit="doRegister(event)">
      <label>Full Name</label><input name="name" required>
      <label>Roll Number</label><input name="roll" required>
      <label>College Email</label><input name="email" type="email" required>
      <label>Password (min 6)</label><input name="pass" type="password" required>
      <button class="btn" style="width:100%;margin-top:16px">Create Account</button>
    </form>`}
  </div>`;
}

/* ---------- home ---------- */
function pageHome(){
  const u = user();
  const my = u ? db.loans.filter(l => l.userId === u.id && !l.returned).length : 0;
  const overdue = u ? db.loans.filter(l => l.userId === u.id && !l.returned && daysBetween(l.due, today()) > 0).length : 0;
  return `<div class="hero">
      <h1>Welcome to the College Library</h1>
      <p>Borrow physical books, buy and read e-books online, and share your own e-books with fellow students.</p>
      <button class="btn sec" onclick="go('catalog')">Browse Catalog</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${approved().filter(b=>b.type==='physical').length}</b><span>Physical titles</span></div>
      <div class="stat"><b>${approved().filter(b=>b.type==='ebook').length}</b><span>E-books</span></div>
      <div class="stat"><b>${db.users.filter(x=>x.role==='student').length}</b><span>Students</span></div>
      ${u && !isAdmin() ? `<div class="stat"><b>${my}</b><span>Books you hold</span></div><div class="stat"><b style="color:${overdue?'var(--bad)':'var(--ok)'}">${overdue}</b><span>Overdue</span></div>` : ''}
    </div>
    <h2>Newly added</h2>
    <div class="grid">${approved().slice(-4).reverse().map(bookCard).join('')}</div>
    <h2>How it works</h2>
    <div class="panel">
      <p>📖 <b>Borrow</b> up to ${MAX_LOANS} physical books for ${LOAN_DAYS} days (renew once). Late fine: ₹${FINE_PER_DAY}/day.</p>
      <p style="margin-top:8px">🛒 <b>Buy</b> e-books and read them online anytime from "My E-Books".</p>
      <p style="margin-top:8px">⬆️ <b>Submit</b> your own e-book (notes, project reports). Librarian approves it, then it appears in the catalog.</p>
    </div>`;
}

/* ---------- catalog ---------- */
function bookCard(b){
  const u = user();
  const avail = b.type === 'physical' ? available(b) : null;
  let tags = `<span class="tag ${b.type==='ebook'?'ebook':'phys'}">${b.type==='ebook'?'E-book':'Physical'}</span><span class="tag">${esc(b.category)}</span>`;
  tags += b.type === 'physical'
    ? `<span class="tag ${avail>0?'ok':'bad'}">${avail>0?avail+' available':'Out of stock'}</span>`
    : `<span class="tag warn">${money(b.price)}</span>`;
  let action = '';
  if (b.type === 'physical') action = `<button class="btn sm" ${avail<1?'disabled':''} onclick="borrow('${b.id}')">Borrow</button>`;
  else if (u && owns(u.id,b.id)) action = `<button class="btn sm ok" onclick="readBook('${b.id}')">Read</button>`;
  else if (!b.price) action = `<button class="btn sm" onclick="getFree('${b.id}')">Get free</button>`;
  else action = `<button class="btn sm" onclick="addToCart('${b.id}')">Add to cart</button>`;
  return `<div class="book">${cover(b)}<div class="body">
    <h3>${esc(b.title)}</h3><div class="meta">${esc(b.author)}</div>
    <div class="tags">${tags}</div>
    <div class="actions">${action}<button class="btn sm sec" onclick="details('${b.id}')">Details</button></div>
  </div></div>`;
}
function pageCatalog(){
  const q = state.q.toLowerCase();
  const list = approved().filter(b =>
    (!state.cat || b.category === state.cat) && (!state.type || b.type === state.type) &&
    (b.title + ' ' + b.author).toLowerCase().includes(q));
  return `<h1>Catalog</h1><p class="sub">Search and filter all books.</p>
    <div class="toolbar">
      <input id="q" placeholder="Search title or author…" value="${esc(state.q)}" oninput="state.q=this.value;renderList()">
      <select onchange="state.cat=this.value;render()"><option value="">All categories</option>${CATEGORIES.map(c=>`<option ${state.cat===c?'selected':''}>${c}</option>`).join('')}</select>
      <select onchange="state.type=this.value;render()">
        <option value="">All types</option><option value="physical" ${state.type==='physical'?'selected':''}>Physical</option><option value="ebook" ${state.type==='ebook'?'selected':''}>E-books</option>
      </select>
    </div>
    <div id="list" class="grid">${list.map(bookCard).join('') || '<div class="empty">No books found.</div>'}</div>`;
}
function renderList(){ // re-render only the grid so the search box keeps focus
  const q = state.q.toLowerCase();
  const list = approved().filter(b => (!state.cat||b.category===state.cat) && (!state.type||b.type===state.type) && (b.title+' '+b.author).toLowerCase().includes(q));
  $('#list').innerHTML = list.map(bookCard).join('') || '<div class="empty">No books found.</div>';
}
function details(id){
  const b = book(id);
  openModal(`<h2 style="margin-top:0">${esc(b.title)}</h2>
    <p class="meta">by ${esc(b.author)} • ${esc(b.category)} • ${b.type==='ebook'?'E-book • '+money(b.price):'Physical • '+b.copies+' copies'}</p>
    <p style="margin:14px 0">${esc(b.desc) || 'No description.'}</p>
    <button class="btn sec" onclick="closeModal()">Close</button>`);
}

/* ---------- borrow / return / renew ---------- */
function borrow(id){
  const u = user(); if (!u) return needLogin();
  if (isAdmin()) return toast('Use a student account to borrow');
  const mine = db.loans.filter(l => l.userId === u.id && !l.returned);
  if (mine.length >= MAX_LOANS) return toast(`Limit reached (${MAX_LOANS} books)`);
  if (mine.some(l => l.bookId === id)) return toast('You already have this book');
  if (mine.some(l => daysBetween(l.due, today()) > 0)) return toast('Return overdue books first');
  if (available(book(id)) < 1) return toast('No copies available');
  db.loans.push({id:uid('l'), userId:u.id, bookId:id, issued:today(), due:addDays(today(),LOAN_DAYS), returned:null, renewed:false});
  save(); toast('Borrowed! Due ' + addDays(today(),LOAN_DAYS)); render();
}
function returnBook(lid){
  const l = db.loans.find(x => x.id === lid); l.returned = today(); l.fine = fineOf(l); save();
  toast(l.fine ? `Returned. Fine: ₹${l.fine}` : 'Returned. Thank you!'); render();
}
function renew(lid){
  const l = db.loans.find(x => x.id === lid);
  if (l.renewed) return toast('Already renewed once');
  if (daysBetween(l.due, today()) > 0) return toast('Overdue books cannot be renewed');
  l.due = addDays(l.due, LOAN_DAYS); l.renewed = true; save(); toast('Renewed'); render();
}
function pageMyLoans(){
  const u = user(); if (!u) return pageAuth();
  const mine = db.loans.filter(l => l.userId === u.id).reverse();
  const totalFine = mine.reduce((s,l) => s + (l.returned ? 0 : fineOf(l)), 0);
  return `<h1>My Loans</h1><p class="sub">Current and past borrowings. Pending fine: <b style="color:${totalFine?'var(--bad)':'var(--ok)'}">₹${totalFine}</b></p>
  <div class="panel tablewrap">${mine.length ? `<table><tr><th>Book</th><th>Issued</th><th>Due</th><th>Status</th><th></th></tr>` +
    mine.map(l => {
      const b = book(l.bookId), late = !l.returned && daysBetween(l.due,today()) > 0;
      return `<tr><td>${esc(b?.title)}</td><td>${l.issued}</td><td>${l.due}</td>
        <td>${l.returned ? `<span class="tag ok">Returned ${l.returned}</span>${l.fine?` <span class="tag bad">Fine ₹${l.fine}</span>`:''}` : late ? `<span class="tag bad">Overdue • ₹${fineOf(l)}</span>` : '<span class="tag warn">Borrowed</span>'}</td>
        <td>${l.returned ? '' : `<button class="btn sm" onclick="returnBook('${l.id}')">Return</button> <button class="btn sm sec" onclick="renew('${l.id}')">Renew</button>`}</td></tr>`;
    }).join('') + '</table>' : '<div class="empty">You have not borrowed any books yet.</div>'}</div>`;
}

/* ---------- cart / buy e-books ---------- */
function addToCart(id){
  const u = user(); if (!u) return needLogin();
  if (isAdmin()) return toast('Use a student account to buy');
  if (cart().includes(id)) return toast('Already in cart');
  cart().push(id); save(); toast('Added to cart'); renderNav();
}
function removeFromCart(id){ db.carts[session] = cart().filter(x => x !== id); save(); render(); }
function getFree(id){
  const u = user(); if (!u) return needLogin();
  if (isAdmin()) return toast('Use a student account');
  if (!owns(u.id,id)) db.purchases.push({id:uid('p'), userId:u.id, bookId:id, date:today(), price:0});
  save(); toast('Added to My E-Books'); render();
}
function pageCart(){
  const u = user(); if (!u) return pageAuth();
  const items = cart().map(book).filter(Boolean);
  const total = items.reduce((s,b) => s + b.price, 0);
  return `<h1>Your Cart</h1><p class="sub">Buy e-books and read them instantly.</p>
  <div class="panel">${items.length ? items.map(b => `<div class="row" style="align-items:center;padding:8px 0;border-bottom:1px solid var(--line)">
      <div><b>${esc(b.title)}</b><div class="meta">${esc(b.author)}</div></div><div>${money(b.price)}</div>
      <div style="text-align:right"><button class="btn sm bad" onclick="removeFromCart('${b.id}')">Remove</button></div></div>`).join('') +
    `<div class="cart-total">Total: ₹${total}</div><button class="btn" onclick="checkout()">Proceed to payment</button>` : '<div class="empty">Your cart is empty.</div>'}</div>`;
}
function checkout(){
  const items = cart().map(book).filter(Boolean);
  const total = items.reduce((s,b) => s + b.price, 0);
  openModal(`<h2 style="margin-top:0">Payment (demo)</h2><p class="sub">No real money is charged. Amount: <b>₹${total}</b></p>
    <form onsubmit="pay(event)">
      <label>Payment method</label><select name="m"><option>UPI</option><option>Debit / Credit Card</option><option>Net Banking</option></select>
      <label>UPI ID / Card number (any dummy value)</label><input required placeholder="student@upi">
      <div style="margin-top:16px;display:flex;gap:8px"><button class="btn ok">Pay ₹${total}</button><button type="button" class="btn sec" onclick="closeModal()">Cancel</button></div>
    </form>`);
}
function pay(e){
  e.preventDefault();
  cart().forEach(id => { if (!owns(session,id)) db.purchases.push({id:uid('p'), userId:session, bookId:id, date:today(), price:book(id).price}); });
  db.carts[session] = []; save(); closeModal(); toast('Payment successful!'); go('mybooks');
}
function pageMyBooks(){
  const u = user(); if (!u) return pageAuth();
  const mine = db.purchases.filter(p => p.userId === u.id).map(p => ({p, b:book(p.bookId)})).filter(x => x.b);
  const submitted = db.books.filter(b => b.submittedBy === u.id);
  return `<h1>My E-Books</h1><p class="sub">Books you purchased or added.</p>
  ${mine.length ? `<div class="grid">${mine.map(({p,b}) => `<div class="book">${cover(b)}<div class="body"><h3>${esc(b.title)}</h3><div class="meta">${esc(b.author)}</div>
      <div class="meta">Bought ${p.date} • ${money(p.price)}</div><div class="actions"><button class="btn sm ok" onclick="readBook('${b.id}')">Read</button>${b.file?`<a class="btn sm sec" style="text-decoration:none" href="${b.file}" download="${esc(b.fileName||b.title)}">Download</a>`:''}</div></div></div>`).join('')}</div>`
    : '<div class="panel empty">No e-books yet. Visit the catalog to buy one.</div>'}
  <h2>My submissions</h2>
  <div class="panel tablewrap">${submitted.length ? `<table><tr><th>Title</th><th>Price</th><th>Status</th></tr>${submitted.map(b => `<tr><td>${esc(b.title)}</td><td>${money(b.price)}</td>
      <td><span class="tag ${b.status==='approved'?'ok':b.status==='pending'?'warn':'bad'}">${b.status}</span></td></tr>`).join('')}</table>` : '<div class="empty">You have not submitted any e-books.</div>'}</div>`;
}
function readBook(id){
  const u = user(), b = book(id);
  if (!u || (!owns(u.id,id) && !isAdmin())) return toast('Buy this e-book first');
  let body;
  if (b.file && b.file.startsWith('data:application/pdf')) body = `<iframe src="${b.file}" style="width:100%;height:60vh;border:1px solid var(--line);border-radius:8px"></iframe>`;
  else if (b.file && b.file.startsWith('data:image')) body = `<img src="${b.file}" style="max-width:100%">`;
  else body = `<div class="reader">${esc(b.text || 'No readable content was provided for this e-book.')}</div>` +
              (b.file ? `<p style="margin-top:10px"><a href="${b.file}" download="${esc(b.fileName||b.title)}">Download attached file</a></p>` : '');
  openModal(`<h2 style="margin-top:0">${esc(b.title)}</h2><p class="meta" style="margin-bottom:10px">${esc(b.author)}</p>${body}<div style="margin-top:14px"><button class="btn sec" onclick="closeModal()">Close</button></div>`);
}

/* ---------- submit e-book (students) ---------- */
function pageSubmit(){
  const u = user(); if (!u) return pageAuth();
  return `<h1>Submit an E-Book</h1><p class="sub">Share notes, reports or books. The librarian reviews it before it appears in the catalog.</p>
  <div class="panel"><form onsubmit="submitEbook(event)">
    <div class="row"><div><label>Title</label><input name="title" required></div><div><label>Author</label><input name="author" value="${esc(u.name)}" required></div></div>
    <div class="row"><div><label>Category</label><select name="category">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div><label>Price in ₹ (0 = free)</label><input name="price" type="number" min="0" value="0"></div></div>
    <label>Description</label><textarea name="desc" rows="3"></textarea>
    <label>File (PDF / image / text, max ${MAX_FILE_KB} KB)</label><input name="file" type="file" accept=".pdf,.txt,image/*">
    <label>Or paste the text content</label><textarea name="text" rows="5" placeholder="Optional if you attach a file"></textarea>
    <button class="btn" style="margin-top:16px">Submit for approval</button>
    <p class="note">Files are stored in your browser for this demo, so keep them small.</p>
  </form></div>`;
}
function submitEbook(e){
  e.preventDefault();
  const f = new FormData(e.target), file = f.get('file');
  const make = (dataUrl) => {
    const text = f.get('text').trim();
    if (!dataUrl && !text) return toast('Attach a file or paste text');
    db.books.push({id:uid('b'), title:f.get('title').trim(), author:f.get('author').trim(), category:f.get('category'), type:'ebook', copies:999,
      price:Math.max(0, +f.get('price') || 0), desc:f.get('desc').trim(), text, file:dataUrl||'', fileName:file?.name||'', status:'pending', submittedBy:session});
    try { save(); } catch(err){ db.books.pop(); return; }
    toast('Submitted! Waiting for approval'); go('mybooks');
  };
  if (file && file.size) {
    if (file.size > MAX_FILE_KB * 1024) return toast(`File too large (max ${MAX_FILE_KB} KB)`);
    const r = new FileReader(); r.onload = () => make(r.result); r.readAsDataURL(file);
  } else make('');
}

/* ---------- admin ---------- */
function setStatus(id, s){ book(id).status = s; save(); toast('Marked ' + s); render(); }
function deleteBook(id){
  if (db.loans.some(l => l.bookId === id && !l.returned)) return toast('Book is currently borrowed');
  if (!confirm('Delete this book?')) return;
  db.books = db.books.filter(b => b.id !== id); save(); render();
}
function addBook(e){
  e.preventDefault(); const f = new FormData(e.target);
  db.books.push({id:uid('b'), title:f.get('title').trim(), author:f.get('author').trim(), category:f.get('category'), type:f.get('type'),
    copies:f.get('type')==='ebook' ? 999 : Math.max(1,+f.get('copies')||1), price:f.get('type')==='ebook' ? Math.max(0,+f.get('price')||0) : 0,
    desc:f.get('desc').trim(), text:'', status:'approved', submittedBy:session});
  save(); toast('Book added'); e.target.reset(); render();
}
function pageAdmin(){
  if (!isAdmin()) return '<div class="panel empty">Admin access only.</div>';
  const tab = state.adminTab, pend = db.books.filter(b => b.status === 'pending');
  const tabBtn = (k,l) => `<button class="btn ${tab===k?'':'sec'}" onclick="state.adminTab='${k}';render()">${l}</button>`;
  const activeLoans = db.loans.filter(l => !l.returned);
  const revenue = db.purchases.reduce((s,p) => s + p.price, 0);
  let body = '';
  if (tab === 'approvals') body = pend.length ? `<div class="panel tablewrap"><table><tr><th>Title</th><th>By</th><th>Price</th><th></th></tr>${pend.map(b => {
      const by = db.users.find(u => u.id === b.submittedBy);
      return `<tr><td>${esc(b.title)}<div class="meta">${esc(b.author)}</div></td><td>${esc(by?.name)}</td><td>${money(b.price)}</td>
      <td><button class="btn sm sec" onclick="readBook('${b.id}')">Preview</button> <button class="btn sm ok" onclick="setStatus('${b.id}','approved')">Approve</button> <button class="btn sm bad" onclick="setStatus('${b.id}','rejected')">Reject</button></td></tr>`;}).join('')}</table></div>`
    : '<div class="panel empty">No pending submissions 🎉</div>';
  if (tab === 'books') body = `<div class="panel"><h2 style="margin-top:0">Add a book</h2><form onsubmit="addBook(event)">
      <div class="row"><div><label>Title</label><input name="title" required></div><div><label>Author</label><input name="author" required></div></div>
      <div class="row"><div><label>Category</label><select name="category">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div><label>Type</label><select name="type"><option value="physical">Physical</option><option value="ebook">E-book</option></select></div>
        <div><label>Copies (physical)</label><input name="copies" type="number" min="1" value="1"></div>
        <div><label>Price ₹ (e-book)</label><input name="price" type="number" min="0" value="0"></div></div>
      <label>Description</label><input name="desc"><button class="btn" style="margin-top:14px">Add book</button></form></div>
    <div class="panel tablewrap"><table><tr><th>Title</th><th>Type</th><th>Status</th><th></th></tr>${db.books.map(b => `<tr><td>${esc(b.title)}</td><td>${b.type}</td>
      <td><span class="tag ${b.status==='approved'?'ok':b.status==='pending'?'warn':'bad'}">${b.status}</span></td><td><button class="btn sm bad" onclick="deleteBook('${b.id}')">Delete</button></td></tr>`).join('')}</table></div>`;
  if (tab === 'loans') body = `<div class="panel tablewrap">${db.loans.length ? `<table><tr><th>Student</th><th>Book</th><th>Issued</th><th>Due</th><th>Status</th></tr>${[...db.loans].reverse().map(l => {
      const u = db.users.find(x => x.id === l.userId), late = !l.returned && daysBetween(l.due,today()) > 0;
      return `<tr><td>${esc(u?.name)}<div class="meta">${esc(u?.roll)}</div></td><td>${esc(book(l.bookId)?.title)}</td><td>${l.issued}</td><td>${l.due}</td>
      <td>${l.returned ? `<span class="tag ok">Returned</span>` : late ? `<span class="tag bad">Overdue ₹${fineOf(l)}</span>` : '<span class="tag warn">Out</span>'}</td></tr>`;}).join('')}</table>` : '<div class="empty">No loans yet.</div>'}</div>`;
  if (tab === 'students') body = `<div class="panel tablewrap"><table><tr><th>Name</th><th>Roll</th><th>Email</th><th>Books out</th><th>E-books</th></tr>${db.users.filter(u=>u.role==='student').map(u =>
      `<tr><td>${esc(u.name)}</td><td>${esc(u.roll)}</td><td>${esc(u.email)}</td><td>${db.loans.filter(l=>l.userId===u.id&&!l.returned).length}</td><td>${db.purchases.filter(p=>p.userId===u.id).length}</td></tr>`).join('')}</table></div>`;
  return `<h1>Admin Dashboard</h1><p class="sub">Manage books, approve submissions and track loans.</p>
    <div class="stats">
      <div class="stat"><b>${db.books.length}</b><span>Total books</span></div>
      <div class="stat"><b>${activeLoans.length}</b><span>Currently borrowed</span></div>
      <div class="stat"><b>${pend.length}</b><span>Pending approvals</span></div>
      <div class="stat"><b>₹${revenue}</b><span>E-book sales</span></div>
    </div>
    <div class="tabs" style="flex-wrap:wrap">${tabBtn('approvals','Approvals')}${tabBtn('books','Manage Books')}${tabBtn('loans','All Loans')}${tabBtn('students','Students')}</div>${body}`;
}

/* ---------- router ---------- */
function render(){
  const pages = {home:pageHome, catalog:pageCatalog, auth:pageAuth, myloans:pageMyLoans, mybooks:pageMyBooks, submit:pageSubmit, cart:pageCart, admin:pageAdmin};
  renderNav();
  $('#app').innerHTML = (pages[state.page] || pageHome)();
}
render();