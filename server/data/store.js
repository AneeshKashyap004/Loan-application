import { S3_BUCKET, s3 } from '../aws/s3.js';
import { ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const useLocal = !S3_BUCKET;

// Local filesystem base directory for JSON documents and counters
const localBaseDir = path.resolve(process.cwd(), 'server', 'local-store');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Unified read/write helpers that switch between S3 and local FS
async function readJson(key) {
  if (useLocal) {
    try {
      const file = path.join(localBaseDir, key);
      if (!fs.existsSync(file)) return null;
      const text = fs.readFileSync(file, 'utf8');
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const text = await res.Body.transformToString();
    return JSON.parse(text);
  } catch (e) { return null; }
}

async function writeJson(key, obj) {
  if (useLocal) {
    const file = path.join(localBaseDir, key);
    ensureDirSync(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
    return;
  }
  const body = JSON.stringify(obj);
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: 'application/json' }));
}

export async function listCollection(prefix) {
  if (useLocal) {
    const dir = path.join(localBaseDir, prefix);
    ensureDirSync(dir);
    const items = [];
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const doc = await readJson(path.join(prefix, name));
      if (doc) items.push(doc);
    }
    return items;
  }
  let ContinuationToken = undefined;
  const items = [];
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix + '/', ContinuationToken }));
    for (const o of (out.Contents || [])) {
      if (!o.Key.endsWith('.json')) continue;
      const doc = await readJson(o.Key);
      if (doc) items.push(doc);
    }
    ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return items;
}

export async function getItem(prefix, id) {
  const key = `${prefix}/${id}.json`;
  return await readJson(key);
}

export async function putItem(prefix, id, obj) {
  const key = `${prefix}/${id}.json`;
  await writeJson(key, obj);
  return obj;
}

export async function updateItem(prefix, id, patch) {
  const existing = await getItem(prefix, id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await putItem(prefix, id, updated);
  return updated;
}

export async function deleteItem(prefix, id) {
  if (useLocal) {
    const file = path.join(localBaseDir, `${prefix}/${id}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  // Not implemented for S3; not required currently
}

async function getCounter(name) {
  return (await readJson(`counters/${name}.json`))?.value ?? 0;
}

async function setCounter(name, value) {
  await writeJson(`counters/${name}.json`, { value });
}

export async function nextId(prefix) {
  const name = `id_${prefix}`;
  const current = await getCounter(name);
  const next = current + 1;
  await setCounter(name, next);
  return next;
}

export async function generateCustomerAutoNumber() {
  // Use dedicated counter for auto numbers
  const name = 'auto_customer';
  const current = await getCounter(name);
  const next = current + 1;
  await setCounter(name, next);
  const s = String(next).padStart(5, '0');
  return `CUST${s}`;
}
