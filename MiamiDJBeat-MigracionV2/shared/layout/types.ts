/** MOD-008 Portal Shell — layout types — TICKET-MOD-008-PORTAL-SHELL-001 */

export type PortalShellId = 'client' | 'artist' | 'staff';

export type PortalNavItem = {
  readonly id: string;
  readonly label: string;
  readonly active?: boolean;
};

export type PortalKpiPlaceholder = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
};

export type PortalModuleSlot = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tag: string;
};

export type PortalShellContent = {
  readonly portalId: PortalShellId;
  readonly documentTitle: string;
  readonly brandMark: string;
  readonly brandSubtitle: string;
  readonly heroEyebrow: string;
  readonly heroTitle: string;
  readonly heroSubtitle: string;
  readonly modulesSectionTitle: string;
  readonly profileName: string;
  readonly profileRole: string;
  readonly profileMeta: string;
  readonly navItems: readonly PortalNavItem[];
  readonly kpis: readonly PortalKpiPlaceholder[];
  readonly modules: readonly PortalModuleSlot[];
};

export type PortalRuntimeStatus = {
  readonly portalId: PortalShellId;
  readonly environment: string;
  readonly configLoaded: boolean;
  readonly busReady: boolean;
  readonly loggingReady: boolean;
  readonly errorHandlerReady: boolean;
  readonly sessionReady: boolean;
  readonly runtimeReady: boolean;
  readonly systemReadyConfirmed: boolean;
  readonly themeReady: boolean;
  readonly permissionsReady: boolean;
  readonly permissionComponentCount: number;
  readonly businessLogic: boolean;
  readonly version: string;
  readonly bootErrorCode?: string;
};
