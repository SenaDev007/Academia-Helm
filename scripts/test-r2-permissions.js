const { S3Client, PutObjectCommand, HeadBucketCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: 'auto',
  endpoint: 'https://151a2a130fbe6fcc2998740587b72b1b.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: 'a36f4cdce46c14fc9505bbc7eb56813c',
    secretAccessKey: 'b05c1a05967cda9b7a77e199a790ef8eefa7ea474bf645cff00237c60b530ed3',
  },
  forcePathStyle: true,
});

(async () => {
  console.log('─── Test permissions token R2 ───');
  console.log('Bucket cible: academia-helm-releases\n');

  // 1. HeadBucket — vérifier accès bucket
  try {
    const r = await r2.send(new HeadBucketCommand({ Bucket: 'academia-helm-releases' }));
    console.log('✅ HeadBucket: 200 — bucket existe et token y a accès');
  } catch (e) {
    const sc = e.$metadata?.httpStatusCode;
    console.log('❌ HeadBucket:', e.name, '(http ' + sc + ')');
    console.log('   →', e.message);
  }

  // 2. PutObject — tester écriture
  try {
    await r2.send(new PutObjectCommand({
      Bucket: 'academia-helm-releases',
      Key: '_permission-test.txt',
      Body: Buffer.from('permission check'),
      ContentType: 'text/plain',
    }));
    console.log('✅ PutObject: OK — écriture autorisée');

    // cleanup
    try { await r2.send(new DeleteObjectCommand({ Bucket: 'academia-helm-releases', Key: '_permission-test.txt' })); } catch {}
  } catch (e) {
    const sc = e.$metadata?.httpStatusCode;
    console.log('❌ PutObject:', e.name, '(http ' + sc + ')');
    console.log('   →', e.message);
  }
})();
