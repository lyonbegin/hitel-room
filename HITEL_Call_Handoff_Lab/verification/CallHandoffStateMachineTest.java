import app.hitel.callhandofflab.CallHandoffStateMachine;
import static app.hitel.callhandofflab.CallHandoffStateMachine.*;
public class CallHandoffStateMachineTest {
    static void check(Object expected,Object got,String name){
        if(!expected.equals(got))throw new AssertionError(name);
        System.out.println("PASS "+name);
    }
    public static void main(String[] args){
        CallHandoffStateMachine s=new CallHandoffStateMachine();
        check(Display.HIDDEN,s.display(),"initial hidden");
        check(Display.HIDDEN,s.stateChanged(RINGING),"ringing hidden");
        check(Display.HIDDEN,s.userConfirms(),"ringing not confirmed");
        check(Display.CONNECTION_UNVERIFIED,s.stateChanged(OFFHOOK),"offhook uncertain");
        check(Display.CONFIRMED_BY_USER,s.userConfirms(),"manual confirmed");
        check(Display.CONFIRMED_BY_USER,s.stateChanged(OFFHOOK),"duplicate offhook stable");
        check(Display.HIDDEN,s.dismiss(),"dismiss");
        check(Display.HIDDEN,s.stateChanged(OFFHOOK),"dismiss stable");
        check(Display.HIDDEN,s.stateChanged(IDLE),"idle cleans");
        check(Display.CONNECTION_UNVERIFIED,s.stateChanged(OFFHOOK),"next call resets");
        check(Display.HIDDEN,s.stateChanged(IDLE),"unanswered idle");
        System.out.println("All 11 state tests passed.");
    }
}
