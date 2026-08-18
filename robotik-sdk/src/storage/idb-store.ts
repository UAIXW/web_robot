import { openDB, type IDBPDatabase } from 'idb'
import type { MessageStore, StoredMessage } from '../types'

interface DBRecord extends Omit<StoredMessage, 'userId'> {
  userId: string
}

interface Schema {
  messages: DBRecord
}

// IndexedDB compound indexes skip records with null components,
// so the anonymous scope is stored as a sentinel string.
const ANON = '__anonymous__'

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null

function getDB(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>('robotik-sdk', 1, {
      upgrade(db) {
        const store = db.createObjectStore('messages', {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('scope', ['appId', 'userId'])
      },
    })
  }
  return dbPromise
}

function scope(appId: string, userId: string | null): [string, string] {
  return [appId, userId ?? ANON]
}

function fromDB(m: DBRecord): StoredMessage {
  return { ...m, userId: m.userId === ANON ? null : m.userId }
}

export function createIdbStore(): MessageStore {
  return {
    async append(msg) {
      try {
        const db = await getDB()
        await db.add('messages', { ...msg, userId: msg.userId ?? ANON })
      } catch (e) {
        console.warn('[web-robot] Local persist failed:', e)
      }
    },

    async recent(appId, userId, limit) {
      try {
        const db = await getDB()
        const all = await db.getAllFromIndex('messages', 'scope', scope(appId, userId))
        return all.slice(-limit).map(fromDB)
      } catch (e) {
        console.warn('[web-robot] Local history load failed:', e)
        return []
      }
    },

    async clear(appId, userId) {
      try {
        const db = await getDB()
        const keys = await db.getAllKeysFromIndex('messages', 'scope', scope(appId, userId))
        const tx = db.transaction('messages', 'readwrite')
        await Promise.all(keys.map((k) => tx.store.delete(k)))
        await tx.done
      } catch (e) {
        console.warn('[web-robot] Local history clear failed:', e)
      }
    },

    async export(appId, userId) {
      try {
        const db = await getDB()
        const all = await db.getAllFromIndex('messages', 'scope', scope(appId, userId))
        return all.map(fromDB)
      } catch (e) {
        console.warn('[web-robot] Local history export failed:', e)
        return []
      }
    },
  }
}
