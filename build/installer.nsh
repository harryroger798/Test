; Custom NSIS installer script for GrabTube
; Handles large installer extraction (~500MB+ with bundled binaries)

!macro customInit
  ; Increase extraction buffer for large installers
  SetDetailsPrint listonly
  DetailPrint "Preparing GrabTube installation..."
!macroend

!macro customInstall
  SetDetailsPrint listonly
  DetailPrint "Installing GrabTube application files..."
!macroend

!macro customUnInstall
  SetDetailsPrint listonly
  DetailPrint "Removing GrabTube..."
!macroend
