import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import ChatInterface from "./components/ChatInterface";
import "./App.css";
import axios from "axios";
// import ExportButton from "./components/ExportButton";

function App() {
  const [tableData, setTableData] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://127.0.0.1:8000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Upload thành công:", res.data);

      const sessionId = res.data.session_id;
      setSessionId(sessionId);
      // Gọi API preview để lấy dữ liệu
      const previewRes = await axios.get(
        `http://127.0.0.1:8000/preview/${sessionId}?limit=20000`
      );

      console.log("Preview:", previewRes.data);
      setTableData(previewRes.data); // lưu preview
    } catch (err) {
      console.error("Lỗi upload:", err);
      alert("Upload thất bại!");
    }
  };
  const handleExport = async (filetype = "csv") => {
    const res = await fetch(
      `http://localhost:8000/export/${sessionId}?filetype=${filetype}`
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export.${filetype}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      console.error("Export thất bại");
    }
  };

  // Hàm quay lại upload
  const handleBack = () => {
    setTableData(null);
  };

  return (
    <>
      <div className="Excel_Spreadsheet">
        <h1>Excel Spreadsheet</h1>

        {/* Nếu chưa upload thì hiện form upload */}
        {!tableData && (
          <FileUpload
            onFileUpload={handleFileUpload}
            loading={false}
            error={null}
          />
        )}

        {/* Nếu đã upload thì hiện bảng dữ liệu */}
        {tableData && (
          <div className="data-frame">
            <div className="table-container">
              <table border="1" cellPadding="5">
                <thead>
                  <tr>
                    {tableData.columns.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {tableData.columns.map((col, colIdx) => (
                        <td
                          key={colIdx}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newValue = e.target.innerText;
                            const newRows = [...tableData.rows];
                            newRows[rowIdx] = {
                              ...newRows[rowIdx],
                              [col]: newValue,
                            };
                            setTableData({ ...tableData, rows: newRows });
                            axios.post(
                              `http://127.0.0.1:8000/update/${sessionId}`,
                              {
                                row_idx: rowIdx,
                                column: col,
                                value: e.target.innerText,
                              }
                            );
                          }}
                        >
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Nút quay lại */}

        {tableData && (
          <button className="back-btn" onClick={handleBack}>
            ⬅ Quay lại Upload
          </button>
        )}
        {/* {tableData && <ExportButton sessionId={sessionId} />} */}
      </div>

      <div className="ChatInterface">
        <h1>Excel Assistant</h1>

        <ChatInterface />
        <p className="information">
          Made by Mif - <a href="https://github.com/toilamif">GitHub</a> -{" "}
          <a href="">LinkedIn</a>
        </p>
      </div>
    </>
  );
}

export default App;
