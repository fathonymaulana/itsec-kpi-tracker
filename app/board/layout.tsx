import { AuthProvider } from '@/lib/auth'

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
