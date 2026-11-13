import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateTranscriptPdf, UNIVERSITIES, matchUniversity } from '../src/generator/transcript.js';
import { isMainModule, reportFatalError } from './process.js';

export async function runGenerate(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      first: { type: 'string', default: 'John' },
      last: { type: 'string', default: 'Doe' },
      name: { type: 'string' },
      birthDate: { type: 'string', default: '2001-05-18' },
      univ: { type: 'string', default: 'ohio' },
      output: { type: 'string' },
      list: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Official Academic Transcript Generator (PDF)

用法:
  node scripts/generate-transcript.js [选项]

选项:
  --name "First Last"       学生全名 (例如 "Gary Porter")
  --first <First>           学生名 (默认: John)
  --last <Last>             学生姓 (默认: Doe)
  --birthDate <YYYY-MM-DD>  出生日期 (默认: 2001-05-18)
  --univ <key>              学校标识 (支持: ohio, umich, uw, purdue, ufl, psu, marshall)
  --output <path>           保存 PDF 路径 (默认: proof/<filename>)
  --list                    列出所有支持的大学预设
  --help                    显示帮助
`);
    return;
  }

  if (values.list) {
    console.log('\n支持的大学预设:');
    for (const [key, item] of Object.entries(UNIVERSITIES)) {
      console.log(`- ${key.padEnd(10)}: ${item.name} (${item.emailDomain}) [${item.shortName}]`);
    }
    return;
  }

  let firstName = values.first;
  let lastName = values.last;
  if (values.name) {
    const parts = values.name.trim().split(/\s+/);
    firstName = parts[0] || 'John';
    lastName = parts.slice(1).join(' ') || 'Doe';
  }

  const universityKey = matchUniversity(values.univ);
  console.log(`正在生成 [${UNIVERSITIES[universityKey].name}] 官方成绩单 PDF...`);

  const result = await generateTranscriptPdf({
    firstName,
    lastName,
    birthDate: values.birthDate,
    universityKey,
  });

  const outputPath = values.output
    ? resolve(values.output)
    : resolve('proof', result.fileName);

  await writeFile(outputPath, result.bytes);
  console.log(`✓ 成绩单生成成功！`);
  console.log(`  学校: ${result.university.name}`);
  console.log(`  学生: ${firstName} ${lastName}`);
  console.log(`  大小: ${(result.fileSize / 1024).toFixed(1)} KB`);
  console.log(`  文件: ${outputPath}`);
}

if (isMainModule(import.meta.url)) {
  runGenerate().catch(reportFatalError);
}
