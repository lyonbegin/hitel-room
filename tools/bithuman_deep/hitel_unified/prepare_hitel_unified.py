"""Add the new shared Flutter page after existing pinned Essence2 assembly."""
from pathlib import Path
import argparse
import shutil

p = argparse.ArgumentParser()
p.add_argument("--app", type=Path, required=True)
a = p.parse_args()
root = Path(__file__).parent
for dart in (root / "lib").glob("*.dart"):
    shutil.copyfile(dart, a.app / "lib" / dart.name)
main = a.app / "lib/main.dart"
s = main.read_text()
anchor = "              FloatingActionButton.small(heroTag: 'clear-logs',"
assert s.count(anchor) == 1, "pinned UI anchor changed"
s = "import 'hitel_communication_page.dart';\n" + s.replace(anchor, """              FloatingActionButton.small(heroTag: 'hitel-communication',
                tooltip: 'HITEL 통신 및 공개방',
                onPressed: () async {
                  await _avatar?.interrupt(reason: 'enter_communication');
                  if (!mounted) return;
                  await Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => const HitelCommunicationPage()));
                },
                child: const Icon(Icons.video_call_rounded)),
              const SizedBox(width: 8),
""" + anchor)
main.write_text(s)
print("PASS_HITEL_FLUTTER_COMMUNICATION_PAGE_WIRED")
