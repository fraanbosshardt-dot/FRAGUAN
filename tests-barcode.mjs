import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync('lib/barcode.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const module={exports:{}};vm.runInNewContext(compiled.outputText,{module,exports:module.exports});
for(const value of ['ABC-123','0123456789','ABCDEFGHIJKLM','NOPQRSTUVWXYZ','-. $/+%']) {
 const pattern=execFileSync(process.env.FRAGUAN_TEST_PYTHON||'python',['-c','import sys; from reportlab.graphics.barcode.code39 import Standard39; b=Standard39(sys.argv[1],checksum=0); b.validate(); b.encode(); print(b.decompose())',value],{encoding:'utf8'}).trim();
 let x=10;const expected=[];
 for(const c of pattern){const width=c===c.toUpperCase()?3:1;if(c.toLowerCase()==='b')expected.push({x,width});x+=width;}
 const actual=module.exports.code39(value);
 assert.equal(JSON.stringify(actual.bars),JSON.stringify(expected));assert.equal(actual.width,x+10);
}
assert.equal(module.exports.code39('abc'),null);assert.equal(module.exports.code39(''),null);assert.equal(module.exports.code39('*'),null);
console.log('PASS: Code39 matches independent ReportLab encoding including quiet zones.');

