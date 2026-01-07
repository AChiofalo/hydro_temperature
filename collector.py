import serial
import sqlite3
import time
from datetime import datetime

SERIAL_PORT = "COM3"
BAUDRATE = 9600
DB_FILE = "climate.db"

# DB setup
conn = sqlite3.connect(DB_FILE)
cur = conn.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS measurements (
    ts INTEGER PRIMARY KEY,
    temperature INTEGER NOT NULL,
    humidity INTEGER NOT NULL
)
""")
conn.commit()

# Serial setup
ser = serial.Serial(SERIAL_PORT, BAUDRATE, timeout=1)

print("Collector avviato...")

while True:
    line = ser.readline().decode("utf-8").strip()
    if not line:
        continue

    try:
        temp, hum = line.split(";")
        temp = int(temp)
        hum = int(hum)
        ts = int(time.time())
        # ts = datetime.now().isoformat(timespec="milliseconds")



        cur.execute(
            "INSERT INTO measurements VALUES (?, ?, ?)",
            (ts, temp, hum)
        )
        conn.commit()

        print(ts, temp, hum)

    except Exception as e:
        print("Errore parsing:", line, e)
