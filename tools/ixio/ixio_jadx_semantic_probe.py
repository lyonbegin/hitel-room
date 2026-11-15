#!/usr/bin/env python3
"""Publish counts only; full decompiled function evidence stays encrypted."""
import argparse,json,pathlib,hashlib
p=argparse.ArgumentParser(); p.add_argument('--sources',required=True); p.add_argument('--output',required=True); a=p.parse_args()
root=pathlib.Path(a.sources); files=list(root.rglob('*.java'))
rows=[]
for f in files:
 s=f.read_text(errors='replace')
 rows.append({'file':str(f.relative_to(root)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'decompilation_error_marker': 'Method not decompiled:' in s})
result={'tool':'JADX 1.5.6','java_files':len(rows),'files_with_decompilation_errors':sum(x['decompilation_error_marker'] for x in rows),'files':rows}
pathlib.Path(a.output).write_text(json.dumps(result,indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='files'}))
