// Mỗi lần start() huỷ request trước đó; isCurrent() chặn response về muộn ghi đè state mới.
export class LatestOnly {
  private seq = 0
  private controller: AbortController | null = null

  start() {
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    const id = ++this.seq
    return { signal: controller.signal, isCurrent: () => id === this.seq }
  }

  cancel() {
    this.controller?.abort()
    this.controller = null
    this.seq++
  }
}
