// Scene ids are single-quoted keys: verify_cues.mjs reads this file to check every at('phrase') is really spoken.
// Sidebar items are React Router <Link>s (role=link); sub-tabs are <button role="tab">; ordinary
// actions are <button role="button">. Mixing these up is the single easiest mistake in this app.
export default ({ page, focus, unzoom, pointLoc, clickLoc, expectSeen, sleep }) => ({
  // Fully hidden behind the title cover: guarantee a known starting state the same way the team's
  // own DEMO-SCRIPT.md does before recording -- faults on, plant replayed.
  '01_title': async () => {
    await page.keyboard.press('Control+K');
    await sleep(300);
    await page.keyboard.type('faults on');
    await sleep(300);
    await page.keyboard.press('Enter');   // this command also navigates to /flow/checks
    await sleep(400);
    // back to the Command Centre for scene 2 -- a client-side nav, not page.goto, so the
    // simulated engine state (just set up above) survives.
    await clickLoc(page.getByRole('link', { name: 'Command Centre' }), 'command centre nav');
    await sleep(300);
  },

  '02_question': async ({ at }) => {
    await at('single measured number');
    await focus('gauge');
  },

  '03_live': async ({ at }) => {
    await at('force a truck');
    await clickLoc(page.getByRole('button', { name: 'Send a truck' }), 'send a truck');
    await sleep(1200);
    await focus('sendTruck');
  },

  '04_score': async ({ at }) => {
    await focus('gauge');
    await at('four weighted inputs');
    await clickLoc(page.getByText('Show the full calculation'), 'show the full calculation');
    await sleep(400);
    await focus('scoreCalc');
    await at('ranks what to fix first');
    unzoom();
    await page.keyboard.press('Escape');   // the calculation opens a real dialog with a backdrop
    await sleep(400);
    await focus('whatNext');
  },

  '05_flow': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: /Live Data Flow/ }), 'flow nav');
    await sleep(600);
    await at('real message in flight');   // stays wide: the moving dots are the point, not a push-in
  },

  '06_checks': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('tab', { name: 'Live Checks' }), 'checks tab');
    await sleep(500);
    await focus('checksC1');
    await at('names the cause');
    await clickLoc(page.getByText('Show the query').first(), 'show the query');
  },

  '07_finding': async ({ at }) => {
    unzoom();
    await focus('raiseFinding');
    await clickLoc(page.getByRole('button', { name: 'Raise finding' }).first(), 'raise finding');
    await sleep(700);
    unzoom();   // the finding card is a full-page view with no card to climb to
    await at('evidence attached');
    await clickLoc(page.locator('.bg-surface', { hasText: 'Records affected' }).locator('button').first(), 'an affected gate-pass chip');
    await sleep(500);
  },

  '08_fix': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('tab', { name: 'Live Checks' }), 'checks tab again');
    await sleep(500);
    await focus('checksC1');
    await at('switch off the fault');
    await clickLoc(page.getByRole('button', { name: 'Fix the cause and replay' }).first(), 'fix the cause and replay');
    await sleep(1200);
  },

  '09_run': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: 'Run Centre' }), 'run centre nav');
    await sleep(500);
    await clickLoc(page.getByRole('button', { name: 'Run the P1 demo now' }), 'run the p1 demo now');
    await sleep(800);   // stays wide: the workflow strip animating through its steps is the point
    await at('conditional, not a blind green tick');
  },

  '10_simulator': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('button', { name: /Key User/ }), 'role menu');
    await sleep(300);
    await clickLoc(page.getByRole('menuitem', { name: /Plant Head/ }), 'plant head');
    await sleep(900);
    await at('simulated before they ship');
    await clickLoc(page.getByRole('button', { name: 'Simulate impact' }), 'simulate impact');
    await sleep(1500);
    await focus('simulate');
  },

  '11_release': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('button', { name: /Plant Head/ }), 'role menu again');
    await sleep(300);
    await clickLoc(page.getByRole('menuitem', { name: 'Key User' }), 'back to key user');
    await sleep(500);
    await clickLoc(page.getByRole('tab', { name: 'Release & Close' }), 'release nav');
    await sleep(500);
    await focus('gateDecision');
    await at('designed, not just inverted');
    unzoom();
    await page.keyboard.press('Shift+D');
    await sleep(700);
  },
});
