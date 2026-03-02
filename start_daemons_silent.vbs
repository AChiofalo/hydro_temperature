Set objShell = CreateObject("WScript.Shell")
objShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""D:\progetti\hydro_temperature\start_daemons.ps1""", 0, False
Set objShell = Nothing