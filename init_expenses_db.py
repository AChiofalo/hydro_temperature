import sqlite3
import time

DB_FILE = "climate.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    # Create Expense Header Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS expense_headers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_name TEXT,
        location TEXT,
        purchase_date TEXT,
        total_amount REAL,
        created_at INTEGER
    )
    """)

    # Create Expense Items Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS expense_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        header_id INTEGER,
        product_name TEXT,
        price REAL,
        unit TEXT,
        quantity REAL,
        created_at INTEGER,
        FOREIGN KEY(header_id) REFERENCES expense_headers(id)
    )
    """)

    conn.commit()
    conn.close()
    print("Expense tables created successfully.")

if __name__ == "__main__":
    init_db()
