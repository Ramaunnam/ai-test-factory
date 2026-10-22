// Scene ids are single-quoted keys: verify_cues.mjs reads this file to check every at('phrase') is really spoken.
//
// Two app-specific rules worth knowing before editing this file:
//  1. Sidebar items are React Router <Link>s (role=link); sub-tabs are <button role="tab">; ordinary
//     actions are <button role="button">. Anything that opens a panel opens it as a right-hand
//     [role=dialog] drawer, so the camera moves onto the drawer, never onto the trigger.
//  2. Chrome's screencast only emits a frame when something on the page changes. After a navigation
//     this app can sit perfectly still for the rest of a scene, and the recorder then keeps whatever
//     frame it last captured -- which can be a half-painted one, leaving a blank-looking page for the
//     whole scene. Every navigation below is followed by a pointer move, which repaints and forces a
//     fresh, complete frame to be captured.
export default ({ page, focus, unzoom, pointLoc, clickLoc, expectSeen, sleep }) => ({
  '02_what': async ({ at }) => {
    await clickLoc(page.getByRole('link', { name: 'Testing Journey' }), 'testing journey nav');
    await sleep(800);
    await pointLoc(page.getByRole('button', { name: /Learn the process/ }).first(), 'the first step');
    await at('in eight steps');
    await focus('journeySteps');
  },

  '03_requirements': async ({ at }) => {
    unzoom();
    await focus('requirements');
    await at('Pick any one');
    await clickLoc(page.getByRole('button', { name: /ADV-01/ }), 'a client requirement');
    await sleep(600);
  },

  '04_step': async ({ at }) => {
    unzoom();
    // back to step one: picking a requirement above re-selects the step that covers it, and this
    // scene's narration is specifically about step one.
    await clickLoc(page.getByRole('button', { name: /^1\s*\|?\s*Learn the process/ }).first(), 'step one');
    await sleep(600);
    await at('what the AI does');
    await focus('stepDetail');
  },

  '05_truck': async ({ at }) => {
    unzoom();
    await at('follows it through all eight steps');
    await focus('truckJourney');
    await pointLoc(page.getByText('Follow one truck through the journey'), 'the truck journey');
  },

  '06_discovery': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('button', { name: /Open this step in the app/ }), 'open this step in the app');
    await sleep(1000);
    await pointLoc(page.getByText('What happens on this page'), 'the discovery inputs');
    await at('groups the clicks');
    await focus('discoveryIn');
  },

  '07_studio': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: 'Test Studio' }), 'test studio nav');
    await sleep(1000);
    await pointLoc(page.getByText('Turn a business rule into a data check'), 'the rule box');
    await at('plain English');
    await focus('studioRule');
  },

  '08_run': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: 'Run Centre' }), 'run centre nav');
    await sleep(700);
    await clickLoc(page.getByRole('button', { name: 'Run the P1 demo now' }), 'run the p1 demo now');
    await at('heals itself');
    await focus('runStrip');
    await at('verdict is conditional');
    await focus('runVerdict');
  },

  '09_checks': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: /Live Data Flow/ }), 'flow nav');
    await sleep(600);
    await clickLoc(page.getByRole('tab', { name: 'Live Checks' }), 'checks tab');
    await sleep(700);
    await at('names the cause');
    await focus('checksC1');
    await at('opens its own panel');
    unzoom();
    await clickLoc(page.getByText('How this works').first(), 'how this works');
    await sleep(800);
    await focus('drawer');
  },

  '10_interfaces': async ({ at }) => {
    unzoom();
    await page.keyboard.press('Escape');   // close the drawer before navigating away from it
    await sleep(400);
    await clickLoc(page.getByRole('link', { name: 'Interface Testing' }), 'interface testing nav');
    await sleep(900);
    await pointLoc(page.getByText('Narrow it down'), 'the interface filters');
    await at('field by field');
    await focus('interfaceTbl');
  },

  // The load test is the one place with live numbers worth watching, so it is actually run here.
  // It needs ~20s of its own: the profile ramps up over the first seconds and settles after that.
  '11_load': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: 'Command Centre' }), 'command centre nav');
    await sleep(600);
    await clickLoc(page.getByRole('tab', { name: 'Month-End Load' }), 'month-end load tab');
    await sleep(800);
    await clickLoc(page.getByRole('button', { name: '5x', exact: true }), 'the 5x profile');
    await sleep(500);
    await clickLoc(page.getByRole('button', { name: 'Run load test' }).first(), 'run load test');
    await at('error rate climb');
    await focus('loadMetrics');
    await at('Invoice capture gives way first');
    await focus('loadBreaks');
  },

  '12_governance': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: /Roles & SoD/ }), 'roles and sod nav');
    await sleep(900);
    await pointLoc(page.getByText('Conflict matrix'), 'the conflict matrix');
    await at('actually attempted');
    await focus('sodMatrix');
    await at('migration reconciliation compares');
    unzoom();
    await clickLoc(page.getByRole('link', { name: /Change & Regression/ }), 'change and regression nav');
    await sleep(700);
    await clickLoc(page.getByRole('tab', { name: 'Migration Reconciliation' }), 'migration reconciliation tab');
    await sleep(800);
    await focus('reconList');
  },

  '13_gate': async ({ at }) => {
    unzoom();
    await clickLoc(page.getByRole('link', { name: 'Command Centre' }), 'command centre nav');
    await sleep(600);
    await clickLoc(page.getByRole('tab', { name: 'Release & Close' }), 'release tab');
    await sleep(800);
    await pointLoc(page.getByText('Exit criteria').first(), 'the exit criteria');
    await focus('gateVerdict');
    await at('not met is named');
    await focus('exitCriteria');
    await at('re-colours in dark mode');
    unzoom();
    await page.keyboard.press('Shift+D');
    await sleep(700);
  },
});
