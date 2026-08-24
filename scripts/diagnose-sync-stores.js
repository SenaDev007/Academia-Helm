(async () => {
  const req = indexedDB.open('academia-helm-local');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const stores = Array.from(db.objectStoreNames);
    console.log('TOTAL STORES:', stores.length);

    // Vérifier si certains stores problématiques existent
    const problematic = ['schooldirector', 'schoolsetting', 'rolepermission', 'position', 'securitysetting'];
    for (const s of problematic) {
      console.log(`STORE ${s}:`, stores.includes(s) ? 'EXISTS' : 'MISSING');
    }

    // Compter quelques stores clés
    const checkStore = (name) => {
      if (!stores.includes(name)) {
        console.log(`COUNT ${name}: store missing`);
        return;
      }
      try {
        const tx = db.transaction(name, 'readonly');
        const c = tx.objectStore(name).count();
        c.onsuccess = () => console.log(`COUNT ${name}:`, c.result);
      } catch (err) {
        console.log(`COUNT ${name}: error`, err.message);
      }
    };
    checkStore('student');
    checkStore('teacher');
    checkStore('class');
    checkStore('schooldirector');
    checkStore('sync_state');
  };
})();
