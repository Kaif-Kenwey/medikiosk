"use client"

// Audio guidance using the browser's built-in speech synthesis
// (works offline, no API needed). Silently no-ops when unavailable.

export function speak(text: string, lang: string = "hi-IN") {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = 0.95
    window.speechSynthesis.speak(utter)
  } catch {
    // audio guidance unavailable — ignore silently
  }
}

export function stopSpeaking() {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
  } catch {
    // ignore
  }
}

export const SPEAK_LANG: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
}
