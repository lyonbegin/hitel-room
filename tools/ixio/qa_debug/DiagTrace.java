package com.lguplus.aicallagent.hitelqa;

/** Small fixed-value hooks. Never dereferences IXIO account or token objects. */
public final class DiagTrace {
    private DiagTrace() {}
    private static final java.util.concurrent.ConcurrentHashMap<Class<?>, java.lang.reflect.Field[]> STATE_FIELDS =
            new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.lang.reflect.Field[] NO_FIELDS = new java.lang.reflect.Field[0];

    private static java.lang.reflect.Field[] stateFields(Class<?> type) {
        if (!type.getName().startsWith("com.lguplus.aicallagent.")) return NO_FIELDS;
        java.lang.reflect.Field[] known = STATE_FIELDS.get(type);
        if (known != null) return known;
        java.util.ArrayList<java.lang.reflect.Field> selected = new java.util.ArrayList<>();
        for (java.lang.reflect.Field f : type.getDeclaredFields()) {
            if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
            boolean numeric = (f.getType() == int.class || f.getType() == long.class)
                    && f.getName().matches("label|errorCode|statusCode|bytesRead|downloadedSize|totalSize|totalBytesRead|downloadedBytes|contentLength|totalDownloadSize|currentModelIndex|totalModelCount|retryCount");
            if (f.getType() != boolean.class && !numeric) continue;
            try { f.setAccessible(true); selected.add(f); } catch (Throwable ignored) { }
        }
        java.lang.reflect.Field[] fields = selected.toArray(NO_FIELDS);
        STATE_FIELDS.putIfAbsent(type, fields);
        return fields;
    }

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

    public static void flow(String label) { DiagLog.event("FLOW", label); }
    public static void flowInt(String label, int value) { flow(label + " value=" + value); }
    public static void flowLong(String label, long value) { flow(label + " value=" + value); }
    public static void flowFloat(String label, float value) { flow(label + " value=" + value); }
    public static void flowDouble(String label, double value) { flow(label + " value=" + value); }

    public static void flowObject(String label, Object value) {
        if (value == null) { flow(label + " result=null"); return; }
        Class<?> type = value.getClass();
        StringBuilder s = new StringBuilder(label).append(" result=")
                .append(type.getName()).append('#').append(instance(value));
        if (value instanceof Boolean) s.append(" value=").append((Boolean)value);
        if (value instanceof String && label.contains(".getAiModelType")
                && ((String)value).matches("[A-Z_]{2,24}")) s.append(" model=").append((String)value);
        if (value instanceof String && label.contains(".getFileVersion")
                && ((String)value).matches("[0-9]+(?:\\.[0-9]+){1,4}")) s.append(" version=").append((String)value);
        if (type.getName().equals("kotlin.Result$Failure")) {
            try {
                java.lang.reflect.Field f = type.getDeclaredField("exception");
                f.setAccessible(true);
                Object cause = f.get(value);
                if (cause != null) s.append(" cause=").append(cause.getClass().getName());
            } catch (Throwable ignored) { }
        }
        if (value instanceof Enum<?>) s.append(" enum=").append(((Enum<?>)value).name());
        if (value instanceof byte[]) s.append(" bytes=").append(((byte[])value).length);
        if (value instanceof short[]) s.append(" samples=").append(((short[])value).length);
        if (value instanceof java.util.Collection<?>)
            s.append(" count=").append(((java.util.Collection<?>)value).size());
        if (value instanceof java.io.File) {
            java.io.File file = (java.io.File)value;
            s.append(" exists=").append(file.exists()).append(" size=").append(file.length());
        }
        // Cache recovered primitive state fields once per app class. Never
        // serialize account objects, strings, tokens, audio or response bodies.
        for (java.lang.reflect.Field f : stateFields(type)) {
            try { s.append(' ').append(f.getName()).append('=').append(f.get(value)); }
            catch (Throwable ignored) { }
        }
        flow(s.toString());
    }
}
