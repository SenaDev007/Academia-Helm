(async () => {
  // 1. Vérifier l'état actuel de l'outbox
  const req = indexedDB.open('academia-helm-local');
  req.onsuccess = async (e) => {
    const db = e.target.result;

    // Lire l'outbox actuel
    const txRead = db.transaction('outbox_events', 'readonly');
    const store = txRead.objectStore('outbox_events');
    const countReq = store.count();
    countReq.onsuccess = () => {
      console.log('OUTBOX initial count:', countReq.result);

      // Insérer un événement PENDING de test (UPDATE sur un student)
      const tx = db.transaction('outbox_events', 'readwrite');
      const ws = tx.objectStore('outbox_events');
      const testEvent = {
        id: 'test-push-' + Date.now(),
        tenantId: '59b8c348-ae5f-4d67-8fbd-af6aefa1f394',
        entityType: 'STUDENT',
        entityId: 'test-student-push-' + Date.now(),
        operation: 'UPDATE',
        payload: { id: 'test-student-push-' + Date.now(), firstName: 'TestPush', lastName: 'BrowserAutomation', _isDirty: true },
        status: 'PENDING',
        localVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const addReq = ws.add(testEvent);
      addReq.onsuccess = () => {
        console.log('TEST event added to outbox:', testEvent.id);
        // Vérifier le compte après ajout
        const tx2 = db.transaction('outbox_events', 'readonly');
        const c2 = tx2.objectStore('outbox_events').count();
        c2.onsuccess = () => console.log('OUTBOX count après ajout:', c2.result);
      };
      addReq.onerror = (err) => console.log('Add error:', err.target.error);
    };
  };
})();
