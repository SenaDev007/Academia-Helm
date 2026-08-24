(async () => {
  const req = indexedDB.open('academia-helm-local');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const stores = Array.from(db.objectStoreNames);
    console.log('LOCAL_DB stores count:', stores.length);
    console.log('LOCAL_DB first 5:', stores.slice(0, 5).join(', '));
    try {
      const tx = db.transaction('student', 'readonly');
      const store = tx.objectStore('student');
      const c = store.count();
      c.onsuccess = () => console.log('LOCAL_DB student records:', c.result);
      c.onerror = () => console.log('LOCAL_DB student count error');
    } catch (err) {
      console.log('LOCAL_DB student store error:', err.message);
    }
  };
  req.onerror = () => console.log('LOCAL_DB open error');
})();
