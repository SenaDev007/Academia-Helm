'use client';

import { useReducer } from 'react';
import { OnboardingState, INITIAL_STATE, OnboardingAction } from '../types';

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_STAFF_ID':
      return { ...state, staffId: action.staffId };
    case 'SET_CONTRACT_ID':
      return { ...state, contractId: action.contractId };
    case 'UPDATE_IDENTITY':
      return { ...state, identity: { ...state.identity, [action.field]: action.value } };
    case 'UPDATE_EMPLOYMENT':
      return { ...state, employment: { ...state.employment, [action.field]: action.value } };
    case 'SET_DOCUMENT':
      return { ...state, documents: { ...state.documents, [action.documentType]: action.file } };
    case 'MARK_DOCUMENT_UPLOADED':
      return { ...state, uploadedDocuments: { ...state.uploadedDocuments, [action.documentType]: true } };
    case 'UPDATE_CONTRACT':
      return { ...state, contract: { ...state.contract, [action.field]: action.value } };
    case 'SET_ARTICLES':
      return { ...state, articles: action.articles };
    case 'SET_ARTICLES_SAVED':
      return { ...state, articlesSaved: action.saved };
    case 'SET_PREVIEW_HTML':
      return { ...state, previewHtml: action.html };
    case 'SET_PDF_GENERATED':
      return { ...state, pdfGenerated: action.generated };
    case 'SET_EMPLOYER_SIGNED':
      return { ...state, employerSigned: action.signed, employerSignatureData: action.signatureData };
    case 'SET_EMPLOYEE_SIGNED':
      return { ...state, employeeSigned: action.signed, employeeSignatureData: action.signatureData };
    case 'SET_SEND_EMAIL':
      return { ...state, sendEmail: action.sendEmail };
    case 'SET_COMPLETED':
      return { ...state, completed: action.completed };
    case 'RESET':
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

export function useOnboardingState() {
  return useReducer(onboardingReducer, INITIAL_STATE);
}
