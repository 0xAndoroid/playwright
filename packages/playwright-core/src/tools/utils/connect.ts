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

import type * as playwright from '../../..';
import type { BrowserDescriptor } from '../../serverRegistry';

export async function connectToBrowserAcrossVersions(descriptor: BrowserDescriptor): Promise<playwright.Browser> {
  // The server that owns a browser produces its snapshots. Only this fork's servers mark their records, and their snapshots omit password values.
  if (!descriptor.omitsPasswordValues)
    throw new Error(`Browser "${descriptor.title}" was bound by Playwright ${descriptor.playwrightVersion}, whose snapshots can include password values. Only browsers bound by this Playwright fork can be attached; connect over CDP or through the extension instead.`);
  const pw = require(descriptor.playwrightLib);
  const browserType = pw[descriptor.browser.browserName] as playwright.BrowserType;
  const browser = await browserType.connect(descriptorEndpoint(descriptor));
  // The guid from the connection handshake shows that the endpoint serves the browser of this record, not a server that reused the endpoint.
  if ((browser as playwright.Browser & { _guid: string })._guid !== descriptor.browser.guid) {
    await browser.close().catch(() => {});
    throw new Error(`The endpoint registered for "${descriptor.title}" is served by a different browser.`);
  }
  return browser;
}

export function descriptorEndpoint(descriptor: BrowserDescriptor): string {
  // eslint-disable-next-line no-restricted-syntax
  return descriptor.endpoint ?? (descriptor as any).pipeName;
}
