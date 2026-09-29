export interface HelpFile { name: string; content: string; }

export function validHelpName(name: string): boolean {
  return !!name.trim() && name === name.trim() && !/[\\/\x00-\x1f]/.test(name) && name !== '.' && name !== '..';
}

/** Validate the whole bundle before any request; never silently drop entries. */
export function parseHelpImport(filename: string, text: string): HelpFile[] {
  let files: HelpFile[];
  if (/\.json$/i.test(filename)) {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('help_invalid_import');
    if (Array.isArray(data)) {
      files = data.map((item) => {
        if (!item || typeof item !== 'object') throw new Error('help_invalid_import');
        return { name: item.name ?? item.key, content: item.content };
      });
    } else files = Object.entries(data).map(([name, content]) => ({ name, content: content as string }));
  } else if (/\.(md|txt)$/i.test(filename)) files = [{ name: filename.replace(/\.(md|txt)$/i, ''), content: text }];
  else throw new Error('help_invalid_import');
  const names = new Set<string>();
  if (!files.length) throw new Error('help_invalid_import');
  for (const file of files) {
    if (typeof file.name !== 'string' || !validHelpName(file.name) || typeof file.content !== 'string' || names.has(file.name)) throw new Error('help_invalid_import');
    names.add(file.name);
  }
  return files;
}
