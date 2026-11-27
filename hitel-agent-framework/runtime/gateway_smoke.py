"""Real Streamable HTTP MCP transport + real ARTEMIS observation + simulated device callback."""
import asyncio
import json
import os
from pathlib import Path
import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    base = "http://127.0.0.1:8765"
    ctl = {"Authorization": "Bearer " + os.environ["HITEL_CONTROLLER_TOKEN"]}
    dev = {"Authorization": "Bearer " + os.environ["HITEL_DEVICE_TOKEN"]}
    async with httpx.AsyncClient(timeout=30) as http:
        for i in range(90):
            try:
                response = await http.get(base + "/device/pending", headers=dev)
                if response.status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            await asyncio.sleep(1)
        else:
            raise RuntimeError("gateway failed to start")
        assert (await http.get(base + "/device/pending")).status_code == 401
        assert (await http.get(base + "/device/pending", headers=ctl)).status_code == 401
        async with streamablehttp_client(base + "/mcp", headers=ctl) as (r,w,_):
            async with ClientSession(r,w) as session:
                await session.initialize()
                tools = {t.name for t in (await session.list_tools()).tools}
                assert {"mobile_get_device_state","mobile_run_task","hitel_submit_task","hitel_task_status","hitel_explore_capability","hitel_create_skill_candidate","hitel_replay_skill","hitel_publish_skill","hitel_list_skills"} <= tools
                empty = await session.call_tool("hitel_list_skills", {})
                assert not empty.isError and (empty.structuredContent is None or empty.structuredContent.get("result")==[]), empty
                invalid = await session.call_tool("hitel_create_skill_candidate", {"capability":"test","package":"com.example.test","version":"1","observed_steps":["open"],"source_trace":"nonexistent-trace"})
                assert invalid.isError, "An ungrounded skill must not be created"
                obs = await session.call_tool("mobile_get_device_state", {"view_type":"hierarchy"})
                assert not obs.isError and obs.content, obs
                observation = " ".join(getattr(x,"text","") for x in obs.content)
                assert observation.strip() and not observation.startswith("Error:"), observation
                print("ARTEMIS actual emulator hierarchy observed through HTTP MCP")
                result = await session.call_tool("hitel_submit_task", {"goal":"Read battery level"})
                assert not result.isError
                queued = (await http.get(base + "/device/pending", headers=dev)).json()
                task_id = queued["id"]
                assert queued["goal"] == "Read battery level"
                endpoint = base + "/device/tasks/" + task_id
                assert (await http.post(endpoint,headers=dev,json={"status":"completed"})).status_code == 409
                for status in ("approved","accepted","completed"):
                    reply = await http.post(endpoint,headers=dev,json={"status":status,"detail":"simulated client" if status=="completed" else ""})
                    assert reply.status_code == 200, reply.text
                end = await session.call_tool("hitel_task_status",{"request_id":task_id})
                assert not end.isError and "completed" in str(end.content)
                Path(os.environ["HITEL_OUT"], "http-mcp-test.json").write_text(json.dumps({
                    "http_mcp":"passed","upstream_device_observation":"passed",
                    "authentication":"passed","callback_protocol":"simulated_client_passed",
                    "native_pokeclaw_callback":"not_tested"},indent=2))
asyncio.run(main())
