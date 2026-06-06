export interface AssetCreationRecord {
  id: string
  projectId: string
  name: string
  sourceImage: string
  componentHtml: string
  componentCss: string
  renderImage: string | null
  promotedAssetId: string | null
  createdAt: string
  updatedAt: string
}

export interface AssetCreationSummary {
  id: string
  name: string
  sourceImage: string
  renderImage: string | null
  promotedAssetId: string | null
  updatedAt: string
}
