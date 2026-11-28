import unittest
from unittest.mock import patch
import os
with patch.dict(os.environ,{"GITHUB_REPOSITORY":"lyonbegin/hitel-room","GITHUB_RUN_ID":"1","REPORT_ISSUE":"17"}):
    from poll_progress import snapshot
class PollTests(unittest.TestCase):
    def test_missing(self):
        self.assertEqual(snapshot([{"name":"Poll and report ARTEMIS progress"}])[0][0],"queued")
    def test_blocked(self):
        state,msg=snapshot([{"name":"mission","status":"completed","conclusion":"failure","steps":[{"name":"Check live Web2 task approval (no API request)","status":"completed","conclusion":"failure"}]}])
        self.assertEqual(state[0],"completed")
        self.assertIn("실제 API 요청 없음",msg)
    def test_live_skipped(self):
        _,msg=snapshot([{"name":"mission","status":"completed","conclusion":"success","steps":[{"name":"Run approved HITEL-backed ARTEMIS text plan","status":"completed","conclusion":"skipped"}]}])
        self.assertIn("실제 AI 성공 증거 없음",msg)
if __name__=="__main__":unittest.main()
