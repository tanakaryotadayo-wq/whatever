import Ajv2020Module from "ajv/dist/2020.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const dir = "schemas/v1";
const files = (await readdir(dir)).filter((name) => name.endsWith(".schema.json")).sort();
const schemas = [];
const ids = new Set();
for (const file of files) {
  try {
    const schema = JSON.parse(await readFile(join(dir, file), "utf8"));
    if (typeof schema.$id !== "string" || schema.$id.length === 0) throw new Error("schema is missing $id");
    if (ids.has(schema.$id)) throw new Error(`duplicate schema $id: ${schema.$id}`);
    ids.add(schema.$id);
    schemas.push({ file, schema });
  } catch (error) {
    console.error(`::error file=${join(dir, file)}::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false, allowUnionTypes: true });
for (const { file, schema } of schemas) {
  try { ajv.addSchema(schema, schema.$id); }
  catch (error) { console.error(`::error file=${join(dir, file)}::addSchema failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
for (const { file, schema } of schemas) {
  try { if (!ajv.getSchema(schema.$id)) throw new Error(`schema did not compile: ${schema.$id}`); }
  catch (error) { console.error(`::error file=${join(dir, file)}::compile failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
console.log(JSON.stringify({ ok: true, schema_count: schemas.length, ids: schemas.map(({ schema }) => schema.$id) }));
