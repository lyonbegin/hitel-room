import hashlib, unittest
from unittest.mock import patch
import web2_client as c
class ClientTests(unittest.TestCase):
    def test_verified_result(self):
        text="한글 응답"
        raw=text.encode()
        self.assertEqual(c.result("job_test",{"result_text":text,"result_length_bytes":len(raw),"result_sha256":hashlib.sha256(raw).hexdigest()}),text)
    def test_wrong_hash(self):
        with self.assertRaises(c.Blocked):
            c.result("job_test",{"result_text":"wrong","result_length_bytes":5,"result_sha256":"0"*64})
    def test_chunk_identity(self):
        with patch.object(c,"get",return_value={"job_id":"job_other"}):
            with self.assertRaises(c.Blocked):
                c.result("job_test",{"room_id":"room_test","result_length_bytes":5,"result_sha256":"0"*64})
if __name__=="__main__":unittest.main()
