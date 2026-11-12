@echo off
rem Makes the TV bridge start automatically (minimized) when you sign in to Windows.
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\Bug-Lizzer TV bridge.vbs" echo CreateObject("WScript.Shell").Run """%~dp0Start TV bridge.bat""", 7, False
echo Done. The TV bridge will start by itself when you sign in to Windows.
echo (To undo: delete "Bug-Lizzer TV bridge.vbs" from %STARTUP%)
pause
