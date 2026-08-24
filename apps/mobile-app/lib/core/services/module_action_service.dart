/// ============================================================================
/// MODULE ACTION SERVICE — Academia Helm Mobile
/// ============================================================================
///
/// A unified service that executes CRUD actions for ALL modules. Instead of
/// each module screen having stub `onAction` callbacks that show SnackBars,
/// this service provides a single `executeAction` method that:
///
/// 1. Identifies the module + action from the actionId
/// 2. Calls the appropriate API endpoint
/// 3. Returns success/failure
/// 4. The UI then refreshes the data provider
///

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import '../network/api_result.dart';

/// Result of an action execution.
class ActionResult {
  final bool success;
  final String message;
  final Map<String, dynamic>? data;

  const ActionResult({
    required this.success,
    required this.message,
    this.data,
  });

  const ActionResult.success({this.data, String? message})
      : success = true,
        message = message ?? 'Action réussie';

  const ActionResult.failure(String error)
      : success = false,
        message = error,
        data = null;
}

/// Executes module actions by mapping (endpoint, actionId, item) to API calls.
class ModuleActionService {
  ModuleActionService(this._apiClient);

  final ApiClient _apiClient;

  /// Execute an action on an item.
  ///
  /// [endpoint] is the base endpoint for the module (e.g. '/students/admissions')
  /// [actionId] is the action to perform (e.g. 'submit', 'accept', 'reject',
  /// 'delete', 'view', 'edit', 'create')
  /// [item] is the data item (must contain 'id' for most actions)
  /// [extraData] is optional payload (e.g. for create/edit forms)
  Future<ActionResult> executeAction({
    required String endpoint,
    required String actionId,
    required Map<String, dynamic> item,
    Map<String, dynamic>? extraData,
  }) async {
    final id = item['id']?.toString() ?? '';

    debugPrint(
        '[ModuleAction] endpoint=$endpoint action=$actionId id=$id');

    try {
      switch (actionId) {
        // ── Generic actions ────────────────────────────────────────────
        case 'view':
          return const ActionResult.success(
              message: 'Ouverture des détails');

        case 'edit':
          if (id.isEmpty) {
            return const ActionResult.failure('ID manquant');
          }
          final result = await _apiClient.patchRaw(
            '$endpoint/$id',
            data: extraData ?? {},
          );
          return _resultFromApi(result, 'Modifié avec succès');

        case 'delete':
          if (id.isEmpty) {
            return const ActionResult.failure('ID manquant');
          }
          final result = await _apiClient.deleteRaw('$endpoint/$id');
          return _resultFromApi(result, 'Supprimé avec succès');

        case 'create':
          final result = await _apiClient.postRaw(
            endpoint,
            data: extraData ?? {},
          );
          return _resultFromApi(result, 'Créé avec succès');

        // ── Students: Admissions ─────────────────────────────────────
        case 'submit':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/submit', data: {});
          return _resultFromApi(r, 'Soumis avec succès');

        case 'accept':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/accept', data: extraData ?? {});
          return _resultFromApi(r, 'Accepté avec succès');

        case 'reject':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/reject',
              data: extraData ?? {'reason': 'Rejeté via mobile'});
          return _resultFromApi(r, 'Rejeté avec succès');

        case 'convert':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/convert', data: {});
          return _resultFromApi(r, 'Converti en élève avec succès');

        case 'accept_and_enroll':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/accept-and-enroll', data: {});
          return _resultFromApi(r, 'Accepté et inscrit avec succès');

        // ── Students: Movements ───────────────────────────────────────
        case 'withdraw':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '/students/withdraw',
              data: {'studentId': id, 'reason': extraData?['reason'] ?? ''});
          return _resultFromApi(r, 'Élève retiré');

        case 'archive':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '/students/$id/archive', data: extraData ?? {});
          return _resultFromApi(r, 'Élève archivé');

        case 'reintegrate':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '/students/reintegrate', data: {'studentId': id});
          return _resultFromApi(r, 'Élève réintégré');

        // ── Students: Transfers ───────────────────────────────────────
        case 'approve':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/approve', data: extraData ?? {});
          return _resultFromApi(r, 'Approuvé avec succès');

        // ── Students: ID Cards ────────────────────────────────────────
        case 'revoke':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.putRaw(
              '$endpoint/$id/revoke',
              data: extraData ?? {'reason': 'Révoqué via mobile'});
          return _resultFromApi(r, 'Carte révoquée');

        case 'reissue':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/reissue', data: {});
          return _resultFromApi(r, 'Carte réémise');

        // ── Finance: Treasury ─────────────────────────────────────────
        case 'validate':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.patchRaw(
              '$endpoint/$id/validate', data: {});
          return _resultFromApi(r, 'Validé avec succès');

        case 'unblock':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/unblock',
              data: extraData ?? {'reason': 'Débloqué via mobile'});
          return _resultFromApi(r, 'Compte débloqué');

        // ── Finance: Cash Registers ───────────────────────────────────
        case 'open':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/open', data: {});
          return _resultFromApi(r, 'Caisse ouverte');

        case 'close':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/close',
              data: extraData ?? {});
          return _resultFromApi(r, 'Caisse fermée');

        case 'transfer':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/transfer',
              data: extraData ?? {});
          return _resultFromApi(r, 'Transfert effectué');

        // ── Finance: Recovery ─────────────────────────────────────────
        case 'reminder':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '/finance/recovery-reminders/manual',
              data: {'studentId': id, ...?extraData});
          return _resultFromApi(r, 'Rappel envoyé');

        case 'promise':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '/finance/collection/promises',
              data: {'studentId': id, ...?extraData});
          return _resultFromApi(r, 'Promesse enregistrée');

        case 'escalate':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '/finance/collection/actions',
              data: {'studentId': id, 'type': 'ESCALATION'});
          return _resultFromApi(r, 'Escaladé');

        // ── Exams: Evaluations ────────────────────────────────────────
        case 'cancel':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/cancel', data: {});
          return _resultFromApi(r, 'Annulé');

        // ── Exams: Bulletins ──────────────────────────────────────────
        case 'publish':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/publish', data: {});
          return _resultFromApi(r, 'Publié avec succès');

        // ── Exams: Councils ───────────────────────────────────────────
        case 'start':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/start', data: {});
          return _resultFromApi(r, 'Conseil démarré');

        case 'complete':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/complete', data: {});
          return _resultFromApi(r, 'Conseil terminé');

        // ── HR: Contracts ─────────────────────────────────────────────
        case 'sign':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/sign', data: {});
          return _resultFromApi(r, 'Contrat signé');

        case 'terminate':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/terminate',
              data: extraData ?? {});
          return _resultFromApi(r, 'Contrat résilié');

        // ── HR: Payroll ────────────────────────────────────────────────
        case 'process':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/process', data: {});
          return _resultFromApi(r, 'Paie traitée');

        // ── Communication ─────────────────────────────────────────────
        case 'resend':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/resend',
              data: extraData ?? {'channels': ['email']});
          return _resultFromApi(r, 'Renvoyé');

        case 'launch':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/launch', data: {});
          return _resultFromApi(r, 'Campagne lancée');

        case 'duplicate':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '$endpoint/$id/duplicate', data: {});
          return _resultFromApi(r, 'Dupliqué');

        // ── Settings: Devices ─────────────────────────────────────────
        case 'revoke_device':
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.postRaw(
              '/settings/devices/$id/revoke', data: {});
          return _resultFromApi(r, 'Appareil révoqué');

        // ── Generic status change ────────────────────────────────────
        default:
          // Try PATCH with the actionId as a status field
          if (id.isEmpty) return const ActionResult.failure('ID manquant');
          final r = await _apiClient.patchRaw(
            '$endpoint/$id',
            data: {'status': actionId.toUpperCase()},
          );
          return _resultFromApi(r, 'Action "$actionId" effectuée');
      }
    } catch (e) {
      debugPrint('[ModuleAction] ERROR: $e');
      return ActionResult.failure('Erreur: $e');
    }
  }

  ActionResult _resultFromApi(ApiResult<Map<String, dynamic>> result,
      String successMessage) {
    return result.when(
      success: (data) =>
          ActionResult.success(message: successMessage, data: data),
      failure: (e) => ActionResult.failure(e.message),
      loading: () =>
          const ActionResult.failure('Chargement en cours...'),
    );
  }
}

/// Provider for [ModuleActionService].
final moduleActionServiceProvider = Provider<ModuleActionService>((ref) {
  return ModuleActionService(ref.watch(apiClientProvider));
});
