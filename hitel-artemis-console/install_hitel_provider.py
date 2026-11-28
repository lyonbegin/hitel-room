"""Install a small, opt-in provider hook against the pinned ARTEMIS checkout."""
import pathlib
import sys
root = pathlib.Path(sys.argv[1])
router = root / "artemis/llm/router.py"
services = root / "artemis/services/llm.py"
a = router.read_text()
b = services.read_text()
anchor = '        if os.environ.get("ARTEMIS_FAKE_LLM") == "1":'
hook = '''        if os.environ.get("HITEL_ARTEMIS_PROVIDER") == "1":
            from hitel_model import HitelChatModel
            return HitelChatModel()
'''
target = '    if getattr(ctx, "llm_config", None) is None:'
resolve = '''    if __import__("os").environ.get("HITEL_ARTEMIS_PROVIDER") == "1":
        return ModelEndpoint(provider=ModelProvider.CUSTOM, model_name="hitel-chatgpt-web-wrapper",
                             timeout_seconds=145, is_multimodal=False)
'''
if a.count(anchor) != 1 or b.count(target) != 1:
    raise SystemExit("Pinned ARTEMIS provider patch anchors changed")
router.write_text(a.replace(anchor,hook+anchor,1))
services.write_text(b.replace(target,resolve+target,1))
