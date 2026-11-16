// "This character is still being prepared for this device" (2.6.40): the door's 404 MODEL_ARTIFACT_NOT_READY
// as a typed, retryable state.
//
// bitHuman's model door answers a character whose on-device model does not exist yet (an agent still training,
// or one whose device copy is being built) with exactly this, on every device door (the container, `&member=`,
// and the Android and web forms):
//
//     HTTP/1.1 404
//     {"error": {"code": "MODEL_ARTIFACT_NOT_READY", "message": "...", "httpStatus": 404, "reason": "DEVICE_BUILD_PENDING"}}
//
// It is the documented POLLABLE answer: the same request succeeds once the model is ready. `code` is the first key
// of `error` and `reason` is a flat string after it. Through 2.6.39 this package treated it as a door that "could not
// confirm this credential" (BithumanEntitlementException, refused false), and Android's load failed as
// `entitlement_unconfirmed`, so apps showed a credential problem or a failure that is not retried. From 2.6.40 it is
// [BithumanModelPreparing]: nothing is wrong with the credential or the character, try again later.
//
// HOW IT IS RECOGNISED (one rule, Dart and Android): HTTP 404 from the door that was asked (never a storage host
// behind its redirect) whose body's FIRST `"code": "…"` within its first 300 bytes is MODEL_ARTIFACT_NOT_READY, as
// bitHuman's Swift and Android stores read it. The message text is never parsed. `reason` is read as a flat string;
// an ETA only from a structured field (the `Retry-After` header in seconds, or a numeric `eta_s` in `error`), never
// from the message.
//
// Apache-2.0; (c) bitHuman.
import 'dart:convert';
import 'dart:math' as math;

import 'door_gate.dart';

/// The door's code for a model that is still being prepared (HTTP 404).
const String kModelArtifactNotReady = 'MODEL_ARTIFACT_NOT_READY';

/// How much of a door's error body is read for its code: the first 300 bytes, as bitHuman's Swift and Android
/// stores read it (the door writes `code` first).
const int kDoorCodeWindow = 300;

/// The first `"code": "…"` within the first [kDoorCodeWindow] bytes of a door's error body, or null.
String? doorHeadCode(List<int> body) =>
    doorErrorCode(utf8.decode(body.length > kDoorCodeWindow ? body.sublist(0, kDoorCodeWindow) : body,
        allowMalformed: true));

/// `error.reason` of a door's error body when it is a flat string (`"reason": "DEVICE_BUILD_PENDING"`), or null.
String? doorReason(String body) => RegExp(r'"reason"\s*:\s*"([A-Za-z0-9_]+)"').firstMatch(body)?.group(1);

/// A structured ETA, in seconds: the `Retry-After` header (delta-seconds), else a numeric `eta_s` in the body.
/// Null when neither is there. Never read from the message text.
int? doorEtaSeconds(String body, {String? retryAfter}) {
  final h = int.tryParse(retryAfter?.trim() ?? '');
  if (h != null && h >= 0) return h;
  final m = RegExp(r'"eta_s"\s*:\s*(\d{1,7})(?![\d.])').firstMatch(body);
  return m == null ? null : int.parse(m.group(1)!);
}

/// The character is still being prepared for this device: bitHuman's door answered 404 `MODEL_ARTIFACT_NOT_READY`
/// (2.6.40). Not a failure of the credential or of the character: the same call succeeds once the model is ready,
/// typically within minutes to about an hour and a half. Show [userMessage] (and [eta] when there is one) and try
/// again on [retryDelay]'s schedule, or let [retryWhileModelPreparing] do it.
///
/// Thrown by `downloadAgentImx`, `downloadExpression2Avatar`, `downloadExpression2Agent`, `downloadEssence2Bundle`
/// and (on Android, where the plugin fetches by code) `BithumanAvatar.load`. It is a [BithumanEntitlementException]
/// with [refused] false and [status] 404, so code written for 2.6.39 that catches that still catches it; test for
/// this type first.
class BithumanModelPreparing extends BithumanEntitlementException {
  const BithumanModelPreparing(super.message, {this.reason, this.etaS}) : super(refused: false, status: 404);

  /// Android's method-channel error code for this state (`PlatformException.code`).
  static const String channelCode = 'model_preparing';

  /// The door's code: always [kModelArtifactNotReady].
  String get code => kModelArtifactNotReady;

  /// The door's flat sub-code, when it sent one (for example `DEVICE_BUILD_PENDING`). For logs; never needed to
  /// decide anything.
  final String? reason;

  /// Seconds until the model is expected to be ready, when the door said so in a structured field; else null.
  final int? etaS;

  /// [etaS] as a duration.
  Duration? get eta => etaS == null ? null : Duration(seconds: etaS!);

  /// What to tell a person (no credential or error wording): "Preparing this character for your device…".
  static const String userMessage = 'Preparing this character for your device…';

  /// The retry schedule: 30 s, 60 s, 120 s, then every 300 s. Never faster than every 30 s (the door's polling
  /// guidance).
  static const List<Duration> retrySchedule = [
    Duration(seconds: 30),
    Duration(seconds: 60),
    Duration(seconds: 120),
    Duration(seconds: 300),
  ];

  /// How long to wait before try [attempt] + 1, after [attempt] answers of "preparing" (1-based): [retrySchedule]
  /// (the last step repeats) plus up to 10% jitter, so devices that met the same answer do not all come back at
  /// once. Always at least 30 s; at most 330 s.
  static Duration retryDelay(int attempt, {math.Random? random}) {
    final i = (attempt < 1 ? 1 : attempt) - 1;
    final base = retrySchedule[i < retrySchedule.length ? i : retrySchedule.length - 1];
    final r = (random ?? math.Random()).nextDouble();
    return base + Duration(milliseconds: (base.inMilliseconds * 0.1 * r).round());
  }

  /// From Android's `model_preparing` channel error: its message and its details map
  /// (`{"status": 404, "code": "MODEL_ARTIFACT_NOT_READY", "reason": ..., "etaS": ...}`).
  factory BithumanModelPreparing.fromChannel(String? message, Object? details) {
    final d = details is Map ? details : const {};
    final reason = d['reason'];
    final eta = d['etaS'];
    return BithumanModelPreparing(message ?? 'this character is still being prepared for this device (HTTP 404 $kModelArtifactNotReady)',
        reason: reason is String && reason.isNotEmpty ? reason : null, etaS: eta is int && eta >= 0 ? eta : null);
  }

  @override
  String toString() => 'BithumanModelPreparing: $message';
}

/// Runs [call] and, while it throws [BithumanModelPreparing], runs it again on [BithumanModelPreparing.retryDelay]'s
/// schedule (30 s, 60 s, 120 s, then every 300 s, with jitter). [onPreparing] hears each answer and the wait before
/// the next try (show [BithumanModelPreparing.userMessage] then). Any other error is rethrown at once.
///
/// Stopping (the screen is closed, another character is picked): complete [cancel], or have [cancelled] say true.
/// [cancel] also ends a wait under way at once; [cancelled] is checked before each wait and each try. Either way the
/// last [BithumanModelPreparing] is rethrown and nothing is tried after that. [sleep] is the wait (tests replace it).
Future<T> retryWhileModelPreparing<T>(
  Future<T> Function() call, {
  void Function(BithumanModelPreparing preparing, Duration nextTry)? onPreparing,
  bool Function()? cancelled,
  Future<void>? cancel,
  Future<void> Function(Duration wait)? sleep,
  math.Random? random,
}) async {
  var stopped = false;
  final stop = cancel?.then<void>((_) => stopped = true, onError: (Object _) => stopped = true);
  bool done() => stopped || (cancelled?.call() ?? false);
  for (var attempt = 1;; attempt++) {
    try {
      return await call();
    } on BithumanModelPreparing catch (p) {
      if (done()) rethrow;
      final wait = BithumanModelPreparing.retryDelay(attempt, random: random);
      onPreparing?.call(p, wait);
      final slept = (sleep ?? Future<void>.delayed)(wait);
      await (stop == null ? slept : Future.any<void>([slept, stop]));
      if (done()) rethrow;
    }
  }
}
