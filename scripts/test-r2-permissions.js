const { S3Client, PutObjectCommand, HeadBucketCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const ACCESS_KEY_ID = '75eecfbee836811eb6c082778e48b499';
const SECRET_ACCESS_KEY = '1ddd70da27ee0df1c0bf23a5051de7991edbe9ea0169a11e1ba21889f2e927f1';
const ACCOUNT_ID = '151a2a130fbe6fcc2998740587b72b1b';
const BUCKET = 'academia-helm-releases';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

(async () => {
  console.log('─── Test permissions token R2 (nouveau) ───');
  console.log('Bucket cible:', BUCKET, '\n');

  // 1. HeadBucket
  try {
    await r2.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log('✅ HeadBucket: 200 — bucket accessible');
  } catch (e) {
    const sc = e.$metadata?.httpStatusCode;
    console.log('❌ HeadBucket:', e.name, '(http ' + sc + ')', '—', e.message);
  }

  // 2. ListObjects (limit 5)
  try {
    const r = await r2.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 5 }));
    const objs = (r.Contents || []).map(o => o.Key);
    console.log('✅ ListObjects: OK — existing objects:', objs.length ? objs.join(', ') : '(empty)');
  } catch (e) {
    const sc = e.$metadata?.httpStatusCode;
    console.log('❌ ListObjects:', e.name, '(http ' + sc + ')', '—', e.message);
  }

  // 3. PutObject (write test)
  try {
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: '_permission-test.txt',
      Body: Buffer.from('permission check ' + new Date().toISOString()),
      ContentType: 'text/plain',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log('✅ PutObject: OK — écriture autorisée');

    // Cleanup
    try { await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: '_permission-test.txt' })); }
    catch (e) { console.log('   (cleanup delete failed:', e.message, ')'); }
  } catch (e) {
    const sc = e.$metadata?.httpStatusCode;
    console.log('❌ PutObject:', e.name, '(http ' + sc + ')', '—', e.message);
  }
})();
