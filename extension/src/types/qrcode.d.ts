declare module 'qrcode' {
  export function toDataURL(text: string): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: any): Promise<void>;
}
