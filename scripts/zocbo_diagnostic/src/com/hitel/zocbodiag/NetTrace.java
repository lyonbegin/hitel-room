package com.hitel.zocbodiag;

import java.io.IOException;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

/** No dynamic Proxy and no network tracing. Only retain original-response
 * metadata needed by the existing authorization/reopen implementation. */
public final class NetTrace {
  private NetTrace() {}
  public static void apiClient(Object builder) {
    try {
      builder.getClass().getMethod("addInterceptor",Interceptor.class)
        .invoke(builder,new ModelResponseInterceptor());
    }catch(ReflectiveOperationException | RuntimeException e){
      Diag.log("MODEL_INTERCEPTOR_ERROR",e.getClass().getSimpleName());
    }
  }
  public static void pdfClient(Object builder) {}
  public static void requestModel(Object request) {}
  public static void pdfPath(String url) {}

  static final class ModelResponseInterceptor implements Interceptor {
    @Override public Response intercept(Interceptor.Chain chain) throws IOException {
      Request req=chain.request();
      boolean viewerPath=req!=null && String.valueOf(req.url()).contains("VIEWER_FILE_PATH");
      String account=viewerPath?PrivatePapers.account():"";
      // Call the original interface directly. IOException/Canceled retains
      // its original type even if the runtime interface has no Throws annotation.
      Response response=chain.proceed(req);
      if(viewerPath)PrivatePapers.recordModel(response,req,account);
      return response;
    }
  }
}
