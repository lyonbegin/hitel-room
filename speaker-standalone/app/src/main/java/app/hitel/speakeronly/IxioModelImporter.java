package app.hitel.speakeronly;

import android.content.Context;
import android.net.Uri;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Local, user-selected ORIGINAL IXIO STT model archive importer.
 * Never downloads or substitutes a public Sherpa model.
 * Original IXIO's bpe.vocab is supplied by the original binary build.
 */
final class IxioModelImporter {
  private static final String[] REQUIRED={
    "encoder.ort","decoder.ort","joiner.ort","tokens.txt","bpe.vocab","vad.onnx"
  };
  // Full original IXIO archive may also contain the anti-spoofing model.
  // Include it in the import but only STT+VAD are loaded for this light-weight test.
  private static final long MAX_FILE_BYTES=650L*1024*1024;
  private static final long MAX_TOTAL_BYTES=900L*1024*1024;

  private IxioModelImporter(){}

  static boolean isReady(Context context){
    File folder=new File(context.getFilesDir(),DirectPcmKoreanStt.MODEL_DIR);
    for(String name:REQUIRED){
      File file=new File(folder,name);
      if(!file.isFile()||file.length()<128)return false;
    }
    return true;
  }

  static String importZip(Context context,Uri uri)throws IOException {
    if(uri==null)throw new IOException("IXIO original STT ZIP is not selected");
    File parent=context.getFilesDir();
    File target=new File(parent,DirectPcmKoreanStt.MODEL_DIR);
    File stage=new File(parent,"ixio-stt-importing");
    File backup=new File(parent,"ixio-stt-previous");
    remove(stage);
    if(!stage.mkdirs())throw new IOException("Cannot create IXIO import directory");
    Set<String> names=new HashSet<>();
    long total=0;
    try{
      try(InputStream source=context.getContentResolver().openInputStream(uri)){
        if(source==null)throw new IOException("Cannot open original IXIO STT archive");
        try(ZipInputStream zip=new ZipInputStream(source)){
          ZipEntry entry;
          byte[] buffer=new byte[65536];
          while((entry=zip.getNextEntry())!=null){
            if(entry.isDirectory()){zip.closeEntry();continue;}
            String path=entry.getName().replace('\\','/');
            String base=path.substring(path.lastIndexOf('/')+1).toLowerCase(Locale.ROOT);
            if(!isModelName(base)){zip.closeEntry();continue;}
            if(!names.add(base))throw new IOException("Duplicate IXIO model entry: "+base);
            File file=new File(stage,base);
            long size=0;
            try(FileOutputStream output=new FileOutputStream(file)){
              int n;
              while((n=zip.read(buffer))!=-1){
                size+=n;total+=n;
                if(size>MAX_FILE_BYTES||total>MAX_TOTAL_BYTES)
                  throw new IOException("IXIO model archive is too large");
                output.write(buffer,0,n);
              }
              output.getFD().sync();
            }
            if(size<128)throw new IOException("IXIO model empty or too small: "+base);
            zip.closeEntry();
          }
        }
      }
      for(String required:REQUIRED)
        if(!names.contains(required))
          throw new IOException("Original IXIO STT.zip missing "+required);
      // These originals were verified from the user's exported 4.0.4 ZIP.
      // Reject old non-ORT model packages rather than silently falling back.
      for(String name:new String[]{"encoder.ort","decoder.ort","joiner.ort"}){
        try(java.io.FileInputStream in=new java.io.FileInputStream(new File(stage,name))){
          byte[] header=new byte[8];
          if(in.read(header)!=8 ||
             header[4]!='O'||header[5]!='R'||header[6]!='T'||header[7]!='M')
            throw new IOException("Not an IXIO .ort model: "+name);
        }
      }
      remove(backup);
      if(target.exists()&&!target.renameTo(backup))
        throw new IOException("Cannot preserve previous IXIO model directory");
      if(!stage.renameTo(target)){
        if(backup.exists())backup.renameTo(target);
        throw new IOException("Cannot activate IXIO STT models");
      }
      remove(backup);
      return "IXIO 원본 STT 모델 설치 확인: "+names.size()+
        "개 파일, "+total+"바이트";
    }catch(IOException|RuntimeException error){
      remove(stage);
      throw error;
    }
  }

  private static boolean isModelName(String name){
    if(name.equals("anti.onnx"))return true;
    for(String required:REQUIRED)if(required.equals(name))return true;
    return false;
  }
  private static void remove(File f)throws IOException {
    if(!f.exists())return;
    if(f.isDirectory()){
      File[] files=f.listFiles();
      if(files!=null)for(File file:files)remove(file);
    }
    if(!f.delete())throw new IOException("Cannot clear IXIO model staging: "+f.getName());
  }
}
