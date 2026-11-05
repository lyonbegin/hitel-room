package app.hitel.callhandofflab;
/** OFFHOOK may mean outgoing dialing; never automatically claim the far end answered. */
public final class CallHandoffStateMachine {
    public static final int IDLE=0,RINGING=1,OFFHOOK=2;
    public enum Display { HIDDEN, CONNECTION_UNVERIFIED, CONFIRMED_BY_USER }
    private int callState=IDLE;
    private boolean confirmed=false, dismissed=false;
    public synchronized Display stateChanged(int next) {
        if(next!=IDLE && next!=RINGING && next!=OFFHOOK) throw new IllegalArgumentException("call state");
        if(next==IDLE) {confirmed=false; dismissed=false;}
        if(next==RINGING) confirmed=false;
        callState=next;
        return display();
    }
    public synchronized Display userConfirms() {
        if(callState==OFFHOOK && !dismissed)confirmed=true;
        return display();
    }
    public synchronized Display dismiss(){dismissed=true;confirmed=false;return display();}
    public synchronized Display display(){
        if(callState!=OFFHOOK||dismissed)return Display.HIDDEN;
        return confirmed?Display.CONFIRMED_BY_USER:Display.CONNECTION_UNVERIFIED;
    }
}
