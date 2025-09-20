import React from "react";
import { exportData } from "../services/api"; // đúng path + đúng tên hàm

function ExportButton({ sessionId }) {
  if (!sessionId) return null;

  const handleExport = async (filetype) => {
    try {
      await exportData(sessionId, filetype);
    } catch (err) {
      console.error("Export thất bại:", err);
    }
  };

  return (
    <div style={{ marginTop: "10px" }}>
      <button onClick={() => handleExport("csv")}>Export CSV</button>
      <button
        onClick={() => handleExport("xlsx")}
        style={{ marginLeft: "10px" }}
      >
        Export Excel
      </button>
    </div>
  );
}

export default ExportButton;
