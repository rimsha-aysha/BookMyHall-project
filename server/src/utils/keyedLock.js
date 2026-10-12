// Runs async critical sections one at a time per key (e.g. one hall/date, or
// one booking's payments), so a check-then-write can't interleave with
// another request for the same key. In-process only — fine for this
// single-instance deployment; a multi-instance deployment would need a
// DB-level lock.
export const createKeyedLock = () => {
  const locks = new Map();
  return async (key, fn) => {
    const previous = locks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    locks.set(key, tail);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(key) === tail) locks.delete(key);
    }
  };
};
