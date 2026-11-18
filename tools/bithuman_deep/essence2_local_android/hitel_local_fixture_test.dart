import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:avatar_chat/hitel_offline_runtime.dart';

void main() {
  test('Essence2 five-sample local debug HTTP and meter fixture contract', () async {
    final runtime = HitelOfflineRuntime();
    final token = await runtime.start();
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    final allowed = <String>[
      'A52DHS2219',
      'A21SKT4314',
      'A62SJB3901',
      'A23KSG5258',
      'A24EKJ8433'
    ];

    Future<(int, Map<String, dynamic>?)> call(
        String method, String path, {String? apiSecret}) async {
      final uri = Uri.parse('http://127.0.0.1:18762$path');
      final request = method == 'GET'
          ? await client.getUrl(uri)
          : await client.postUrl(uri);
      request.headers.set('api-secret', apiSecret ?? token);
      final response = await request.close();
      final raw = await utf8.decoder.bind(response).join();
      if (raw.isEmpty) return (response.statusCode, null);
      return (response.statusCode, jsonDecode(raw) as Map<String, dynamic>);
    }

    try {
      for (final code in allowed) {
        final (status, body) = await call('GET',
            '/v1/agent/$code/model/download?model=essence-2&redirect=false');
        expect(status, HttpStatus.ok, reason: code);
        expect(body?['valid'], true);
        expect(body?['meter_tail'], true);
        expect(body?['licensed_vendor_entitlement'], false);
        expect(body?['product'], 'essence-2');
      }

      final (badCodeStatus, _) = await call('GET',
          '/v1/agent/A000000000/model/download?model=essence-2&redirect=false');
      expect(badCodeStatus, HttpStatus.notFound);

      final (badTokenStatus, _) = await call('GET',
          '/v1/agent/A52DHS2219/model/download?model=essence-2&redirect=false',
          apiSecret: 'incorrect');
      expect(badTokenStatus, HttpStatus.unauthorized);

      final (authStatus, authBody) = await call('POST', '/v1/auth/validate');
      expect(authStatus, HttpStatus.ok);
      expect(authBody?['valid'], true);
      expect(authBody?['meter_tail'], true);

      final (meterStatus, meterBody) = await call('POST', '/v1/meter/beats');
      expect(meterStatus, HttpStatus.ok);
      expect(meterBody?['meter_tail'], true);
      expect(meterBody?['licensed_vendor_entitlement'], false);
    } finally {
      client.close(force: true);
      await runtime.close().timeout(const Duration(seconds: 15));
    }
  });
}
