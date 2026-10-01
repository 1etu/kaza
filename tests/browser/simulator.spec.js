import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>!!window.simulation);await page.locator('#toggle-panel').click();
});

test('Scene, camera modes, deterministic seeking and visible signals',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.reload();await page.waitForFunction(()=>!!window.simulation);await page.locator('#toggle-panel').click();
  await expect(page.locator('canvas[aria-label="3D kavşak sahnesi"]')).toBeVisible();
  await page.screenshot({path:'test-results/01-start.png'});
  await page.locator('[data-event-time]').filter({hasText:'İlk temas'}).click();
  await expect(page.locator('#time-input')).toHaveValue('13.20');
  await page.locator('#focus').click();await page.screenshot({path:'test-results/02-contact-top.png'});
  await page.locator('#driver').click();await expect(page.locator('#driver-hud')).toBeVisible();
  await page.screenshot({path:'test-results/03-contact-driver.png'});
  await page.locator('#bird').click();await page.screenshot({path:'test-results/04-contact-bird.png'});
  await page.locator('#back-frame').click();await expect(page.locator('#time-input')).toHaveValue('13.17');
  await page.locator('#forward-frame').click();await expect(page.locator('#time-input')).toHaveValue('13.20');
  const state=await page.evaluate(()=>window.simulation.getState());expect(state.mode).toBe('bird');expect(state.playing).toBe(false);expect(state.drawCalls).toBeLessThan(600);
  await page.locator('#time-input').fill('16');await page.locator('#time-input').press('Tab');
  await page.locator('[data-actor="corolla"]').click();await page.locator('#focus').click();await page.screenshot({path:'test-results/05-final.png'});
  expect(errors).toEqual([]);
});

test('Playback can pause at contact and run backwards',async({page})=>{
  await page.locator('#auto-explain').uncheck();await page.locator('#time-input').fill('13.15');await page.locator('#time-input').press('Tab');
  await page.locator('#pause-contact').check();await page.locator('#play').click();
  await expect.poll(()=>page.evaluate(()=>window.simulation.getState().playing)).toBe(false);
  expect(await page.evaluate(()=>window.simulation.getState().time)).toBe(13.2);
  await page.locator('#rate').selectOption('-1');await page.locator('#play').click();
  await expect.poll(()=>page.evaluate(()=>window.simulation.getState().time)).toBeLessThan(13);
  await page.locator('#play').click();expect(await page.evaluate(()=>window.simulation.getState().playing)).toBe(false);
});

test('Vehicle pose, drawing, undo, export and import',async({page})=>{
  await page.locator('[data-event-time]').filter({hasText:'İlk temas'}).click();
  await page.locator('#edit-x').fill('2');await page.getByRole('button',{name:'Bu ana konum anahtarı ekle',exact:true}).click();
  expect((await page.evaluate(()=>window.simulation.getState())).project.edits.bmw.some(k=>k.x===2)).toBe(true);
  await page.locator('#undo').click();expect((await page.evaluate(()=>window.simulation.getState())).project.edits.bmw).toBeUndefined();
  await page.locator('[data-tool="arrow"]').click();
  const points=await page.evaluate(()=>[window.simulation.projectToScreen(-2,20),window.simulation.projectToScreen(3,12)]);
  for(const p of points)await page.mouse.click(p.x,p.y);
  expect((await page.evaluate(()=>window.simulation.getState())).project.annotations).toHaveLength(1);
  await page.locator('#undo').click();expect((await page.evaluate(()=>window.simulation.getState())).project.annotations).toHaveLength(0);
  await page.locator('#redo').click();expect((await page.evaluate(()=>window.simulation.getState())).project.annotations).toHaveLength(1);
  const downloadPromise=page.waitForEvent('download');await page.locator('#save').click();const download=await downloadPromise;
  const path=await download.path();await page.locator('#reset').click();await page.locator('#file').setInputFiles(path);
  await expect(page.locator('#status')).toHaveText('Proje açıldı.');
  expect((await page.evaluate(()=>window.simulation.getState())).project.annotations).toHaveLength(1);
  const shotPromise=page.waitForEvent('download');await page.locator('#shot').click();expect((await shotPromise).suggestedFilename()).toMatch(/\.png$/);
});

test('Invalid import leaves the scene intact and reference images load',async({page})=>{
  await page.locator('#file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.locator('#status')).toContainText('Dosya açılamadı');
  await page.locator('#references').click();await expect(page.locator('#reference-dialog')).toBeVisible();
  expect(await page.locator('#reference-dialog img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  await page.locator('#reference-dialog [data-close]').click();
});


test('Clean night view, blocking explanation with original photo, and video export',async({page})=>{
  test.setTimeout(120000);
  await expect(page).toHaveTitle('kaza');
  await expect(page.locator('header')).not.toContainText('Fatih Sokak');
  await page.locator('#toggle-panel').click();
  expect((await page.evaluate(()=>window.simulation.getState())).mode).toBe('driver');
  await expect(page.locator('#inspector')).toBeHidden();await expect(page.locator('#report')).toBeHidden();
  await page.screenshot({path:'test-results/06-night-clean.png'});
  await page.locator('#time-input').fill('11.94');await page.locator('#time-input').press('Tab');await page.locator('#play').click();
  await expect(page.locator('#evidence-photo')).toBeVisible();
  const state=await page.evaluate(()=>window.simulation.getState());
  expect(state.hold.id).toBe('corolla-entry');
  await page.screenshot({path:'test-results/07-photo-explanation.png'});
  await page.waitForTimeout(2300);
  expect((await page.evaluate(()=>window.simulation.getState())).time).toBe(state.time);
  await expect(page.locator('#explanation')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#explanation')).toBeVisible();
  await page.locator('#close-explanation').click();
  await page.keyboard.press('Space');
  if(await page.locator('#explanation').isVisible()){await page.locator('#close-explanation').click();await page.keyboard.press('Space');}
  await page.locator('#time-input').fill('11.6');await page.locator('#time-input').press('Tab');
  await page.screenshot({path:'test-results/08-approach-visibility.png'});
  await page.locator('#auto-explain').uncheck();
  const videoPromise=page.waitForEvent('download',{timeout:90000});await page.locator('#record-video').click();
  const file=await videoPromise;expect(file.suggestedFilename()).toBe('fatih-gece-aciklama.webm');
  await file.saveAs('test-results/video-export.webm');
});
