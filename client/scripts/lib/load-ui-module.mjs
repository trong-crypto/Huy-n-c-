// Test/preview tooling only: transpile the real component tree, without production stubs.
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../../src/", import.meta.url);
const require = createRequire(import.meta.url);
const modules = new Map();
function moduleUrl(file) {
  const key = file.href;
  if (modules.has(key)) return modules.get(key);
  const source = fs.readFileSync(file, "utf8");
  const code = file.pathname.endsWith(".json") ? `export default ${JSON.stringify(JSON.parse(source))};` : ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText.replace(/\bfrom\s+(["'])([^"']+)\1/g, (_match, _quote, specifier) => {
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) {
      // Next.js exposes extensionless CommonJS entries such as next/link.
      const url = specifier.startsWith("next/")
        ? pathToFileURL(require.resolve(specifier)).href
        : import.meta.resolve(specifier);
      return `from ${JSON.stringify(url)}`;
    }
    const base = specifier.startsWith("@/") ? new URL(specifier.slice(2), sourceRoot) : new URL(specifier, file);
    const dependency = [base, new URL(`${base.href}.tsx`), new URL(`${base.href}.ts`)].find(candidate => fs.existsSync(candidate));
    if (!dependency) throw new Error(`UI test dependency not found: ${specifier}`);
    return `from ${JSON.stringify(moduleUrl(dependency))}`;
  });
  const result = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  modules.set(key, result);
  return result;
}

export function loadUiModule(relativePath) {
  return import(moduleUrl(new URL(relativePath, sourceRoot)));
}
