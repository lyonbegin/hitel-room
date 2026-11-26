"""Connect the offline reader to the normal viewer of the pinned 4.3.11(2) build."""
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
pkg = "com/eduzone/eduzoneviewer/ui/activities/"
helper = "Lcom/hitel/zocbodiag/PrivatePapers;"

def edit(path, method, transform):
    candidates = [p for folder in root.glob("smali*") if (p := folder / path).is_file()]
    if len(candidates) != 1:
        raise ValueError("Expected one class: " + path)
    file = candidates[0]
    source = file.read_text()
    methods = list(re.finditer(r"(?ms)^\.method[^\n]*" + re.escape(method) + r"\s*\n.*?^\.end method", source))
    if len(methods) != 1:
        raise ValueError("Expected one method: " + method)
    match = methods[0]
    updated = transform(match[0])
    file.write_text(source[:match.start()] + updated + source[match.end():])
    print(path, method)

def insert(source, pattern, code, after=True):
    matches = list(re.finditer(pattern, source, re.M))
    if len(matches) != 1:
        raise ValueError("Unexpected match count %d for %s" % (len(matches), pattern))
    at = matches[0].end() if after else matches[0].start()
    return source[:at] + "\n" + code.strip("\n") + "\n" + source[at:]

def setup(source, viewer):
    code = """
    invoke-static {p0}, HELPER->offlineLaunch(Landroid/app/Activity;)Z
    move-result v0
    if-eqz v0, :hitel_normal_open
    return-void
    :hitel_normal_open
"""
    if viewer:
        code += """
    invoke-virtual {p0}, Lcom/eduzone/eduzoneviewer/ui/activities/ViewerActivity;->Y()Ly3/Y0;
    move-result-object v0
    invoke-static {p0, v0}, HELPER->begin(Landroid/app/Activity;Ljava/lang/Object;)V
"""
    return insert(source, r"^    invoke-super \{p0, p1\}, Li3/[xy];->onCreate\(Landroid/os/Bundle;\)V$", code.replace("HELPER",helper))

edit(pkg+"SplashActivity.smali", "onCreate(Landroid/os/Bundle;)V", lambda s:setup(s,False))
edit(pkg+"ViewerActivity.smali", "onCreate(Landroid/os/Bundle;)V", lambda s:setup(s,True))

def save_only(source):
    # This is the observer of the actual viewer model. The original website and
    # viewer have already handled selection, the account and the model request.
    anchor = r"^    invoke-virtual \{v1\}, Lv3/P;->u\(\)Ljava/lang/String;\s*\n(?:\s*\.line \d+\s*\n)*\s*move-result-object v4$"
    # v6 remains live on the original ON branch. Save all the original
    # registers by moving OFF handling into a separate method.
    code = """
    invoke-static {v1}, Lcom/hitel/zocbodiag/Diag;->questionModel(Ljava/lang/Object;)V
    invoke-static {v2, v1, v4}, Lcom/hitel/zocbodiag/ViewerPaperHooks;->saveIfSelected(Lcom/eduzone/eduzoneviewer/ui/activities/ViewerActivity;Lv3/P;Ljava/lang/String;)Z
    move-result v5
    if-eqz v5, :hitel_display_paper
    sget-object v5, Lkotlin/Unit;->a:Lkotlin/Unit;
    return-object v5
    :hitel_display_paper
"""
    # The original instruction following move-result-object v4 obtains the
    # layout, overwriting v5 before any read of it.
    after = re.search(anchor, source, re.M)
    if not after or not re.match(r"(?:\s*\.line \d+)*\s*invoke-virtual \{v2\}, Ll3/d;->A\(\)LL0/j;\s*(?:\.line \d+\s*)*move-result-object v5", source[after.end():]):
        raise ValueError("Unexpected observer register use")
    return insert(source, anchor, code)

edit("i3/z0.smali", "invoke(Ljava/lang/Object;)Ljava/lang/Object;", save_only)
edit("k1/c.smali", "onResponse(Lokhttp3/Call;Lokhttp3/Response;)V",
     lambda s:insert(s,r"^    invoke-virtual \{p1, v4\}, LU7/j;->resumeWith\(Ljava/lang/Object;\)V$",
                     "    invoke-static {v2, v4, p2}, "+helper+"->received(Ljava/lang/Object;Ljava/io/File;Ljava/lang/Object;)V",False))

def stop_render(source):
    return insert(source, r"^    check-cast v2, Ljava/io/File;$", """
    invoke-static {v12}, HELPER->saving(Ljava/lang/Object;)Z
    move-result v5
    if-eqz v5, :hitel_render_file
    sget-object v5, Lkotlin/Unit;->a:Lkotlin/Unit;
    return-object v5
    :hitel_render_file
""".replace("HELPER",helper))

edit("y3/R0.smali","invokeSuspend(Ljava/lang/Object;)Ljava/lang/Object;",stop_render)
target = root/"smali"/"com/hitel/zocbodiag/ViewerPaperHooks.smali"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(""".class public final Lcom/hitel/zocbodiag/ViewerPaperHooks;
.super Ljava/lang/Object;

.method public static saveIfSelected(Lcom/eduzone/eduzoneviewer/ui/activities/ViewerActivity;Lv3/P;Ljava/lang/String;)Z
    .locals 3
    invoke-virtual {p0}, Lcom/eduzone/eduzoneviewer/ui/activities/ViewerActivity;->Y()Ly3/Y0;
    move-result-object v0
    invoke-virtual {p1}, Lv3/P;->C()Ljava/lang/String;
    move-result-object v1
    invoke-static {v0, v1, p2, p1}, Lcom/hitel/zocbodiag/PrivatePapers;->prepare(Ljava/lang/Object;Ljava/lang/String;Ljava/lang/String;Ljava/lang/Object;)Z
    move-result v1
    if-eqz v1, :end
    invoke-static {v0}, Lcom/hitel/zocbodiag/PrivatePapers;->requiresPdf(Ljava/lang/Object;)Z
    move-result v2
    if-eqz v2, :end
    invoke-virtual {p2}, Ljava/lang/String;->isEmpty()Z
    move-result v2
    if-nez v2, :end
    const/4 v2, 0x0
    invoke-virtual {v0, p2, v2}, Ly3/Y0;->v(Ljava/lang/String;Z)V
    :end
    return v1
.end method
""")
