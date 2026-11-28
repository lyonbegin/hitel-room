package com.google.ai.edge.gallery.services.tts

import android.content.Context
import android.util.Log
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import org.json.JSONObject

/** Data-only model installation. No native engine selection, routing, or caching changes. */
internal object HitelPocketEightModel {
  private const val TAG="HITEL_POCKET_EIGHT"
  private const val ROOT="hitel/"
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
    val m=context.assets.open(ROOT+"pocket-eight.json").bufferedReader().use{JSONObject(it.readText())}
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
        context.assets.open(ROOT+"pocket-eight-header.bin").use { input ->
          val header=input.readBytes()
          check(header.size==16384)
          out.seek(0);out.write(header)
        }
        out.seek(baseSize)
        context.assets.open(ROOT+"pocket-eight-tail.bin").buffered().use { input ->
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
