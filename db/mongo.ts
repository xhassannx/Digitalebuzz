import mongoose from 'mongoose';

let activeMongoUri = '';

export function getMongoUri(): string {
  if (activeMongoUri) return activeMongoUri;
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL || '';
  return uri.trim();
}

export function isMongoEnabled(): boolean {
  const adapter = (process.env.DB_ADAPTER || '').trim().toLowerCase();
  const uri = getMongoUri();
  return adapter === 'mongodb' || uri.length > 0;
}

let resolveMongoReady!: () => void;
export const mongoReady = new Promise<void>((resolve) => {
  resolveMongoReady = resolve;
});

let isInitialized = false;

export async function initMongo(): Promise<typeof mongoose | null> {
  if (isInitialized) {
    return mongoose;
  }

  const uri = getMongoUri();
  if (!uri && process.env.DB_ADAPTER !== 'mongodb') {
    console.warn('[MongoDB] MONGODB_URI is not set. Skipping MongoDB initialization.');
    resolveMongoReady();
    return null;
  }

  try {
    let connectUri = uri || 'mongodb://127.0.0.1:27017/digitalebuzz';
    const maxPool = parseInt(process.env.MONGO_MAX_POOL_SIZE || '50', 10);
    const minPool = parseInt(process.env.MONGO_MIN_POOL_SIZE || '5', 10);

    mongoose.connection.on('connected', () => {
      console.log('[MongoDB] ✅ Successfully connected to MongoDB');
      resolveMongoReady();
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] ❌ Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] ⚠️ Disconnected from MongoDB');
    });

    try {
      await mongoose.connect(connectUri, {
        maxPoolSize: Number.isFinite(maxPool) ? maxPool : 50,
        minPoolSize: Number.isFinite(minPool) ? minPool : 5,
        serverSelectionTimeoutMS: 3000,
        autoIndex: process.env.NODE_ENV !== 'production',
      });
      activeMongoUri = connectUri;
    } catch (connErr: any) {
      if (connectUri.includes('127.0.0.1') || connectUri.includes('localhost') || !connectUri) {
        console.log('[MongoDB] ℹ️ Local port 27017 unreachable. Auto-starting embedded in-memory MongoDB...');
        try {
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          const fs = await import('fs');
          const path = await import('path');
          const dbDir = path.resolve(process.cwd(), 'data', 'mongodb');
          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
          }

          let mongod: any;
          try {
            mongod = await MongoMemoryServer.create({
              instance: {
                port: 27017,
                dbName: 'digitalebuzz',
                dbPath: dbDir,
                storageEngine: 'wiredTiger',
              },
            });
          } catch (bindErr: any) {
            console.warn('[MongoDB] Port 27017 busy, falling back to dynamic port:', bindErr?.message);
            mongod = await MongoMemoryServer.create({
              instance: {
                dbName: 'digitalebuzz',
                dbPath: dbDir,
                storageEngine: 'wiredTiger',
              },
            });
          }

          const baseUri = mongod.getUri();
          activeMongoUri = baseUri.endsWith('/') ? `${baseUri}digitalebuzz` : `${baseUri}/digitalebuzz`;
          console.log(`[MongoDB] ✅ Embedded MongoDB active on port 27017 at: ${activeMongoUri}`);
          await mongoose.connect(activeMongoUri);
        } catch (memErr: any) {
          console.error('[MongoDB] ❌ Failed to start in-memory MongoDB:', memErr?.message);
          throw connErr;
        }
      } else {
        throw connErr;
      }
    }

    isInitialized = true;
    resolveMongoReady();
    return mongoose;
  } catch (error: any) {
    console.error('[MongoDB] ❌ Failed to connect to MongoDB during startup:', error?.message);
    resolveMongoReady();
    return null;
  }
}

export async function waitForMongo(timeoutMs = 30000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      mongoReady,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[MongoDB] waitForMongo timed out after ${timeoutMs}ms — continuing`);
          resolve();
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { mongoose };
