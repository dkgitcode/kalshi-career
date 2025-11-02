declare module "html-to-image" {
  export function toBlob(node: HTMLElement, options?: { pixelRatio?: number }): Promise<Blob | null>
}


