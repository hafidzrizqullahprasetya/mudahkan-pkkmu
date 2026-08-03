import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import logoImg from "../logo/mudahkan-atributmu.jpg";
import qrisLogo from "../logo/qris.svg";
import heroImg from "../image/kampus-upn.jpg";
import imgPusat from "../kumpulan-pkkbn/pkkbn_upnvyk.jpg";
import imgFeb from "../kumpulan-pkkbn/pkkbn_feb.jpg";
import imgFisip from "../kumpulan-pkkbn/pkkbn_fisip.jpg";
import imgFti from "../kumpulan-pkkbn/pkkbn_garuda_fti.jpg";
import imgFp from "../kumpulan-pkkbn/pkkbn_fp.jpg";
import imgFtme from "../kumpulan-pkkbn/pkkbn_ftme.jpg";

const instagramUrl = "https://www.instagram.com/mudahkan.pkkmu/";

const products = [
  {
    id: "lanyard",
    number: "01",
    name: "Lanyard",
    price: 8000,
    note: "Identitas harian",
    description: "Tali identitas bercorak hijau veteran dengan pengait kuat.",
    icon: "🪪",
  },
  {
    id: "cocard",
    number: "02",
    name: "Cocard",
    price: 10000,
    note: "Wajib ospek",
    description: "Kartu identitas peserta dengan ruang nama dan kelompok.",
    icon: "📋",
  },
  {
    id: "booklet",
    number: "03",
    name: "Booklet",
    price: 25000,
    note: "Panduan kegiatan",
    description: "Panduan ringkas agenda, denah, dan catatan kegiatan.",
    icon: "📖",
  },
];

const pkkbnScopes = [
  {
    id: "pusat",
    name: "PKKBN Pusat UPNVYK",
    type: "Universitas",
    code: "UPNVYK",
    image: imgPusat,
    instagramUrl: instagramUrl,
    description: "Layanan & kelengkapan atribut resmi ospek universitas UPN Veteran Yogyakarta.",
  },
  {
    id: "feb",
    name: "PKKBN FEB",
    type: "Fakultas Ekonomi & Bisnis",
    code: "FEB",
    image: imgFeb,
    instagramUrl: instagramUrl,
    description: "Atribut khusus kegiatan pengenalan kampus Fakultas Ekonomi dan Bisnis.",
  },
  {
    id: "fisip",
    name: "PKKBN FISIP",
    type: "Fakultas Ilmu Sosial & Ilmu Politik",
    code: "FISIP",
    image: imgFisip,
    instagramUrl: instagramUrl,
    description: "Kelengkapan atribut identitas mahasiswa baru FISIP UPN Veteran Yogyakarta.",
  },
  {
    id: "fti",
    name: "PKKBN FTI (Garuda)",
    type: "Fakultas Teknologi Industri",
    code: "FTI",
    image: imgFti,
    instagramUrl: instagramUrl,
    description: "Paket atribut ospek FTI Garuda untuk calon keteknikan dan industri.",
  },
  {
    id: "ftme",
    name: "PKKBN FTME",
    type: "Fakultas Teknologi Mineral & Energi",
    code: "FTME",
    image: imgFtme,
    instagramUrl: instagramUrl,
    description: "Kelengkapan atribut ospek Fakultas Teknologi Mineral dan Energi.",
  },
  {
    id: "fp",
    name: "PKKBN FP",
    type: "Fakultas Pertanian",
    code: "FP",
    image: imgFp,
    instagramUrl: instagramUrl,
    description: "Atribut kegiatan PKKBN untuk mahasiswa baru Fakultas Pertanian.",
  },
];

const prodiList = [
  "Teknik Geologi",
  "Teknik Pertambangan",
  "Teknik Perminyakan",
  "Teknik Lingkungan",
  "Teknik Geofisika",
  "Teknik Metalurgi",
  "Teknik Geomatika",
  "Teknik Industri",
  "S1 Teknik Kimia",
  "Informatika",
  "Sistem Informasi",
  "D3 Teknik Kimia",
  "Agroteknologi",
  "Agribisnis",
  "Ilmu Tanah",
  "Manajemen",
  "Akuntansi",
  "Ekonomi Pembangunan",
  "Ilmu Komunikasi",
  "Ilmu Administrasi Bisnis",
  "Hubungan Internasional",
  "Hubungan Masyarakat",
];

const whatsappGroupUrl = "https://chat.whatsapp.com/MudahkanPKKMUDemo";

const rupiah = (amount) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(amount);

function ProductArt({ type }) {
  return (
    <div className={`product-art product-art--${type}`} aria-hidden="true">
      <span className="art-stamp">UPN</span>
      <span className="art-year">2026</span>
      <div className="art-object">
        {type === "lanyard" && <><i>UPNVY • VETERAN • UPNVY</i><b>V</b></>}
        {type === "cocard" && <><small>PESERTA</small><b>V</b><em>NAMA / KELOMPOK</em></>}
        {type === "booklet" && <><small>BUKU PANDUAN</small><b>26</b><em>PKKBN UPNVY</em></>}
      </div>
      <span className="art-caption">BELA NEGARA</span>
    </div>
  );
}

function CustomProdiSelect({ options, value, onChange, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredOptions = options.filter((item) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return item.toLowerCase().includes(term);
  });

  return (
    <div className="custom-select-wrapper" ref={dropdownRef}>
      <input type="hidden" name="prodi" value={value} />
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? "custom-select-trigger--open" : ""} ${error ? "custom-select-trigger--error" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {value ? (
          <div className="custom-select-selected">
            <span className="select-text"><b>{value}</b></span>
          </div>
        ) : (
          <span className="select-placeholder">-- Pilih Program Studi --</span>
        )}
        <span className="select-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="custom-select-menu" role="listbox">
          <div className="custom-select-search-box">
            <input
              ref={searchInputRef}
              type="text"
              className="custom-select-search-input"
              placeholder="Cari program studi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="custom-select-options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item) => {
                const isSelected = item === value;
                return (
                  <div
                    key={item}
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? "custom-select-option--selected" : ""}`}
                    onClick={() => {
                      onChange(item);
                      setIsOpen(false);
                    }}
                  >
                    <div className="option-info">
                      <strong>{item}</strong>
                    </div>
                    {isSelected && <span className="option-check">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="custom-select-empty">
                Tidak ada program studi yang cocok dengan "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoUploadInput({ error, onChange }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selected));
      if (onChange) onChange(selected);
    }
  };

  const handleReupload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`photo-upload-wrapper ${error ? "photo-upload-wrapper--error" : ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        name="photo"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {previewUrl ? (
        <div className="photo-preview-card">
          <div className="photo-preview-frame">
            <img src={previewUrl} alt="Preview pas foto 3x4" />
            <span className="photo-ratio-badge">3x4</span>
          </div>
          <div className="photo-preview-info">
            <div className="photo-filename">{file?.name}</div>
            <div className="photo-filesize">
              {file?.size ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : ""}
            </div>
            <button
              type="button"
              className="photo-reupload-btn"
              onClick={handleReupload}
            >
              📷 Ganti foto / Upload ulang
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="photo-upload-trigger"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="upload-icon">📁</span>
          <div className="upload-text">
            <strong>Pilih Pas Foto 3x4</strong>
            <small>Format JPG, PNG, atau WEBP (Maksimal 1 foto)</small>
          </div>
        </button>
      )}
    </div>
  );
}

function CustomPkkbnSelect({ scopes, value, onChange, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedScope = scopes.find((s) => s.name === value);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredScopes = scopes.filter((scope) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      scope.name.toLowerCase().includes(term) ||
      scope.code.toLowerCase().includes(term) ||
      scope.type.toLowerCase().includes(term)
    );
  });

  return (
    <div className="custom-select-wrapper" ref={dropdownRef}>
      <input type="hidden" name="faculty" value={value} />
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? "custom-select-trigger--open" : ""} ${error ? "custom-select-trigger--error" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {selectedScope ? (
          <div className="custom-select-selected">
            <span className="select-badge">{selectedScope.code}</span>
            <span className="select-text"><b>{selectedScope.name}</b><small> • {selectedScope.type}</small></span>
          </div>
        ) : (
          <span className="select-placeholder">-- Pilih Lini PKKBN / Fakultas --</span>
        )}
        <span className="select-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="custom-select-menu" role="listbox">
          <div className="custom-select-search-box">
            <input
              ref={searchInputRef}
              type="text"
              className="custom-select-search-input"
              placeholder="Cari PKKBN atau fakultas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="custom-select-options-list">
            {filteredScopes.length > 0 ? (
              filteredScopes.map((scope) => {
                const isSelected = scope.name === value;
                return (
                  <div
                    key={scope.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? "custom-select-option--selected" : ""}`}
                    onClick={() => {
                      onChange(scope.name);
                      setIsOpen(false);
                    }}
                  >
                    <span className="option-badge">{scope.code}</span>
                    <div className="option-info">
                      <strong>{scope.name}</strong>
                      <small>{scope.type}</small>
                    </div>
                    {isSelected && <span className="option-check">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="custom-select-empty">
                Tidak ada PKKBN yang cocok dengan "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzw8Dj11JHnSGzLOQm7rB3uoJ85LVtYxh9S5GKeAvnweiPHh0lKl6Fo1V3C8KtGzOgfEw/exec";

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

function App() {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProdi, setSelectedProdi] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes timer (600 seconds)
  const [menuOpen, setMenuOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeIgTarget, setActiveIgTarget] = useState(null);

  const selectedItems = products.filter((product) => selectedProducts.includes(product.id));
  const total = selectedItems.reduce((sum, product) => sum + product.price, 0);

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
    setSelectedProducts((current) => current.includes(id)
      ? current.filter((productId) => productId !== id)
      : [...current, id]);
    setErrors((current) => ({ ...current, products: undefined }));
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

    ["name", "nim", "prodi", "faculty", "whatsapp"].forEach((field) => {
      if (!data.get(field)?.trim()) nextErrors[field] = "Bagian ini wajib diisi.";
    });
    const photoFile = data.get("photo");
    if (!photoFile || !photoFile.name || photoFile.size === 0) {
      nextErrors.photo = "Pas foto 3x4 wajib diunggah.";
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
          products: selectedItems.map((item) => item.name),
          total: total,
        };

        if (GOOGLE_SCRIPT_URL) {
          const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
          });
          const result = await res.json().catch(() => null);
          if (result && result.qr_url) {
            setPaymentData(result);
          } else {
            setPaymentData({
              qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=00020101021226680016ID.CO.MIDTRANS.WWW0118936000140000017857520215G501573755530336054002150000${total}`,
              order_id: generatedOrderId,
              gross_amount: total,
            });
          }
        } else {
          setPaymentData({
            qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=00020101021226680016ID.CO.MIDTRANS.WWW0118936000140000017857520215G501573755530336054002150000${total}`,
            order_id: generatedOrderId,
            gross_amount: total,
          });
        }
      } catch (err) {
        console.error("Gagal mengirim data ke Backend:", err);
        setPaymentData({
          qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=00020101021226680016ID.CO.MIDTRANS.WWW0118936000140000017857520215G501573755530336054002150000${total}`,
          order_id: generatedOrderId,
          gross_amount: total,
        });
      } finally {
        setIsSubmitting(false);
        setTimeLeft(600); // Reset to 10 minutes
        setSubmitted(true);
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
          <a className="button button--dark" href="#produk">Lihat produk <span>↓</span></a>
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
          {products.map((product) => {
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
              <strong>Mudahkan PKKMU!</strong> siap mencover kebutuhan atribut untuk <strong>PKKBN Pusat UPNVYK</strong> dan <strong>5 Fakultas</strong> di lingkungan kampus. Klik kartu untuk mengunjungi akun Instagram resmi.
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
              <label><span>Nama lengkap <span className="required-asterisk">*</span></span><input name="name" type="text" autoComplete="name" placeholder="Tulis nama lengkap" aria-invalid={Boolean(errors.name)} />{errors.name && <small className="error">{errors.name}</small>}</label>
              <label><span>NIM <span className="required-asterisk">*</span></span><input name="nim" type="text" inputMode="numeric" autoComplete="off" placeholder="Contoh: 111260004" aria-invalid={Boolean(errors.nim)} />{errors.nim && <small className="error">{errors.nim}</small>}</label>
              <label><span>Program Studi <span className="required-asterisk">*</span></span><CustomProdiSelect options={prodiList} value={selectedProdi} onChange={(val) => { setSelectedProdi(val); setErrors((curr) => ({ ...curr, prodi: undefined })); }} error={Boolean(errors.prodi)} />{errors.prodi && <small className="error">{errors.prodi}</small>}</label>
              <label><span>Pilihan PKKBN (Pusat / Fakultas) <span className="required-asterisk">*</span></span><CustomPkkbnSelect scopes={pkkbnScopes} value={selectedFaculty} onChange={(val) => { setSelectedFaculty(val); setErrors((curr) => ({ ...curr, faculty: undefined })); }} error={Boolean(errors.faculty)} />{errors.faculty && <small className="error">{errors.faculty}</small>}</label>
              <label className="full-width"><span>Nomor WhatsApp <span className="required-asterisk">*</span></span><input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="Contoh: 081234567890" aria-invalid={Boolean(errors.whatsapp)} />{errors.whatsapp && <small className="error">{errors.whatsapp}</small>}</label>
              <label className="full-width"><span>Pas foto 3x4 (keperluan Cocard) <span className="required-asterisk">*</span></span><PhotoUploadInput error={Boolean(errors.photo)} onChange={() => setErrors((curr) => ({ ...curr, photo: undefined }))} />{errors.photo && <small className="error">{errors.photo}</small>}</label>
            </div>
          </fieldset>

          <fieldset>
            <legend><span>2</span> Produk yang dibeli</legend>
            <p className="fieldset-help">Pilih satu atau beberapa produk.</p>
            <div className="product-check-grid">
              {products.map((product) => {
                const selected = selectedProducts.includes(product.id);
                return (
                  <label className={`product-check ${selected ? "product-check--active" : ""}`} key={product.id}>
                    <input type="checkbox" name="products" value={product.id} checked={selected} onChange={() => toggleProduct(product.id)} />
                    <div className="product-check-content">
                      <div className="product-check-meta">{product.note}</div>
                      <div className="product-check-title">{product.name}</div>
                      <div className="product-check-desc">{product.description}</div>
                    </div>
                    <div className="product-check-right">
                      <div className="product-check-price">{rupiah(product.price)}</div>
                      <div className="product-check-badge">{selected ? "Terpilih ✓" : "Pilih +"}</div>
                    </div>
                  </label>
                );
              })}
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
              {isSubmitting ? "Mengirim data..." : <>Kirim pesanan <span>→</span></>}
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
        <p>Portal demo pemesanan atribut mahasiswa baru.<br />Belum menerima transaksi nyata.</p>
        <div className="footer-links">
          <a href="#produk">Produk</a>
          <a href="#pesan">Form pesanan</a>
          <a href={instagramUrl} target="_blank" rel="noreferrer">Instagram @mudahkan.pkkmu ↗</a>
        </div>
        <strong>MUDAHKAN <i>PKKMU!</i></strong>
      </footer>

      {submitted && (
        <div className="modal-backdrop" role="presentation">
          <div className="success-modal qris-modal-card" role="dialog" aria-modal="true" aria-labelledby="qris-modal-title">
            <div className="qris-modal-top">
              <span className="qris-badge-tag">PEMBAYARAN VIA QRIS</span>
              <div className="qris-timer-box">
                <span className="timer-label">Batas Waktu:</span>
                <span className={`timer-digits ${timeLeft <= 120 ? "timer-digits--warning" : ""}`}>
                  ⏱️ {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            <div className="qris-card-body">
              <div className="qris-header-row">
                <img src={qrisLogo} alt="Logo QRIS" className="qris-brand-logo" />
                <span className="qris-merchant-title">NMK: UPN ATRIBUT OSPEK • MIDTRANS</span>
              </div>

              <div className="qris-qr-wrapper">
                {timeLeft > 0 ? (
                  <img
                    src={paymentData?.qr_url || `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=00020101021226680016ID.CO.MIDTRANS.WWW0118936000140000017857520215G501573755530336054002150000${total}`}
                    alt="Kode QRIS Pembayaran Midtrans"
                    className="qris-qr-code"
                  />
                ) : (
                  <div className="qris-expired-notice">
                    <span className="expired-icon">⌛</span>
                    <strong>Waktu Pembayaran Habis (10 Menit)</strong>
                    <small>Silakan tutup dan isi ulang formulir untuk membuat transaksi baru.</small>
                  </div>
                )}
              </div>

              <div className="qris-amount-row">
                <span>Total Pembayaran</span>
                <strong>{rupiah(paymentData?.gross_amount || total)}</strong>
              </div>

              <div className="qris-order-details">
                <div className="order-detail-line"><span>Order ID:</span><b>{paymentData?.order_id || `PKKMU-${Date.now()}`}</b></div>
                <div className="order-detail-line"><span>Metode:</span><b>QRIS (GoPay, OVO, Dana, ShopeePay, BCA, dll)</b></div>
              </div>
            </div>

            <div className="qris-modal-actions">
              <p className="qris-scan-help">Scan Kode QRIS menggunakan aplikasi E-Wallet atau Mobile Banking kamu.</p>
              <a className="button whatsapp-button" href={whatsappGroupUrl} target="_blank" rel="noreferrer">
                Sudah Bayar? Masuk grup WhatsApp <span>↗</span>
              </a>
              <button
                type="button"
                className="button button--cancel"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={() => setSubmitted(false)}
              >
                Tutup / Selesai
              </button>
            </div>
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
