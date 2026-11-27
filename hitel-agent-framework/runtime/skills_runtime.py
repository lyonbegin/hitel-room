"""Evidence-bound skill candidates. Start with no app inventory and no built-in recipes."""
import json
import re
import uuid
from artemis.runtime import trace_store
from mcp_server.tools.task_runner import mobile_run_task

def register(mcp, connect):
    with connect() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY, capability TEXT NOT NULL, package TEXT NOT NULL,
            version TEXT NOT NULL, steps TEXT NOT NULL, source_trace TEXT NOT NULL,
            replay_trace TEXT, state TEXT NOT NULL)""")

    def trace(trace_id):
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", trace_id):
            raise ValueError("Invalid trace identifier")
        result=trace_store.read_status(trace_id)
        if not result or result.get("status") != "completed" or result.get("error"):
            raise ValueError("Completed, error-free ARTEMIS trace required")
        return result

    @mcp.tool()
    def hitel_explore_capability(capability: str, device_serial: str | None = None) -> dict:
        """Explore a capability on an authorized test device, with no fixed app list.
        Inspect existing apps; discover a suitable Play Store app only when needed.
        Never enter credentials, evade authentication, purchase, or send messages.
        """
        if not capability.strip() or len(capability)>2000:
            raise ValueError("Invalid capability")
        goal=("On an authorized test device, explore this capability: "+capability+
              "\nInspect installed apps first. If none is suitable, search Google Play, "
              "inspect real candidates and install an appropriate free app if available. "
              "Stop and report any login, OTP, CAPTCHA, payment or consent requirement. "
              "Do not send messages, create accounts or make purchases. "
              "Return actual package/version, observed UI steps and evidence; "
              "do not invent successful installation or claim a blocked task succeeded.")
        return mobile_run_task(task_desc=goal, model="Pro", device_serial=device_serial,
                               verification_level="strict",
                               expected_output_desc="Actual observed UI sequence and verified outcome or blocker")

    @mcp.tool()
    def hitel_create_skill_candidate(capability: str, package: str, version: str,
                                     observed_steps: list[str], source_trace: str) -> dict:
        """Save a draft recipe grounded in an existing completed ARTEMIS trace.
        Drafts are never automatically published; run and inspect a replay first.
        """
        trace(source_trace)
        if not re.fullmatch(r"[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+",package):
            raise ValueError("Invalid package")
        if not capability.strip() or not version.strip() or not observed_steps or len(observed_steps)>100:
            raise ValueError("Capability, version and observed steps required")
        if len(json.dumps(observed_steps))>30000:
            raise ValueError("Skill too large")
        skill_id=uuid.uuid4().hex
        with connect() as conn:
            conn.execute("INSERT INTO skills VALUES(?,?,?,?,?,?,NULL,'draft')",
                         (skill_id,capability,package,version,json.dumps(observed_steps),source_trace))
        return {"skill_id":skill_id,"state":"draft"}

    @mcp.tool()
    def hitel_list_skills(include_drafts: bool = False) -> list[dict]:
        """List reusable verified skills, optionally including unpublished drafts."""
        with connect() as conn:
            rows=conn.execute("SELECT id,capability,package,version,state FROM skills" +
                              ("" if include_drafts else " WHERE state='verified'")).fetchall()
        return [dict(r) for r in rows]

    @mcp.tool()
    def hitel_replay_skill(skill_id: str, device_serial: str | None = None) -> dict:
        """Start a real test-device replay of an observed draft or verified recipe."""
        with connect() as conn:
            row=conn.execute("SELECT * FROM skills WHERE id=?",(skill_id,)).fetchone()
        if not row:
            raise ValueError("Unknown skill")
        task=("Validate this recorded test-device recipe without inventing missing UI steps. "
              "Stop before credential entry, purchases, account creation or real messages. "
              "Confirm app version and every required checkpoint. Capability: "+row["capability"]+
              "\nPackage: "+row["package"]+" Version: "+row["version"]+
              "\nSteps: "+row["steps"])
        result=mobile_run_task(task_desc=task, model="Pro", device_serial=device_serial,
                               locked_app_package=row["package"], verification_level="strict")
        if result.get("trace_id"):
            with connect() as conn:
                conn.execute("UPDATE skills SET replay_trace=?, state='draft' WHERE id=?",
                             (result["trace_id"],skill_id))
        return result

    @mcp.tool()
    def hitel_publish_skill(skill_id: str, operator_verified: bool = False) -> dict:
        """Publish only after an operator has reviewed actual successful replay evidence.
        Do not assert operator_verified without an actual review.
        """
        if not operator_verified:
            raise ValueError("Operator review required")
        with connect() as conn:
            row=conn.execute("SELECT * FROM skills WHERE id=?",(skill_id,)).fetchone()
            if not row or not row["replay_trace"] or row["source_trace"]==row["replay_trace"]:
                raise ValueError("Independent replay required")
            trace(row["replay_trace"])
            conn.execute("UPDATE skills SET state='verified' WHERE id=?",(skill_id,))
        return {"skill_id":skill_id,"state":"verified"}
