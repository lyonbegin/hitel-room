package com.google.ai.edge.gallery.services.tts

import android.content.Context
import android.util.Log
import android.net.Uri
import java.util.zip.ZipInputStream
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import org.json.JSONObject

/** Data-only model installation. No native engine selection, routing, or caching changes. */
internal object HitelPocketEightModel {
  private const val TAG="HITEL_POCKET_EIGHT"
  private const val ROOT="hitel/"
  private fun packDir(context:Context)=File(context.filesDir,"hitel_pocket_ko_pack")
  private fun metadata(context:Context)=context.assets.open(ROOT+"pocket-eight.json").bufferedReader().use{JSONObject(it.readText())}
  fun installed(context:Context):Boolean {
    val d=packDir(context)
    return File(d,"verified").isFile && File(d,"pocket-eight-header.bin").length()==16384L &&
      File(d,"pocket-eight-tail.bin").isFile
  }
  @Synchronized fun importPack(context:Context,uri:Uri) {
    val m=metadata(context)
    val dir=packDir(context)
    val stage=File(context.filesDir,"hitel_pocket_ko_pack_stage")
    stage.deleteRecursively()
    check(stage.mkdirs())
    val sizes=mapOf("pocket-eight-header.bin" to 16384L,
      "pocket-eight-tail.bin" to (m.getLong("combinedSize")-m.getLong("baseSize")))
    try {
      val seen=mutableSetOf<String>()
      ZipInputStream(checkNotNull(context.contentResolver.openInputStream(uri)).buffered()).use { zip ->
        while(true) {
          val entry=zip.nextEntry?:break
          val expected=sizes[entry.name]?:error("Unexpected model entry "+entry.name)
          check(!entry.isDirectory && seen.add(entry.name))
          var count=0L
          File(stage,entry.name).outputStream().buffered().use { out ->
            val buf=ByteArray(1024*1024)
            while(true){
              val n=zip.read(buf)
              if(n<0)break
              count+=n;check(count<=expected);out.write(buf,0,n)
            }
          }
          check(count==expected)
          val key=if(entry.name.endsWith("header.bin"))"headerSha256" else "tailSha256"
          check(digest(File(stage,entry.name))==m.getString(key)) {"Korean model checksum mismatch"}
          zip.closeEntry()
        }
      }
      check(seen==sizes.keys)
      File(stage,"verified").writeText(m.getString("combinedSha256"))
      val old=File(context.filesDir,"hitel_pocket_ko_pack_old")
      old.deleteRecursively()
      if(dir.exists())check(dir.renameTo(old))
      if(!stage.renameTo(dir)){if(old.exists())old.renameTo(dir);error("Cannot install model")}
      old.deleteRecursively()
      Log.i(TAG,"EXTERNAL_KOREAN_PACK_IMPORT_PASS")
    } finally { stage.deleteRecursively() }
  }
  private fun digest(file:File):String {
    val md=MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { input ->
      val bytes=ByteArray(1024*1024)
      while(true) {
        val n=input.read(bytes)
        if(n<0)break
        md.update(bytes,0,n)
      }
    }
    return md.digest().joinToString(""){"%02x".format(it.toInt() and 255)}
  }
  @Synchronized fun install(context:Context, original:File):File {
    if(!installed(context))return original
    val m=metadata(context)
    val expectedBase=m.getString("baseSha256")
    val expectedCombined=m.getString("combinedSha256")
    val baseSize=m.getLong("baseSize")
    val combinedSize=m.getLong("combinedSize")
    require(original.length()==baseSize) {"Pocket TTS base model size mismatch"}
    val dir=File(context.filesDir,"hitel_pocket_eight/"+expectedCombined)
    check(dir.isDirectory||dir.mkdirs())
    val dest=File(dir,"pocket_tts_int8.litertlm")
    val mark=File(dir,"verified.json")
    val sourceIdentity=JSONObject().put("path",original.absolutePath).put("size",original.length())
      .put("mtime",original.lastModified()).put("combined",expectedCombined).toString()
    if(dest.isFile&&dest.length()==combinedSize&&mark.isFile&&mark.readText()==sourceIdentity)return dest
    require(digest(original)==expectedBase) {"Pocket TTS base model checksum mismatch"}
    val tmp=File(dir,"model.tmp")
    try {
      original.copyTo(tmp,overwrite=true)
      RandomAccessFile(tmp,"rw").use { out ->
        File(packDir(context),"pocket-eight-header.bin").inputStream().use { input ->
          val header=input.readBytes()
          check(header.size==16384)
          out.seek(0);out.write(header)
        }
        out.seek(baseSize)
        File(packDir(context),"pocket-eight-tail.bin").inputStream().buffered().use { input ->
          val buf=ByteArray(1024*1024)
          while(true){
            val n=input.read(buf)
            if(n<0)break
            out.write(buf,0,n)
          }
        }
        check(out.length()==combinedSize)
        out.fd.sync()
      }
      check(digest(tmp)==expectedCombined) {"Combined eight-language model checksum mismatch"}
      if(dest.exists())check(dest.delete())
      check(tmp.renameTo(dest))
      mark.writeText(sourceIdentity)
      Log.i(TAG,"ORIGINAL_7_PAYLOAD_PRESERVED_KO_APPENDED bytes="+dest.length())
      return dest
    }finally{tmp.delete()}
  }
}
