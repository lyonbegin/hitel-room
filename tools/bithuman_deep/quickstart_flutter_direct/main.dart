// Flutter-only display shell. All model/PCM/frame operations use the original
// Android Essence2 SDK sample through the one native method channel.
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() => runApp(const MaterialApp(home: Quickstart()));

class Quickstart extends StatefulWidget {
  const Quickstart({super.key});
  @override
  State<Quickstart> createState() => _QuickstartState();
}

class _QuickstartState extends State<Quickstart> {
  static const native = MethodChannel('hitel.e2.direct.quickstart');
  final secret = TextEditingController();
  final file = TextEditingController();
  int? textureId;
  bool loading = false;
  String status = 'Essence2 PCM → feed → pull';

  @override
  void initState() {
    super.initState();
    native.setMethodCallHandler((call) async {
      if (call.method == 'status' && mounted) {
        setState(() => status = call.arguments.toString());
      }
    });
  }

  Future<void> start() async {
    if (loading) return;
    if (secret.text.trim().isEmpty) {
      setState(() => status = 'bitHuman API secret required');
      return;
    }
    setState(() {
      loading = true;
      status = 'Loading WAV';
    });
    try {
      final path = file.text.trim();
      final Uint8List wav;
      if (path.isEmpty) {
        final asset = await rootBundle.load('assets/speech.wav');
        wav = asset.buffer.asUint8List(asset.offsetInBytes, asset.lengthInBytes);
      } else {
        wav = await File(path).readAsBytes();
      }
      final id = await native.invokeMethod<int>('start', {
        'secret': secret.text.trim(),
        'wav': wav,
      });
      if (mounted) setState(() => textureId = id);
    } catch (e) {
      if (mounted) setState(() => status = 'Failed: $e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    secret.dispose();
    file.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Column(
        children: [
          TextField(controller: secret, obscureText: true,
            decoration: const InputDecoration(labelText: 'bitHuman API secret (not stored)')),
          TextField(controller: file,
            decoration: const InputDecoration(labelText: 'WAV path (blank = bundled speech.wav)')),
          ElevatedButton(onPressed: loading ? null : start, child: const Text('Run quickstart')),
          Text(status),
          Expanded(child: textureId == null
            ? const SizedBox()
            : Texture(textureId: textureId!)),
        ],
      ),
    ),
  );
}
