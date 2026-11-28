import unittest
from unittest.mock import patch
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from hitel_model import HitelChatModel, ContractError
class Result(BaseModel):
    answer: str
class ModelTests(unittest.TestCase):
    def test_plain(self):
        with patch("hitel_model.complete",return_value='{"content":"ok","tool_calls":[]}'):
            self.assertEqual(HitelChatModel().invoke([HumanMessage(content="hi")]).content,"ok")
    def test_structured(self):
        with patch("hitel_model.complete",return_value='{"content":"","tool_calls":[{"name":"Result","args":{"answer":"ok"}}]}'):
            self.assertEqual(HitelChatModel().with_structured_output(Result).invoke([HumanMessage(content="hi")]).answer,"ok")
    def test_unknown_tool(self):
        with patch("hitel_model.complete",return_value='{"content":"","tool_calls":[{"name":"bad","args":{}}]}'):
            with self.assertRaises(ContractError):HitelChatModel().invoke([HumanMessage(content="hi")])
    def test_image_rejected_without_call(self):
        with patch("hitel_model.complete") as send:
            with self.assertRaises(ContractError):HitelChatModel().invoke([HumanMessage(content=[{"type":"image_url","image_url":{"url":"data:image/png;base64,AAAA"}}])])
            send.assert_not_called()
if __name__=="__main__":unittest.main()
