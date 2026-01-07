from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from db import get_connection

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
