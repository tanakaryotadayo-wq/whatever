import Ajv2020 from "ajv/dist/2020.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const dir = "schemas/v1";
const files = (await readdir(dir)).filter((name) => name.endsWith(".schema.json"));
const schemas = [];
for (const file of files) schemas.push(JSON.parse(await readFile(join(dir, file), "utf8")));
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const schema of schemas) ajv.addSchema(schema, schema.$id);
for (const schema of schemas) {
  const validate = ajv.getSchema(schema.$id);
  if (!validate) throw new Error(`schema did not compile: ${schema.$id}`);
}
console.log(JSON.stringify({ ok: true, schema_count: schemas.length, ids: schemas.map((schema) => schema.$id) }));
