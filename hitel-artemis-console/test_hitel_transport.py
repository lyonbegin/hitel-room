import base64, json, unittest, os, tempfile
from pathlib import Path
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
            with self.assertRaises(c.ApprovalError): c.client_task()
    def test_rejection_exact_project(self):
        self.assertIsNone(c.rejection_in_log("PROJECT_REJECTED artemis-other operator live approval missing","artemis-test"))
        self.assertEqual(c.rejection_in_log("2026-11-28T00:00:00Z PROJECT_REJECTED artemis-test operator live approval missing","artemis-test"),"operator live approval missing")
    def test_rejection_before_state(self):
        def api(method,path,body=None,token=None):
            self.assertEqual(method,"GET")
            if path.startswith("/contents/"): return None
            if path.startswith("/actions/workflows/"): return {"workflow_runs":[{"id":7,"head_branch":c.BRANCH,"path":".github/workflows/universal-ai.yml","head_sha":"commit","status":"completed"}]}
            if path.endswith("/jobs"): return {"jobs":[{"name":"run","id":8}]}
            if path.endswith("/logs"): return "PROJECT_REJECTED artemis-test operator live approval missing"
            raise AssertionError(path)
        with self.assertRaises(c.ProjectRejected):
            c.wait_project("artemis-test",call=api,timeout=30,registration={"commit":{"sha":"commit"}})
    def test_pending_resume_get_only(self):
        now=[0]
        def api(method,path,body=None,token=None):
            self.assertEqual(method,"GET")
            return {"workflow_runs":[]} if path.startswith("/actions/workflows/") else None
        with self.assertRaises(c.ProjectPending) as e:
            c.wait_project("artemis-test",call=api,timeout=35,clock=lambda:now[0],sleep=lambda sec:now.__setitem__(0,now[0]+sec))
        self.assertEqual(e.exception.project_id,"artemis-test")
    def test_request_id_stable_across_runner(self):
        with patch.dict(os.environ,{"task_id":"artemis-test","GH_TOKEN":"fixture","ARTEMIS_REQUEST_ID":"request-001","GITHUB_RUN_ID":"100","ARTEMIS_API_MODE":"runtime"},clear=True):
            with patch("hitel_transport.register",return_value=None),patch("hitel_transport.wait_project",return_value="answer") as wait:
                c.complete("same")
                first=wait.call_args.args[0]
                os.environ["GITHUB_RUN_ID"]="101"
                c.complete("same")
                self.assertEqual(first,wait.call_args.args[0])
    def test_dispatch_only_once_if_missing(self):
        now=[0]; posts=[]
        def api(method,path,body=None,token=None):
            if method=="POST": posts.append(body); raise TimeoutError("uncertain dispatch")
            return {"workflow_runs":[]} if path.startswith("/actions/workflows/") else None
        with self.assertRaises(c.ProjectPending):
            c.wait_project("artemis-test",call=api,timeout=100,clock=lambda:now[0],sleep=lambda sec:now.__setitem__(0,now[0]+sec),registration={"commit":{"sha":"commit"}})
        self.assertEqual(len(posts),1)
    def test_connector_default_no_runtime_token_or_writes(self):
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ,{"task_id":"artemis-test","ARTEMIS_REQUEST_ID":"request-001","GITHUB_WORKSPACE":root},clear=True):
            calls=[]
            def api(method,path,body=None,token=None):
                calls.append((method,path,token))
                self.assertEqual(method,"GET")
                self.assertIsNone(token)
                return None
            with self.assertRaises(c.ProjectPending) as e:
                c.complete("public synthetic goal",call=api)
            pid=e.exception.project_id
            artifact=Path(root)/"console-results"/"connector-projects"/(pid+".json")
            self.assertEqual(json.loads(artifact.read_text()),c.project_for("public synthetic goal","artemis-test","request-001"))
            self.assertEqual(len(calls),1)
            self.assertIn("not confirmed",e.exception.reason)
    def test_connector_verified_answer_and_definition(self):
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ,{"GITHUB_WORKSPACE":root},clear=True):
            p=c.project_for("public synthetic goal","artemis-test","request-001")
            state={"status":"complete","definition_sha":c.definition_sha(p),"provider":"hitel","total":1,"mock_completed":0,"verified_ai_completed":1,"results":[{"record_id":"turn-1","answer":"ok"}]}
            def api(method,path,body=None,token=None):
                self.assertEqual(method,"GET")
                data=(json.dumps(p).encode() if "project.json" in path else json.dumps(state).encode() if "state.json" in path else b"record_id,answer\nturn-1,ok\n")
                return {"encoding":"base64","content":base64.b64encode(data).decode()}
            self.assertEqual(c.connector_result(p,call=api),"ok")
            state["definition_sha"]="different"
            with self.assertRaises(c.ContractError): c.connector_result(p,call=api)
            state["definition_sha"]=c.definition_sha(p)
            state["provider"]="mock"
            with self.assertRaises(c.ContractError): c.connector_result(p,call=api)
    def test_runtime_still_requires_token(self):
        with patch.dict(os.environ,{"task_id":"artemis-test","ARTEMIS_API_MODE":"runtime"},clear=True):
            with self.assertRaises(c.ApprovalError): c.client_task()
if __name__=="__main__": unittest.main()
