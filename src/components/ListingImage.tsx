import { useEffect, useMemo, useRef, useState } from 'react';
import { buildImageUrlFromId } from '@/lib/utils';

type Loader = (id: string) => Promise<string | Blob | undefined>;

export type ListingImageProps = {
  id?: string | null;
  alt: string;
  className?: string;
  /**
   * Optional async loader; defaults to buildImageUrlFromId.
   * Must resolve to a URL string or a Blob/File. Blobs are object-URLed.
   */
  loader?: Loader;
  /**
   * Optional placeholder to render while loading or if no image.
   */
  fallback?: React.ReactNode;
  /**
   * Optional placeholder to render when loading fails.
   */
  errorFallback?: React.ReactNode;
};

export default function ListingImage({
  id,
  alt,
  className = 'w-full h-40 object-cover',
  loader,
  fallback,
  errorFallback,
}: ListingImageProps) {
  const [src, setSrc] = useState<string | undefined>();
  const [err, setErr] = useState<unknown>(null);

  const activeObjectUrl = useRef<string | null>(null);

  // choose loader once
  const load: Loader = useMemo(
    () => loader ?? (async (imageId: string) => buildImageUrlFromId(imageId)),
    [loader]
  );

  useEffect(() => {
    let alive = true;

    const run = async () => {
      // cleanup any previous object URL
      if (activeObjectUrl.current) {
        URL.revokeObjectURL(activeObjectUrl.current);
        activeObjectUrl.current = null;
      }

      if (!id) {
        if (alive) {
          setSrc(undefined);
          setErr(null);
        }
        return;
      }

      try {
        const res = await load(id);
        if (!alive) return;

        if (!res) {
          setSrc(undefined);
          setErr(null);
          return;
        }

        if (typeof res === 'string') {
          setSrc(res);
          setErr(null);
          return;
        }

        // Blob/File support
        const objectUrl = URL.createObjectURL(res);
        activeObjectUrl.current = objectUrl;
        setSrc(objectUrl);
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setSrc(undefined);
        setErr(e);
      }
    };

    void run();

    return () => {
      alive = false;
      if (activeObjectUrl.current) {
        URL.revokeObjectURL(activeObjectUrl.current);
        activeObjectUrl.current = null;
      }
    };
  }, [id, load]);

  if (!src) {
    if (err) {
      return (
        <>
          {errorFallback ?? (
            <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
              Image failed to load
            </div>
          )}
        </>
      );
    }
    return (
      <>
        {fallback ?? (
          <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}
      </>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}