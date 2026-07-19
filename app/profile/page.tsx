'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ClockCircleLineDuotone as Clock,
  ShieldCheckLineDuotone as ShieldCheck,
  AltArrowRightLineDuotone as ChevronRight,
  RestartLineDuotone as ResetIcon,
  GalleryLineDuotone as ChooseIcon,
  LogoutLineDuotone as LogOutIcon,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { CrossfadeSwap } from '@/components/ui/crossfade-swap'
import { SuccessMorph } from '@/components/ui/success-morph'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

// 168px avatar frame — ring sits just outside it. circumference = 2πr, r = 84.
const AVATAR_RING_R = 84
const AVATAR_RING_CIRCUMFERENCE = 2 * Math.PI * AVATAR_RING_R

interface Profile {
  id: number
  name: string
  avatar_url: string | null
  role: string
  dept_name: string | null
  pending_pin_request: { id: number; status: string; requested_at: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  dept_head: 'Department Head',
  corp_planning: 'Corporate Planning',
}

export default function ProfilePage() {
  const { user, token, ready, refreshUser, logout } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [resettingAvatar, setResettingAvatar] = useState(false)
  const [submittingPin, setSubmittingPin] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
  }, [user, router, ready])

  const fetchProfile = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const r = await fetch('/api/users/me', { headers: authHeaders(token) })
      const data = await r.json()
      setProfile(data)
      setName(data.name || '')
    } catch { toast.error('Couldn’t load your profile', { description: 'Please refresh the page.' }) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (user) fetchProfile() }, [user, fetchProfile])

  const handleAvatarPick = () => fileInputRef.current?.click()

  // XMLHttpRequest (not fetch) specifically for its upload.onprogress event — fetch has no simple
  // equivalent — so the ring around the avatar tracks the actual upload percentage, not a fake timer.
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingAvatar(true)
    setUploadProgress(0)
    try {
      const form = new FormData()
      form.append('file', file)
      const avatarUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/users/me/avatar')
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
        }
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300) resolve(data.avatar_url)
            else reject(new Error(data.error || 'Upload failed'))
          } catch {
            reject(new Error('Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(form)
      })
      setUploadProgress(100)
      refreshUser({ avatar_url: avatarUrl })
      await fetchProfile()
      toast.success('Avatar updated', { description: 'Looking good — your new photo is live.' })
    } catch (err) {
      toast.error('Couldn’t upload that image', { description: err instanceof Error ? err.message : 'Please try a different file.' })
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleResetAvatar = async () => {
    if (!token) return
    setResettingAvatar(true)
    try {
      const r = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: null }),
      })
      if (!r.ok) throw new Error('Reset failed')
      refreshUser({ avatar_url: null })
      await fetchProfile()
      toast.success('Profile picture reset')
    } catch {
      toast.error('Couldn’t reset your profile picture', { description: 'Please try again.' })
    } finally {
      setResettingAvatar(false)
    }
  }

  const handleLogout = () => {
    const firstName = user?.name?.split(' ')[0]
    logout()
    router.push('/login')
    toast.success('Signed out', { description: firstName ? `See you soon, ${firstName}.` : 'You’ve been signed out safely.' })
  }

  const handleSaveName = async () => {
    if (!token || !name.trim()) return
    setSavingName(true)
    try {
      const r = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!r.ok) throw new Error('Save failed')
      refreshUser({ name: name.trim() })
      toast.success('Name updated')
    } catch {
      toast.error('Couldn’t update your name', { description: 'Please try again.' })
    } finally {
      setSavingName(false)
    }
  }

  const handleSubmitPin = async () => {
    if (!token || newPin.length !== 4) return
    setSubmittingPin(true)
    try {
      const r = await fetch('/api/users/me/pin-request', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_pin: newPin }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Request failed')
      setNewPin('')
      await fetchProfile()
      toast.success('PIN change requested', { description: 'Your current PIN still works until Corporate Planning approves the change.' })
    } catch (err) {
      toast.error('Couldn’t submit that request', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSubmittingPin(false)
    }
  }

  if (!ready || !user) return <PageSkeleton leftAside={false} rightAside={false} />

  const homeHref = user.role === 'dept_head' ? '/dept/dashboard' : '/board'

  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <DeptTopNav />

      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-6 py-8">
        <div className="max-w-xl mx-auto w-full space-y-4">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={homeHref} className="text-ink-muted hover:text-ink">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight size={14} className="text-ink-faint" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-ink">Profile</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Profile</h1>
            <p className="text-sm text-ink-muted mt-1">Manage your display name, avatar, and PIN.</p>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setConfirmLogout(true)}
            className="text-danger border-danger-soft-border hover:bg-danger-soft shrink-0"
          >
            <LogOutIcon size={15} className="mr-1.5" />
            Sign Out
          </Button>
        </div>

        <CrossfadeSwap
          show={!loading}
          skeleton={
            <div className="space-y-4">
              <div className="h-40 bg-panel border border-divider rounded-3xl animate-pulse" />
              <div className="h-40 bg-panel border border-divider rounded-3xl animate-pulse" />
            </div>
          }
        >
          {profile && (
          <div className="space-y-4">
            {/* Profile card */}
            <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl p-6">
              <h2 className="font-medium text-ink text-sm mb-4">Profile</h2>

              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative size-[176px] flex items-center justify-center">
                  {uploadingAvatar && (
                    <svg
                      className="absolute inset-0 -rotate-90"
                      width={176}
                      height={176}
                      viewBox="0 0 176 176"
                    >
                      <circle cx={88} cy={88} r={AVATAR_RING_R} fill="none" stroke="var(--divider)" strokeWidth={3} />
                      <circle
                        cx={88}
                        cy={88}
                        r={AVATAR_RING_R}
                        fill="none"
                        stroke="#CC1F1F"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={AVATAR_RING_CIRCUMFERENCE}
                        strokeDashoffset={AVATAR_RING_CIRCUMFERENCE * (1 - uploadProgress / 100)}
                        className="transition-[stroke-dashoffset] duration-150 ease-out"
                      />
                    </svg>
                  )}
                  <Avatar className="size-[168px]">
                    {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.name} />}
                    <AvatarFallback className="text-3xl">{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
                </div>

                <div className="text-center">
                  <div className="text-xs text-ink-muted">{ROLE_LABELS[profile.role] || profile.role}</div>
                  {profile.dept_name && <div className="text-xs text-ink-faint">{profile.dept_name}</div>}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={uploadingAvatar || resettingAvatar || !profile.avatar_url}
                    onClick={handleResetAvatar}
                  >
                    <ResetIcon size={15} className="mr-1.5" />
                    {resettingAvatar ? 'Resetting…' : 'Reset profile picture'}
                  </Button>
                  <Button
                    size="lg"
                    disabled={uploadingAvatar || resettingAvatar}
                    onClick={handleAvatarPick}
                  >
                    <ChooseIcon size={15} className="mr-1.5" />
                    {uploadingAvatar ? `Uploading… ${uploadProgress}%` : 'Choose profile picture'}
                  </Button>
                </div>
              </div>

              <label className="block text-xs font-medium text-ink-soft mb-1.5">Display Name</label>
              <div className="flex gap-2">
                <Input value={name} onChange={e => setName(e.target.value)} className="h-10 rounded-lg text-sm flex-1" />
                <Button
                  size="lg"
                  disabled={savingName || !name.trim() || name.trim() === profile.name}
                  onClick={handleSaveName}
                >
                  <SuccessMorph stateKey={savingName ? 'saving' : 'idle'}>
                    {savingName ? 'Saving…' : 'Save'}
                  </SuccessMorph>
                </Button>
              </div>
            </div>

            {/* Password card */}
            <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl p-6">
              <h2 className="font-medium text-ink text-sm mb-1">Password</h2>
              <p className="text-xs text-ink-muted mb-4">Changing your PIN requires Corporate Planning&apos;s approval — your current PIN keeps working until then.</p>

              {profile.pending_pin_request ? (
                <div className="flex items-start gap-2 bg-warning-soft border border-warning-soft-border rounded-lg px-3 py-2.5">
                  <Badge variant="warning" className="h-auto px-2 py-0.5 text-[10px] shrink-0 mt-0.5">
                    <Clock size={11} />
                    Pending
                  </Badge>
                  <p className="text-xs text-warning">
                    Waiting on Corporate Planning&apos;s approval — requested {new Date(profile.pending_pin_request.requested_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-ink-soft mb-1.5">New 4-Digit PIN</label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={newPin}
                      onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="• • • •"
                      className="h-10 rounded-lg text-sm flex-1 text-center tracking-widest"
                    />
                    <Button
                      size="lg"
                      disabled={submittingPin || newPin.length !== 4}
                      onClick={handleSubmitPin}
                      className="shrink-0"
                    >
                      <SuccessMorph stateKey={submittingPin ? 'submitting' : 'idle'}>
                        <ShieldCheck size={13} className="mr-1" />
                        {submittingPin ? 'Submitting…' : 'Request Change'}
                      </SuccessMorph>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </CrossfadeSwap>
        </div>
      </main>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Sign out?"
        description="You'll need your PIN again to sign back in."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={handleLogout}
      />
    </div>
  )
}
