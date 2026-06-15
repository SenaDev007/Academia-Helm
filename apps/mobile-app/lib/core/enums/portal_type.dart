/// Portal types mirroring the web app's 5-portal architecture.
///
/// This file re-exports PortalType from user_role.dart where it is
/// co-located with UserRole for self-containment.
///
/// The portal type determines which modules, tabs, and sub-tabs are visible
/// in the UI. This is the primary driver of UI differentiation.
export 'user_role.dart' show PortalType;
