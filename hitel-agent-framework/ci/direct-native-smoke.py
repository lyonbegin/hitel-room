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
            # Settings titles may be exposed via contentDescription or omitted
            # from the active accessibility tree. Require destination-specific
            # controls as evidence rather than relying on a single title.
            trace = []
            trace_path = Path(os.environ["HITEL_DIRECT_REPORT"]).with_name("direct-native-observations.json")
            def labels(screen):
                return {str(n.get(k, "")).strip().casefold()
                        for n in screen.get("nodes", []) for k in ("text", "description")
                        if n.get(k)}
            async def observe(phase):
                s = await act("get_screen_info")
                assert s["package"] == "com.android.settings", s["package"]
                trace.append({"phase": phase, "package": s["package"],
                              "labels": sorted(labels(s))})
                trace_path.write_text(json.dumps(trace, indent=2))
                print(phase + ": " + json.dumps(trace[-1]), flush=True)
                return s
            parent_label = "network & internet"
            destination_controls = {
                "internet", "sims", "sim cards", "airplane mode",
                "hotspot & tethering", "data saver", "vpn", "private dns",
                "mobile network", "adaptive connectivity", "wifi", "wi-fi"
            }
            def is_destination(s):
                return len(labels(s) & destination_controls) >= 2
            async def wait_for(phase, predicate):
                for i in range(3):
                    await asyncio.sleep(1)
                    s = await observe(phase + "-" + str(i + 1))
                    if predicate(s):
                        return s
                raise AssertionError(phase + " not verified; see observations")
            await act("open_app", {"package": "com.android.settings"})
            screen = await wait_for("settings-parent", lambda s: parent_label in labels(s) and not is_destination(s))
            candidates = [n for n in screen["nodes"] if parent_label in
                          {str(n.get("text", "")).strip().casefold(),
                           str(n.get("description", "")).strip().casefold()}]
            assert candidates, "Settings entry missing"
            node = next((n for n in candidates if n.get("clickable")), candidates[0])
            await act("tap", {"x": node["x"], "y": node["y"]})
            after = await wait_for("network-destination", lambda s: s["nodes"] != screen["nodes"] and is_destination(s))
            await act("back")
            back = await wait_for("settings-return", lambda s: s["nodes"] != after["nodes"] and parent_label in labels(s) and not is_destination(s))
            Path(os.environ["HITEL_DIRECT_REPORT"]).write_text(json.dumps({"native_open_app":"verified","native_screen_tree":"verified","native_tap":"verified","native_back":"verified","transport":"authenticated MCP + native callback"},indent=2))
            print("Native direct open, observation, tap and back verified.")
asyncio.run(main())
