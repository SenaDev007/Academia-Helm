/**
 * ============================================================================
 * SUPPLEMENTARY MODULES SERVICE — Services pour les modules complémentaires
 * (Bibliothèque, Transport, Cantine, Infirmerie, Boutique, EduCast)
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';

// ---------------------------------------------------------------------------
// Bibliothèque
// ---------------------------------------------------------------------------

export interface LibraryBook {
  id: string;
  tenantId: string;
  title: string;
  author?: string;
  isbn?: string;
  category?: string;
  quantity?: number;
  availableQuantity?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LibraryLoan {
  id: string;
  tenantId: string;
  bookId: string;
  borrowerId: string;
  borrowDate: string;
  dueDate?: string;
  returnDate?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class LibraryBookService extends BaseEntityService<LibraryBook> {
  constructor() {
    super({
      storeName: 'library_books',
      entityType: 'LIBRARY_BOOK',
      apiPrefix: '/api/library/books',
      moduleName: 'Library-Books',
    });
  }
}

class LibraryLoanService extends BaseEntityService<LibraryLoan> {
  constructor() {
    super({
      storeName: 'library_loans',
      entityType: 'LIBRARY_LOAN',
      apiPrefix: '/api/library/loans',
      moduleName: 'Library-Loans',
    });
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export interface TransportRoute {
  id: string;
  tenantId: string;
  name: string;
  startPoint?: string;
  endPoint?: string;
  distance?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class TransportRouteService extends BaseEntityService<TransportRoute> {
  constructor() {
    super({
      storeName: 'transport_routes',
      entityType: 'TRANSPORT_ROUTE',
      apiPrefix: '/api/transport/routes',
      moduleName: 'Transport-Routes',
    });
  }
}

// ---------------------------------------------------------------------------
// Cantine
// ---------------------------------------------------------------------------

export interface CanteenMenu {
  id: string;
  tenantId: string;
  name: string;
  date: string;
  meals?: any[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class CanteenMenuService extends BaseEntityService<CanteenMenu> {
  constructor() {
    super({
      storeName: 'canteen_menus',
      entityType: 'CANTEEN_MENU',
      apiPrefix: '/api/canteen/menus',
      moduleName: 'Canteen-Menus',
    });
  }
}

// ---------------------------------------------------------------------------
// Infirmerie
// ---------------------------------------------------------------------------

export interface InfirmaryRecord {
  id: string;
  tenantId: string;
  studentId: string;
  type: string;
  description?: string;
  treatment?: string;
  visitDate: string;
  treatedBy?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class InfirmaryRecordService extends BaseEntityService<InfirmaryRecord> {
  constructor() {
    super({
      storeName: 'infirmary_records',
      entityType: 'INFIRMARY_RECORD',
      apiPrefix: '/api/infirmary/records',
      moduleName: 'Infirmary',
    });
  }
}

// ---------------------------------------------------------------------------
// Boutique
// ---------------------------------------------------------------------------

export interface ShopProduct {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  stock?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class ShopProductService extends BaseEntityService<ShopProduct> {
  constructor() {
    super({
      storeName: 'shop_products',
      entityType: 'SHOP_PRODUCT',
      apiPrefix: '/api/shop/products',
      moduleName: 'Shop-Products',
    });
  }
}

// ---------------------------------------------------------------------------
// EduCast
// ---------------------------------------------------------------------------

export interface EducastVideo {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  url?: string;
  duration?: number;
  category?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class EducastVideoService extends BaseEntityService<EducastVideo> {
  constructor() {
    super({
      storeName: 'educast_videos',
      entityType: 'EDUCAST_VIDEO',
      apiPrefix: '/api/educast/videos',
      moduleName: 'EduCast',
    });
  }
}

// ---------------------------------------------------------------------------
// Service unifié pour modules complémentaires
// ---------------------------------------------------------------------------

class SupplementaryModulesService {
  readonly libraryBooks = new LibraryBookService();
  readonly libraryLoans = new LibraryLoanService();
  readonly transportRoutes = new TransportRouteService();
  readonly canteenMenus = new CanteenMenuService();
  readonly infirmaryRecords = new InfirmaryRecordService();
  readonly shopProducts = new ShopProductService();
  readonly educastVideos = new EducastVideoService();
}

export const supplementaryModulesService = new SupplementaryModulesService();
