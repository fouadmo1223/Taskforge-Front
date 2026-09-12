import { useMutation } from '@tanstack/react-query';
import type { AuthUser, Locale, ThemePreference } from '@flowdesk/types';
import { api } from '@/lib/api/client';
import { useAuth } from './auth.store';

export function useUpdateProfile() {
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: (body: Partial<{ name: string; locale: Locale; theme: ThemePreference; timezone: string | null }>) =>
      api.patch<AuthUser>('/users/me', body),
    onSuccess: setUser,
  });
}

export function useUploadAvatar() {
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post<AuthUser>('/users/me/avatar', fd);
    },
    onSuccess: setUser,
  });
}

export function useRemoveAvatar() {
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: () => api.delete<AuthUser>('/users/me/avatar'),
    onSuccess: setUser,
  });
}
