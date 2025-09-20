import os, shutil
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from pydantic import BaseModel
import uuid
import requests
import re
import traceback

app = FastAPI()

# -----------------------------
# Cấu hình thư mục tạm
# -----------------------------
UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# Session memory
SESSIONS = {}

def cleanup_uploads():
    """Xóa toàn bộ thư mục con trong uploads"""
    for folder in os.listdir(UPLOAD_DIR):
        folder_path = os.path.join(UPLOAD_DIR, folder)
        if os.path.isdir(folder_path):
            shutil.rmtree(folder_path)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# -----------------------------
# Upload file
# -----------------------------
@app.post("/upload")
async def upload_excel(file: UploadFile = File(...)):

    cleanup_uploads()
    SESSIONS.clear() 
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".csv")):
        return JSONResponse(content={"error": "Chỉ hỗ trợ .xlsx hoặc .csv"}, status_code=400)

    # Tạo session_id
    session_id = str(uuid.uuid4())
    session_folder = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_folder, exist_ok=True)

    file_path = os.path.join(session_folder, file.filename)

    # Lưu file
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Đọc file thành pandas DataFrame
    if file.filename.endswith(".xlsx"):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    # Lưu session vào memory
    SESSIONS[session_id] = {"folder": session_folder, "file_path": file_path, "df": df}

    return {
        "session_id": session_id,
        "filename": file.filename,
        "columns": df.columns.tolist(),
        "rows": len(df)
    }

# -----------------------------
# Preview
# -----------------------------
@app.get("/preview/{session_id}")
async def preview_data(session_id: str, limit: int = 2000):
    if session_id not in SESSIONS:
        return JSONResponse({"error": "Session không tồn tại"}, status_code=404)

    df = SESSIONS[session_id].get("df")
    if df is None:
        return JSONResponse({"error": "Không có dữ liệu"}, status_code=400)

    preview_df = df.head(limit)
    preview_df = preview_df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(preview_df), None)
    rows = [
        {col: (None if isinstance(val, float) and (pd.isna(val) or val in [np.inf, -np.inf]) else val)
         for col, val in row.items()}
        for row in preview_df.to_dict(orient="records")
    ]
    return {"columns": preview_df.columns.tolist(), "rows": rows, "total_rows": len(df)}

# -----------------------------
# Export
# -----------------------------
@app.get("/export/{session_id}")
async def export_data(session_id: str, filetype: str = "csv"):
    if session_id not in SESSIONS:
        return {"error": "Session không tồn tại"}
    df = SESSIONS[session_id]["df"]
    if df is None:
        return {"error": "Không có dữ liệu để export"}

    session_folder = SESSIONS[session_id]["folder"]
    filename = f"output.{filetype}"
    filepath = os.path.join(session_folder, filename)

    try:
        if filetype == "csv":
            df.to_csv(filepath, index=False)
        elif filetype == "xlsx":
            df.to_excel(filepath, index=False)
        else:
            return {"error": "Chỉ hỗ trợ csv hoặc xlsx"}
    except Exception as e:
        return {"error": str(e)}

    return FileResponse(path=filepath, filename=filename, media_type="application/octet-stream")

# -----------------------------
# Update cell
# -----------------------------
class UpdateCellRequest(BaseModel):
    row_idx: int
    column: str
    value: str

@app.post("/update/{session_id}")
async def update_cell(session_id: str, req: UpdateCellRequest):
    if session_id not in SESSIONS:
        return {"error": "Session không tồn tại"}
    df = SESSIONS[session_id]["df"]
    if df is None:
        return {"error": "Không có dữ liệu"}

    try:
        df.at[req.row_idx, req.column] = req.value
        SESSIONS[session_id]["df"] = df
    except Exception as e:
        return {"error": str(e)}

    return {"message": "Cập nhật thành công"}


# -----------------------------
# Model Generation code
# -----------------------------
# Mô hình request
class RunRequest(BaseModel):
    instruction: str

# -----------------------------
# Hàm helper gọi API và trích code
# -----------------------------
def fetch_code_from_api(instruction: str, url: str, timeout: int = 180) -> str:
    """
    Gọi API sinh code từ instruction, trả về code Python sạch.
    """
    try:
        response = requests.post(url, json={"instruction": instruction}, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        
        # Lấy raw response
        raw_response = data.get("response") or data.get("code") or ""

        # Trích code từ ### Response: hoặc ```python ... ```
        code = ""
        if "### Response:" in raw_response:
            match = re.search(r"### Response:\n(.+?)(?:\n###|$)", raw_response, re.DOTALL)
            if match:
                code = match.group(1).strip()
        elif "```python" in raw_response:
            match = re.search(r"```python\n(.+?)```", raw_response, re.DOTALL)
            if match:
                code = match.group(1).strip()
        else:
            code = raw_response.strip()  

        return code

    except requests.exceptions.Timeout:
        raise Exception("Server không phản hồi trong thời gian quy định")
    except requests.exceptions.ConnectionError:
        raise Exception("Không kết nối được server")
    except requests.exceptions.HTTPError as e:
        raise Exception(f"Lỗi HTTP {e.response.status_code}: {e.response.text}")
    except Exception as e:
        raise Exception(f"Lỗi khác: {str(e)}")


# -----------------------------
# Endpoint /run sử dụng hàm helper
# -----------------------------
@app.post("/run")
async def run_instruction(req: RunRequest):
    instruction = req.instruction
    try:
        code = fetch_code_from_api(
            instruction, 
            url="https://f8bd6e11ef07.ngrok-free.app/generate", # đây là API của model, chạy trên kaggle vì máy k có GPU
            timeout=180
        )

        if not code:
            return JSONResponse(
                content={"instruction": instruction, "code": None, "error": "No code returned"},
                status_code=500
            )

        return {"instruction": instruction, "code": code}

    except Exception as e:
        return JSONResponse(
            content={"instruction": instruction, "code": None, "error": str(e)},
            status_code=500
        )
# -----------------------------
# run_excel_code
# -----------------------------
class RunExcelCodeRequest(BaseModel):
    session_id: str
    code: str
import io, base64
import matplotlib.pyplot as plt



@app.post("/run_excel_code")
async def run_excel_code(req: RunExcelCodeRequest):
    session_id = req.session_id
    code = req.code

    if session_id not in SESSIONS:
        return JSONResponse({"error": "Session không tồn tại"}, status_code=404)

    session = SESSIONS[session_id]
    df = session.get("df")
    file_path = session.get("file_path")

    if df is None or file_path is None:
        return JSONResponse({"error": "Không có DataFrame trong session"}, status_code=400)

    
    stdout_buffer = io.StringIO()
    safe_builtins = {"print": lambda *args, **kwargs: print(*args, **kwargs, file=stdout_buffer)}
    sandbox = {"df": df, "plt": plt, "__builtins__": safe_builtins}

    try:
        exec(code, sandbox)
        df_result = sandbox.get("df", df)

        # Cập nhật session
        SESSIONS[session_id]["df"] = df_result

        
        console_output = stdout_buffer.getvalue()

       
        img_base64 = None
        fig = plt.gcf()
        if fig.get_axes():  
            buf = io.BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode("utf-8")
            plt.close(fig)  

        # Ghi lại file (Excel hoặc CSV)
        if file_path.endswith(".xlsx"):
            df_result.to_excel(file_path, index=False)
        elif file_path.endswith(".csv"):
            df_result.to_csv(file_path, index=False)

    except Exception as e:
        return JSONResponse({
            "error": f"Chạy code lỗi: {str(e)}",
            "traceback": traceback.format_exc()
        }, status_code=500)

    return {
        "success": True,
        "session_id": session_id,
        "message": "Chạy code thành công",
        "console_output": console_output,
        "image_base64": img_base64
    }


