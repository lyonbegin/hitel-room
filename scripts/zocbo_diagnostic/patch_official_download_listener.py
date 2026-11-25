#!/usr/bin/env python3
"""Retain the original listener, wrapping only an explicit official attachment."""
from pathlib import Path
import re,sys
root=Path(sys.argv[1])
rx=re.compile(r'(?m)^(\s*)(invoke-virtual(?:/range)?)\s+(\{[^\n}]+\}),\s+L[^;\n]+;->setDownloadListener\(Landroid/webkit/DownloadListener;\)V\s*$')
n=0
for d in root.glob('smali*'):
    for f in d.rglob('*.smali'):
        raw=f.read_text(encoding='utf-8')
        def replace(m):
            global n
            n+=1
            opcode='invoke-static/range' if m.group(2).endswith('/range') else 'invoke-static'
            return m.group(1)+opcode+' '+m.group(3)+', Lcom/hitel/zocbodiag/OfficialPdfDownloads;->setOriginalListener(Landroid/webkit/WebView;Landroid/webkit/DownloadListener;)V'
        updated=rx.sub(replace,raw)
        if updated!=raw: f.write_text(updated,encoding='utf-8')
print('OFFICIAL_DOWNLOAD_LISTENER_WRAPPED_CALLS',n)
