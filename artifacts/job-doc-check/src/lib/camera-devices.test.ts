import { describe, expect, it } from "vitest"
import { cameraLabel, cameraScore, DarkFrameDetector, DARK_STREAK, meanLuminance, pickPreferredCamera } from "./camera-devices"

// 실제 문제가 된 PC의 장치 구성 (캡처 보드가 맨 앞이라 브라우저 기본값이 검은 화면이었다)
const devices = [
  { deviceId: "capture", label: "USB3. 0 capture (534d:2109)" },
  { deviceId: "animaze", label: "Animaze Virtual Camera" },
  { deviceId: "webcam", label: "GENERAL WEBCAM (1bcf:2284)" },
]

describe("pickPreferredCamera", () => {
  it("prefers a real webcam over capture cards and virtual cameras", () => {
    expect(pickPreferredCamera(devices)).toBe("webcam")
  })

  it("keeps the camera the user chose before, if it is still connected", () => {
    expect(pickPreferredCamera(devices, "animaze")).toBe("animaze")
    expect(pickPreferredCamera(devices, "unplugged")).toBe("webcam")
  })

  it("falls back to the first device when names are unknown, and handles no devices", () => {
    expect(pickPreferredCamera([{ deviceId: "a", label: "" }, { deviceId: "b", label: "" }])).toBe("a")
    expect(pickPreferredCamera([])).toBeNull()
  })

  it("scores common names", () => {
    expect(cameraScore("OBS Virtual Camera")).toBe(0)
    expect(cameraScore("Elgato Cam Link 4K")).toBe(0)
    expect(cameraScore("Integrated Camera")).toBe(2)
    expect(cameraScore("Logitech BRIO")).toBe(2)
    expect(cameraScore("Some Device")).toBe(1)
  })

  it("labels unnamed devices by position", () => {
    expect(cameraLabel({ deviceId: "x", label: "" }, 1)).toBe("카메라 2")
    expect(cameraLabel(devices[2], 2)).toBe("GENERAL WEBCAM (1bcf:2284)")
  })
})

describe("dark frame detection", () => {
  const rgba = (v: number, pixels = 4) => Array.from({ length: pixels * 4 }, (_, i) => (i % 4 === 3 ? 255 : v))

  it("measures mean luminance", () => {
    expect(meanLuminance(rgba(0))).toBe(0)
    expect(meanLuminance(rgba(200))).toBeCloseTo(200)
  })

  it("reports dark only after several dark frames in a row and recovers on a bright frame", () => {
    const d = new DarkFrameDetector()
    for (let i = 1; i < DARK_STREAK; i++) expect(d.add(0)).toBe(false)
    expect(d.add(0)).toBe(true)
    expect(d.add(120)).toBe(false)
    expect(d.add(0)).toBe(false)
  })
})
