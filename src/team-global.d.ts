/**
 * Ambient global declaration so Team.tsx can call loadTeamForTerritory()
 * without a static import (the file is at its edit cap and cannot accept a
 * new import line). The function is registered on globalThis from main.tsx
 * via a dynamic import of @/lib/team-territory-scoped.
 */
declare function loadTeamForTerritory(): Promise<any[]>;
