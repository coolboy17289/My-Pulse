// Local SQLite database for Pulse New Tab.
// Runs entirely in the browser via sql.js (SQLite compiled to WebAssembly)
// and persists to IndexedDB so the user's data survives reloads.
// Schema is local-only — perfect for a static GitHub Pages deploy.

import initSqlJs from "sql.js"
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url"

const IDB_NAME = "pulse-db"
const IDB_VERSION = 1
const STORE = "sqlite"
const DB_KEY = "pulse-db-v1"

let db = null
let sqlReady = null

function loadSqlJs() {
  if (!sqlReady) {
    sqlReady = initSqlJs({ locateFile: () => wasmUrl })
  }
  return sqlReady
}

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readPersisted() {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(DB_KEY)
    req.onsuccess = () => {
      idb.close()
      resolve(req.result || null)
    }
    req.onerror = () => {
      idb.close()
      reject(req.error)
    }
  })
}

async function writePersisted(bytes) {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, "readwrite")
    const req = tx.objectStore(STORE).put(bytes, DB_KEY)
    req.onsuccess = () => {
      idb.close()
      resolve()
    }
    req.onerror = () => {
      idb.close()
      reject(req.error)
    }
  })
}

async function persist() {
  if (!db) return
  try {
    await writePersisted(db.export())
  } catch (err) {
    console.warn("[pulse] failed to persist db:", err)
  }
}

export async function initDb() {
  if (db) return db
  const SQL = await loadSqlJs()
  const persisted = await readPersisted()

  if (persisted) {
    db = new SQL.Database(new Uint8Array(persisted))
    // Ensure schema still exists after upgrade
    db.run(
      "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
    )
  } else {
    db = new SQL.Database()
    db.run(
      "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
    )
    // Seed with starter tasks so a fresh install isn't empty
    db.run("INSERT INTO tasks (text, done) VALUES (?, 0)", ["Build Pulse New Tab"])
    db.run("INSERT INTO tasks (text, done) VALUES (?, 0)", ["Add more widgets"])
    db.run("INSERT INTO tasks (text, done) VALUES (?, 0)", ["Implement weather API"])
    await persist()
  }
  return db
}

export function getTasks() {
  if (!db) return []
  const stmt = db.prepare(
    "SELECT id, text, done FROM tasks ORDER BY datetime(created_at) DESC, id DESC"
  )
  const out = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    out.push({ id: row.id, text: row.text, done: !!row.done })
  }
  stmt.free()
  return out
}

export async function addTask(text) {
  if (!db) return null
  db.run("INSERT INTO tasks (text, done) VALUES (?, ?)", [text, 0])
  await persist()
  const idStmt = db.prepare("SELECT last_insert_rowid() AS id")
  idStmt.step()
  const id = idStmt.getAsObject().id
  idStmt.free()
  return id
}

export async function toggleTask(id, done) {
  if (!db) return
  db.run("UPDATE tasks SET done = ? WHERE id = ?", [done ? 1 : 0, id])
  await persist()
}

export async function removeTask(id) {
  if (!db) return
  db.run("DELETE FROM tasks WHERE id = ?", [id])
  await persist()
}
