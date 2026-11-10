#!/usr/bin/env python3
"""Produce exact middle/high subject x grade x semester coverage counts.

Zero in the table means 'none among the retrieved records', NOT 'no such book
exists in Korea'. Unspecified grades and high-school elective subjects remain
unresolved; do not infer nonexistent semester divisions.
"""
import csv,json
from pathlib import Path
from collections import defaultdict,Counter
from datetime import datetime,timezone
OUT=Path("reports/textbook_catalog")
IN=OUT/"yes24_book_detail_links.csv"
SUBJECTS=["국어","영어","수학","과학","사회","역사","도덕·윤리","기술가정",
          "정보","한문","제2외국어","음악","미술","체육","미분류"]
with IN.open(encoding="utf-8-sig",newline="") as fp:
    items=list(csv.DictReader(fp))
by_key=defaultdict(set)
missing={"school":0,"subject":0,"grade":0,"semester":0}
for r in items:
    key=(r["학교급"],r["과목"],r["학년"] or "미기재",r["학기"] or "미기재")
    by_key[key].add(r["yes24_id"])
    missing["grade"]+=not bool(r["학년"])
    missing["semester"]+=not bool(r["학기"])
    missing["subject"]+=r["과목"]=="미분류"
    missing["school"]+=r["학교급"] in ("복합","교차 분류 확인 필요")
rows=[{"학교급":lv,"과목":su,"학년":gr,"학기":te,"이용 가능한 상품 상세주소 수":len(ids),
       "근거":"수집된 YES24 고유 상품ID만 집계, 전체 시장의 존재/부재 증명 아님"}
      for (lv,su,gr,te),ids in sorted(by_key.items())]
with (OUT/"subject_grade_semester_coverage.csv").open("w",encoding="utf-8-sig",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else ["학교급","과목","학년","학기","이용 가능한 상품 상세주소 수","근거"])
    w.writeheader();w.writerows(rows)
summ={"generated_at_utc":datetime.now(timezone.utc).isoformat(),
 "unique_books":len(items),"coverage_groups_with_items":len(rows),
 "subjects_found":dict(Counter(x["과목"] for x in items)),
 "grades_unspecified":missing["grade"],"semesters_unspecified":missing["semester"],
 "subjects_unspecified":missing["subject"],"levels_need_review":missing["school"],
 "interpretation":"Results represent acquired links only. Empty cells or unspecified grade/term are not proof books do not exist."}
(OUT/"subject_grade_semester_summary.json").write_text(json.dumps(summ,ensure_ascii=False,indent=2),encoding="utf-8")
print("SUBJECT_GRADE_COVERAGE",json.dumps(summ,ensure_ascii=False),flush=True)
