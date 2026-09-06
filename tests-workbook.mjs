import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync('lib/workbook.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const module={exports:{}};vm.runInNewContext(compiled.outputText,{module,exports:module.exports,TextEncoder});
const file=module.exports.workbook([{name:'Ventas',columns:['Producto','Total ARS'],rows:[['Camisa & algodón',59900],['=HYPERLINK("https://example.test")',12.34],['<b>literal</b>',null]]},{name:'Ventas',columns:['Estado'],rows:[]}]);
assert.equal(new DataView(file.buffer).getUint32(0,true),0x04034b50);
const dir=mkdtempSync(join(tmpdir(),'fraguan-workbook-')),path=join(dir,'report.xlsx');
try {
  writeFileSync(path,file);
  execFileSync(process.env.FRAGUAN_TEST_PYTHON||'python',['-c',[
    'import sys, zipfile, xml.etree.ElementTree as ET, openpyxl',
    'with zipfile.ZipFile(sys.argv[1]) as z:',
    ' assert z.testzip() is None',
    ' for n in z.namelist(): ET.fromstring(z.read(n))',
    'w=openpyxl.load_workbook(sys.argv[1])',
    'assert w.sheetnames==["Ventas","Ventas 2"]',
    'assert w["Ventas"]["A2"].value=="Camisa & algodón"',
    'assert w["Ventas"]["B2"].value==59900',
    'assert w["Ventas"]["B3"].value==12.34',
    'assert w["Ventas"]["A3"].data_type=="s"',
    'assert w["Ventas"].freeze_panes=="A2"',
  ].join('\n'),path],{stdio:'pipe'});
  console.log('PASS: Excel válido con varias hojas, importes numéricos, caracteres especiales y fórmulas tratadas como texto.');
} finally { unlinkSync(path);rmdirSync(dir); }
