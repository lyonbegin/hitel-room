from pathlib import Path
import shutil,sys
root=Path(sys.argv[1])
base=root/"Android/src/app/src/main/java/com/google/ai/edge/gallery"
here=Path(__file__).resolve().parent
shutil.copy2(here/"HitelMobileActionsLocal.kt",base/"ui/common/HitelMobileActionsLocal.kt")
p=base/"ui/common/DownloadAndTryButton.kt"
s=p.read_text()
anchor="  when {\n    isPaused -> {"
assert s.count(anchor)==1
s=s.replace(anchor,'''  when {
    HitelMobileActionsImport.matches(model) && needToDownloadFirst &&
      !showDownloadProgress && !inProgress -> {
      HitelMobileActionsLocalButton(
        model = model,
        manager = modelManagerViewModel,
        onOnlineDownload = onDownloadButtonClicked,
        onlineEnabled = buttonEnabled,
        modifier = modifier,
      )
    }
    isPaused -> {''',1)
p.write_text(s)
print("HITEL_MOBILE_ACTIONS_LOCAL_PICKER_INTEGRATED")
