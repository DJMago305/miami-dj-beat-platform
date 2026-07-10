/** TICKET-V2-RUNTIME-SCAFFOLD-001 · TICKET-V2-RUNTIME-CONFIG-001 */
export {
  BOOT_AUTH_HANDOFF_MODE,
  activateAuthForBoot,
  getBootMockAuthProviderForTests,
  registerAuthForBoot,
  resetBootAuthWiringForTests,
  type BootAuthActivationResult,
  type BootAuthRegistration,
} from './initialize-auth';
export { bootScaffold, type BootFailure, type BootResult, type BootSuccess } from './boot';
