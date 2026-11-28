import base64, json, unittest, os
from unittest.mock import patch
import hitel_transport as c
class ClientTests(unittest.TestCase):
    def test_project(self):
        p=c.project_for("public synthetic request","artemis-approved","1")
        self.assertEqual(p["provider"],"hitel")
        self.assertEqual(p["task_id"],"artemis-approved")
        self.assertEqual(p,c.project_for("public synthetic request","artemis-approved","1"))
    def test_register_original_endpoint(self):
        calls=[]
        def api(method,path,body=None,token=None):
            calls.append((method,path,body))
            return {"commit":{"sha":"test"}} if method=="PUT" else None
        p=c.project_for("public","artemis-approved","1")
        c.register(p,call=api,token="fixture")
        self.assertEqual(calls[1][0],"PUT")
        self.assertTrue(calls[1][1].startswith("/contents/universal/projects/"))
        self.assertEqual(calls[1][2]["branch"],c.BRANCH)
        self.assertEqual(json.loads(base64.b64decode(calls[1][2]["content"])),p)
    def test_no_overwrite(self):
        p=c.project_for("public","artemis-approved","1")
        def api(method,path,body=None,token=None):
            self.assertEqual(method,"GET")
            return {"encoding":"base64","content":base64.b64encode(json.dumps(p).encode()).decode()}
        self.assertIsNone(c.register(p,call=api,token="fixture"))
    def test_mock_not_live(self):
        with self.assertRaises(c.ContractError): c.verified_answer({"status":"complete","provider":"mock","total":1,"verified_ai_completed":0},b"")
    def test_verified_live(self):
        s={"status":"complete","provider":"hitel","total":1,"mock_completed":0,"verified_ai_completed":1,"results":[{"record_id":"turn-1","answer":"ok"}]}
        self.assertEqual(c.verified_answer(s,b"record_id,answer\nturn-1,ok\n"),"ok")
        with self.assertRaises(c.ContractError): c.verified_answer(s,b"record_id,answer\nturn-1,wrong\n")
    def test_approval_not_invented(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaises(c.ApprovalError): c.approved_task()
if __name__=="__main__": unittest.main()
