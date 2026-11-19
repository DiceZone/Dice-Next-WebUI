export interface ImageHostConf {
  mode?: string;
  provider?: string;
  api_key?: string;
  url?: string;
  file_field?: string;
  result_path?: string;
  public_base?: string;
  headers?: string[];
  extra_fields?: Record<string, string>;
}

// Provider API references are linked in the image-host documentation.
export const imageHostPresets = {
  imgbb: { name: 'ImgBB', url: 'https://api.imgbb.com/1/upload', file_field: 'image', result_path: 'data.url', placeholder: 'https://api.imgbb.com/1/upload' },
  lsky: { name: 'Lsky Pro', url: '', file_field: 'file', result_path: 'data.links.url', placeholder: 'https://your-imagehost/api/v1/upload' },
  chevereto: { name: 'Chevereto', url: '', file_field: 'source', result_path: 'image.url', placeholder: 'https://your-imagehost/api/1/upload' },
} as const;

export function imageHostProvider(config: ImageHostConf): string {
  if (config.provider === 'custom' || Object.prototype.hasOwnProperty.call(imageHostPresets, config.provider || '')) return config.provider!;
  // Never infer a provider from an existing custom URL and overwrite its fields.
  return config.url ? 'custom' : '';
}

export function selectImageHostProvider(config: ImageHostConf, provider: string): ImageHostConf {
  if (provider === 'custom') return { ...config, provider, api_key: '' };
  const preset = imageHostPresets[provider as keyof typeof imageHostPresets];
  if (!preset) return config;
  // Credentials/extra fields for one host must never follow a new host.
  return { ...config, provider, url: preset.url, file_field: preset.file_field,
    result_path: preset.result_path, api_key: '', headers: [], extra_fields: {} };
}
