/**
 * ============================================================================
 * MODULE BLUEPRINT - EXPORTS
 * ============================================================================
 * 
 * Exports centralisés pour le Module Blueprint
 * 
 * ============================================================================
 */

export { default as ModuleContainer } from './ModuleContainer';
export { default as ModuleHeader } from './ModuleHeader';
export type { ModuleHeaderProps, ModuleKPI } from './ModuleHeader';
export { default as SubModuleNavigation } from './SubModuleNavigation';
export type { SubModuleNavigationProps, SubModule } from './SubModuleNavigation';
export { default as ModuleContentArea } from './ModuleContentArea';
export type { ModuleContentAreaProps, ContentLayout } from './ModuleContentArea';

// Modals
export { default as BaseModal } from './modals/BaseModal';
export type { BaseModalProps } from './modals/BaseModal';
export { default as FormModal } from './modals/FormModal';
export type { FormModalProps } from './modals/FormModal';
export { default as ConfirmModal } from './modals/ConfirmModal';
export type { ConfirmModalProps, ConfirmModalType } from './modals/ConfirmModal';
export { default as CriticalModal } from './modals/CriticalModal';
export type { CriticalModalProps } from './modals/CriticalModal';
export { default as WizardModal } from './modals/WizardModal';
export type { WizardModalProps, WizardStep } from './modals/WizardModal';
export { default as ReadOnlyModal } from './modals/ReadOnlyModal';
export type { ReadOnlyModalProps } from './modals/ReadOnlyModal';
export { default as AlertModal } from './modals/AlertModal';
export type { AlertModalProps, AlertModalType } from './modals/AlertModal';

// Modal Provider
export { ModalProvider, useModal as useModalContext } from './modals/ModalProvider';

