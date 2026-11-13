import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UNIVERSITIES, matchUniversity, getGeneratorHtmlPath, generateTranscriptPdf } from '../src/generator/transcript.js';
import { readDocument } from '../src/apps/sheerid/document.js';
import { createWebServer } from '../src/web/server.js';

test('matchUniversity matches various inputs to valid university keys', () => {
  assert.equal(matchUniversity('ohio'), 'ohio');
  assert.equal(matchUniversity('Ohio University'), 'ohio');
  assert.equal(matchUniversity('University of Michigan'), 'umich');
  assert.equal(matchUniversity('umich.edu'), 'umich');
  assert.equal(matchUniversity('University of Washington'), 'uw');
  assert.equal(matchUniversity('Purdue University'), 'purdue');
  assert.equal(matchUniversity('University of Florida'), 'ufl');
  assert.equal(matchUniversity('Penn State'), 'psu');
  assert.equal(matchUniversity('Marshall University'), 'marshall');
  assert.equal(matchUniversity('unknown'), 'ohio');
});

test('getGeneratorHtmlPath returns valid existing path', () => {
  const path = getGeneratorHtmlPath();
  assert.ok(path.endsWith('official_transcript_generator.html'));
});

test('generateTranscriptPdf generates valid PDF with correct magic bytes and filename', async () => {
  const result = await generateTranscriptPdf({
    firstName: 'TestFirst',
    lastName: 'TestLast',
    universityKey: 'umich',
  });
  assert.equal(result.mimeType, 'application/pdf');
  assert.ok(result.fileSize > 10000);
  assert.equal(result.bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(result.fileName.includes('MICH'));
  assert.ok(result.fileName.includes('TestFirst_TestLast'));
  assert.equal(result.university.key, 'umich');
  assert.equal(result.student.name, 'TestLast, TestFirst');
  assert.equal(result.student.email, 'TestFirst.TestLast@umich.edu');
});

test('readDocument falls back to direct generation when loopback /api/document server is offline', async () => {
  const source = { url: 'http://127.0.0.1:59999/api/document?name=Fallback+Student&univ=purdue' };
  const doc = await readDocument(source);
  assert.equal(doc.mimeType, 'application/pdf');
  assert.ok(doc.fileSize > 10000);
  assert.equal(doc.bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(doc.fileName.includes('PURDUE'));
  assert.ok(doc.fileName.includes('Fallback_Student'));
});

test('Web server /api/presets and /api/document endpoints serve presets and generated PDF', async () => {
  const app = createWebServer({ port: 0, password: 'test-password' });
  const origin = await app.start();
  try {
    // Presets
    const presetsRes = await fetch(`${origin}/api/presets`, {
      headers: { 'X-Web-Password': 'test-password' },
    });
    assert.equal(presetsRes.status, 200);
    const presetsData = await presetsRes.json();
    assert.ok(presetsData.presets.ohio);
    assert.ok(presetsData.presets.umich);

    // Document generation via loopback HTTP
    const docRes = await fetch(`${origin}/api/document?name=Api+Student&univ=ufl`);
    assert.equal(docRes.status, 200);
    assert.equal(docRes.headers.get('content-type'), 'application/pdf');
    const bytes = Buffer.from(await docRes.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(bytes.length > 10000);
  } finally {
    await app.close();
  }
});
