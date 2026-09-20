"use client";

import Image from "next/image";
import { ArrowRight, Check, Download, Heart, Menu, Minus, Plus, Search, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

const DOWNLOAD_ORDER_URL = process.env.NEXT_PUBLIC_DOWNLOAD_ORDER_URL || "";

const products = [
  { id: 1, name: "Emerald Drape Midi", category: "Day dresses", price: 3890, image: "/images/emerald-drape.png", color: "Emerald", badge: "New" },
  { id: 2, name: "Noir Pleated Gown", category: "Evening", price: 6490, image: "/images/noir-pleat.png", color: "Black", badge: "Bestseller" },
  { id: 3, name: "Ivory Noor Anarkali", category: "Festive", price: 7990, image: "/images/ivory-anarkali.png", color: "Ivory", badge: "Limited" },
  { id: 4, name: "Verdant One-Shoulder", category: "Evening", price: 4290, image: "/images/emerald-drape.png", color: "Green", badge: "" },
  { id: 5, name: "After Dark Column", category: "Party", price: 5790, image: "/images/noir-pleat.png", color: "Noir", badge: "New" },
  { id: 6, name: "Zari Moonlight Set", category: "Festive", price: 8490, image: "/images/ivory-anarkali.png", color: "Gold", badge: "" },
];

type Product = (typeof products)[number];
type CartLine = { product: Product; quantity: number };
type CompletedOrder = {
  orderNumber: string;
  name: string;
  address: string;
  items: CartLine[];
  subtotal: number;
  placedAt: string;
};

const categories = ["All", "Day dresses", "Evening", "Party", "Festive"];

export default function Home() {
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [liked, setLiked] = useState<number[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [downloadingOrder, setDownloadingOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const visibleProducts = useMemo(
    () => category === "All" ? products : products.filter((product) => product.category === category),
    [category],
  );
  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? products.filter((product) => `${product.name} ${product.category} ${product.color}`.toLowerCase().includes(query)) : products;
  }, [searchTerm]);
  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cart.reduce((total, line) => total + line.product.price * line.quantity, 0);

  const toggleLike = (id: number) => setLiked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const addToCart = (product: Product) => {
    setOrderNumber("");
    setCompletedOrder(null);
    setOrderError("");
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      return existing
        ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const changeQuantity = (id: number, change: number) => {
    setCart((current) => current
      .map((line) => line.product.id === id ? { ...line, quantity: line.quantity + change } : line)
      .filter((line) => line.quantity > 0));
  };

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const address = String(form.get("address") || "").trim();
    if (!name || !address || cart.length === 0) return;

    const nextOrderNumber = `SS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const order: CompletedOrder = {
      orderNumber: nextOrderNumber,
      name,
      address,
      items: cart.map((line) => ({ ...line })),
      subtotal,
      placedAt: new Date().toISOString(),
    };

    setSavingOrder(true);
    setOrderError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(order),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || `Order API returned ${response.status}`);

      setCompletedOrder(order);
      setOrderNumber(result.orderNumber || nextOrderNumber);
      setCart([]);
    } catch (error) {
      console.error("Unable to store the order in RDS", error);
      setOrderError(error instanceof Error ? error.message : "Unable to store the order. Please try again.");
    } finally {
      setSavingOrder(false);
    }
  };

  const downloadOrderDetails = async () => {
    if (!completedOrder) return;
    if (!DOWNLOAD_ORDER_URL) {
      alert("The Lambda download URL has not been configured.");
      return;
    }

    setDownloadingOrder(true);
    try {
      const response = await fetch(DOWNLOAD_ORDER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(completedOrder),
      });
      if (!response.ok) throw new Error(`Lambda returned ${response.status}`);

      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `starzstyle-${completedOrder.orderNumber}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Unable to download the Lambda receipt", error);
      alert("Unable to download the order details. Please try again.");
    } finally {
      setDownloadingOrder(false);
    }
  };

  return (
    <main>
      <div className="announcement">Free shipping above ₹2,999 <span>•</span> Easy 7-day returns</div>
      <header className="site-header">
        <a href="#top" className="wordmark" aria-label="StarzStyle home">STARZ<span>STYLE</span></a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          <button className="nav-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={22} /></button>
          <a href="#new" onClick={() => setMenuOpen(false)}>New in</a><a href="#collection" onClick={() => setMenuOpen(false)}>Dresses</a><a href="#occasion" onClick={() => setMenuOpen(false)}>Occasion</a><a href="#story" onClick={() => setMenuOpen(false)}>Our story</a>
        </nav>
        <div className="header-actions">
          <button aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={20} /></button>
          <button aria-label={`Shopping bag with ${cartCount} items`} className="bag-button" onClick={() => setCartOpen(true)}><ShoppingBag size={20} /><span className="bag-count">{cartCount}</span></button>
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
        </div>
      </header>

      <section className="hero" id="top">
        <Image src="/images/starzstyle-hero.png" alt="Model wearing a flowing magenta StarzStyle gown" fill priority sizes="100vw" className="hero-image" />
        <div className="hero-overlay" />
        <div className="hero-copy"><p className="eyebrow"><Sparkles size={15} /> The celebration edit</p><h1>Dress like the<br /><em>moment is yours.</em></h1><p>Statement silhouettes for weddings, dinners, and every entrance worth remembering.</p><a href="#collection" className="primary-link">Shop the collection <ArrowRight size={18} /></a></div>
        <div className="hero-note"><span>01</span><p>Designed for<br />your main-character moments.</p></div>
      </section>

      <section className="marquee" aria-label="Brand promises"><div>LIMITED RUNS <span>✦</span> MADE TO MOVE <span>✦</span> MODERN INDIAN GLAMOUR <span>✦</span> LIMITED RUNS <span>✦</span></div></section>

      <section className="collection" id="collection">
        <div className="section-heading" id="new"><div><p className="eyebrow dark">Fresh from the studio</p><h2>The new dress code</h2></div><p>Confident cuts, rich colour, and details that do the talking.</p></div>
        <div className="filters" role="group" aria-label="Filter products by category">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="product-grid">
          {visibleProducts.map((product, index) => (
            <article className="product-card" key={product.id}>
              <div className="product-image-wrap">
                <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" className={`product-image crop-${index % 3}`} />
                {product.badge && <span className="badge">{product.badge}</span>}
                <button className={liked.includes(product.id) ? "heart liked" : "heart"} onClick={() => toggleLike(product.id)} aria-label={`${liked.includes(product.id) ? "Remove" : "Add"} ${product.name} ${liked.includes(product.id) ? "from" : "to"} favourites`}><Heart size={19} fill={liked.includes(product.id) ? "currentColor" : "none"} /></button>
                <button className="quick-add" onClick={() => addToCart(product)}>Quick add <Plus size={18} /></button>
              </div>
              <div className="product-info"><div><h3>{product.name}</h3><p>{product.category} · {product.color}</p></div><strong>₹{product.price.toLocaleString("en-IN")}</strong></div>
            </article>
          ))}
        </div>
      </section>

      <section className="occasion" id="occasion"><div className="occasion-copy"><p className="eyebrow">The StarzStyle promise</p><h2>Beautiful clothes.<br /><em>Better choices.</em></h2><p>Small-batch collections, considered fabrics, and silhouettes made to be worn far beyond one occasion.</p><a href="#story">Read our story <ArrowRight size={17} /></a></div><div className="occasion-stats" id="story"><div><strong>01</strong><h3>Small batches</h3><p>Thoughtful quantities mean less waste and more special pieces.</p></div><div><strong>02</strong><h3>Fit-first design</h3><p>Comfortable construction that lets you move, sit, and celebrate.</p></div><div><strong>03</strong><h3>Made in India</h3><p>Created with skilled makers and a love for contemporary craft.</p></div></div></section>

      <section className="newsletter"><p className="eyebrow dark">Your front-row invitation</p><h2>New drops. Styling notes. No noise.</h2>{subscribed ? <div className="subscribed"><Check size={19} /> You&apos;re on the list.</div> : <form onSubmit={(event) => { event.preventDefault(); setSubscribed(true); }}><label className="sr-only" htmlFor="email">Email address</label><input id="email" type="email" placeholder="Your email address" required /><button type="submit">Join the list <ArrowRight size={18} /></button></form>}<p>By subscribing, you agree to receive StarzStyle updates.</p></section>

      <footer><div className="footer-brand"><a href="#top" className="wordmark light">STARZ<span>STYLE</span></a><p>Occasion wear for every version of you.</p></div><div><h3>Shop</h3><a href="#collection">New in</a><a href="#collection">Dresses</a><a href="#occasion">Festive</a></div><div><h3>Help</h3><a href="#delivery">Shipping</a><a href="#delivery">Returns</a><a href="#collection">Size guide</a></div><div><h3>Follow</h3><a href="https://www.instagram.com" target="_blank" rel="noreferrer">Instagram</a><a href="https://www.pinterest.com" target="_blank" rel="noreferrer">Pinterest</a><a href="https://www.whatsapp.com" target="_blank" rel="noreferrer">WhatsApp</a></div><p className="copyright">© 2026 StarzStyle. Demo store.</p></footer>

      {searchOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Search products"><button className="layer-backdrop" onClick={() => setSearchOpen(false)} aria-label="Close search" /><section className="search-panel"><div className="panel-head"><h2>Search StarzStyle</h2><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X /></button></div><div className="search-field"><Search size={20} /><input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search dresses, colours, occasions…" /></div><div className="search-results">{searchResults.map((product) => <button key={product.id} onClick={() => { addToCart(product); setSearchOpen(false); }}><Image src={product.image} alt="" width={58} height={72} /><span><strong>{product.name}</strong><small>{product.category} · ₹{product.price.toLocaleString("en-IN")}</small></span><Plus size={18} /></button>)}</div></section></div>}

      {cartOpen && <div className="modal-layer cart-layer" role="dialog" aria-modal="true" aria-label="Shopping bag"><button className="layer-backdrop" onClick={() => setCartOpen(false)} aria-label="Close shopping bag" /><aside className="cart-panel"><div className="panel-head"><div><p>Your bag</p><h2>{orderNumber ? "Order confirmed" : `${cartCount} ${cartCount === 1 ? "item" : "items"}`}</h2></div><button onClick={() => setCartOpen(false)} aria-label="Close shopping bag"><X /></button></div>
        {orderNumber ? <div className="order-success"><span><Check size={28} /></span><h3>Thank you for your order.</h3><p>Your demo order <strong>{orderNumber}</strong> has been saved in RDS.</p><div className="order-actions"><button type="button" className="download-order" onClick={downloadOrderDetails} disabled={downloadingOrder}><Download size={18} /> {downloadingOrder ? "Generating with Lambda…" : "Download order details"}</button><button type="button" className="continue-shopping" onClick={() => { setOrderNumber(""); setCompletedOrder(null); setCartOpen(false); }}>Continue shopping</button></div></div> : cart.length === 0 ? <div className="empty-cart"><ShoppingBag size={36} /><h3>Your bag is empty</h3><p>Add a dress you love and it will appear here.</p><button onClick={() => setCartOpen(false)}>Browse dresses</button></div> : <><div className="cart-lines">{cart.map(({ product, quantity }) => <article className="cart-line" key={product.id}><div className="cart-thumb"><Image src={product.image} alt={product.name} fill sizes="88px" /></div><div className="cart-line-info"><h3>{product.name}</h3><p>{product.color}</p><div className="quantity"><button onClick={() => changeQuantity(product.id, -1)} aria-label={`Decrease ${product.name} quantity`}><Minus size={15} /></button><span>{quantity}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label={`Increase ${product.name} quantity`}><Plus size={15} /></button></div></div><div className="cart-line-price"><strong>₹{(product.price * quantity).toLocaleString("en-IN")}</strong><button onClick={() => setCart((current) => current.filter((line) => line.product.id !== product.id))} aria-label={`Remove ${product.name}`}><Trash2 size={17} /></button></div></article>)}</div><div className="cart-total"><span>Subtotal</span><strong>₹{subtotal.toLocaleString("en-IN")}</strong></div><p className="shipping-note" id="delivery">Free shipping · Cash on delivery available</p><form className="checkout-form" onSubmit={placeOrder}><h3>Delivery details</h3><label htmlFor="customer-name">Full name</label><input id="customer-name" name="name" autoComplete="name" placeholder="Your full name" required disabled={savingOrder} /><label htmlFor="customer-address">Delivery address</label><textarea id="customer-address" name="address" autoComplete="street-address" placeholder="House number, street, city, state and PIN code" rows={4} required disabled={savingOrder} />{orderError && <p className="order-error" role="alert">{orderError}</p>}<button type="submit" disabled={savingOrder}>{savingOrder ? "Saving order to RDS…" : <>Place order · ₹{subtotal.toLocaleString("en-IN")} <ArrowRight size={18} /></>}</button><small>Demo checkout — no payment will be collected.</small></form></>}
      </aside></div>}
    </main>
  );
}
