"""Text planning only: reuse original ARTEMIS prompt, grammar and model factory."""
import json
import os
from pathlib import Path
from jinja2 import Template
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from artemis.agents.planner.planner import build_planner_system_blocks, validate_plan_format
from artemis.utils.plan_grammar import render_plan_grammar_spec
from artemis.llm.router import ModelEndpoint, ModelFactory, ModelProvider
from hitel_transport import approved_task, ContractError

approved_task()
goal = os.environ["HITEL_MISSION"].strip()
root = Path(os.environ["GITHUB_WORKSPACE"])
prompts = json.loads((root/"upstream-artemis/artemis/agents/planner/planner.json").read_text())
blocks = build_planner_system_blocks(prompts,"initial_plan",False)
system = Template("\n\n".join(prompts["blocks"][k] for k in blocks)).render(plan_grammar=render_plan_grammar_spec(midway=False,final=False))
system += "\nText-only planning test. No device screenshot or inventory is available. Do not claim observed state or executed actions. Explicitly include discovery of actual device capabilities when required."
human = Template(prompts["modes"]["initial_plan"]["human"]).render(initial_goal=goal)
tools = [{"type":"function","function":{"name":"save_note","description":"Save a plan or scratchpad in this planning-only test","parameters":{"type":"object","properties":{"key":{"type":"string"},"content":{"type":"string"}},"required":["key","content"],"additionalProperties":False}}}]
model = ModelFactory.get_model(ModelEndpoint(provider=ModelProvider.CUSTOM,model_name="hitel-chatgpt-web-wrapper",is_multimodal=False)).bind_tools(tools)
messages = [SystemMessage(content=system),HumanMessage(content=human)]
notes = {}
for _ in range(4):
    reply = model.invoke(messages)
    messages.append(reply)
    for call in reply.tool_calls:
        args=call["args"]
        if len(args["content"])>20000:
            raise ContractError("Note too long")
        notes[args["key"]]=args["content"]
        messages.append(ToolMessage(content="Saved planning note",tool_call_id=call["id"]))
    if "task_plan" in notes:
        valid, why=validate_plan_format(notes["task_plan"])
        if not valid:
            raise ContractError("Plan grammar failed: "+why)
        if any(line.lstrip().startswith("- [x]") for line in notes["task_plan"].splitlines()):
            raise ContractError("Planning-only mode cannot mark work completed")
        out=root/"console-results";out.mkdir(exist_ok=True)
        (out/"task_plan.md").write_text(notes["task_plan"],encoding="utf-8")
        (out/"result.json").write_text(json.dumps({"provider":"hitel","mode":"text-planning-only","plan_grammar_verified":True,"device_execution_verified":False},indent=2))
        print("HITEL response and ARTEMIS plan grammar verified; device execution not performed")
        break
    if not reply.tool_calls:
        raise ContractError("Planner did not submit a plan")
else:
    raise ContractError("Planner did not save task_plan within four calls")
