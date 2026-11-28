"""Remove only seven agreed task implementations from the pinned Gallery checkout.
Run AFTER other integration patches. Preserve shared code by a conservative
file-level dependency closure and keep legacy task IDs / stored schema.
"""
import re, sys, json, shutil, hashlib
from pathlib import Path
root=Path(sys.argv[1])
app=root/"Android/src/app"
main=app/"src/main"
base=main/"java/com/google/ai/edge/gallery"
removed_ids={"SMART_ALBUM","VIDEO_MOMENT_FINDER","LLM_ASK_IMAGE","LLM_ASK_AUDIO","LLM_PROMPT_LAB","LLM_TINY_GARDEN","MP_SCRAPBOOK"}
removed=[]
retained=[]
def write(p,s):
    p.write_text(s)
def cut(p,start,end=None):
    s=p.read_text()
    assert s.count(start)==1,(p,start)
    i=s.index(start)
    if end is not None:
        assert s.count(end)==1,(p,end)
        j=s.index(end,i)
    else: j=len(s)
    write(p,s[:i]+s[j:])
def delete(p):
    removed.append({"path":str(p.relative_to(root)),"bytes":p.stat().st_size})
    p.unlink()
# Shared AI Chat code must remain.
cut(base/"ui/llmchat/LlmChatTaskModule.kt","////////////////////////////////////////////////////////////////////////////////////////////////////\n// Ask image.")
cut(base/"ui/llmchat/LlmChatScreen.kt","@Composable\nfun LlmAskImageScreen(","@Composable\nfun ChatViewWrapper(")
cut(base/"ui/llmchat/LlmChatViewModel.kt","@HiltViewModel\nclass LlmAskImageViewModel")
# Remove task order and capability list entries without altering legacy constants.
for p in [base/"ui/modelmanager/ModelManagerViewModel.kt",base/"data/Tasks.kt"]:
    s=p.read_text()
    s=re.sub(r"(?m)^[ \t]*BuiltInTaskId\.(?:"+"|".join(sorted(removed_ids))+r"),[ \t]*\n","",s)
    write(p,s)
# Candidates include services shared by removed tasks. No common package,
# XR, LLM runtime, ASR/TTS, or existing model-storage code is a candidate.
dirs=["customtasks/smartalbum","customtasks/videomomentfinder","customtasks/tinygarden","customtasks/scrapbook","ui/llmsingleturn","services/semanticretrieval","services/photolibrary"]
files=list(base.rglob("*.kt"))+list(base.rglob("*.java"))
candidates={p for p in files if any(p.is_relative_to(base/d) for d in dirs)}
contents={p:p.read_text() for p in files}
package={p:re.search(r"(?m)^package\s+([\w.]+)",s).group(1) for p,s in contents.items() if re.search(r"(?m)^package\s+([\w.]+)",s)}
# Include top-level functions, types, extension functions, and properties.
decl=re.compile(r"(?m)^(?:(?:public|internal|private|protected|abstract|open|data|sealed|enum|annotation|value|suspend|inline|operator|infix|tailrec|const|lateinit|override|expect|actual)\s+)*(?:class|interface|object|typealias|fun|val|var)\s+(?:<[^>\n]+>\s*)?(?:[\w.<>?]+\.)?(\w+)")
symbols={p:set(decl.findall(contents[p]))|{p.stem} for p in candidates}
# Avoid inferring dependencies from comments; conservatively keep imported
# symbols even when an import is unused. Same-package references include
# generic name collisions rather than risk deleting shared functionality.
def code(s):
    return re.sub(r"/\*[\s\S]*?\*/|(?m://[^\n]*)","",s)
clean={p:code(s) for p,s in contents.items()}
imports={p:set(re.findall(r"(?m)^import\s+([\w.*]+)",s)) for p,s in clean.items()}
tokens={p:set(re.findall(r"\b[A-Za-z_]\w*\b",s)) for p,s in clean.items()}
def references(src,target):
    pkg=package.get(target,"")
    if not pkg: return False
    names=symbols[target]
    if package.get(src)==pkg and names & tokens[src]: return True
    if pkg+".*" in imports[src]: return True
    if any(pkg+"."+n in imports[src] for n in names): return True
    return any(pkg+"."+n in clean[src] for n in names)
keep=set(files)-candidates
while True:
    new={p for p in candidates-keep if any(references(q,p) for q in keep)}
    if not new: break
    keep.update(new)
# A task registration must never survive. If a retained feature actually
# references one, fail before producing a broken or deceptively hidden APK.
required={p for p in candidates if p.name.endswith("TaskModule.kt") or p.name in {"SmartAlbumTask.kt","VideoMomentFinderTask.kt","TinyGardenTask.kt","ScrapbookTask.kt"}}
assert not required & keep,("Task registration still referenced",sorted(map(str,required & keep)))
for p in sorted(candidates):
    if p in keep:
        retained.append(str(p.relative_to(root)))
    else: delete(p)
# Remove dedicated test sources only, not shared tests or fixtures.
for kind in ["test","androidTest"]:
    testbase=app/"src"/kind/"java/com/google/ai/edge/gallery"
    for d in dirs[:5]:
        for p in sorted((testbase/d).rglob("*")):
            if p.is_file(): delete(p)
# Tiny Garden's bundled web app is dedicated; check retained source references.
surviving=[p for p in base.rglob("*") if p.suffix in {".kt",".java"}]
all_code="\n".join(code(p.read_text()) for p in surviving)
if not re.search(r'(?i)["\x27][^"\x27\n]*tinygarden/',all_code):
    for p in sorted((main/"assets/tinygarden").rglob("*")):
        if p.is_file(): delete(p)
# Delete only dedicated resources no remaining source or XML references.
# Keep shared resources and persisted metadata to preserve existing data.
prefix=re.compile(r"^(?:smart_?album|video_?moment|tiny_?garden|scrapbook|prompt_?lab|ask_?image|ask_?audio|audio_?scribe|task_(?:label|desc|short_desc)_(?:ask_image|audio_scribe|prompt_lab|tiny_garden|scrapbook|smart_album|video_moment))",re.I)
res=main/"res"
xmls=list(res.rglob("*.xml"))
resrefs=set(re.findall(r"(?:R\.\w+\.|@\w+/)(\w+)",all_code+"\n"+"\n".join(p.read_text() for p in xmls)))
for p in sorted(res.rglob("*")):
    if not p.is_file() or p.parent.name.startswith("values"): continue
    if prefix.match(p.stem) and p.stem not in resrefs: delete(p)
for p in sorted(res.glob("values*/strings.xml")):
    s=p.read_text()
    s=re.sub(r'<string\s+name="([^"]+)"[^>]*>[\s\S]*?</string>',lambda m:"" if prefix.match(m.group(1)) and m.group(1) not in resrefs else m.group(0),s)
    write(p,s)
# Dependency removal is conditional on remaining imports, preserving vision
# segmentation and every speech/model library regardless of feature count.
gradle=app/"build.gradle.kts"
s=gradle.read_text()
dropped=[]
for dep,namespace in [("tasks.retrieval","com.google.mediapipe.tasks.retrieval"),("androidx.media3.transformer","androidx.media3.transformer"),("androidx.media3.exoplayer","androidx.media3.exoplayer"),("androidx.media3.ui","androidx.media3.ui")]:
    line="  implementation(libs."+dep+")\n"
    if line in s and namespace not in all_code:
        s=s.replace(line,"")
        dropped.append(dep)
write(gradle,s)
# Assert intact shared engines and retained entry points.
for p in ["customtasks/xrlanguageteacher/XrLanguageTeacherTaskModule.kt","ui/llmchat/LlmChatTaskModule.kt","ui/llmchat/LlmTestTaskModule.kt","customtasks/agentchat/AgentChatTaskModule.kt","services/tts/SupertonicTtsEngine.kt","services/asr/AsrServiceProvider.kt"]:
    assert (base/p).exists(),p
assert "class LlmAskImageTask" not in all_code and "class LlmAskAudioTask" not in all_code
# Runtime verification of the actual Hilt registered tasks in installed APK.
test=app/"src/androidTest/java/com/google/ai/edge/gallery/services/tts/SupertonicDeviceTest.kt"
s=test.read_text()
anchor="    val context=InstrumentationRegistry.getInstrumentation().targetContext"
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'''
    val taskEntry=dagger.hilt.android.EntryPointAccessors.fromApplication(context.applicationContext, LiteTaskRegistryEntry::class.java)
    val taskIds=taskEntry.tasks().map { it.task.id }.toSet()
    val removedIds=setOf("smart_album","video_moment_finder","llm_ask_image","llm_ask_audio","llm_prompt_lab","llm_tiny_garden","mp_scrapbook")
    assertTrue("removed tasks registered: "+taskIds.intersect(removedIds),taskIds.intersect(removedIds).isEmpty())
    assertTrue("retained tasks missing: "+taskIds,taskIds.containsAll(setOf("llm_chat","llm_test","llm_agent_chat","llm_mobile_actions","llm_xr_language_teacher")))
    android.util.Log.i("HITEL_GALLERY_LITE","TASK_REGISTRY_PASS ids="+taskIds.sorted().joinToString(","))
''')
s+='''
@dagger.hilt.EntryPoint
@dagger.hilt.InstallIn(dagger.hilt.components.SingletonComponent::class)
interface LiteTaskRegistryEntry {
  fun tasks(): Set<@JvmSuppressWildcards com.google.ai.edge.gallery.customtasks.common.CustomTask>
}
'''
write(test,s)
report={"removed":removed,"retained_candidate_files":retained,"dropped_gradle_dependencies":dropped,"removed_file_bytes":sum(x["bytes"] for x in removed),"removed_task_ids":sorted(removed_ids)}
Path("gallery-lite-prune-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print("GALLERY_LITE_PRUNE",len(removed),"files",report["removed_file_bytes"],"bytes", "retained shared candidates",retained,"dropped deps",dropped)
