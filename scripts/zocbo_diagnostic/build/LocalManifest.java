import java.nio.file.*;
import pxb.android.axml.*;
public final class LocalManifest {
  static final String NS="http://schemas.android.com/apk/res/android";
  static void attr(NodeVisitor v,String name,int id,int type,Object value){v.attr(NS,name,id,type,value);}
  public static void main(String[] args) throws Exception {
    AxmlWriter writer=new AxmlWriter();
    final int[] applications={0};
    new AxmlReader(Files.readAllBytes(Paths.get(args[0]))).accept(new AxmlVisitor(writer){
      @Override public NodeVisitor child(String ns,String name){
        NodeVisitor root=super.child(ns,name);
        if(!"manifest".equals(name))return root;
        return new NodeVisitor(root){
          @Override public NodeVisitor child(String ns,String name){
            NodeVisitor node=super.child(ns,name);
            if(!"application".equals(name))return node;
            applications[0]++;
            return new NodeVisitor(node){
              @Override public void end(){
                NodeVisitor activity=super.child(null,"activity");
                attr(activity,"name",android.R.attr.name,3,"com.hitel.zocbodiag.NativePdfEntryActivity");
                attr(activity,"exported",android.R.attr.exported,18,0);
                attr(activity,"theme",android.R.attr.theme,1,android.R.style.Theme_Material_Light_NoActionBar);
                activity.end();
                NodeVisitor provider=super.child(null,"provider");
                attr(provider,"name",android.R.attr.name,3,"com.hitel.zocbodiag.PaperDocumentsProvider");
                attr(provider,"authorities",android.R.attr.authorities,3,"com.eduzone.eduzoneviewer.localpapers");
                attr(provider,"exported",android.R.attr.exported,18,1);
                attr(provider,"grantUriPermissions",android.R.attr.grantUriPermissions,18,1);
                attr(provider,"permission",android.R.attr.permission,3,"android.permission.MANAGE_DOCUMENTS");
                NodeVisitor filter=provider.child(null,"intent-filter");
                NodeVisitor action=filter.child(null,"action");
                attr(action,"name",android.R.attr.name,3,"android.content.action.DOCUMENTS_PROVIDER");
                action.end();filter.end();provider.end();
                super.end();
              }
            };
          }
        };
      }
    });
    if(applications[0]!=1)throw new IllegalStateException("application count");
    Files.write(Paths.get(args[1]),writer.toByteArray());
  }
}
