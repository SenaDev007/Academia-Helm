(async () => {
  const req = indexedDB.open('academia-helm-local');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const stores = Array.from(db.objectStoreNames);
    console.log('LOCAL_DB stores count:', stores.length);

    // Check key stores
    const checkStore = (name) => {
      try {
        const tx = db.transaction(name, 'readonly');
        const store = tx.objectStore(name);
        const c = store.count();
        c.onsuccess = () => console.log(`STORE ${name}:`, c.result, 'records');
        c.onerror = () => console.log(`STORE ${name}: error`);
      } catch (err) {
        console.log(`STORE ${name}: not accessible`);
      }
    };

    checkStore('student');
    checkStore('teacher');
    checkStore('class');
    checkStore('subject');
    checkStore('schoollevel');
    checkStore('academicyear');
    checkStore('outbox_events');
    checkStore('sync_state');
  };
})();
