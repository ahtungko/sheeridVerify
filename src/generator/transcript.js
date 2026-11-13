import { existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { AutomationError } from '../core/errors.js';

export const UNIVERSITIES = {
  ohio: {
    key: 'ohio',
    name: 'Ohio University',
    shortName: 'OHIO',
    optionText: 'Ohio University',
    emailDomain: 'ohio.edu',
    country: 'United States',
  },
  umich: {
    key: 'umich',
    name: 'University of Michigan',
    shortName: 'MICH',
    optionText: 'University of Michigan - Ann Arbor',
    emailDomain: 'umich.edu',
    country: 'United States',
  },
  uw: {
    key: 'uw',
    name: 'University of Washington',
    shortName: 'UW',
    optionText: 'University of Washington',
    emailDomain: 'uw.edu',
    country: 'United States',
  },
  purdue: {
    key: 'purdue',
    name: 'Purdue University',
    shortName: 'PURDUE',
    optionText: 'Purdue University',
    emailDomain: 'purdue.edu',
    country: 'United States',
  },
  ufl: {
    key: 'ufl',
    name: 'University of Florida',
    shortName: 'UFL',
    optionText: 'University of Florida',
    emailDomain: 'ufl.edu',
    country: 'United States',
  },
  psu: {
    key: 'psu',
    name: 'Pennsylvania State University',
    shortName: 'PSU',
    optionText: 'Penn State University',
    emailDomain: 'psu.edu',
    country: 'United States',
  },
  marshall: {
    key: 'marshall',
    name: 'Marshall University',
    shortName: 'MARSHALL',
    optionText: 'Marshall University',
    emailDomain: 'marshall.edu',
    country: 'United States',
  },
};

export function matchUniversity(input = '') {
  if (!input || typeof input !== 'string') return 'ohio';
  const clean = input.trim().toLowerCase();
  if (Object.hasOwn(UNIVERSITIES, clean)) return clean;
  if (clean.includes('michigan') || clean.includes('umich')) return 'umich';
  if (clean.includes('washington') || clean.includes('uw.edu')) return 'uw';
  if (clean.includes('purdue')) return 'purdue';
  if (clean.includes('florida') || clean.includes('ufl')) return 'ufl';
  if (clean.includes('penn') || clean.includes('psu')) return 'psu';
  if (clean.includes('marshall')) return 'marshall';
  if (clean.includes('ohio')) return 'ohio';
  return 'ohio';
}

export function findBrowserExecutable() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  if (process.env.BROWSER_EXECUTABLE_PATH && existsSync(process.env.BROWSER_EXECUTABLE_PATH)) return process.env.BROWSER_EXECUTABLE_PATH;

  const localApp = process.env.LOCALAPPDATA || '';

  const candidates = [
    // Linux standard paths (instabox / Ubuntu / Debian / CentOS)
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/lib/chromium/chromium',
    '/snap/bin/chromium',
    '/usr/bin/msedge',
    // Windows Chrome & Edge
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    localApp ? `${localApp}\\Google\\Chrome\\Application\\chrome.exe` : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    localApp ? `${localApp}\\Microsoft\\Edge\\Application\\msedge.exe` : null,
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);

  for (const item of candidates) {
    if (existsSync(item)) return item;
  }

  try {
    const playwrightPath = chromium.executablePath?.();
    if (playwrightPath && existsSync(playwrightPath)) return playwrightPath;
  } catch {}

  return null;
}

export function getGeneratorHtmlPath() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.TRANSCRIPT_GENERATOR_PATH,
    resolve(currentDir, 'templates/official_transcript_generator.html'),
    resolve(currentDir, 'official_transcript_generator.html'),
    resolve('src/generator/templates/official_transcript_generator.html'),
  ].filter(Boolean);

  for (const item of candidates) {
    if (existsSync(item)) return resolve(item);
  }
  throw new AutomationError('GENERATOR_NOT_FOUND', '未找到成绩单生成器 HTML 模板文件 (official_transcript_generator.html)');
}

export async function generateTranscriptPdf(options = {}) {
  const {
    firstName = 'Student',
    lastName = 'User',
    birthDate = '2001-05-18',
    universityKey,
    signal,
  } = options;

  const univKey = matchUniversity(universityKey);
  const univ = UNIVERSITIES[univKey];
  const executablePath = findBrowserExecutable();

  const htmlPath = getGeneratorHtmlPath();
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

  let browser;
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
      ...(executablePath ? { executablePath } : {}),
    };

    browser = await chromium.launch(launchOptions).catch(err => {
      throw new AutomationError(
        'BROWSER_NOT_FOUND',
        `无法启动无头浏览器生成 PDF: ${err.message}。请确认已安装 Chrome、Chromium 或运行 npx playwright install chromium`
      );
    });

    signal?.throwIfAborted();
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });

    signal?.throwIfAborted();
    const studentInfo = await page.evaluate(({ uKey, fName, lName, bDate }) => {
      let applied;
      if (typeof window.applyStudentData === 'function') {
        applied = window.applyStudentData(fName, lName, uKey);
      } else {
        if (typeof window.switchUniversity === 'function') window.switchUniversity(uKey);
        else if (typeof switchUniversity === 'function') switchUniversity(uKey);

        const s = typeof state !== 'undefined' ? state : window.state;
        if (s) {
          if (fName) s.firstName = fName.trim();
          if (lName) s.lastName = lName.trim();
          if (bDate) s.birthDate = bDate.trim();
          s.emailManuallyEdited = false;
          const u = (typeof UNIVERSITIES !== 'undefined' ? UNIVERSITIES[s.universityKey] : null) || (window.UNIVERSITIES ? window.UNIVERSITIES[s.universityKey] : null);
          if (u) {
            const cleanFirst = s.firstName.replace(/\s+/g, '.');
            const cleanLast = s.lastName.replace(/\s+/g, '.');
            s.email = `${cleanFirst}.${cleanLast}@${u.registrarOffice.emailDomain}`;
          }
        }
        if (typeof randomizeIDs === 'function') randomizeIDs();
        else if (typeof window.randomizeIDs === 'function') window.randomizeIDs();

        if (typeof autoSetCurrentDates === 'function') autoSetCurrentDates();
        else if (typeof window.autoSetCurrentDates === 'function') window.autoSetCurrentDates();

        if (typeof syncInputsFromState === 'function') syncInputsFromState();
        else if (typeof window.syncInputsFromState === 'function') window.syncInputsFromState();

        if (typeof syncVerificationText === 'function') syncVerificationText();
        else if (typeof window.syncVerificationText === 'function') window.syncVerificationText();

        if (typeof renderTranscriptPreview === 'function') renderTranscriptPreview();
        else if (typeof window.renderTranscriptPreview === 'function') window.renderTranscriptPreview();

        applied = {
          name: document.getElementById('p1StudentName')?.textContent,
          email: document.getElementById('p1Email')?.textContent,
          pid: document.getElementById('p1Pid')?.textContent,
          docId: document.getElementById('p1DocumentId')?.textContent,
        };
      }
      return applied;
    }, { uKey: univKey, fName: firstName, lName: lastName, bDate: birthDate });

    signal?.throwIfAborted();
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const safeName = `${firstName}_${lastName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${univ.shortName}_Official_Transcript_${safeName}.pdf`;

    return {
      bytes: pdfBuffer,
      mimeType: 'application/pdf',
      fileSize: pdfBuffer.length,
      fileName,
      university: univ,
      student: studentInfo,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
