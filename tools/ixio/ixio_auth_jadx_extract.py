#!/usr/bin/env python3
"""Extract narrow API and DTO code evidence from private JADX outputs.

Preserve method declarations and annotation names/path templates, exclude
credential material and any potentially personal values from public artifacts.
Only inspect, never execute or alter original API methods or auth conditions.
"""
import argparse,json,pathlib,re,hashlib

KEYWORDS=re.compile(r"(?i)verifyCtn|isRegistered|refreshToken|postAutoLogin|"
                    r"getPhoneNumbersForDefaultSim|encrypt\(|getTokenData|"
                    r"MemberVerificationRemoteSource|serverBaseUrl|request|response|"
                    r"IxIOAuthApi|MemberVerificationRepository|UserService|"
                    r"getCode\(|getData\(|getMessage\(|isTokenExpired|"
                    r"getLoginState|result|CommonResponse|NotAuthorized|"
                    r"isLogin|TokenData|getCtn|postCtn|checkSuccessOrThrow|"
                    r"getService\(|postService\(")
LITERAL=re.compile(r'"(?:\\.|[^"\\])*"')
def sanitize(line):
    # Include Retrofit path annotations; these are API schema, not secret data.
    if re.search(r"@(?:GET|POST|PUT|DELETE|PATCH|HTTP|Headers|Query|Path|Body|Header|Url|Field)\b",line):
        line=re.sub(r"https?://[^\"']+","[HOST-REMOVED]",line)
        return line[:700]
    # Redact string literal values but retain flow, types, fields, and comparisons
    line=LITERAL.sub('"[LITERAL]"',line)
    line=re.sub(r"https?://\S+","[URL-REMOVED]",line)
    return line[:440]

def extract(path):
    s=path.read_text(errors="replace")
    a=s.splitlines()
    decls=[];api=[];fields=[];fragments=[]
    re_decl=re.compile(r"\b(?:public|private|protected|static|final|abstract|suspend|native|synchronized)\b[^;{}]{0,550}?\b([A-Za-z_$][\w$-]*)\s*\(")
    for i,line in enumerate(a):
        if re.search(r"^\s*@[A-Za-z][A-Za-z0-9_.]*(?:\(|$)",line):
            if any(tag in line for tag in ("@GET","@POST","@PUT","@DELETE","@PATCH","@HTTP","@Headers",
                "@Query","@Body","@Header","@Path","@Url","@Field","@SerialName")):
                api.append({"line":i+1,"code":sanitize(line.strip())})
                for x in range(i+1,min(i+9,len(a))):
                    if re_decl.search(a[x]):
                        api.append({"line":x+1,"code":sanitize(a[x].strip())})
                        break
        if re.search(r"^\s*(?:private|public|protected)\s+(?:static\s+)?(?:final\s+)?[\w.<>\[\]?$,\s]+\s+[\w$]+\s*;",line):
            if len(fields)<100: fields.append({"line":i+1,"decl":sanitize(line.strip())})
        m=re_decl.search(line)
        if m and len(line)<700:
            if len(decls)<180:
                decls.append({"line":i+1,"name":m.group(1),"signature":sanitize(line.strip())})
        if KEYWORDS.search(line):
            # narrow local code context around actual relevant calls / conditions
            if len(fragments)<160:
                fragments.append({"line":i+1,"code":sanitize(line.strip())})
    return {
      "class":path.stem,
      "decompiled_source_sha256":hashlib.sha256(s.encode()).hexdigest(),
      "source_bytes":len(s),
      "jadx_failed_methods":s.count("Method not decompiled:"),
      "fields":fields[:75],
      "method_signatures":decls[:110],
      "retrofit_api_annotations_and_declarations":api[:135],
      "significant_call_and_condition_lines":fragments[:100]
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inputs",type=pathlib.Path,required=True)
    p.add_argument("--out",type=pathlib.Path,required=True)
    x=p.parse_args()
    result={}
    for file in sorted(x.inputs.glob("*.java")):
        result[file.stem]=extract(file)
    x.out.parent.mkdir(parents=True,exist_ok=True)
    x.out.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    for name,y in result.items():
        print("\n===",name,"bytes",y["source_bytes"],"jadx_failed_methods",y["jadx_failed_methods"],"===")
        for item in y["fields"][:22]: print("FIELD",item["line"],item["decl"])
        for item in y["method_signatures"][:65]:
            if any(k.lower() in item["name"].lower() for k in ("verify","login","token","encrypt",
                      "refresh","get","post","service","register","init")):
                print("DECL",item["line"],item["signature"])
        for item in y["retrofit_api_annotations_and_declarations"][:60]:
            print("RETROFIT",item["line"],item["code"])
        for item in y["significant_call_and_condition_lines"][:46]:
            print("CODE",item["line"],item["code"])
    print("CLASSES_RECONSTRUCTED",len(result))
if __name__=="__main__":main()
