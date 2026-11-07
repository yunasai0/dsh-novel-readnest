export const isDshReader = () => Boolean(process.env['NEXT_PUBLIC_DSH_READER_PATH']);

export const withDshReaderBasePath = (path: string) =>
  `${process.env['NEXT_PUBLIC_DSH_READER_PATH'] ?? ''}${path}`;

export const getDshReaderFullscreenRoot = () => {
  if (!isDshReader() || typeof window === 'undefined') return undefined;
  const root = window.frameElement?.parentElement;
  return root?.hasAttribute('data-dsh-reader-root') ? root : undefined;
};
