/** Writes the OpenAPI document to docs/openapi.json (run: npm run docs:export). */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { openApiDocument } from '../src/docs/openapi';

const target = path.resolve(__dirname, '..', 'docs', 'openapi.json');
writeFileSync(target, `${JSON.stringify(openApiDocument, null, 2)}\n`, 'utf8');
console.log(`OpenAPI document written to ${target}`);
