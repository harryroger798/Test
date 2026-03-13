; Custom NSIS installer script for GrabTube
; Handles shortcuts and app launch manually to fix path issues
; with allowToChangeInstallationDirectory

!macro customInit
  SetDetailsPrint listonly
  DetailPrint "Preparing GrabTube installation..."
!macroend

!macro customInstall
  SetDetailsPrint listonly
  DetailPrint "Installing GrabTube application files..."

  ; Create desktop shortcut pointing to correct $INSTDIR
  CreateShortCut "$DESKTOP\GrabTube.lnk" "$INSTDIR\GrabTube.exe" "" "$INSTDIR\GrabTube.exe" 0

  ; Create start menu shortcuts
  CreateDirectory "$SMPROGRAMS\GrabTube"
  CreateShortCut "$SMPROGRAMS\GrabTube\GrabTube.lnk" "$INSTDIR\GrabTube.exe" "" "$INSTDIR\GrabTube.exe" 0
  CreateShortCut "$SMPROGRAMS\GrabTube\Uninstall GrabTube.lnk" "$INSTDIR\Uninstall GrabTube.exe"

  ; Launch app after install
  ExecShell "" "$INSTDIR\GrabTube.exe"
!macroend

!macro customUnInstall
  SetDetailsPrint listonly
  DetailPrint "Removing GrabTube..."

  ; Clean up shortcuts
  Delete "$DESKTOP\GrabTube.lnk"
  Delete "$SMPROGRAMS\GrabTube\GrabTube.lnk"
  Delete "$SMPROGRAMS\GrabTube\Uninstall GrabTube.lnk"
  RMDir "$SMPROGRAMS\GrabTube"
!macroend
