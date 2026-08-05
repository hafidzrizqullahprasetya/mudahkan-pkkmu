import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import logoImg from "../logo/mudahkan-atributmu.jpg";
import qrisLogo from "../logo/qris.svg";
import heroImg from "../image/kampus-upn.jpg";

import {
  instagramUrl,
  whatsappGroupUrl,
  products,
  productItems,
  BEST_SELLER_IDS,
  COCARD_PRODUCT_IDS,
  pkkbnScopes,
} from "./constants";
import { IconFlame, IconSparkles, IconTag, ProductArt } from "./components/Icons";
import { CustomProdiSelect } from "./components/CustomProdiSelect";
import { PhotoUploadInput } from "./components/PhotoUploadInput";
import { CustomPkkbnSelect } from "./components/CustomPkkbnSelect";
import { rupiah } from "./utils/format";
import { normalizeSelection, sortedProducts } from "./utils/products";
import { crc16ccitt, buildQrisFallback } from "./utils/qris";
import { BACKEND_URL, fileToBase64 } from "./utils/api";

function App() {
  // Parse draft sekali, share ke semua useState initializer
  // ponytail: add when draft structure kompleks — pertimbangkan useReducer
  const draft = (() => {
    try {
      const saved = localStorage.getItem("pkkbn_order_draft");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })();

  const [formData, setFormData] = useState(
    draft ? { name: draft.name || "", nim: draft.nim || "", whatsapp: draft.whatsapp || "" } : { name: "", nim: "", whatsapp: "" }
  );

  const [selectedProducts, setSelectedProducts] = useState(
    draft && Array.isArray(draft.selectedProducts) ? draft.selectedProducts : []
  );

  const [selectedProdi, setSelectedProdi] = useState(draft?.prodi || "");

  const [selectedFaculty, setSelectedFaculty] = useState(draft?.faculty || "");

  const [cocardOption, setCocardOption] = useState(draft?.cocardOption || "both");

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes timer (600 seconds)
  const [menuOpen, setMenuOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeIgTarget, setActiveIgTarget] = useState(null);
  const [payMode, setPayMode] = useState("production");
  const [productTab, setProductTab] = useState("all");
  const [isPaid, setIsPaid] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const checkStatusNow = async () => {
    if (!paymentData?.order_id || isPaid) return;
    setCheckingStatus(true);
    try {
      if (!BACKEND_URL) return;
      const res = await fetch(`${BACKEND_URL}/api/check-order-status?orderId=${paymentData.order_id}&_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        console.log("🔍 [Frontend checkStatusNow]:", data);
        if (data && data.paid) {
          setIsPaid(true);
        }
      }
    } catch (e) {
      console.log("Error checking order status:", e);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!submitted || !paymentData?.order_id || isPaid) return;

    let eventSource = null;
    try {
      if (BACKEND_URL && typeof EventSource !== "undefined") {
        eventSource = new EventSource(`${BACKEND_URL}/api/payment-stream?orderId=${paymentData.order_id}`);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("⚡ [SSE Realtime Push Received]:", data);
            if (data && data.paid) {
              setIsPaid(true);
              if (eventSource) eventSource.close();
            }
          } catch (e) {}
        };
      }
    } catch (e) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [submitted, paymentData, isPaid]);

  useEffect(() => {
    try {
      const draft = {
        name: formData.name || "",
        nim: formData.nim || "",
        whatsapp: formData.whatsapp || "",
        faculty: selectedFaculty,
        prodi: selectedProdi,
        selectedProducts,
        cocardOption,
      };
      localStorage.setItem("pkkbn_order_draft", JSON.stringify(draft));
    } catch (e) {}
  }, [formData, selectedFaculty, selectedProdi, selectedProducts, cocardOption]);

  // ponytail: normalizeSelection dipanggil di sini, bukan di toggleProduct, biar derivasi murni
  const normalizedProductIds = useMemo(() => normalizeSelection(selectedProducts), [selectedProducts]);
  const selectedItems = useMemo(
    () => products.filter((product) => normalizedProductIds.includes(product.id)),
    [normalizedProductIds]
  );
  const total = useMemo(() => selectedItems.reduce((sum, product) => sum + product.price, 0), [selectedItems]);

  const selectedScope = pkkbnScopes.find((s) => s.name === selectedFaculty) || null;
  const availableProdis = selectedScope?.prodis || [];
  const hasCocardProduct = normalizedProductIds.some((id) => COCARD_PRODUCT_IDS.includes(id));
  // sortedProducts dipanggil 2x di render (package-grid + product-check) — hitung sekali
  const sortedProductList = useMemo(() => sortedProducts(products), []);

  const handleFacultyChange = (val) => {
    setSelectedFaculty(val);
    setErrors((curr) => ({ ...curr, faculty: undefined }));
    const newScope = pkkbnScopes.find((s) => s.name === val);
    if (newScope && !newScope.prodis.includes(selectedProdi)) {
      setSelectedProdi("");
    }
  };

  useEffect(() => {
    if (!BACKEND_URL) return;
    fetch(`${BACKEND_URL}/api/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.mode === "testing" || data.mode === "production")) {
          setPayMode(data.mode);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!submitted || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const toggleProduct = (id) => {
    const isAdding = !selectedProducts.includes(id);
    setSelectedProducts((current) => {
      let next;
      if (!isAdding) {
        next = current.filter((productId) => productId !== id);
      } else {
        const incomingItems = productItems[id];
        next = [...current.filter((productId) => {
          const existingItems = productItems[productId] || [];
          return existingItems.length === 0 || !incomingItems.some((item) => existingItems.includes(item));
        }), id];
      }
      return normalizeSelection(next);
    });
    setErrors((current) => ({ ...current, products: undefined }));
  };

  const handleCloseAndReset = () => {
    setSubmitted(false);
    setPaymentData(null);
    setIsPaid(false);
    setFormData({
      name: "",
      nim: "",
      whatsapp: "",
    });
    setSelectedFaculty("");
    setSelectedProdi("");
    setSelectedProducts([]);
    setCocardOption("both");
    setErrors({});
    try {
      localStorage.removeItem("pkkbn_order_draft");
    } catch (e) {}
  };

  const scrollToForm = () => {
    const formSection = document.getElementById("pesan");
    if (formSection) {
      formSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextErrors = {};

    ["name", "nim", "faculty", "whatsapp"].forEach((field) => {
      if (!data.get(field)?.trim()) nextErrors[field] = "Bagian ini wajib diisi.";
    });
    if (selectedFaculty && !data.get("prodi")?.trim()) {
      nextErrors.prodi = "Bagian ini wajib diisi.";
    }
    const photoFile = data.get("photo");
    if (hasCocardProduct && (!photoFile || !photoFile.name || photoFile.size === 0)) {
      nextErrors.photo = "Pas foto 3x4 wajib diunggah untuk Cocard.";
    }
    if (selectedProducts.length === 0) nextErrors.products = "Pilih minimal satu produk.";
    if (!data.get("agreement")) nextErrors.agreement = "Centang persetujuan sebelum mengirim pesanan.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setIsSubmitting(true);
      const generatedOrderId = `PKKMU-${Date.now()}`;
      try {
        let photoBase64 = "";
        if (photoFile && photoFile.size > 0) {
          photoBase64 = await fileToBase64(photoFile);
        }
        const cocardVariantNote = hasCocardProduct
          ? cocardOption === "both"
            ? "(Cocard: Pusat + Fakultas)"
            : cocardOption === "pusat"
            ? "(Cocard: Pusat Saja)"
            : "(Cocard: Fakultas Saja)"
          : "";

        const formattedProducts = selectedItems.map((item) => {
          if (COCARD_PRODUCT_IDS.includes(item.id)) {
            return `${item.name} ${cocardVariantNote}`;
          }
          return item.name;
        });

        const payload = {
          orderId: generatedOrderId,
          name: data.get("name")?.trim(),
          nim: data.get("nim")?.trim(),
          prodi: selectedProdi,
          faculty: selectedFaculty,
          whatsapp: data.get("whatsapp")?.trim(),
          photoName: photoFile ? photoFile.name : "",
          photoType: photoFile ? photoFile.type : "",
          photoBase64: photoBase64,
          products: formattedProducts,
          total: total,
        };

        const chargeTotal = payMode === "testing" ? 1 : total;

        // Simpan ke Google Sheets/Drive dilakukan oleh backend di /api/send-order-notif
        // (sendToGoogleSheets). Kirim langsung dari browser dulu duplikat baris di Sheets.
        if (BACKEND_URL) {
          fetch(`${BACKEND_URL}/api/send-order-notif`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, total: chargeTotal }),
          }).catch((e) => console.log("WA notification error:", e));
        }

        let qrisDirect = null;
        if (BACKEND_URL) {
          try {
            const qrisRes = await fetch(`${BACKEND_URL}/api/charge-qris`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // productIds dikirim, bukan amount — total dihitung server-side (anti-fraud)
              body: JSON.stringify({ orderId: generatedOrderId, productIds: normalizedProductIds }),
            });
            if (qrisRes.ok) {
              qrisDirect = await qrisRes.json();
            }
          } catch (e) {
            console.log("Direct QRIS charge error:", e);
          }
        }

        if (qrisDirect && qrisDirect.qr_url) {
          setPaymentData(qrisDirect);
        } else {
          setPaymentData({
            qr_url: buildQrisFallback(chargeTotal),
            order_id: generatedOrderId,
            gross_amount: chargeTotal,
          });
        }
      } catch (err) {
        console.error("Gagal mengirim data ke Backend:", err);
        const chargeTotal = payMode === "testing" ? 1 : total;
        setPaymentData({
          qr_url: buildQrisFallback(chargeTotal),
          order_id: generatedOrderId,
          gross_amount: chargeTotal,
        });
      } finally {
        setIsSubmitting(false);
        setTimeLeft(600);
        setIsPaid(false);
        setSubmitted(true);
        try {
          localStorage.removeItem("pkkbn_order_draft");
        } catch (e) {}
      }
    } else {
      setTimeout(() => {
        const firstErrorEl = document.querySelector(
          ".error, [aria-invalid='true'], .custom-select-trigger--error"
        );
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof firstErrorEl.focus === "function") {
            firstErrorEl.focus();
          }
        }
      }, 50);
    }
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Kembali ke bagian atas">
          <span className="brand-mark brand-mark--img">
            <img src={logoImg} alt="Mudahkan PKKMU Logo" />
          </span>
          <span><b>Mudahkan PKKMU!</b><small>UPN Veteran Yogyakarta</small></span>
        </a>
        <nav id="main-navigation" className={menuOpen ? "nav nav--open" : "nav"} aria-label="Navigasi utama">
          <a href="#produk" onClick={() => setMenuOpen(false)}>Produk</a>
          <a href="#cakupan" onClick={() => setMenuOpen(false)}>Lini PKKBN</a>
          <a href="#alur" onClick={() => setMenuOpen(false)}>Alur</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a className="nav-cta" href="#pesan" onClick={() => setMenuOpen(false)}>Isi form</a>
        </nav>
        <button className="menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="main-navigation">
          {menuOpen ? "Tutup" : "Menu"}
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">Atribut ospek mahasiswa baru / 2026</p>
          <h1>MUDAHKAN<br /><span>PKKMU!</span></h1>
          <p className="hero-lead">Lanyard, cocard, dan booklet untuk langkah pertamamu sebagai mahasiswa UPN Veteran Yogyakarta.</p>
          <button type="button" className="button button--dark hero-btn-pulse" onClick={scrollToForm}>Isi form sekarang <span>↓</span></button>
        </div>
        <div className="hero-collage" aria-label="Foto Kampus UPN Veteran Yogyakarta">
          <div className="photo photo--large">
            <img src={heroImg} alt="Kampus UPN Veteran Yogyakarta" />
          </div>
          <div className="hero-poster"><b>SIAP</b><span>OSPEK</span><small>UPNVY / ANGKATAN 2026</small></div>
          <div className="tape tape--one"></div>
          <div className="tape tape--two"></div>
        </div>
        <p className="hero-side">MUDAHKAN PKKMU! • SLEMAN, YOGYAKARTA</p>
      </section>

      <section className="notice" aria-label="Informasi batas pemesanan">
        <strong>Pemesanan ditutup</strong>
        <span>18 Agustus 2026 / 23.59 WIB</span>
        <span className="notice-mark">Jangan lewatkan.</span>
      </section>

      <section className="packages section" id="produk">
        <div className="section-heading">
          <span className="section-index">01</span>
          <div><h2>Pilih atributmu.</h2><p>Klik produk untuk langsung menuju ke formulir pemesanan.</p></div>
        </div>
        <div className="package-grid">
          {sortedProductList.map((product) => {
            return (
              <button
                type="button"
                className="package-card"
                key={product.id}
                onClick={scrollToForm}
              >
                <div className="package-top"><span>{product.number}</span><b>{product.note}</b></div>
                <ProductArt type={product.id} />
                <div className="package-copy">
                  <h3>{product.name}</h3>
                  <strong>{rupiah(product.price)}</strong>
                  <p>{product.description}</p>
                  <span className="select-label">Pilih di form ↓</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="pkkbn-coverage section" id="cakupan">
        <div className="section-heading">
          <span className="section-index">02</span>
          <div>
            <h2>Mencakup Seluruh<br />Lini PKKBN.</h2>
            <p>
              <strong>Mudahkan PKKMU!</strong> siap mencover kebutuhan atribut untuk <strong>5 Fakultas</strong> di lingkungan kampus. Klik kartu untuk mengunjungi akun Instagram resmi.
            </p>
          </div>
        </div>

        <div className="pkkbn-grid">
          {pkkbnScopes.map((scope) => {
            return (
              <div
                className="pkkbn-card"
                key={scope.id}
                onClick={() => setActiveIgTarget(scope)}
                style={{ cursor: "pointer" }}
              >
                <div className="pkkbn-card-media">
                  <img src={scope.image} alt={scope.name} loading="lazy" />
                  <span className="pkkbn-badge">{scope.code}</span>
                </div>
                <div className="pkkbn-card-body">
                  <small>{scope.type}</small>
                  <h3>{scope.name}</h3>
                  <p>{scope.description}</p>
                  <button type="button" className="pkkbn-select-btn" onClick={(e) => { e.stopPropagation(); setActiveIgTarget(scope); }}>
                    Kunjungi IG ↗
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flow section" id="alur">
        <div className="flow-title"><span>03</span><h2>Dari pilih<br />sampai gabung.</h2></div>
        <ol className="flow-list">
          <li><b>01</b><div><strong>Pilih produk</strong><span>Lanyard, cocard, atau booklet.</span></div></li>
          <li><b>02</b><div><strong>Isi identitas</strong><span>Periksa NIM dan nomor WhatsApp.</span></div></li>
          <li><b>03</b><div><strong>Bayar via QRIS</strong><span>Satu metode, lebih praktis.</span></div></li>
          <li><b>04</b><div><strong>Masuk grup WA</strong><span>Wajib untuk info pengambilan.</span></div></li>
        </ol>
      </section>

      <section className="order section" id="pesan">
        <div className="order-intro">
          <span className="section-index">04</span>
          <h2>Isi data.<br />Selesai.</h2>
          <p>Setelah mengirim form, kamu wajib masuk grup WhatsApp untuk menerima informasi pembayaran dan pengambilan.</p>
          <div className="order-poster" aria-hidden="true">
            <span>ATRIBUT</span><b>04</b><small>LANYARD / COCARD / BOOKLET</small>
          </div>
        </div>

        <form className="order-form" onSubmit={submitOrder} noValidate>
          <fieldset>
            <legend><span>1</span> Data pembeli & PKKBN</legend>
            <div className="form-grid">
              <label><span>Nama lengkap <span className="required-asterisk">*</span></span><input name="name" type="text" autoComplete="name" placeholder="Tulis nama lengkap" value={formData.name} onChange={(e) => { setFormData((prev) => ({ ...prev, name: e.target.value })); setErrors((curr) => ({ ...curr, name: undefined })); }} aria-invalid={Boolean(errors.name)} />{errors.name && <small className="error">{errors.name}</small>}</label>
              <label><span>NIM <span className="required-asterisk">*</span></span><input name="nim" type="text" inputMode="numeric" autoComplete="off" placeholder="Contoh: 111260004" value={formData.nim} onChange={(e) => { setFormData((prev) => ({ ...prev, nim: e.target.value })); setErrors((curr) => ({ ...curr, nim: undefined })); }} aria-invalid={Boolean(errors.nim)} />{errors.nim && <small className="error">{errors.nim}</small>}</label>
              <label><span>Pilihan PKKBN Fakultas <span className="required-asterisk">*</span></span><CustomPkkbnSelect scopes={pkkbnScopes} value={selectedFaculty} onChange={handleFacultyChange} error={Boolean(errors.faculty)} />{errors.faculty && <small className="error">{errors.faculty}</small>}</label>
              <label><span>Program Studi <span className="required-asterisk">*</span></span><CustomProdiSelect options={availableProdis} value={selectedProdi} onChange={(val) => { setSelectedProdi(val); setErrors((curr) => ({ ...curr, prodi: undefined })); }} error={Boolean(errors.prodi)} hasFaculty={Boolean(selectedFaculty)} />{errors.prodi && <small className="error">{errors.prodi}</small>}</label>
              <label className="full-width"><span>Nomor WhatsApp <span className="required-asterisk">*</span></span><input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="Contoh: 081234567890" value={formData.whatsapp} onChange={(e) => { setFormData((prev) => ({ ...prev, whatsapp: e.target.value })); setErrors((curr) => ({ ...curr, whatsapp: undefined })); }} aria-invalid={Boolean(errors.whatsapp)} />{errors.whatsapp && <small className="error">{errors.whatsapp}</small>}</label>
              <label className="full-width"><span>Pas foto 3x4 (keperluan Cocard) {hasCocardProduct && <span className="required-asterisk">*</span>}</span><PhotoUploadInput key={`photo-${submitted}`} required={hasCocardProduct} error={Boolean(errors.photo)} onChange={() => setErrors((curr) => ({ ...curr, photo: undefined }))} />{errors.photo && <small className="error">{errors.photo}</small>}</label>
            </div>
          </fieldset>

          <fieldset>
            <legend><span>2</span> Produk yang dibeli</legend>
            <p className="fieldset-help">Filter kategori atau pilih langsung paket favoritmu.</p>
            
            <div className="product-tab-filter">
              <button
                type="button"
                className={`tab-btn ${productTab === "all" ? "tab-btn--active" : ""}`}
                onClick={() => setProductTab("all")}
              >
                <IconFlame className="tab-icon" /> Semua ({products.length})
              </button>
              <button
                type="button"
                className={`tab-btn tab-btn--highlight ${productTab === "bundle" ? "tab-btn--active" : ""}`}
                onClick={() => setProductTab("bundle")}
              >
                <IconSparkles className="tab-icon" /> Paket Hemat ({products.filter((p) => p.id.startsWith("paket-")).length})
              </button>
              <button
                type="button"
                className={`tab-btn ${productTab === "single" ? "tab-btn--active" : ""}`}
                onClick={() => setProductTab("single")}
              >
                <IconTag className="tab-icon" /> Eceran ({products.filter((p) => !p.id.startsWith("paket-")).length})
              </button>
            </div>

            <div className="product-check-grid">
              {sortedProductList
                .filter((p) => {
                  if (productTab === "bundle") return p.id.startsWith("paket-");
                  if (productTab === "single") return !p.id.startsWith("paket-");
                  return true;
                })
                .map((product) => {
                  const selected = selectedProducts.includes(product.id);
                  const isBestSeller = BEST_SELLER_IDS.includes(product.id);
                  return (
                    <label
                      className={`product-check ${selected ? "product-check--active" : ""} ${isBestSeller ? "product-check--highlight" : ""}`}
                      key={product.id}
                    >
                      {isBestSeller && <div className="product-best-badge"><IconFlame className="badge-icon" /> PALING LARIS</div>}
                      <input type="checkbox" name="products" value={product.id} checked={selected} onChange={() => toggleProduct(product.id)} />
                      <div className="product-check-content">
                        <div className="product-check-meta">{product.note}</div>
                        <div className="product-check-title">{product.name}</div>
                      </div>
                      <div className="product-check-right">
                        <div className="product-check-price">{rupiah(product.price)}</div>
                        <div className="product-check-badge">{selected ? "Terpilih ✓" : "Pilih +"}</div>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div
              className={`cocard-option-box ${hasCocardProduct ? "cocard-option-box--show" : ""}`}
              aria-hidden={!hasCocardProduct}
            >
              <div className="cocard-box-header">
                <span className="cocard-box-tag">Varian Cetak Cocard</span>
                <strong>Pilihan versi cetak kokard (Harga tetap sama):</strong>
              </div>
              <div className="cocard-radio-group">
                <label className={`cocard-radio ${cocardOption === "both" ? "cocard-radio--active" : ""}`}>
                  <input
                    type="radio"
                    name="cocardOption"
                    value="both"
                    checked={cocardOption === "both"}
                    onChange={() => setCocardOption("both")}
                  />
                  <div className="cocard-radio-text">
                    <strong>Dua-duanya (PKKBN Pusat + Fakultas)</strong>
                    <small>Dapatkan 2 kokard fisik sekaligus (Versi Pusat & Versi Fakultas) tanpa biaya tambahan!</small>
                  </div>
                </label>

                <label className={`cocard-radio ${cocardOption === "pusat" ? "cocard-radio--active" : ""}`}>
                  <input
                    type="radio"
                    name="cocardOption"
                    value="pusat"
                    checked={cocardOption === "pusat"}
                    onChange={() => setCocardOption("pusat")}
                  />
                  <div className="cocard-radio-text">
                    <strong>PKKBN Pusat Saja</strong>
                    <small>Cetak 1 kokard versi PKKBN Pusat UPNVYK</small>
                  </div>
                </label>

                <label className={`cocard-radio ${cocardOption === "fakultas" ? "cocard-radio--active" : ""}`}>
                  <input
                    type="radio"
                    name="cocardOption"
                    value="fakultas"
                    checked={cocardOption === "fakultas"}
                    onChange={() => setCocardOption("fakultas")}
                  />
                  <div className="cocard-radio-text">
                    <strong>PKKBN Fakultas Saja</strong>
                    <small>Cetak 1 kokard versi Fakultas yang kamu pilih</small>
                  </div>
                </label>
              </div>
            </div>

            {errors.products && <small className="error product-error">{errors.products}</small>}
          </fieldset>

          <fieldset>
            <legend><span>3</span> Pembayaran</legend>
            <div className="qris-panel">
              <div className="qris-mark qris-mark--img">
                <img src={qrisLogo} alt="Logo QRIS" />
              </div>
              <div><strong>QRIS</strong><p>Kode QRIS pembayaran resmi akan dibagikan di grup WhatsApp setelah form dikirim.</p></div>
              <span className="only-badge">Satu-satunya metode</span>
            </div>
          </fieldset>

          <div className="summary">
            <div className="summary-title"><span>Ringkasan pesanan</span></div>
            {selectedItems.length ? selectedItems.map((product) => (
              <div className="summary-line" key={product.id}><span>{product.name}</span><b>{rupiah(product.price)}</b></div>
            )) : <div className="summary-empty">Belum ada produk dipilih.</div>}
            <div className="summary-line"><span>Metode pembayaran</span><b>QRIS</b></div>
            <div className="summary-total"><span>Total pembayaran</span><b>{rupiah(total)}</b></div>
            <label className="terms"><input name="agreement" type="checkbox" /><span>Saya sudah memeriksa data dan memahami bahwa saya wajib masuk grup WhatsApp setelah submit.</span></label>
            {errors.agreement && <small className="error summary-error">{errors.agreement}</small>}
            <button className="button button--submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><span className="spinner-icon" />Mengirim data...</>
              ) : (
                <>Kirim pesanan <span>→</span></>
              )}
            </button>
          </div>
        </form>
      </section>

      <section className="faq section" id="faq">
        <div className="faq-heading"><span>05</span><h2>Yang sering<br />ditanyakan.</h2></div>
        <div className="faq-list">
          <details open><summary>Produk apa saja yang tersedia?<span>+</span></summary><p>Mudahkan PKKMU! menjual Lanyard, Cocard, dan Booklet. Kamu dapat membeli satu atau beberapa produk sekaligus.</p></details>
          <details><summary>Bagaimana cara membayar?<span>+</span></summary><p>Pembayaran hanya menggunakan QRIS. Kode QR dan instruksi pembayaran akan dibagikan melalui grup WhatsApp.</p></details>
          <details><summary>Apakah harus masuk grup WhatsApp?<span>+</span></summary><p>Ya. Grup WhatsApp wajib diikuti karena seluruh informasi pembayaran, verifikasi, dan pengambilan produk disampaikan di sana.</p></details>
          <details><summary>Kapan atribut dapat diambil?<span>+</span></summary><p>Jadwal dan lokasi pengambilan akan diinformasikan oleh panitia melalui grup WhatsApp.</p></details>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark brand-mark--img">
            <img src={logoImg} alt="Mudahkan PKKMU Logo" />
          </span>
          <b>MUDAHKAN<br />PKKMU!</b>
        </div>
        <p>Portal pemesanan atribut resmi ospek UPN Veteran Yogyakarta 2026.</p>
        <div className="footer-links">
          <a href="#produk">Produk</a>
          <a href="#pesan">Form pesanan</a>
          <a href={instagramUrl} target="_blank" rel="noreferrer">Instagram @mudahkan.pkkmu ↗</a>
        </div>
        <strong>MUDAHKAN <i>PKKMU!</i></strong>
      </footer>

      {submitted && (
        <div className="modal-backdrop" role="presentation">
          <div className="qris-modal-card" role="dialog" aria-modal="true" aria-labelledby="qris-modal-title">
            {isPaid ? (
              <div className="qris-paid-success">
                <div className="paid-icon-circle paid-icon-animated">✓</div>
                <h2 className="paid-success-title">PEMBAYARAN BERHASIL!</h2>
                <p className="paid-success-lead">
                  Terima kasih kak <b>{formData.name || "Peserta"}</b>! Pembayaran sebesar <b>{rupiah(paymentData?.gross_amount || 1)}</b> telah kami terima.
                </p>
                <div className="qris-order-details" style={{ margin: "12px 0 16px", width: "100%" }}>
                  <div className="order-detail-line"><span>Order ID:</span><b>{paymentData?.order_id}</b></div>
                  <div className="order-detail-line"><span>Status:</span><b style={{ color: "#174b36" }}>LUNAS (VERIFIED)</b></div>
                </div>
                <a className="button whatsapp-button" href={whatsappGroupUrl} target="_blank" rel="noreferrer" style={{ width: "100%", marginTop: "4px" }}>
                  LANGSUNG MASUK GRUP WHATSAPP ↗
                </a>
                <button
                  type="button"
                  className="button button--cancel"
                  style={{ width: "100%", marginTop: "10px" }}
                  onClick={handleCloseAndReset}
                >
                  Tutup / Selesai
                </button>
              </div>
            ) : (
              <>
                <div className="qris-modal-top">
                  <span className="qris-badge-tag">PEMBAYARAN VIA QRIS</span>
                  <div className="qris-timer-box">
                    <span className="timer-label">Batas Waktu:</span>
                    <span className={`timer-digits ${timeLeft <= 120 ? "timer-digits--warning" : ""}`}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                </div>

                <div className="qris-card-body">
                  <div className="qris-header-row">
                    <img src={qrisLogo} alt="Logo QRIS" className="qris-brand-logo" />
                    <span className="qris-merchant-title">MIDTRANS • QRIS OFFICIAL</span>
                  </div>

                  <div className="qris-qr-wrapper">
                    {timeLeft > 0 && paymentData?.qr_url ? (
                      <img
                        src={paymentData.qr_url}
                        alt="Kode QRIS Pembayaran Midtrans"
                        className="qris-qr-code"
                      />
                    ) : (
                      <div className="qris-expired-notice">
                        <span className="expired-badge">EXPIRED</span>
                        <strong>Waktu Pembayaran Habis (10 Menit)</strong>
                        <small>Silakan tutup dan isi ulang formulir untuk membuat transaksi baru.</small>
                      </div>
                    )}
                  </div>

                  <div className="qris-merchant-notice">
                    <span className="info-badge">INFO</span>
                    <span>Saat di-scan, nama merchant resmi yang muncul adalah <b>Pempek Asli Wong Kito</b>.</span>
                  </div>

                  <div className="qris-amount-row">
                    <span>Total Pembayaran</span>
                    <strong>{rupiah(paymentData?.gross_amount || total)}</strong>
                  </div>

                  {payMode === "testing" && (
                    <div className="qris-testing-badge">MODE TESTING — TRANSAKSI UJI (RP 1)</div>
                  )}

                  <div className="qris-order-details">
                    <div className="order-detail-line"><span>Order ID:</span><b>{paymentData?.order_id || `PKKMU-${Date.now()}`}</b></div>
                    <div className="order-detail-line"><span>Merchant:</span><b>Pempek Asli Wong Kito (Midtrans)</b></div>
                    <div className="order-detail-line"><span>Metode:</span><b>QRIS (GoPay, OVO, Dana, ShopeePay, BCA, dll)</b></div>
                  </div>
                </div>

                <div className="qris-modal-actions">
                  <p className="qris-scan-help">Scan Kode QRIS menggunakan aplikasi E-Wallet atau Mobile Banking kamu.</p>
                  <div className="qris-buttons-group">
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={checkStatusNow}
                      disabled={checkingStatus}
                      style={{ background: "#e8efe9", color: "#174b36", borderColor: "#174b36", fontWeight: "bold" }}
                    >
                      {checkingStatus ? "⏳ Mengecek..." : "🔄 Cek Status Bayar"}
                    </button>
                    <button
                      type="button"
                      className="button button--cancel"
                      onClick={handleCloseAndReset}
                    >
                      Batalkan / Tutup
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeIgTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => setActiveIgTarget(null)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <span className="confirm-tag">KONFIRMASI / INSTAGRAM</span>
            <h2>Menuju ke IG?</h2>
            <p>Apakah kamu ingin mengunjungi halaman Instagram resmi <b>Mudahkan PKKMU!</b> (<code>@mudahkan.pkkmu</code>)?</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="button button--dark"
                onClick={() => {
                  window.open(instagramUrl, "_blank", "noopener,noreferrer");
                  setActiveIgTarget(null);
                }}
              >
                Ya ↗
              </button>
              <button
                type="button"
                className="button button--cancel"
                onClick={() => setActiveIgTarget(null)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
