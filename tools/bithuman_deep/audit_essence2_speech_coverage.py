#!/usr/bin/env python3
"""Parse ORIGINAL bitHuman Essence2 player coverage, not fake frame counts.

speechPresented counts re-presenting a held frame. Only bhcov UTT.unique
counts distinctive mouth positions actually shown. Use independent baseline
from original SDK skipAhead OFF, same model+voice on Android15 emulator.
"""
from pathlib import Path
import argparse
import json
import re

UTT=re.compile(r'bhcov\s*.*?UTT\s+(\d+)\s+unique=(\d+)\s+due=(\d+)\s+cov=(\d+)%\s+frozen=(\d+)ms\s+episodes=(\d+)')
PLAYER=re.compile(r'BithumanAvatar.*?COVERAGE speechWritten=(\d+)\s+speechPresented=(\d+)\s+uniqueShown=(\d+)\s+due=(\d+)\s+cov=(\d+)%')
VOICED=re.compile(r'\[bhdeliver\]\s+reply audio_s=([0-9.]+)\s+wall_s=([0-9.]+).*?deltas=(\d+)')

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--logcat",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    p.add_argument("--baseline-unique",type=int,default=3)
    p.add_argument("--baseline-due",type=int,default=360)
    p.add_argument("--require-improvement",action="store_true")
    a=p.parse_args()
    lines=a.logcat.read_text(errors="replace").splitlines()
    utterances=[]
    frames=[]
    audio=[]
    for line in lines:
        m=UTT.search(line)
        if m:
            n,unique,due,cov,frozen,episodes=map(int,m.groups())
            utterances.append({"turn":n,"unique":unique,"due":due,"printed_cov":cov,
                                "actual_percent":100*unique/due if due else None,
                                "frozen_ms":frozen,"frozen_episodes":episodes})
        m=PLAYER.search(line)
        if m:
            n,p,u,d,c=map(int,m.groups())
            frames.append({"written":n,"presented":p,"unique":u,"due":d,"printed_cov":c})
        m=VOICED.search(line)
        if m:
            duration,wall,delta=m.groups()
            audio.append({"seconds":float(duration),"wall":float(wall),"deltas":int(delta)})
    # Do not infer a good lip-sync from speechPresented (it counts held frames).
    best=max(utterances,key=lambda v:v["actual_percent"] or 0) if utterances else None
    baseline_percent=100*a.baseline_unique/a.baseline_due
    comparable=[u for u in utterances if u["due"]>=200]
    improved=bool(comparable and max(u["actual_percent"] for u in comparable)>=max(baseline_percent*4,5.0))
    report={
      "engine":"original Essence2 Android 0.9.5",
      "baseline_original_skipAhead_OFF":{"unique":a.baseline_unique,"due":a.baseline_due,
         "actual_percent":baseline_percent},
      "utterances":utterances,
      "newest_global_player":frames[-1] if frames else None,
      "voiced_audio_turns":audio,
      "best_due_200_or_more":max(comparable,key=lambda u:u["actual_percent"]) if comparable else None,
      "meaningful_improvement_at_least_5pct":improved,
      "AV_smoothness_verified":improved and bool(audio),
      "GalaxyFlip3_measured":False,
    }
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,indent=2)+"\n")
    for u in utterances:
        print("ESSENCE2_ORIGINAL_COVERAGE_UTT_"+str(u["turn"]),
              "unique="+str(u["unique"]),"due="+str(u["due"]),
              "pct="+str(round(u["actual_percent"],3)),
              "frozen_ms="+str(u["frozen_ms"]))
    print("ESSENCE2_ORIGINAL_COVERAGE_BASELINE_PERCENT",baseline_percent)
    print("ESSENCE2_MEANINGFUL_COVERAGE_IMPROVEMENT",improved)
    if not utterances:
        print("NO_VERIFIED_NATIVE_UTTERANCE_COVERAGE")
    if a.require_improvement and not report["AV_smoothness_verified"]:
        raise SystemExit("FAIL_ESSENCE2_ORIGINAL_SKIP_AHEAD_DID_NOT_IMPROVE_MOUTH_COVERAGE_ABOVE_FLOOR")

if __name__=="__main__":main()
