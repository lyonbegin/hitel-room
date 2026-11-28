import os, tempfile, unittest, json
from pathlib import Path
from unittest.mock import patch
from hitel_transport import complete, approved_task, ContractError, ApprovalError

class Stub:
    def __init__(self, uncertain=False, invalid=False):
        self.j=None; self.posts=0; self.uncertain=uncertain; self.invalid=invalid
    def get(self,p):
        if p.startswith("/requests/"):return self.j
        return dict(self.j,status="completed",result_ready=True,chatgpt_send_confirmed=True,assistant_reply_observed=not self.invalid)
    def submit(self,p,b,text):
        self.posts+=1
        if self.uncertain:raise OSError("uncertain")
        self.j=dict(request_id=b["request_id"],job_id="job_test",room_id="room_test")
        return self.j
    def result(self,job,r):return "verified test answer"

class TransportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.config=Path(self.tmp.name)/"task.json"
        self.config.write_text(json.dumps({"task_id":"artemis-test"}),encoding="utf-8")
        self.config_patch=patch("hitel_transport.TASK_CONFIG",self.config)
        self.config_patch.start();self.addCleanup(self.config_patch.stop)
        self.env=patch.dict(os.environ,{"HITEL_ALLOW_LIVE":"true","ACTIONS_ID_TOKEN_REQUEST_URL":"test","ACTIONS_ID_TOKEN_REQUEST_TOKEN":"test","GITHUB_RUN_ID":"123","GITHUB_RUN_ATTEMPT":"1","RUNNER_TEMP":self.tmp.name},clear=True)
        self.env.start();self.addCleanup(self.env.stop)
    def test_reconcile_no_duplicate(self):
        s=Stub()
        self.assertEqual(complete("one",transport=s),"verified test answer")
        self.assertEqual(complete("one",transport=s),"verified test answer")
        self.assertEqual(s.posts,1)
    def test_uncertain_no_resend(self):
        s=Stub(uncertain=True)
        with self.assertRaises(OSError):complete("one",transport=s)
        with self.assertRaises(ContractError):complete("one",transport=s)
        self.assertEqual(s.posts,1)
    def test_reject_unverified(self):
        with self.assertRaises(ContractError):complete("one",transport=Stub(invalid=True))
    def test_approval_gate(self):
        self.config.write_text(json.dumps({"task_id":"scribd-18109"}),encoding="utf-8")
        with self.assertRaises(ApprovalError):approved_task()
    def test_original_live_flag(self):
        os.environ.pop("HITEL_ALLOW_LIVE")
        with self.assertRaisesRegex(ApprovalError, "HITEL_ALLOW_LIVE"):
            approved_task()
    def test_size_limit(self):
        with self.assertRaises(ContractError):complete("x"*24001,transport=Stub())
if __name__=="__main__":unittest.main()
