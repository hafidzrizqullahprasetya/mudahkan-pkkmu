export function IconFlame({ className = "svg-icon" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M12 23c-4.97 0-9-3.58-9-8 0-4.17 3.34-7.46 7.44-11.77.34-.36.95-.12.95.38 0 1.62.61 3.21 1.76 4.34 1.78-2.03 2.5-4.46 1.81-6.75-.12-.39.31-.72.65-.51C18.66 2.57 21 6.84 21 11c0 6.63-4.03 12-9 12zm0-2c3.87 0 7-4.48 7-9 0-2.81-1.39-5.91-3.14-8.08.15 2.1-.64 4.38-2.28 6.06A4.98 4.98 0 0 1 12 11.5c-1.38 0-2.5-1.12-2.5-2.5 0-.58.2-1.12.55-1.55C7.94 10.92 5 13.56 5 15c0 3.31 3.13 6 7 6z" />
    </svg>
  );
}

export function IconSparkles({ className = "svg-icon" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M12 3l2.25 5.25L19.5 10.5l-5.25 2.25L12 18l-2.25-5.25L4.5 10.5l5.25-2.25L12 3zm6 12l1.125 2.625L21.75 18.75l-2.625 1.125L18 22.5l-1.125-2.625-2.625-1.125 2.625-1.125L18 15zm-12 0l1.125 2.625L9.75 18.75l-2.625 1.125L6 22.5l-1.125-2.625-2.625-1.125 2.625-1.125L6 15z" />
    </svg>
  );
}

export function IconTag({ className = "svg-icon" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
    </svg>
  );
}

export function IconCamera(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  );
}

export function IconFolderUpload(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>
      <path d="M12 10v6m-3-3l3-3 3 3"/>
    </svg>
  );
}

export function ProductArt({ type }) {
  return (
    <div className={`product-art product-art--${type}`} aria-hidden="true">
      <span className="art-stamp">UPN</span>
      <span className="art-year">2026</span>
      <div className="art-object">
        {type === "lanyard" && <><i>UPNVY • VETERAN • UPNVY</i><b>V</b></>}
        {type === "cocard" && <><small>PESERTA</small><b>V</b><em>NAMA / KELOMPOK</em></>}
        {type === "booklet" && <><small>BUKU PANDUAN</small><b>26</b><em>PKKBN UPNVY</em></>}
        {type === "paket-lc" && <><small>PAKET STARTER</small><b>15K</b><em>LANYARD + COCARD</em></>}
        {type === "paket-lb" && <><small>PAKET EKO</small><b>30K</b><em>LANYARD + BOOKLET</em></>}
        {type === "paket-cb" && <><small>PAKET DUO</small><b>32K</b><em>COCARD + BOOKLET</em></>}
        {type === "paket-lengkap" && <><small>PAKET LENGKAP</small><b>38K</b><em>SET KOMPLIT PKKBN</em></>}
      </div>
      <span className="art-caption">BELA NEGARA</span>
    </div>
  );
}

