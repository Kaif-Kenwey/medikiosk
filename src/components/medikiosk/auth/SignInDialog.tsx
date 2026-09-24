"use client"

// ============================================================
// MediKiosk — Sign-in dialog (JWT/RBAC)
// Kiosk devices are auto-authenticated; frontline/doctor/admin
// sign in with a facility PIN. Demo PINs are openly displayed —
// this is a prototype demonstrating the RBAC architecture.
// ============================================================

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import type { Role } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Building2, HeartPulse, KeyRound, Loader2, Stethoscope, User } from "lucide-react"

const IDENTITIES: {
  role: Role
  title: string
  name: string
  pin: string | null
  icon: React.ReactNode
}[] = [
  { role: "kiosk", title: "Kiosk · Patient", name: "Kiosk Device", pin: null, icon: <User className="h-4 w-4" /> },
  { role: "frontline", title: "Frontline Worker", name: "ANM Sunita Sharma", pin: "1234", icon: <HeartPulse className="h-4 w-4" /> },
  { role: "doctor", title: "Medical Officer", name: "Dr. A. Prasad", pin: "2345", icon: <Stethoscope className="h-4 w-4" /> },
  { role: "admin", title: "Facility Administrator", name: "Facility Admin", pin: "3456", icon: <Building2 className="h-4 w-4" /> },
]

export default function SignInDialog() {
  const {
    authDialogOpen,
    authDialogPreset,
    closeAuthDialog,
    signIn,
    session,
  } = useAppStore()
  const [selected, setSelected] = useState<Role>(authDialogPreset ?? "frontline")
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [appliedPreset, setAppliedPreset] = useState<Role | null>(authDialogPreset)

  // Keep the selection in sync when the dialog is opened with a preset role
  // (setState-during-render is React's documented prop-derived adjustment)
  if (authDialogOpen && authDialogPreset && authDialogPreset !== appliedPreset) {
    setAppliedPreset(authDialogPreset)
    setSelected(authDialogPreset)
    setPin("")
  }

  // Any 401/403 from the API layer opens this dialog automatically
  useEffect(() => {
    const onAuthRequired = () => {
      useAppStore.getState().openAuthDialog()
    }
    window.addEventListener("mk-auth-required", onAuthRequired)
    return () => window.removeEventListener("mk-auth-required", onAuthRequired)
  }, [])

  const identity = IDENTITIES.find((i) => i.role === selected)!

  const submit = async () => {
    setBusy(true)
    const ok = await signIn(selected, selected === "kiosk" ? undefined : pin)
    setBusy(false)
    if (ok) {
      setPin("")
      // Land the user on their role home after elevation
      const { navigate, role } = useAppStore.getState()
      if (role === "frontline") navigate("intake")
      else if (role === "doctor") navigate("doctor")
      else if (role === "admin") navigate("facility")
    }
  }

  return (
    <Dialog open={authDialogOpen} onOpenChange={(open) => !open && closeAuthDialog()}>
      <DialogContent className="sm:max-w-md" aria-describedby="signin-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="h-5 w-5 text-teal-700" aria-hidden /> Sign in to MediKiosk
          </DialogTitle>
          <DialogDescription id="signin-desc">
            Kiosk devices are pre-authenticated. Staff roles sign in with a facility PIN — every
            action is then attributed in the audit trail (JWT session · RBAC enforced on the server).
            {session && (
              <span className="mt-1 block font-medium text-teal-700">
                Current session: {session.name} ({session.role})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {IDENTITIES.map((i) => (
              <button
                key={i.role}
                type="button"
                onClick={() => {
                  setSelected(i.role)
                  setPin("")
                }}
                aria-pressed={selected === i.role}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                  selected === i.role
                    ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                    : "border-border bg-card hover:border-teal-300"
                }`}
              >
                <span className="mt-0.5 text-teal-700">{i.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{i.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{i.name}</span>
                  {i.pin ? (
                    <span className="mt-0.5 block font-mono text-[11px] text-teal-700">
                      Demo PIN: {i.pin}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">No PIN needed</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {identity.pin && (
            <div className="space-y-1.5">
              <Label htmlFor="mk-pin" className="text-sm">
                Facility PIN
              </Label>
              <Input
                id="mk-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && void submit()}
                placeholder={`Enter PIN for ${identity.title.toLowerCase()}`}
                className="h-11 text-base tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Demo PIN shown on the identity card — production deployments use hashed credentials.
              </p>
            </div>
          )}

          <Button
            type="button"
            disabled={busy || (!!identity.pin && !pin.trim())}
            onClick={() => void submit()}
            className="h-12 w-full bg-teal-600 text-base font-semibold text-white hover:bg-teal-700"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
