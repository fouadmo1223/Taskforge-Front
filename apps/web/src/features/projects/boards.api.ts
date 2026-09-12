import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface BoardView {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  rank: string;
  archived: boolean;
}

export function useProjectBoards(workspaceId: string, projectId: string | undefined) {
  return useQuery({
    queryKey: ['boards', workspaceId, projectId],
    queryFn: () => api.get<BoardView[]>(`/workspaces/${workspaceId}/projects/${projectId}/boards`),
    enabled: Boolean(projectId),
  });
}
