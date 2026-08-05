import imgPusat from "../kumpulan-pkkbn/pkkbn_upnvyk.jpg";
import imgFeb from "../kumpulan-pkkbn/pkkbn_feb.jpg";
import imgFisip from "../kumpulan-pkkbn/pkkbn_fisip.jpg";
import imgFti from "../kumpulan-pkkbn/pkkbn_garuda_fti.jpg";
import imgFp from "../kumpulan-pkkbn/pkkbn_fp.jpg";
import imgFtme from "../kumpulan-pkkbn/pkkbn_ftme.jpg";

export const instagramUrl = "https://www.instagram.com/mudahkan.pkkmu/";



export const products = [
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
  {
    id: "paket-lc",
    number: "04",
    name: "Paket Starter (Lanyard + Cocard)",
    price: 15000,
    note: "Hemat 3K",
    description: "Paket hemat identitas ospek: Tali lanyard bercorak veteran + Kartu kokard peserta.",
    icon: "✨",
  },
  {
    id: "paket-lb",
    number: "05",
    name: "Paket Eko (Lanyard + Booklet)",
    price: 30000,
    note: "Hemat 3K",
    description: "Tali lanyard bercorak hijau veteran + Buku panduan agenda kegiatan PKKBN.",
    icon: "📚",
  },
  {
    id: "paket-cb",
    number: "06",
    name: "Paket Duo (Cocard + Booklet)",
    price: 32000,
    note: "Hemat 3K",
    description: "Kartu kokard identitas peserta + Buku panduan agenda kegiatan PKKBN lengkap.",
    icon: "📝",
  },
  {
    id: "paket-lengkap",
    number: "07",
    name: "Paket Lengkap (Lanyard + Cocard + Booklet)",
    price: 38000,
    note: "Paling Laris (Hemat 5K)",
    description: "Set komplit seluruh atribut ospek: Lanyard, Cocard, dan Booklet PKKBN UPNVY.",
    icon: "🔥",
  },
];



export const productItems = {
  lanyard: ["lanyard"],
  cocard: ["cocard"],
  booklet: ["booklet"],
  "paket-lc": ["lanyard", "cocard"],
  "paket-lb": ["lanyard", "booklet"],
  "paket-cb": ["cocard", "booklet"],
  "paket-lengkap": ["lanyard", "cocard", "booklet"],
};


export const BEST_SELLER_IDS = ["paket-lengkap", "paket-lc"];


export const COCARD_PRODUCT_IDS = Object.entries(productItems)
  .filter(([, items]) => items.includes("cocard"))
  .map(([id]) => id);



export const pkkbnScopes = [
  {
    id: "feb",
    name: "PKKBN FEB",
    type: "Fakultas Ekonomi & Bisnis",
    code: "FEB",
    image: imgFeb,
    instagramUrl: instagramUrl,
    description: "Atribut khusus kegiatan pengenalan kampus Fakultas Ekonomi dan Bisnis.",
    prodis: ["Manajemen", "Akuntansi", "Ekonomi Pembangunan"],
  },
  {
    id: "fisip",
    name: "PKKBN FISIP",
    type: "Fakultas Ilmu Sosial & Ilmu Politik",
    code: "FISIP",
    image: imgFisip,
    instagramUrl: instagramUrl,
    description: "Kelengkapan atribut identitas mahasiswa baru FISIP UPN Veteran Yogyakarta.",
    prodis: [
      "Ilmu Komunikasi",
      "Ilmu Administrasi Bisnis",
      "Hubungan Internasional",
      "Hubungan Masyarakat",
    ],
  },
  {
    id: "fti",
    name: "PKKBN FTI (Garuda)",
    type: "Fakultas Teknologi Industri",
    code: "FTI",
    image: imgFti,
    instagramUrl: instagramUrl,
    description: "Paket atribut ospek FTI Garuda untuk calon keteknikan dan industri.",
    prodis: ["Teknik Industri", "S1 Teknik Kimia", "Informatika", "Sistem Informasi", "D3 Teknik Kimia"],
  },
  {
    id: "ftme",
    name: "PKKBN FTME",
    type: "Fakultas Teknologi Mineral & Energi",
    code: "FTME",
    image: imgFtme,
    instagramUrl: instagramUrl,
    description: "Kelengkapan atribut ospek Fakultas Teknologi Mineral dan Energi.",
    prodis: [
      "Teknik Geologi",
      "Teknik Pertambangan",
      "Teknik Perminyakan",
      "Teknik Lingkungan",
      "Teknik Geofisika",
      "Teknik Geomatika",
      "Teknik Metalurgi",
    ],
  },
  {
    id: "fp",
    name: "PKKBN FP",
    type: "Fakultas Pertanian",
    code: "FP",
    image: imgFp,
    instagramUrl: instagramUrl,
    description: "Atribut kegiatan PKKBN untuk mahasiswa baru Fakultas Pertanian.",
    prodis: ["Agroteknologi", "Agribisnis", "Ilmu Tanah"],
  },
];


export const whatsappGroupUrl = "https://chat.whatsapp.com/IARvfdegaWUEUwiJ42roiN?s=cl&p=i&ilr=2";
