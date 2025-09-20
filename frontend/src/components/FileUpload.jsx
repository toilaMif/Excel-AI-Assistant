import React, { useRef, useState } from "react";
import { FiUpload } from "react-icons/fi";

/**
 * props:
 *  - onFileUpload(file): function
 *  - loading: bool
 *  - error: string
 */
const supportedFormats = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.oasis.opendocument.spreadsheet": ".ods",
  "text/csv": ".csv",
  "text/tab-separated-values": ".tsv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template":
    ".xltx",
  "application/vnd.ms-excel.sheet.macroEnabled.12": ".xlsm",
};

const acceptedExtensions = Object.values(supportedFormats).join(",");

export default function FileUpload({ onFileUpload, loading, error }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const isFileSupported = (file) => {
    if (!file) return false;
    if (supportedFormats[file.type]) return true;
    const ext = (file.name || "").toLowerCase().split(".").pop();
    return [
      "xlsx",
      "xls",
      "csv",
      "tsv",
      "ods",
      "fods",
      "xlsm",
      "xltx",
      "xltm",
    ].includes(ext);
  };

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isFileSupported(f)) {
      alert(`Vui lòng chọn file spreadsheet hợp lệ (${acceptedExtensions})`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(f);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isFileSupported(f)) {
      alert(`Vui lòng thả file spreadsheet hợp lệ (${acceptedExtensions})`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(f);
  }

  function handlePickClick() {
    fileInputRef.current?.click();
  }

  function handleUpload() {
    if (!selectedFile) {
      alert("Chưa chọn file");
      return;
    }
    onFileUpload(selectedFile);
  }

  return (
    <div
      className="file-upload"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") handlePickClick();
      }}
    >
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept={acceptedExtensions}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <div className="upload-inner" onClick={handlePickClick}>
        <FiUpload size={36} />
        <h2>Upload Spreadsheet</h2>
        <p className="muted">Kéo & thả file ở đây hoặc click để chọn</p>
        <p className="muted small">
          Supported: XLSX, XLS, CSV, TSV, ODS, XLSM...
        </p>

        {selectedFile && (
          <div className="selected-file">Selected: {selectedFile.name}</div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ marginTop: 12 }}>
        <button
          className="btn"
          onClick={handleUpload}
          disabled={!selectedFile || loading}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
}
