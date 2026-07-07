import { bootScaffold } from '@mdj/bootstrap/boot';
import { MDJ_V2_SCAFFOLD_VERSION, SCAFFOLD_META } from '@mdj/shared/index';
import { resolveStaffPortalComponentGuards } from './component-guards-wire';

const PORTAL_ID = 'staff';

function main(): void {
  const boot = bootScaffold(undefined, PORTAL_ID);
  const app = document.querySelector('#app');
  if (!app) return;

  if (!boot.ok) {
    app.textContent = [`Portal: ${PORTAL_ID}`, `Config: error`, `Code: ${boot.errorCode}`].join(' · ');
    return;
  }

  resolveStaffPortalComponentGuards();

  app.textContent = [
    `Portal: ${PORTAL_ID}`,
    `Config: loaded`,
    `Environment: ${boot.environment}`,
    `Bus: ready`,
    `Logging: ready`,
    `Error Handler: ready`,
    `Session: ready`,
    `Version: ${MDJ_V2_SCAFFOLD_VERSION}`,
    `Business logic: ${String(SCAFFOLD_META.businessLogic)}`,
  ].join(' · ');
}

main();
