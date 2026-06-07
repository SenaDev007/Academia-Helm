/**
 * Admin Authentication Service
 * 
 * Service pour gérer l'authentification du Super Admin via IndexedDB
 * Les identifiants sont stockés localement dans IndexedDB
 */

const DB_NAME = 'academia-hub-admin';
const DB_VERSION = 1;
const STORE_NAME = 'super_admin_credentials';

interface SuperAdminCredentials {
  id: string;
  email: string;
  passwordHash: string; // Hash du mot de passe (bcrypt ou similaire)
  createdAt: string;
  updatedAt: string;
}

class AdminAuthService {
  private db: IDBDatabase | null = null;

  /**
   * Initialise IndexedDB pour les identifiants du super admin
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        
        // Créer l'object store pour les identifiants du super admin
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('email', 'email', { unique: true });
        }
      };
    });
  }

  /**
   * Vérifie si un email existe dans la base de données
   */
  async emailExists(email: string): Promise<boolean> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => {
        const credentials = request.result as SuperAdminCredentials | undefined;
        resolve(!!credentials);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Vérifie les identifiants du super admin
   */
  async verifyCredentials(email: string, password: string): Promise<boolean> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => {
        const credentials = request.result as SuperAdminCredentials | undefined;

        if (!credentials) {
          resolve(false);
          return;
        }

        // Vérifier le mot de passe
        // Pour l'instant, on fait une comparaison simple
        // En production, il faudrait utiliser bcrypt ou une autre méthode de hash
        // Pour le développement, on peut stocker le hash et le comparer
        this.comparePassword(password, credentials.passwordHash)
          .then(match => resolve(match))
          .catch(reject);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Compare le mot de passe avec le hash stocké
   * Pour l'instant, comparaison simple (à remplacer par bcrypt en production)
   */
  private async comparePassword(password: string, hash: string): Promise<boolean> {
    // Pour le développement, on peut utiliser une méthode simple
    // En production, utiliser bcrypt.compare()
    // Pour l'instant, on suppose que le hash est le mot de passe lui-même (non sécurisé pour dev)
    // TODO: Implémenter bcrypt pour la production
    return password === hash;
  }

  /**
   * Stocke les identifiants du super admin
   * À utiliser uniquement pour l'initialisation
   */
  async setCredentials(email: string, password: string): Promise<void> {
    await this.ensureInitialized();

    // Hash le mot de passe (pour l'instant, on stocke tel quel - à améliorer)
    const passwordHash = password; // TODO: Utiliser bcrypt.hash() en production

    const credentials: SuperAdminCredentials = {
      id: 'super-admin-1',
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(credentials);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * S'assure que la DB est initialisée
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }
}

// Instance singleton
export const adminAuthService = new AdminAuthService();

// Fonction utilitaire pour initialiser les identifiants par défaut
export async function initializeDefaultAdminCredentials(): Promise<void> {
  try {
    await adminAuthService.initialize();
    
    // Vérifier si des identifiants existent déjà
    const emailExists = await adminAuthService.emailExists('academiahub.pro@gmail.com');
    
    // Si aucun identifiant n'existe, créer les identifiants par défaut
    if (!emailExists) {
      // Créer les identifiants par défaut
      // Email: academiahub.pro@gmail.com
      // Password: C@ptain.Acadhub20212025
      await adminAuthService.setCredentials('academiahub.pro@gmail.com', 'C@ptain.Acadhub20212025');
      console.log('Identifiants Super Admin par défaut créés');
    }
  } catch (error) {
    // Ne pas afficher l'erreur à l'utilisateur si c'est juste une initialisation
    // L'erreur sera gérée lors de la tentative de connexion
    console.error('Erreur lors de l\'initialisation des identifiants admin:', error);
  }
}

