import { describe, expect, it } from 'vitest';
import { imageHostProvider, selectImageHostProvider } from '../../src/lib/image-host-presets';

describe('image-host presets', () => {
  it('keeps old custom settings and requires a choice for a new host', () => {
    expect(imageHostProvider({})).toBe('');
    expect(imageHostProvider({ url: 'https://custom.example/upload', headers: ['Authorization: old'] })).toBe(
      'custom',
    );
  });
  it('sets provider fields and clears credentials when switching hosts', () => {
    const old = {
      mode: 'generic',
      url: 'https://old.example/upload',
      api_key: 'old-secret',
      headers: ['Authorization: old'],
      extra_fields: { key: 'old' },
    };
    const next = selectImageHostProvider(old, 'imgbb');
    expect(next).toMatchObject({
      provider: 'imgbb',
      url: 'https://api.imgbb.com/1/upload',
      file_field: 'image',
      result_path: 'data.url',
      api_key: '',
      headers: [],
      extra_fields: {},
    });
    expect(selectImageHostProvider(next, 'lsky')).toMatchObject({
      url: '',
      file_field: 'file',
      result_path: 'data.links.url',
    });
    expect(selectImageHostProvider(next, 'chevereto')).toMatchObject({
      url: '',
      file_field: 'source',
      result_path: 'image.url',
    });
    expect(old.api_key).toBe('old-secret');
  });
});
