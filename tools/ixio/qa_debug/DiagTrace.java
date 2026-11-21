package com.lguplus.aicallagent.hitelqa;

/** Small fixed-value hooks. Never dereferences IXIO account or token objects. */
public final class DiagTrace {
    private DiagTrace() {}

    private static String instance(Object object) {
        return object == null ? "null" : Integer.toHexString(System.identityHashCode(object));
    }

    public static void repoCheck(Object repository, boolean granted) {
        DiagLog.event("PERMISSION", "repository#" + instance(repository) + " androidCheck=" + granted);
    }

    public static void repoWrite(Object repository, boolean granted) {
        DiagLog.event("PERMISSION", "repository#" + instance(repository) + " stateFlowWrite=" + granted);
    }

    public static void viewModelInitial(Object viewModel, boolean granted) {
        DiagLog.event("PERMISSION", "callViewModel#" + instance(viewModel) + " flowInitial=" + granted);
    }

    public static void flowEmission(Object flow, boolean granted) {
        DiagLog.event("PERMISSION", "permissionFlowEmission#" + instance(flow) + " value=" + granted);
    }

    public static void screenState(boolean granted) {
        DiagLog.event("SCREEN", "ErrorStateScreen.permissionGranted=" + granted);
    }

    public static void stage(String event) {
        DiagLog.event("RECORD", event);
    }

    public static void fixedTag(String tag, String event) {
        DiagLog.event(tag, event);
    }
}
