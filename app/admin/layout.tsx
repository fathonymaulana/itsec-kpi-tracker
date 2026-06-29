import { AuthProvider } from '@/lib/auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
