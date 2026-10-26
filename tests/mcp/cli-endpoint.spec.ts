/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';

import { test, expect } from './cli-fixtures';

test('attach --endpoint keeps the default session', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41154' } }, async ({ boundBrowser, cli, server }) => {
  await boundBrowser.newContext();
  await boundBrowser.unbind();
  await boundBrowser.bind('bound');
  const { exitCode, error } = await cli('attach', '--endpoint=bound');
  expect(error).not.toContain('no target specified');
  expect(exitCode).toBe(0);

  const { output: listOutput } = await cli('list');
  expect(listOutput).toContain('- default:');
  expect(listOutput).toContain('(attached)');

  await cli('goto', server.HELLO_WORLD);
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain('Hello, world!');
});

test('attach refuses browsers that this build did not bind', async ({ boundBrowser, cli, cliEnv }, testInfo) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<input aria-label=Login value=visible-login><input type=password aria-label=Password value=direct-secret><label><input type=checkbox>Remember<input type=password value=label-secret></label>`);
  const registry = cliEnv.PWTEST_SERVER_REGISTRY;
  const [file] = await fs.promises.readdir(registry);
  const { omitsPasswordValues, ...record } = JSON.parse(await fs.promises.readFile(path.join(registry, file), 'utf8'));
  // An upstream server records its browser without the marker, and its snapshots include password values.
  await fs.promises.writeFile(path.join(registry, file), JSON.stringify({ ...record, title: 'upstream' }));
  // A record of this build whose endpoint is served by another browser.
  await fs.promises.writeFile(path.join(registry, 'browser@stale'), JSON.stringify({ ...record, omitsPasswordValues, title: 'stale', browser: { ...record.browser, guid: 'browser@stale' } }));

  for (const [session, target, message] of [
    ['upstream', 'upstream', `Browser "upstream" was bound by Playwright ${record.playwrightVersion}, whose snapshots can include password values`],
    ['default', `--endpoint=${record.endpoint}`, `"${record.endpoint}" is not a browser bound by this Playwright fork`],
    ['stale', 'stale', `The endpoint registered for "stale" is served by a different browser`],
  ]) {
    const attach = await cli('--json', 'attach', target);
    expect(attach.exitCode).toBe(1);
    expect(attach.error).toContain(message);
    const snapshotFile = testInfo.outputPath(`${session}.yml`);
    const snapshot = await cli(`-s=${session}`, 'snapshot', `--filename=${snapshotFile}`);
    expect(snapshot.exitCode).toBe(1);
    expect(fs.existsSync(snapshotFile)).toBe(false);
    expect(attach.output + attach.error + snapshot.output + snapshot.error).not.toContain('secret');
  }
  expect(fs.existsSync(testInfo.outputPath('.playwright-cli'))).toBe(false);
  expect(boundBrowser.isConnected()).toBe(true);
});
