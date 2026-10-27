const valid = value => value && typeof value.text === 'string' && value.text.length <= 20_000
  && Number.isSafeInteger(value.revision) && value.revision >= 0;
const snapshot = value => ({ text: value.text, revision: value.revision });

// A clientId identifies one live page. Draft slots are separate from the canonical server copy.
export class NotesJournal {
  constructor(storage, namespacePrefix, clientId) {
    if (!storage || typeof namespacePrefix !== 'string' || !namespacePrefix || typeof clientId !== 'string' || !clientId)
      throw new TypeError('Storage, owner namespace and unique page clientId are required');
    this.storage = storage; this.prefix = namespacePrefix; this.clientId = encodeURIComponent(clientId);
  }

  _keys(id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id)) throw new TypeError('Invalid collection');
    return { legacy: this.prefix + 'notes:' + id, cache: this.prefix + 'notes-cache:' + id,
      drafts: this.prefix + 'notes-draft:' + encodeURIComponent(id) + ':' };
  }

  _read(key) {
    const text = this.storage.getItem(key);
    try { return text === null ? null : JSON.parse(text); } catch { return null; }
  }

  _marker(key) { return this.prefix + 'notes-confirmed:' + encodeURIComponent(key.slice(this.prefix.length)); }

  _slots(id) {
    const names = this._keys(id), keys = [names.legacy];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(names.drafts)) keys.push(key);
    }
    return [...new Set(keys)].flatMap(key => {
      const value = this._read(key);
      if (!valid(value) || value.dirty !== true) return [];
      const updatedAt = Number.isSafeInteger(value.updatedAt) && value.updatedAt >= 0 ? value.updatedAt : 0;
      const marker = this._read(this._marker(key));
      if (valid(marker) && marker.text === value.text && marker.revision === value.revision && marker.updatedAt === updatedAt) return [];
      return [{ key, ...snapshot(value), updatedAt }];
    });
  }

  list(id) {
    const slots = this._slots(id).sort((a, b) => b.updatedAt - a.updatedAt || a.key.localeCompare(b.key));
    const seen = new Set();
    return slots.filter(value => {
      const identity = JSON.stringify([value.text, value.revision]);
      if (seen.has(identity)) return false;
      seen.add(identity); return true;
    });
  }

  _canonical(id) {
    const names = this._keys(id);
    return [this._read(names.cache), this._read(names.legacy)]
      .filter(value => valid(value) && value.dirty === false)
      .sort((a, b) => b.revision - a.revision)[0] || null;
  }

  load(id) {
    const draft = this.list(id)[0];
    if (draft) return { ...snapshot(draft), dirty: true };
    const clean = this._canonical(id);
    return clean ? { ...snapshot(clean), dirty: false } : { text: '', revision: 0, dirty: false };
  }

  cache(id, value) {
    if (!valid(value)) throw new TypeError('Invalid canonical note');
    const names = this._keys(id), clean = this._canonical(id);
    if (clean && clean.revision > value.revision) return snapshot(clean);
    this.storage.setItem(names.cache, JSON.stringify({ ...snapshot(value), dirty: false, updatedAt: Date.now() }));
    return snapshot(value);
  }

  draft(id, value) {
    if (!valid(value)) throw new TypeError('Invalid note draft');
    const key = this._keys(id).drafts + this.clientId;
    const previous = this._read(key), updatedAt = Math.max(Date.now(), (Number.isSafeInteger(previous?.updatedAt) ? previous.updatedAt : 0) + 1);
    this.storage.setItem(key, JSON.stringify({ ...snapshot(value), dirty: true, updatedAt }));
    return { ...snapshot(value), dirty: true };
  }

  _settle(id, entry) {
    const current = this._read(entry.key);
    if (!valid(current) || !current.dirty || current.text !== entry.text || current.revision !== entry.revision) return;
    if (entry.key === this._keys(id).drafts + this.clientId) {
      // Only this page writes its own slot, so its synchronous compare/remove cannot erase another writer.
      this.storage.removeItem(entry.key);
      this.storage.removeItem(this._marker(entry.key));
    } else {
      // localStorage has no cross-window CAS. Mark the exact foreign snapshot instead of deleting its slot.
      // A concurrent edit changes text/baseRevision and remains visible even if it races this marker write.
      this.storage.setItem(this._marker(entry.key), JSON.stringify({ ...snapshot(entry), updatedAt: entry.updatedAt }));
    }
  }

  acknowledge(id, { text, baseRevision, revision }) {
    if (!valid({ text, revision: baseRevision }) || !Number.isSafeInteger(revision) || revision <= baseRevision)
      throw new TypeError('Invalid note acknowledgement');
    this.cache(id, { text, revision });
    for (const entry of this._slots(id))
      if (entry.text === text && entry.revision === baseRevision) this._settle(id, entry);
  }

  discard(id, key, expectedText) {
    const slots = this._slots(id), target = slots.find(entry => entry.key === key && entry.text === expectedText);
    if (!target) return false;
    // list() merges identical snapshots; discard that one logical version, preserving every different draft.
    for (const entry of slots)
      if (entry.text === target.text && entry.revision === target.revision) this._settle(id, entry);
    return true;
  }
}
