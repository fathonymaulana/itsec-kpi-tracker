import { AuthProvider } from '@/lib/auth'

export default function DeptLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
