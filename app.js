// app.js
/* Frontend-only e-commerce demo.
   - Uses localStorage to persist products and orders
   - Simulates inventory updates, mock payment, and shipment tracking stages
*/

(() => {
  // --- Utilities ---
  const $ = sel => document.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (!c) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  // --- Initial data (persisted) ---
  const DEFAULT_PRODUCTS = [
    { id: 'p1', name: 'Wireless Mouse', price: 499, stock: 10, desc: 'Comfortable ergonomic mouse' },
    { id: 'p2', name: 'Mechanical Keyboard', price: 2499, stock: 5, desc: 'Tactile keys, RGB' },
    { id: 'p3', name: 'USB-C Cable 1m', price: 199, stock: 20, desc: 'Fast charge & data' },
    { id: 'p4', name: 'Bluetooth Earbuds', price: 1499, stock: 8, desc: 'Noise isolation, 24h battery' }
  ];

  // Storage helpers
  const store = {
    products: {
      key: 'ecom_demo_products',
      load() {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : DEFAULT_PRODUCTS.slice();
      },
      save(data) { localStorage.setItem(this.key, JSON.stringify(data)); }
    },
    orders: {
      key: 'ecom_demo_orders',
      load() { const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) : {}; },
      save(obj) { localStorage.setItem(this.key, JSON.stringify(obj)); }
    },
    cart: {
      key: 'ecom_demo_cart',
      load(){ const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) : {}; },
      save(o){ localStorage.setItem(this.key, JSON.stringify(o)); }
    }
  };

  // --- App state ---
  let products = store.products.load();
  let orders = store.orders.load();
  let cart = store.cart.load(); // { productId: qty }

  // --- DOM refs ---
  const productsGrid = $('#productsGrid');
  const cartCountEl = $('#cartCount');
  const cartList = $('#cartList');
  const ordersList = $('#ordersList');
  const orderDetail = $('#orderDetail');
  const checkoutMsg = $('#checkoutMsg');

  const views = {
    products: $('#productsView'),
    cart: $('#cartView'),
    orders: $('#ordersView')
  };

  // --- Navigation ---
  function showView(name) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (name === 'products') $('#viewProductsBtn').classList.add('active');
    if (name === 'cart') $('#viewCartBtn').classList.add('active');
    if (name === 'orders') $('#viewOrdersBtn').classList.add('active');
  }
  $('#viewProductsBtn').onclick = () => showView('products');
  $('#viewCartBtn').onclick = () => { showView('cart'); renderCart(); };
  $('#viewOrdersBtn').onclick = () => { showView('orders'); renderOrders(); };

  // --- Rendering ---
  function renderProducts(){
    productsGrid.innerHTML = '';
    products.forEach(p => {
      const card = el('div', { class: 'card' }, [
        el('div', { class: 'product-title', text: p.name }),
        el('div', { class: 'order-meta', text: p.desc }),
        el('div', { class: 'price', text: `₹ ${p.price.toFixed(0)}` }),
        el('div', { class: 'stock', text: `Stock: ${p.stock}` }),
      ]);
      const controls = el('div', { class: 'controls' });
      const qtyInput = el('input', { type: 'number', min: 1, value: 1, class: 'small', style: 'width:70px' });
      const addBtn = el('button', { class: 'small' }, 'Add to Cart');
      addBtn.onclick = () => {
        const q = Math.max(1, parseInt(qtyInput.value) || 1);
        addToCart(p.id, q);
      };
      controls.appendChild(qtyInput);
      controls.appendChild(addBtn);
      card.appendChild(controls);
      productsGrid.appendChild(card);
    });
    updateCartCount();
  }

  function renderCart(){
    cartList.innerHTML = '';
    const keys = Object.keys(cart);
    if (keys.length === 0){
      cartList.appendChild(el('div',{class:'muted',text:'Your cart is empty.'}));
      return;
    }
    let total = 0;
    keys.forEach(pid => {
      const p = products.find(x=>x.id===pid);
      const qty = cart[pid];
      total += p.price*qty;
      const item = el('div', { class: 'cart-item' }, [
        el('div', {}, [
          el('div',{class:'product-title', text: p.name}),
          el('div',{class:'order-meta', text: `₹${p.price} × ${qty} = ₹${p.price*qty}`})
        ]),
        el('div', { class: 'qty' }, [
          el('button',{class:'ghost'}, '-'),
          el('div',{class:'muted', text: qty}),
          el('button',{class:'ghost'}, '+'),
          el('button',{class:'ghost'}, 'Remove')
        ])
      ]);
      const [minusBtn, qtyDiv, plusBtn, removeBtn] = item.querySelectorAll('.ghost');
      minusBtn.onclick = () => { updateCartQty(pid, Math.max(1, cart[pid]-1)); renderCart(); };
      plusBtn.onclick = () => { updateCartQty(pid, cart[pid]+1); renderCart(); };
      removeBtn.onclick = () => { removeFromCart(pid); renderCart(); };
      cartList.appendChild(item);
    });
    const sumEl = el('div',{class:'card', style:'margin-top:12px'}, [
      el('div',{class:'product-title', text: `Total: ₹${total}`})
    ]);
    cartList.appendChild(sumEl);
  }

  function renderOrders(){
    ordersList.innerHTML = '';
    const keys = Object.keys(orders).sort((a,b)=> orders[b].createdAt - orders[a].createdAt);
    if (keys.length === 0){
      ordersList.appendChild(el('div',{class:'muted',text:'No orders yet.'}));
      return;
    }
    keys.forEach(id => {
      const o = orders[id];
      const box = el('div',{class:'card'}, [
        el('div',{class:'product-title', text:`Order ${o.id}`}),
        el('div',{class:'order-meta', text:`Placed: ${new Date(o.createdAt).toLocaleString()} — ₹${o.amount}`}),
        el('div',{class:'order-meta', text:`Status: ${o.status}`}),
        el('div', { class: 'controls' })
      ]);
      const detailsBtn = el('button',{class:'small'}, 'View');
      detailsBtn.onclick = () => showOrderDetail(id);
      box.querySelector('.controls').appendChild(detailsBtn);
      ordersList.appendChild(box);
    });
  }

  function showOrderDetail(id){
    const o = orders[id];
    if(!o) return;
    orderDetail.classList.remove('hidden');
    orderDetail.innerHTML = '';
    const header = el('div',{class:'card'}, [
      el('div',{class:'product-title', text:`Order ${o.id}`}),
      el('div',{class:'order-meta', text:`Customer: ${o.customerName}`}),
      el('div',{class:'order-meta', text:`Amount: ₹${o.amount}`}),
      el('div',{class:'order-meta', text:`Placed: ${new Date(o.createdAt).toLocaleString()}`}),
      el('div',{class:'order-meta', text:`Status: ${o.status}`}),
    ]);
    orderDetail.appendChild(header);

    const itemsBox = el('div',{class:'card'}, [
      el('div',{class:'product-title', text:'Items'}),
      ...o.items.map(it => {
        const p = products.find(x=>x.id===it.productId) || {name:it.productId};
        return el('div',{class:'order-meta', text: `${p.name} × ${it.qty} — ₹${(p.price||0)*it.qty}`});
      })
    ]);
    orderDetail.appendChild(itemsBox);

    // Tracking
    const trackBox = el('div',{class:'card'}, [
      el('div',{class:'product-title', text:'Shipment Tracking'}),
      el('div',{class:'order-meta', text: `Carrier: ${o.shipment ? o.shipment.carrier : 'TBD'}`}),
      el('div',{class:'order-meta', text: `Tracking ID: ${o.shipment ? o.shipment.trackingId : '—'}`}),
      el('div',{class:'tracking', id:'stagesContainer'})
    ]);
    orderDetail.appendChild(trackBox);

    const stagesContainer = $('#stagesContainer');
    const stages = o.shipment ? o.shipment.stages : [];
    stages.forEach((s, idx) => {
      const done = (o.shipment && o.shipment.currentStageIndex !== undefined && idx <= o.shipment.currentStageIndex);
      const st = el('div',{class:`stage ${done ? 'done' : ''}`, text: `${s} ${done ? '✓' : ''}`});
      stagesContainer.appendChild(st);
    });

    // scroll to detail
    orderDetail.scrollIntoView({behavior:'smooth'});
  }

  // --- Cart management ---
  function addToCart(pid, qty=1){
    const p = products.find(x=>x.id===pid);
    if(!p) return alert('Product not found');
    if (p.stock < (cart[pid] || 0) + qty) return alert('Not enough stock');
    cart[pid] = (cart[pid] || 0) + qty;
    store.cart.save(cart);
    updateCartCount();
    renderProducts();
  }
  function updateCartQty(pid, qty){
    const p = products.find(x=>x.id===pid);
    if(qty <= 0) return removeFromCart(pid);
    if (p.stock < qty) return alert('Not enough stock');
    cart[pid] = qty;
    store.cart.save(cart);
    updateCartCount();
  }
  function removeFromCart(pid){
    delete cart[pid];
    store.cart.save(cart);
    updateCartCount();
  }
  function updateCartCount(){
    const count = Object.values(cart).reduce((s,q)=>s+q,0);
    cartCountEl.textContent = count;
  }

  // --- Ordering & mock server behavior ---
  function placeOrder(customerName, customerAddress){
    // validate
    if(!customerName) return checkoutMsg.textContent = 'Please enter your name.';
    const itemEntries = Object.entries(cart);
    if(itemEntries.length === 0) return checkoutMsg.textContent = 'Your cart is empty.';
    // check inventory
    for(const [pid, qty] of itemEntries){
      const p = products.find(x=>x.id===pid);
      if(!p || p.stock < qty) return checkoutMsg.textContent = `Insufficient stock for ${p ? p.name : pid}`;
    }
    // deduct inventory (atomic-ish)
    for(const [pid, qty] of itemEntries){
      const p = products.find(x=>x.id===pid);
      p.stock -= qty;
    }
    store.products.save(products);

    // compute amount
    let amount = 0;
    const items = itemEntries.map(([pid, qty]) => {
      const p = products.find(x=>x.id===pid);
      amount += (p.price * qty);
      return { productId: pid, qty };
    });

    // create order record
    const id = `ORD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const newOrder = {
      id,
      customerName,
      customerAddress,
      items,
      amount,
      status: 'PLACED',
      createdAt: Date.now(),
      shipment: null
    };
    orders[id] = newOrder;
    store.orders.save(orders);

    // clear cart
    cart = {};
    store.cart.save(cart);
    updateCartCount();

    // Simulate payment then shipment progression
    checkoutMsg.textContent = 'Processing payment...';
    setTimeout(() => {
      // Mock payment success
      orders[id].status = 'PAID';
      orders[id].shipment = {
        carrier: 'MockPost',
        trackingId: 'TRK-' + id.slice(-8),
        stages: ['PICKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'],
        currentStageIndex: 0
      };
      store.orders.save(orders);
      checkoutMsg.textContent = `Payment successful — Order ${id} placed.`;
      renderProducts();
      renderOrders();
      // Progress shipment over time
      advanceShipment(id);
    }, 800);

    return id;
  }

  // Progress shipment stages periodically (simulated background)
  function advanceShipment(orderId){
    const o = orders[orderId];
    if(!o || !o.shipment) return;
    const advance = () => {
      const s = orders[orderId].shipment;
      if(s.currentStageIndex < s.stages.length - 1){
        s.currentStageIndex += 1;
        // When delivered
        if(s.currentStageIndex === s.stages.length - 1) orders[orderId].status = 'DELIVERED';
        else orders[orderId].status = 'SHIPPED';
        store.orders.save(orders);
        // schedule next advance
        setTimeout(advance, 2500 + Math.floor(Math.random()*3000));
      }
    };
    // start first advance after a short delay
    setTimeout(advance, 2000 + Math.floor(Math.random()*2000));
  }

  // --- Restore in-progress shipments on load and resume timers ---
  function resumeShipments(){
    Object.keys(orders).forEach(id => {
      const o = orders[id];
      if(o.shipment && (o.shipment.currentStageIndex < o.shipment.stages.length - 1)){
        // small delay to stagger
        setTimeout(()=> advanceShipment(id), 1000 + Math.floor(Math.random()*1000));
      }
    });
  }

  // --- Event hooks ---
  $('#placeOrderBtn').onclick = () => {
    checkoutMsg.textContent = '';
    const name = $('#customerName').value.trim();
    const addr = $('#customerAddress').value.trim();
    const id = placeOrder(name, addr);
    if(id){
      // after successful placement, switch to orders view
      setTimeout(()=> {
        $('#customerName').value = '';
        $('#customerAddress').value = '';
        showView('orders');
        renderOrders();
        showOrderDetail(id);
      }, 900);
    }
  };

  // --- Init render ---
  renderProducts();
  renderOrders();
  resumeShipments();
  updateCartCount();

  // expose debug (optional)
  window.__EcomDemo = { products, orders, cart, store };

})();
