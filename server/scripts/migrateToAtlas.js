// One-time copy of the local MongoDB database to MongoDB Atlas.
//   source: LOCAL_MONGODB_URI (default mongodb://localhost:27017/bookmyhall)
//   target: MONGODB_URI (the Atlas connection string in server/.env)
// Every document is copied as-is — same _id, same ObjectId references, same
// BSON types — and every index (including unique ones) is recreated. The
// copy is then verified document-by-document against the source.
// The local database is only read, never modified. The script refuses to
// run if the Atlas database already contains documents, so it can't
// overwrite or duplicate data.
// Run from the server/ folder:  npm run migrate:atlas
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

const { MongoClient } = mongoose.mongo;
const { EJSON } = mongoose.mongo.BSON;

const SOURCE_URI = process.env.LOCAL_MONGODB_URI || "mongodb://localhost:27017/bookmyhall";
const TARGET_URI = process.env.MONGODB_URI;

const canonical = (doc) => EJSON.stringify(doc, { relaxed: false });

const run = async () => {
  if (!TARGET_URI) throw new Error("MONGODB_URI (the Atlas connection string) is not set in server/.env");
  if (/localhost|127\.0\.0\.1/i.test(TARGET_URI)) throw new Error("MONGODB_URI still points at the local database");

  const source = new MongoClient(SOURCE_URI);
  const target = new MongoClient(TARGET_URI);
  try {
    await source.connect();
    await target.connect();
    const sourceDb = source.db();
    const targetDb = target.db();
    if (targetDb.databaseName === "test") {
      throw new Error('MONGODB_URI has no database name — add "/bookmyhall" before the "?" in the connection string');
    }
    console.log(`Source: ${sourceDb.databaseName} (local)  ->  Target: ${targetDb.databaseName} (Atlas)\n`);

    const collections = (await sourceDb.listCollections({ type: "collection" }).toArray())
      .map((c) => c.name)
      .filter((name) => !name.startsWith("system."))
      .sort();

    for (const name of collections) {
      const existing = await targetDb.collection(name).countDocuments();
      if (existing > 0) {
        throw new Error(`Atlas collection "${name}" already has ${existing} documents — refusing to overwrite`);
      }
    }

    let failures = 0;
    for (const name of collections) {
      const docs = await sourceDb.collection(name).find({}).sort({ _id: 1 }).toArray();
      if (docs.length > 0) await targetDb.collection(name).insertMany(docs, { ordered: true });
      else await targetDb.createCollection(name).catch(() => {});

      const indexes = (await sourceDb.collection(name).indexes()).filter((i) => i.name !== "_id_");
      for (const { key, v: _v, ns: _ns, ...options } of indexes) {
        await targetDb.collection(name).createIndex(key, options);
      }

      // Verify: same documents (byte-for-byte BSON-equivalent) and same indexes.
      const copied = await targetDb.collection(name).find({}).sort({ _id: 1 }).toArray();
      const sameDocs = copied.length === docs.length && docs.every((d, i) => canonical(d) === canonical(copied[i]));
      const indexNames = (list) => list.map((i) => i.name).sort().join(",");
      const sameIndexes =
        indexNames(await sourceDb.collection(name).indexes()) === indexNames(await targetDb.collection(name).indexes());
      const ok = sameDocs && sameIndexes;
      if (!ok) failures += 1;
      console.log(
        `${ok ? "OK  " : "FAIL"} ${name.padEnd(20)} ${String(copied.length).padStart(4)}/${docs.length} docs` +
          `  indexes: ${indexNames(await targetDb.collection(name).indexes())}`
      );
    }

    if (failures > 0) throw new Error(`${failures} collection(s) did not verify`);
    console.log(`\nMigration complete: ${collections.length} collections copied and verified.`);
  } finally {
    await source.close();
    await target.close();
  }
};

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
