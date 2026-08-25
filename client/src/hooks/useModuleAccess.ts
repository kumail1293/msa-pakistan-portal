import { trpc } from "@/lib/trpc";

export type ModuleAccessLevel = "view" | "comment" | "edit";

export interface ModuleAccessResult {
  /** Access level for a given module id, or null if not loaded yet. */
  getAccess: (moduleId: string) => ModuleAccessLevel | null;
  /** Whether the user has at least the required level for a module. */
  hasAccess: (moduleId: string, required: ModuleAccessLevel) => boolean;
  /** Raw access map from the server. */
  access: Record<string, ModuleAccessLevel> | null;
  /** Whether the query is still loading. */
  loading: boolean;
}

const RANK: Record<ModuleAccessLevel, number> = { view: 0, comment: 1, edit: 2 };

/**
 * Returns the current user's per-module access levels.
 *
 * Example:
 *   const { hasAccess } = useModuleAccess();
 *   if (!hasAccess("finance", "edit")) { /* hide the submit button *\/ }
 */
export function useModuleAccess(): ModuleAccessResult {
  const { data, isLoading } = trpc.modulePermissions.myAccess.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000, // cache for 5 min — permissions change rarely
      refetchOnWindowFocus: false,
    },
  );

  const access = data?.access ?? null;

  const getAccess = (moduleId: string): ModuleAccessLevel | null => {
    if (!access) return null;
    return (access[moduleId] as ModuleAccessLevel) ?? "view";
  };

  const hasAccess = (moduleId: string, required: ModuleAccessLevel): boolean => {
    if (!access) return false;
    const actual = (access[moduleId] as ModuleAccessLevel) ?? "view";
    return RANK[actual] >= RANK[required];
  };

  return { getAccess, hasAccess, access, loading: isLoading };
}
