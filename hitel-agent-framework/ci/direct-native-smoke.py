import asyncio,json,os,time
from pathlib import Path
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client("http://127.0.0.1:8766/mcp", headers={"Authorization":"Bearer "+os.environ["HITEL_CONTROLLER_TOKEN"]}) as (read,write,_):
        async with ClientSession(read,write) as session:
            await session.initialize()
            def unpack(result):
                assert not result.isError, str(result.content)
                return json.loads(result.content[0].text)
            async def act(action, args={}):
                q=unpack(await session.call_tool("hitel_direct_action",{"action":action,"args":args}))
                for i in range(45):
                    await asyncio.sleep(.5)
                    state=unpack(await session.call_tool("hitel_direct_status",{"request_id":q["id"]}))
                    if state["state"] in {"completed","failed"}:
                        assert state["state"]=="completed",state
                        return state["result"]
                raise RuntimeError("No native callback: "+action)
            # Every command below is executed by native PokeClaw, never adb input.
            await act("open_app",{"package":"com.android.settings"})
            await asyncio.sleep(2)
            screen=await act("get_screen_info")
            assert screen["package"]=="com.android.settings",screen["package"]
            node=next((n for n in screen["nodes"] if n["text"]=="Network & internet" or n["description"]=="Network & internet"),None)
            assert node,"Network & internet not found"
            await act("tap",{"x":node["x"],"y":node["y"]})
            await asyncio.sleep(2)
            after=await act("get_screen_info")
            assert after["package"]=="com.android.settings"
            assert after["nodes"]!=screen["nodes"],"UI unchanged after native tap"
            assert any(n["text"]=="Network & internet" for n in after["nodes"]),"target page missing"
            await act("back")
            await asyncio.sleep(1)
            back=await act("get_screen_info")
            assert back["package"]=="com.android.settings" and back["nodes"]!=after["nodes"]
            Path(os.environ["HITEL_DIRECT_REPORT"]).write_text(json.dumps({"native_open_app":"verified","native_screen_tree":"verified","native_tap":"verified","native_back":"verified","transport":"authenticated MCP + native callback"},indent=2))
            print("Native direct open, observation, tap and back verified.")
asyncio.run(main())
