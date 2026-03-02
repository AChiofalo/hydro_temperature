from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from db import get_connection
from pydantic import BaseModel
from typing import List, Optional
import time
import json


app = FastAPI(title="Home Projects API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Assets (CSS, JS, Images)
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

# Public Routes
@app.get("/")
def root():
    return FileResponse("static/pages/index.html")

@app.get("/dashboard")
def dashboard_page():
    return FileResponse("static/pages/dashboard.html")

@app.get("/expenses")
def expenses_page():
    return FileResponse("static/pages/expenses.html")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/climate/monthly")
def monthly_stats():
    conn = get_connection()
    cur = conn.cursor()
    
    # SQLite query to group by month
    cur.execute("""
        SELECT 
            strftime('%Y-%m', datetime(ts, 'unixepoch')) as month,
            AVG(temperature) as avg_temp,
            MIN(temperature) as min_temp,
            MAX(temperature) as max_temp,
            AVG(humidity) as avg_hum,
            MIN(humidity) as min_hum,
            MAX(humidity) as max_hum,
            COUNT(*) as record_count
        FROM measurements
        GROUP BY month
        ORDER BY month DESC
    """)
    rows = cur.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        results.append({
            "month": row["month"],
            "avg_temp": round(row["avg_temp"], 1) if row["avg_temp"] else None,
            "min_temp": row["min_temp"],
            "max_temp": row["max_temp"],
            "avg_hum": round(row["avg_hum"], 1) if row["avg_hum"] else None,
            "min_hum": row["min_hum"],
            "max_hum": row["max_hum"],
            "record_count": row["record_count"]
        })
    return results

@app.get("/climate/history")
def get_history(start_ts: int = 0, end_ts: int = None):
    if end_ts is None:
        import time
        end_ts = int(time.time())

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT ts, temperature, humidity
        FROM measurements
        WHERE ts BETWEEN ? AND ?
        ORDER BY ts ASC
    """, (start_ts, end_ts))
    
    rows = cur.fetchall()
    conn.close()

    data = []
    for row in rows:
        data.append({
            "ts": row["ts"],
            "temperature": row["temperature"],
            "humidity": row["humidity"]
        })
    return data

@app.get("/climate/latest")
def latest_measurement():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT ts, temperature, humidity
        FROM measurements
        ORDER BY ts DESC
        LIMIT 1
    """)
    row = cur.fetchone()
    conn.close()

    if row is None:
        return {}

    return {
        "ts": row["ts"],
        "temperature": row["temperature"],
        "humidity": row["humidity"]
    }

# --- EXPENSE TRACKER ENDPOINTS ---

class ExpenseItemModel(BaseModel):
    product_name: str
    price: float
    unit: str
    quantity: float

class ExpenseModel(BaseModel):
    store_name: str
    location: Optional[str] = ""
    purchase_date: str
    total_amount: float
    items: List[ExpenseItemModel]

@app.post("/api/expenses/upload")
async def upload_receipt(file: UploadFile = File(...)):
    # In a real scenario, this would send the image to an AI model (OpenAI/Gemini)
    # to extract text. For now, we return a mock response to demonstrate the flow.
    time.sleep(1.5) # Simulate processing time
    
    # Mock AI response
    return {
        "store_name": "Supermercato Esempio",
        "location": "Milano",
        "purchase_date": time.strftime("%Y-%m-%d"),
        "total_amount": 25.50,
        "items": [
            {"product_name": "Mele Golden", "price": 1.50, "unit": "kg", "quantity": 1.2},
            {"product_name": "Latte Intero", "price": 1.20, "unit": "l", "quantity": 2.0},
            {"product_name": "Pane", "price": 3.00, "unit": "kg", "quantity": 0.5},
            {"product_name": "Pasta", "price": 1.10, "unit": "pz", "quantity": 2.0}
        ]
    }

@app.post("/api/expenses/confirm")
def save_expense(expense: ExpenseModel):
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Insert Header
        cur.execute("""
            INSERT INTO expense_headers (store_name, location, purchase_date, total_amount, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (expense.store_name, expense.location, expense.purchase_date, expense.total_amount, int(time.time())))
        
        header_id = cur.lastrowid
        
        # Insert Items
        for item in expense.items:
            cur.execute("""
                INSERT INTO expense_items (header_id, product_name, price, unit, quantity, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (header_id, item.product_name, item.price, item.unit, item.quantity, int(time.time())))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
        
    return {"status": "success", "id": header_id}

@app.get("/api/expenses/all")
def get_all_expenses():
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, store_name, location, purchase_date, total_amount 
        FROM expense_headers 
        ORDER BY purchase_date DESC
    """)
    rows = cur.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "store_name": row["store_name"],
            "location": row["location"],
            "purchase_date": row["purchase_date"],
            "total_amount": row["total_amount"]
        })
    return results

@app.get("/api/expenses/{expense_id}")
def get_expense_details(expense_id: int):
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM expense_headers WHERE id = ?", (expense_id,))
    header = cur.fetchone()
    
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")
        
    cur.execute("SELECT * FROM expense_items WHERE header_id = ?", (expense_id,))
    items = cur.fetchall()
    conn.close()
    
    return {
        "header": {
            "id": header["id"],
            "store_name": header["store_name"],
            "location": header["location"],
            "purchase_date": header["purchase_date"],
            "total_amount": header["total_amount"]
        },
        "items": [
            {
                "product_name": row["product_name"],
                "price": row["price"],
                "unit": row["unit"],
                "quantity": row["quantity"]
            }
            for row in items
        ]
    }
