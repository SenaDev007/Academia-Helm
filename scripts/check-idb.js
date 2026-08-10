const req = indexedDB.open('academia-helm-db');
req.onsuccess = (e) => {
  const db = e.target.result;
  const stores = Array.from(db.objectStoreNames);
  console.log('IDB stores count:', stores.length);
  console.log('First 10 stores:', stores.slice(0, 10).join(', '));

  // Check a few key stores
  const checkStore = (name) => {
    try {
      const tx = db.transaction(name, 'readonly');
      const store = tx.objectStore(name);
      const countReq = store.count();
      countReq.onsuccess = () => console.log(`Store "${name}":`, countReq.result, 'records');
      countReq.onerror = () => console.log(`Store "${name}": error`);
    } catch (err) {
      console.log(`Store "${name}": not accessible`);
    }
  };

  checkStore('student');
  checkStore('teacher');
  checkStore('class');
  checkStore('outbox_events');
  checkStore('sync_state');
};
req.onerror = () => console.log('IDB open error');
