#!/usr/bin/env python3
"""Read-only APK/AAR AppSealing and packer signature inventory.
Not an unpacker, runtime bypass, or proof of the ABSENCE of anti-tamper checks.
"""
import argparse,collections,hashlib,io,json,re,zipfile
from pathlib import Path
STRONG=(b"appsealing",b"com.inka",b"inka.entworks")
WEAK=(b"frida",b"xposed",b"magisk",b"rootbeer",b"debugger",b"tamper")
def sha(data):return hashlib.sha256(data).hexdigest()
def scan(filename):
    path=Path(filename)
    b=path.read_bytes()
    out={"package":str(path),"archive_sha256":sha(b),"bytes":len(b)}
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        names=z.namelist()
        if len(names)!=len(set(names)):raise ValueError("DUPLICATE_ENTRIES")
        if z.testzip() is not None:raise ValueError("INVALID_ZIP_CRC")
        out["entries"]=len(names)
        out["dex_entries"]=len([n for n in names if re.fullmatch(r"classes\d*\.dex",n)])
        out["jvm_classes"]=len([n for n in names if n.endswith(".class")])
        out["native_elfs"]=sorted([n for n in names if n.endswith(".so")])
        out["original_arm64_expr2_present"]="jni/arm64-v8a/libexpr2jni.so" in names or "lib/arm64-v8a/libexpr2jni.so" in names
        out["suspicious_marker_findings"]=[]
        total=0
        for n in names:
            if n.endswith("/") or (n.lower().endswith((".png",".jpg",".webp",".ttf",".woff",".mp4",".wav"))):continue
            content=z.read(n)
            total+=len(content)
            name_low=n.lower().encode()
            for marker in STRONG+WEAK:
                lower=marker.lower()
                locations=[]
                if lower in name_low:locations.append("entry_name")
                # Scan each original JVM/DEX/ELF payload, not just filenames.
                if lower in content.lower():locations.append("file_contents")
                if locations:
                    out["suspicious_marker_findings"].append({
                       "entry":n,"marker":marker.decode(),"locations":locations,
                       "strength":"APPSEALING_VENDOR_INDICATOR" if marker in STRONG else "GENERIC_HEURISTIC_NOT_PROOF"})
        out["scanned_uncompressed_bytes"]=total
        out["strong_vendor_marker_hits"]=sum(x["strength"]=="APPSEALING_VENDOR_INDICATOR" for x in out["suspicious_marker_findings"])
        out["weak_generic_marker_hits"]=sum(x["strength"]=="GENERIC_HEURISTIC_NOT_PROOF" for x in out["suspicious_marker_findings"])
        out["appsealing_proven_by_static_signature"]=out["strong_vendor_marker_hits"]>0
        out["conclusion"]=(
          "APPSEALING_VENDOR_STRING_OR_PATH_PRESENT_REQUIRES_MANUAL_VALIDATION"
          if out["appsealing_proven_by_static_signature"] else
          "NO_KNOWN_APPSEALING_VENDOR_MARKERS_DETECTED_NOT_A_PROOF_OF_ABSENCE")
        out["limitations"]=(
          "Static ZIP content search cannot prove absence of packed/encrypted runtime code, "
          "Java reflection, loader-stage protection, dynamically loaded modules, "
          "or package protection applied AFTER this APK is generated. "
          "Generic debug/root terms do not establish that AppSealing is in use."
        )
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--original-aar",type=Path,required=True)
    ap.add_argument("--unpatched-apk",type=Path,required=True)
    ap.add_argument("--patched-apk",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    a=ap.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    packages=[scan(f) for f in [a.original_aar,a.unpatched_apk,a.patched_apk]]
    data={"purpose":"Original Expression2 AAR and APK packaging protection inventory",
          "analyzed_without_modifying_original":True,"packages":packages}
    (a.out/"package-protection-signatures.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
    with (a.out/"package-protection-SUMMARY.md").open("w") as f:
        f.write("# Original Expression2 SDK / APK — protection-indicator inventory\n\n")
        f.write("| Package | ZIP entries | DEX | SO | AppSealing vendor-indicator hits | Verdict |\n")
        f.write("|---|---:|---:|---:|---:|---|\n")
        for item in packages:
            f.write(f"| {Path(item['package']).name} | {item['entries']} | {item['dex_entries']} | {len(item['native_elfs'])} | {item['strong_vendor_marker_hits']} | {item['conclusion']} |\n")
        f.write("\nNo match means **not detected**; does not prove absence of protection or authorization controls.\n")
    print("EXPR2_PACKAGE_PROTECTION_READONLY_INVENTORY_PASS",json.dumps(
       [{"package":Path(p["package"]).name,"strong_vendor_hits":p["strong_vendor_marker_hits"],
         "generic_hits":p["weak_generic_marker_hits"],"conclusion":p["conclusion"]} for p in packages]))
if __name__=="__main__":main()
