import { useState, useRef } from "react";
import { IconCamera, IconFolderUpload } from "./Icons";

export function PhotoUploadInput({ error, onChange }) {
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
              <IconCamera style={{ marginRight: "6px", verticalAlign: "middle" }} /> Ganti foto / Upload ulang
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="photo-upload-trigger"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="upload-icon"><IconFolderUpload /></span>
          <div className="upload-text">
            <strong>Pilih Pas Foto 3x4</strong>
            <small>Format JPG, PNG, atau WEBP (Maksimal 1 foto)</small>
          </div>
        </button>
      )}
    </div>
  );
}

