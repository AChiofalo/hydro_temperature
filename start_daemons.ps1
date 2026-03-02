$BASEDIR = "D:\progetti\hydro_temperature"
$LOGFILE = "$BASEDIR\startup.log"

Add-Content -Path $LOGFILE -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Avvio daemon..."

try {
    Start-Process -FilePath "$BASEDIR\.venv\bin\python.exe" -ArgumentList "$BASEDIR\collector.py" -WorkingDirectory $BASEDIR -WindowStyle Hidden -RedirectStandardOutput "$BASEDIR\collector.out.log" -RedirectStandardError "$BASEDIR\collector.err.log"
    Add-Content -Path $LOGFILE -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Collector avviato"
    
    Start-Process -FilePath "$BASEDIR\.venv\bin\uvicorn.exe" -ArgumentList "api:app","--host","127.0.0.1","--port","8000" -WorkingDirectory $BASEDIR -WindowStyle Hidden -RedirectStandardOutput "$BASEDIR\uvicorn.out.log" -RedirectStandardError "$BASEDIR\uvicorn.err.log"
    Add-Content -Path $LOGFILE -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Uvicorn avviato"
} catch {
    Add-Content -Path $LOGFILE -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERRORE: $_"
}

Add-Content -Path $LOGFILE -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Script completato"